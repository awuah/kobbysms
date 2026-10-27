import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendBulkSMS, sanitizePhoneNumber } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let createdCampaignId: string | null = null;
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
      // Note: Supabase has a default server limit of 1,000 rows per query.
      // We count total matching rows and fetch all pages concurrently so all constituents are reached.
      let countQuery = supabaseAdmin
        .from("ks_constituents")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (target_type === "localities" && target_localities.length > 0) {
        countQuery = countQuery.in("electoral_area", target_localities);
      }

      const { count: totalMatching, error: countErr } = await countQuery;
      if (countErr) {
        return NextResponse.json({ error: countErr.message }, { status: 500 });
      }

      const totalCount = totalMatching || 0;
      const PAGE_SIZE = 1000;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);

      const pageIndexes = Array.from({ length: totalPages }, (_, i) => i);
      const CONCURRENCY = 6;
      const allRows: any[] = [];

      for (let i = 0; i < pageIndexes.length; i += CONCURRENCY) {
        const batch = pageIndexes.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map((pageIdx) => {
          const from = pageIdx * PAGE_SIZE;
          let q = supabaseAdmin
            .from("ks_constituents")
            .select("first_name, last_name, phone_number, electoral_area")
            .eq("is_active", true)
            .range(from, from + PAGE_SIZE - 1);

          if (target_type === "localities" && target_localities.length > 0) {
            q = q.in("electoral_area", target_localities);
          }
          return q;
        });

        const batchResults = await Promise.all(batchPromises);
        for (const res of batchResults) {
          if (res.data) {
            allRows.push(...res.data);
          }
        }
      }

      targetRecipients = allRows
        .map((c) => ({
          phone: sanitizePhoneNumber(c.phone_number),
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Constituent",
          locality: c.electoral_area,
        }))
        .filter((item) => item.phone.length >= 9);

      // De-duplicate recipients by phone number
      const seenPhones = new Set<string>();
      targetRecipients = targetRecipients.filter((r) => {
        if (!r.phone || seenPhones.has(r.phone)) return false;
        seenPhones.add(r.phone);
        return true;
      });
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

    createdCampaignId = campaign.id;

    // 3. Dispatch SMS messages via Arkesel v2 Bulk Gateway
    const callbackUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/callback`
      : "https://sms.kobbydogood.org/api/sms/callback";

    const bulkResult = await sendBulkSMS(
      targetRecipients.map((r) => ({ phone: r.phone, name: r.name })),
      message.trim(),
      sender_id || "KOBBYMP",
      callbackUrl
    );

    // 4. Batch insert into ks_sms_logs for auditing
    const logsToInsert = targetRecipients.map((target, idx) => {
      const res = bulkResult.results[idx] || { success: false, statusText: "No response" };
      return {
        campaign_id: campaign.id,
        recipient_name: target.name,
        phone_number: target.phone,
        electoral_area: target.locality || "Takoradi",
        message: message.trim(),
        sender_id: sender_id || "KOBBYMP",
        status: res.success ? "sent" : "failed",
        gateway_response: res,
        error_message: res.error || null,
      };
    });

    // Chunk log inserts to prevent payload limits
    const CHUNK_SIZE = 200;
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

    // Safeguard: Mark campaign as failed so it never stays stuck in "sending"
    if (createdCampaignId) {
      try {
        await supabaseAdmin
          .from("ks_campaigns")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", createdCampaignId);
      } catch (updateErr) {
        console.error("Failed to mark campaign as failed:", updateErr);
      }
    }

    return NextResponse.json({ error: err.message || "Failed to broadcast SMS" }, { status: 500 });
  }
}
