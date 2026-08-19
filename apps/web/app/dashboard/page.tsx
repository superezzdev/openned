import { adminAuth } from "@/lib/firebase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (!session) {
    redirect("/login")
  }

  try {
    await adminAuth.verifySessionCookie(session, true)
  } catch (error) {
    redirect("/login")
  }

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Select an option from the sidebar to get started.</p>
      </div>
    </div>
  )
}
