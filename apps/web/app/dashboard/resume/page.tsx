import { adminAuth } from "@/lib/firebase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { supabaseDb } from "@/lib/supabase/database"
import { FileText, Download } from "lucide-react"

export default async function ResumePage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (!session) redirect("/login")

  let decodedClaims = null
  try {
    decodedClaims = await adminAuth.verifySessionCookie(session, true)
  } catch (error) {
    redirect("/login")
  }

  const { data: profile } = await supabaseDb
    .from("profiles")
    .select("id")
    .eq("user_id", decodedClaims.uid)
    .single()

  if (!profile) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Profile Not Found</h2>
          <p className="text-muted-foreground">Please complete the onboarding process.</p>
        </div>
      </div>
    )
  }

  const { data: resumes } = await supabaseDb
    .from("resumes")
    .select("*")
    .eq("profile_id", profile.id)
    .order("uploaded_at", { ascending: false })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Resumes</h2>
        <p className="text-muted-foreground">Manage your uploaded resumes.</p>
      </div>

      <div className="border rounded-lg divide-y">
        {resumes?.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">
            No resumes found.
          </div>
        )}
        {resumes?.map((resume: any) => {
          // get public url for download
          const { data: publicUrlData } = supabaseDb.storage
            .from("resumes")
            .getPublicUrl(resume.file_path)

          return (
            <div key={resume.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{resume.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <a
                href={publicUrlData.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-accent rounded-md transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
