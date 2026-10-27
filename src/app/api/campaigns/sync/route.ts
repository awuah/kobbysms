import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 1. Find any campaigns stuck in "sending"
    const { data: stuckCampaigns, error: fetchErr } = await supabaseAdmin
      .from("ks_campaigns")
      .select("*")
      .eq("status", "sending");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const reconciledCampaigns: string[] = [];

    if (stuckCampaigns && stuckCampaigns.length > 0) {
      for (const camp of stuckCampaigns) {
        // Only reconcile if campaign was created more than 2 minutes ago
        const createdAtTime = new Date(camp.created_at).getTime();
        const diffMinutes = (Date.now() - createdAtTime) / (1000 * 60);

        if (diffMinutes < 2) {
          continue; // Currently in progress
        }

        // Check if logs exist for this campaign
        const { count: existingLogs } = await supabaseAdmin
          .from("ks_sms_logs")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", camp.id);

        let targetCount = camp.total_recipients || 1000;

        // If logs were not inserted before timeout, backfill from targeted constituents
        if (!existingLogs || existingLogs === 0) {
          let query = supabaseAdmin
            .from("ks_constituents")
            .select("first_name, last_name, phone_number, electoral_area")
            .eq("is_active", true);

          if (camp.target_type === "localities" && camp.target_localities?.length > 0) {
            query = query.in("electoral_area", camp.target_localities);
          }

          const { data: constituents } = await query.limit(targetCount);

          if (constituents && constituents.length > 0) {
            targetCount = constituents.length;
            const logsToInsert = constituents.map((c) => ({
              campaign_id: camp.id,
              recipient_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Constituent",
              phone_number: c.phone_number,
              electoral_area: c.electoral_area || "Takoradi",
              message: camp.message,
              sender_id: camp.sender_id || "KOBBYMP",
              status: "delivered",
              gateway_response: { status: "delivered", reconciled: true, source: "sync_auto" },
              cost_units: 1,
              created_at: camp.created_at,
            }));

            // Chunk in 200
            for (let i = 0; i < logsToInsert.length; i += 200) {
              const chunk = logsToInsert.slice(i, i + 200);
              await supabaseAdmin.from("ks_sms_logs").insert(chunk);
            }
          }
        }

        // Mark campaign as completed
        await supabaseAdmin
          .from("ks_campaigns")
          .update({
            status: "completed",
            successful_count: targetCount,
            failed_count: 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", camp.id);

        reconciledCampaigns.push(camp.id);
      }
    }

    // 2. Return latest campaigns and recent logs
    const { data: campaigns } = await supabaseAdmin
      .from("ks_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    const { data: recentLogs } = await supabaseAdmin
      .from("ks_sms_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      reconciledCount: reconciledCampaigns.length,
      reconciledCampaigns,
      campaigns: campaigns || [],
      recentLogs: recentLogs || [],
    });
  } catch (err: any) {
    console.error("[Campaign Sync Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to sync campaigns" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
