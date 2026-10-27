import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Arkesel Delivery Receipt (DLR) Webhook Receiver
 * Receives delivery report notifications for sent SMS messages
 */
export async function POST(request: Request) {
  try {
    let body: any = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    }

    const { searchParams } = new URL(request.url);
    const smsId =
      body.sms_id ||
      body.id ||
      body.msg_id ||
      body.message_id ||
      searchParams.get("sms_id") ||
      searchParams.get("id");

    const statusRaw = String(body.status || searchParams.get("status") || "").trim();
    const recipient = String(
      body.recipient ||
      body.to ||
      body.phone ||
      body.phone_number ||
      searchParams.get("recipient") ||
      searchParams.get("to") ||
      ""
    ).trim();

    console.log("[Arkesel Webhook Received]:", { smsId, statusRaw, recipient });

    if (smsId || recipient) {
      const statusLower = statusRaw.toLowerCase();
      const normalizedStatus =
        statusLower.includes("deliver")
          ? "delivered"
          : statusLower.includes("fail") || statusLower.includes("reject") || statusLower.includes("expired")
          ? "failed"
          : "sent";

      // 1. If smsId provided, update by gateway response id
      if (smsId) {
        await supabaseAdmin
          .from("ks_sms_logs")
          .update({
            status: normalizedStatus,
            gateway_response: { ...(typeof body === "object" ? body : {}), updated_via: "webhook" },
          })
          .filter("gateway_response->>id", "eq", smsId);
      }

      // 2. If recipient provided, update most recent matching log
      if (recipient) {
        const cleaned = recipient.replace(/[^\d]/g, "");
        const localFormat = cleaned.startsWith("233") ? "0" + cleaned.substring(3) : cleaned;

        const { data: matchedLog } = await supabaseAdmin
          .from("ks_sms_logs")
          .select("id, campaign_id, status")
          .or(`phone_number.eq.${cleaned},phone_number.eq.${localFormat}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (matchedLog) {
          await supabaseAdmin
            .from("ks_sms_logs")
            .update({
              status: normalizedStatus,
              gateway_response: { ...(typeof body === "object" ? body : {}), updated_via: "webhook" },
            })
            .eq("id", matchedLog.id);

          // Update campaign counts if status changed
          if (matchedLog.campaign_id && normalizedStatus === "delivered" && matchedLog.status !== "delivered") {
            const { count: deliveredCount } = await supabaseAdmin
              .from("ks_sms_logs")
              .select("*", { count: "exact", head: true })
              .eq("campaign_id", matchedLog.campaign_id)
              .eq("status", "delivered");

            if (deliveredCount) {
              await supabaseAdmin
                .from("ks_campaigns")
                .update({ successful_count: deliveredCount })
                .eq("id", matchedLog.campaign_id);
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (err: any) {
    console.error("[Arkesel Webhook Error]:", err);
    // Return 200 OK so Arkesel acknowledges delivery receipt
    return NextResponse.json({ status: "success" });
  }
}

export async function GET(request: Request) {
  // Arkesel can send DLR callbacks via GET query parameters
  return POST(request);
}
