import { NextResponse } from "next/server";
import { getSMSBalance } from "@/lib/sms";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch balance from Arkesel
    const balanceResult = await getSMSBalance();

    // 2. Fetch total constituents count
    const { count: constituentsCount, error: cErr } = await supabaseAdmin
      .from("ks_constituents")
      .select("*", { count: "exact", head: true });

    // 3. Fetch total campaigns count
    const { count: campaignsCount } = await supabaseAdmin
      .from("ks_campaigns")
      .select("*", { count: "exact", head: true });

    // 4. Fetch total messages sent from logs
    const { count: sentMessagesCount } = await supabaseAdmin
      .from("ks_sms_logs")
      .select("*", { count: "exact", head: true });

    // 5. Fetch locality distribution via RPC function
    const { data: localityData, error: lErr } = await supabaseAdmin
      .rpc("get_ks_locality_counts");

    let localities: Array<{ name: string; count: number }> = [];
    if (localityData && Array.isArray(localityData)) {
      localities = localityData.map((item: any) => ({
        name: item.name,
        count: Number(item.count),
      }));
    }

    return NextResponse.json({
      balance: balanceResult.success ? balanceResult.balance : 0,
      balanceAccount: balanceResult.user || "Hon. Kwabena Okyere Darko-Mensah",
      totalConstituents: constituentsCount || 0,
      totalCampaigns: campaignsCount || 0,
      totalMessagesSent: sentMessagesCount || 0,
      localities,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
