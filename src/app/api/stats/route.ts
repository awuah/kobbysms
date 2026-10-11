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

    // 5. Fetch locality distribution
    const { data: localityData, error: lErr } = await supabaseAdmin
      .from("ks_constituents")
      .select("electoral_area");

    const localitiesMap: Record<string, number> = {};
    if (localityData) {
      localityData.forEach((item) => {
        const area = item.electoral_area || "Other";
        localitiesMap[area] = (localitiesMap[area] || 0) + 1;
      });
    }

    const localities = Object.entries(localitiesMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

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
