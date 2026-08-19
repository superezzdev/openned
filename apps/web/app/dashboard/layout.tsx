import { removeSession } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { adminAuth } from "@/lib/firebase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  if (!session) {
    redirect("/login")
  }

  let decodedClaims = null
  try {
    decodedClaims = await adminAuth.verifySessionCookie(session, true)
  } catch (error) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
          <div className="flex items-center space-x-4">
            {/* Mobile sidebar toggle can be added here if needed */}
          </div>
          <div className="flex items-center space-x-4">
            <p className="text-sm font-medium text-muted-foreground hidden sm:block">
              {decodedClaims.email}
            </p>
            <form action={removeSession}>
              <Button variant="outline" size="sm">Sign Out</Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
