import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reparseResume } from "@/lib/resume/reparse";

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

    const result = await reparseResume(user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to reparse resume" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal reparse error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
