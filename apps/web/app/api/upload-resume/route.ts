import { NextRequest, NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase/server"
import { cookies } from "next/headers"
import { supabaseDb } from "@/lib/supabase/database"
import { GoogleGenAI, Type, Schema } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true)
    const userId = decodedClaims.uid
    const email = decodedClaims.email || ""

    const formData = await req.formData()
    const file = formData.get("resume") as File

    if (!file) {
      return NextResponse.json({ error: "No resume file provided" }, { status: 400 })
    }

    // 1. Convert to Buffer and upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${userId}-${Date.now()}.pdf`
    const filePath = `${userId}/${fileName}`

    const { data: storageData, error: storageError } = await supabaseDb.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (storageError) {
      console.error("Storage error:", storageError)
      return NextResponse.json({ error: "Failed to upload resume" }, { status: 500 })
    }

    // 2. Extract data using Gemini Native PDF support
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        profile: {
          type: Type.OBJECT,
          properties: {
            first_name: { type: Type.STRING },
            last_name: { type: Type.STRING },
            phone: { type: Type.STRING },
            location: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
        },
        experiences: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company_name: { type: Type.STRING },
              job_title: { type: Type.STRING },
              duration: { type: Type.STRING },
              responsibilities: { type: Type.STRING },
            },
          },
        },
        educations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              institution: { type: Type.STRING },
              degree: { type: Type.STRING },
              field_of_study: { type: Type.STRING },
              duration: { type: Type.STRING },
            },
          },
        },
        skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        projects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              project_name: { type: Type.STRING },
              description: { type: Type.STRING },
              link: { type: Type.STRING },
            },
          },
        },
        certifications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              certification_name: { type: Type.STRING },
              issuer: { type: Type.STRING },
            },
          },
        },
        links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              url_type: { type: Type.STRING },
              url: { type: Type.STRING },
            },
          },
        },
      },
    }

    const prompt = `You are an expert ATS resume parser. Extract the requested information from the provided resume PDF.
Follow these rules strictly:
1. Extract first name, last name, phone, and location.
2. If there is an 'About', 'Summary', or 'Objective' section, put it in the summary field.
3. Extract ALL work experiences. Ensure you include the company name, job title, duration, and combine all bullet points into the responsibilities field.
4. Extract ALL education records.
5. Extract ALL skills into a flat array of strings.
6. If any data is missing from the resume, leave it as an empty string.`

    const aiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "application/pdf"
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    })

    const responseText = aiResponse.text || "{}"
    let extractedData: any = {}
    try {
      extractedData = JSON.parse(responseText)
    } catch (e) {
      console.error("Failed to parse AI JSON:", e)
    }

    // 4. Save to Supabase DB
    // 4.a Insert Profile
    const { data: profile, error: profileError } = await supabaseDb
      .from("profiles")
      .insert({
        user_id: userId,
        email: email,
        first_name: extractedData.profile?.first_name || "",
        last_name: extractedData.profile?.last_name || "",
        phone: extractedData.profile?.phone || "",
        location: extractedData.profile?.location || "",
        summary: extractedData.profile?.summary || "",
      })
      .select()
      .single()

    if (profileError) {
      console.error("Profile DB insert error:", profileError)
      // Check if profile already exists, then update it instead
      if (profileError.code === '23505') { // unique violation
         // fallback: just update instead
         await supabaseDb.from('profiles').update({
            first_name: extractedData.profile?.first_name || "",
            last_name: extractedData.profile?.last_name || "",
            phone: extractedData.profile?.phone || "",
            location: extractedData.profile?.location || "",
            summary: extractedData.profile?.summary || "",
         }).eq('user_id', userId)
      } else {
         return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
      }
    }

    // fetch profile again to get ID in case it existed
    const { data: currentProfile } = await supabaseDb
       .from("profiles")
       .select("id")
       .eq("user_id", userId)
       .single()

    const profileId = currentProfile?.id

    if (profileId) {
       // Clear old records to prevent duplicates on re-upload
       await Promise.all([
         supabaseDb.from("experiences").delete().eq("profile_id", profileId),
         supabaseDb.from("educations").delete().eq("profile_id", profileId),
         supabaseDb.from("skills").delete().eq("profile_id", profileId),
         supabaseDb.from("projects").delete().eq("profile_id", profileId),
         supabaseDb.from("certifications").delete().eq("profile_id", profileId),
         supabaseDb.from("links").delete().eq("profile_id", profileId),
       ])
       // Insert Experiences
       if (extractedData.experiences?.length) {
         await supabaseDb.from("experiences").insert(
           extractedData.experiences.map((exp: any) => ({
             profile_id: profileId,
             ...exp,
           }))
         )
       }

       // Insert Educations
       if (extractedData.educations?.length) {
         await supabaseDb.from("educations").insert(
           extractedData.educations.map((edu: any) => ({
             profile_id: profileId,
             ...edu,
           }))
         )
       }

       // Insert Skills
       if (extractedData.skills?.length) {
         await supabaseDb.from("skills").insert(
           extractedData.skills.map((skill: string) => ({
             profile_id: profileId,
             skill_name: skill,
           }))
         )
       }

       // Insert Projects
       if (extractedData.projects?.length) {
         await supabaseDb.from("projects").insert(
           extractedData.projects.map((proj: any) => ({
             profile_id: profileId,
             ...proj,
           }))
         )
       }

       // Insert Certifications
       if (extractedData.certifications?.length) {
         await supabaseDb.from("certifications").insert(
           extractedData.certifications.map((cert: any) => ({
             profile_id: profileId,
             ...cert,
           }))
         )
       }

       // Insert Links
       if (extractedData.links?.length) {
         await supabaseDb.from("links").insert(
           extractedData.links.map((link: any) => ({
             profile_id: profileId,
             ...link,
           }))
         )
       }

       // Record Resume upload
       await supabaseDb.from("resumes").insert({
         profile_id: profileId,
         file_path: filePath,
         file_name: file.name,
       })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
