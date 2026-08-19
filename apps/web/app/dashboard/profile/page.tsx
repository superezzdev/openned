import { adminAuth } from "@/lib/firebase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { supabaseDb } from "@/lib/supabase/database"
import { ProfileForm } from "@/components/profile-form"

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (!session) redirect("/login")

  let decodedClaims = null
  try {
    decodedClaims = await adminAuth.verifySessionCookie(session, true)
  } catch (error) {
    redirect("/login")
  }

  // Fetch all profile data including related tables
  const { data: profile } = await supabaseDb
    .from("profiles")
    .select(`
      *,
      experiences (*),
      educations (*),
      skills (*),
      projects (*),
      certifications (*)
    `)
    .eq("user_id", decodedClaims.uid)
    .single()

  if (!profile) {
    // If somehow they bypassed onboarding or it hasn't finished
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Profile Not Found</h2>
          <p className="text-muted-foreground">Please complete the onboarding process.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
        <p className="text-muted-foreground">Manage your personal and professional information.</p>
      </div>
      <ProfileForm initialData={profile} />
    </div>
  )
}
