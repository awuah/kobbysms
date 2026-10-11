import { NextResponse } from "next/server";
import { sendSingleSMS, calculateSMSDetails, sanitizePhoneNumber } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { phone, message, sender_id = "KOBBYMP" } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ error: "Phone and message are required" }, { status: 400 });
    }

    const cleanedPhone = sanitizePhoneNumber(phone);
    if (!cleanedPhone || cleanedPhone.length < 9) {
      return NextResponse.json({ error: "Invalid test phone number" }, { status: 400 });
    }

    const result = await sendSingleSMS(cleanedPhone, message, sender_id || "KOBBYMP");

    // Log the test send in ks_sms_logs
    await supabaseAdmin.from("ks_sms_logs").insert({
      recipient_name: "Test Recipient",
      phone_number: cleanedPhone,
      electoral_area: "Test / Office",
      message: message,
      sender_id: sender_id || "KOBBYMP",
      status: result.success ? "sent" : "failed",
      gateway_response: result,
      error_message: result.error || null,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send test SMS" }, { status: 500 });
  }
}
