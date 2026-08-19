"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function OnboardingDialog({ open }: { open: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a resume file first.")
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append("resume", file)

    try {
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to upload")
      }

      toast.success("Resume uploaded and parsed successfully!")
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}> 
      {/* onOpenChange empty and hidden close button prevents closing */}
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Welcome to Prsnl Pro!</DialogTitle>
          <DialogDescription>
            To get started, please upload your resume. We will automatically parse it and set up your profile.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          <Input 
            id="resume" 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isUploading}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? "Uploading & Parsing..." : "Upload Resume"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
