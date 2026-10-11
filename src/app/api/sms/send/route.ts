import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendSingleSMS, sendBulkSMS, calculateSMSDetails, sanitizePhoneNumber } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      message,
      target_type = "all", // "all", "localities", "custom"
      target_localities = [], // e.g. ["Airport Ridge", "Zenith"]
      custom_numbers = [], // string array or comma separated
      sender_id = "KOBBYMP",
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "SMS message content is required" }, { status: 400 });
    }

    const campaignTitle = title?.trim() || `MP Message - ${new Date().toLocaleDateString("en-GB")}`;

    // 1. Gather target recipients based on segment criteria
    let targetRecipients: Array<{ phone: string; name: string; locality?: string }> = [];

    if (target_type === "custom") {
      // Direct raw phone numbers entered or pasted
      const rawNumbers = Array.isArray(custom_numbers)
        ? custom_numbers
        : String(custom_numbers)
            .split(/[\n,;]+/)
            .map((s) => s.trim());

      targetRecipients = rawNumbers
        .map((num: string) => ({
          phone: sanitizePhoneNumber(num),
          name: "Constituent",
          locality: "Custom",
        }))
        .filter((item: any) => item.phone.length >= 9);
    } else {
      // Query database based on target_type ("all" or specific localities)
      let query = supabaseAdmin
        .from("ks_constituents")
        .select("first_name, last_name, phone_number, electoral_area")
        .eq("is_active", true);

      if (target_type === "localities" && target_localities.length > 0) {
        query = query.in("electoral_area", target_localities);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      targetRecipients = (data || []).map((c) => ({
        phone: c.phone_number,
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Constituent",
        locality: c.electoral_area,
      }));
    }

    if (targetRecipients.length === 0) {
      return NextResponse.json(
        { error: "No recipients found matching the selected filter criteria" },
        { status: 400 }
      );
    }

    // 2. Create the campaign record in ks_campaigns
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("ks_campaigns")
      .insert({
        title: campaignTitle,
        sender_id: sender_id || "KOBBYMP",
        message: message.trim(),
        target_type,
        target_localities: target_localities,
        total_recipients: targetRecipients.length,
        status: "sending",
        sent_by: "Hon. Kwabena Okyere Darko-Mensah (MP)",
      })
      .select()
      .single();

    if (campErr) {
      return NextResponse.json({ error: campErr.message }, { status: 500 });
    }

    // 3. Dispatch SMS messages
    const bulkResult = await sendBulkSMS(
      targetRecipients.map((r) => ({ phone: r.phone, name: r.name })),
      message.trim(),
      sender_id || "KOBBYMP"
    );

    // 4. Batch insert into ks_sms_logs for auditing
    const logsToInsert = targetRecipients.map((target, idx) => {
      const res = bulkResult.results[idx] || { success: false, statusText: "No response" };
      return {
        campaign_id: campaign.id,
        recipient_name: target.name,
        phone_number: target.phone,
        electoral_area: target.locality || "Other",
        message: message.trim(),
        sender_id: sender_id || "KOBBYMP",
        status: res.success ? "sent" : "failed",
        gateway_response: res,
        error_message: res.error || null,
      };
    });

    // Chunk log inserts to prevent payload limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < logsToInsert.length; i += CHUNK_SIZE) {
      const chunk = logsToInsert.slice(i, i + CHUNK_SIZE);
      await supabaseAdmin.from("ks_sms_logs").insert(chunk);
    }

    // 5. Update campaign status to completed
    await supabaseAdmin
      .from("ks_campaigns")
      .update({
        status: bulkResult.successful > 0 ? "completed" : "failed",
        successful_count: bulkResult.successful,
        failed_count: bulkResult.failed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      total: bulkResult.total,
      successful: bulkResult.successful,
      failed: bulkResult.failed,
    });
  } catch (err: any) {
    console.error("[SMS Broadcast Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to broadcast SMS" }, { status: 500 });
  }
}
