import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizePhoneNumber } from "@/lib/sms";

export const dynamic = "force-dynamic";

// GET /api/constituents - List constituents with pagination, search, and locality filter
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locality = searchParams.get("locality");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("ks_constituents")
      .select("*", { count: "exact" });

    if (locality && locality !== "all") {
      query = query.eq("electoral_area", locality);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_number.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      constituents: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/constituents - Add new constituent or bulk import
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if it's an array of items (Bulk Import)
    if (Array.isArray(body)) {
      const recordsToInsert = body
        .map((item) => ({
          first_name: item.first_name || item.name || "Constituent",
          last_name: item.last_name || "",
          phone_number: sanitizePhoneNumber(item.phone_number || item.phone || ""),
          electoral_area: item.electoral_area || item.locality || "Other",
          gender: item.gender || null,
          occupation: item.occupation || null,
          source: item.source || "manual_import",
          notes: item.notes || "",
        }))
        .filter((r) => r.phone_number.length >= 9);

      if (recordsToInsert.length === 0) {
        return NextResponse.json(
          { error: "No valid constituent records with phone numbers provided" },
          { status: 400 }
        );
      }

      // Upsert to handle any duplicated phone numbers gracefully
      const { data, error } = await supabaseAdmin
        .from("ks_constituents")
        .upsert(recordsToInsert, { onConflict: "phone_number" })
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        importedCount: data?.length || recordsToInsert.length,
      });
    }

    // Single item creation
    const { first_name, last_name, phone_number, electoral_area, gender, occupation, notes } = body;

    const cleanedPhone = sanitizePhoneNumber(phone_number);
    if (!cleanedPhone || cleanedPhone.length < 9) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("ks_constituents")
      .upsert(
        {
          first_name: first_name || "Constituent",
          last_name: last_name || "",
          phone_number: cleanedPhone,
          electoral_area: electoral_area || "Other",
          gender,
          occupation,
          notes,
          source: "manual",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone_number" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, constituent: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/constituents?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing constituent ID" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("ks_constituents")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
