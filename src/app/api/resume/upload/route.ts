import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromResume, parseResumeText } from "@/lib/resume-parser";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No resume file provided" },
        { status: 400 }
      );
    }

    // 1. Ensure Profile Exists
    let { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile, error: createProfileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          email: user.email,
          first_name: user.user_metadata?.full_name?.split(" ")[0] || "",
          last_name: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
        })
        .select()
        .single();

      if (createProfileError || !newProfile) {
        throw new Error(createProfileError?.message || "Failed to create profile record");
      }
      profile = newProfile;
    }

    if (!profile) {
      throw new Error("Unable to establish profile session");
    }

    const currentProfile = profile;


    // 2. Upload file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}_${sanitizedFileName}`;

    const { error: storageError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // 3. Insert record into public.resumes
    const { data: resumeRecord, error: resumeError } = await supabase
      .from("resumes")
      .insert({
        profile_id: currentProfile.id,
        file_path: storagePath,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (resumeError) {
      console.warn("Failed to record resume entry:", resumeError);
    }

    // 4. Extract Text and Parse Resume
    const rawText = await extractTextFromResume(
      fileBuffer,
      file.type,
      file.name
    );

    const parsedData = await parseResumeText(rawText, user.email || "");

    // 5. Update Profile
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        first_name: parsedData.profile.first_name || currentProfile.first_name,
        last_name: parsedData.profile.last_name || currentProfile.last_name,
        phone: parsedData.profile.phone || null,
        location: parsedData.profile.location || null,
        summary: parsedData.profile.summary || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentProfile.id);

    if (profileUpdateError) {
      console.warn("Profile update warning:", profileUpdateError);
    }

    // 6. Delete old parsed items to prevent stale duplicates on new resume upload
    await Promise.all([
      supabase.from("skills").delete().eq("profile_id", currentProfile.id),
      supabase.from("experiences").delete().eq("profile_id", currentProfile.id),
      supabase.from("educations").delete().eq("profile_id", currentProfile.id),
      supabase.from("projects").delete().eq("profile_id", currentProfile.id),
      supabase.from("certifications").delete().eq("profile_id", currentProfile.id),
      supabase.from("links").delete().eq("profile_id", currentProfile.id),
    ]);

    // 7. Insert Extracted Skills
    if (parsedData.skills.length > 0) {
      const skillsRows = parsedData.skills.map((skill_name) => ({
        profile_id: currentProfile.id,
        skill_name: skill_name.trim(),
      }));
      await supabase.from("skills").insert(skillsRows);
    }

    // 8. Insert Extracted Experiences
    if (parsedData.experiences.length > 0) {
      const expRows = parsedData.experiences.map((exp) => ({
        profile_id: currentProfile.id,
        company_name: exp.company_name,
        job_title: exp.job_title,
        duration: exp.duration,
        responsibilities: exp.responsibilities,
      }));
      await supabase.from("experiences").insert(expRows);
    }

    // 9. Insert Extracted Educations
    if (parsedData.educations.length > 0) {
      const eduRows = parsedData.educations.map((edu) => ({
        profile_id: currentProfile.id,
        institution: edu.institution,
        degree: edu.degree,
        field_of_study: edu.field_of_study,
        duration: edu.duration,
      }));
      await supabase.from("educations").insert(eduRows);
    }

    // 10. Insert Extracted Projects
    if (parsedData.projects.length > 0) {
      const projRows = parsedData.projects.map((proj) => ({
        profile_id: currentProfile.id,
        project_name: proj.project_name,
        description: proj.description,
        link: proj.link || null,
      }));
      await supabase.from("projects").insert(projRows);
    }

    // 11. Insert Extracted Certifications
    if (parsedData.certifications.length > 0) {
      const certRows = parsedData.certifications.map((cert) => ({
        profile_id: currentProfile.id,
        certification_name: cert.certification_name,
        issuer: cert.issuer || null,
      }));
      await supabase.from("certifications").insert(certRows);
    }

    // 12. Insert Extracted Links
    if (parsedData.links.length > 0) {
      const linkRows = parsedData.links.map((lnk) => ({
        profile_id: currentProfile.id,
        url_type: lnk.url_type,
        url: lnk.url,
      }));
      await supabase.from("links").insert(linkRows);
    }


    return NextResponse.json({
      success: true,
      data: parsedData,
      resume: resumeRecord,
    });
  } catch (error: unknown) {
    console.error("Resume processing error:", error);
    const message = error instanceof Error ? error.message : "Failed to process resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
