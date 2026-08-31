import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const sourceFilter = searchParams.get("source");

    let query = supabase
      .from("sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (sourceFilter && sourceFilter !== "all") {
      query = query.eq("source", sourceFilter);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch sync logs" },
      { status: 500 }
    );
  }
}
