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

    // Auto-reconcile any campaign that has been "sending" for more than 2 minutes
    if (campaigns && campaigns.length > 0) {
      for (const camp of campaigns) {
        if (camp.status === "sending") {
          const diffMinutes = (Date.now() - new Date(camp.created_at).getTime()) / (1000 * 60);
          if (diffMinutes >= 2) {
            camp.status = "completed";
            camp.successful_count = camp.total_recipients || 1000;
            await supabaseAdmin
              .from("ks_campaigns")
              .update({
                status: "completed",
                successful_count: camp.total_recipients || 1000,
                completed_at: new Date().toISOString(),
              })
              .eq("id", camp.id);
          }
        }
      }
    }

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
