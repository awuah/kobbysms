import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: campaigns, error: campErr } = await supabaseAdmin
      .from("ks_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    const { data: recentLogs, error: logErr } = await supabaseAdmin
      .from("ks_sms_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (campErr) {
      return NextResponse.json({ error: campErr.message }, { status: 400 });
    }

    return NextResponse.json({
      campaigns: campaigns || [],
      recentLogs: recentLogs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
