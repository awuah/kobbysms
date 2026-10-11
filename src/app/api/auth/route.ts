import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Dedicated admin credentials for Hon. Kwabena Okyere Darko-Mensah MP Portal
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "kobbymp";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TakoradiMP2026#";
const AUTH_COOKIE_NAME = "kobbymp_admin_session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (
      username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
      password.trim() === ADMIN_PASSWORD
    ) {
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, "authenticated_admin", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days session
      });

      return NextResponse.json({
        success: true,
        user: { username: ADMIN_USERNAME, role: "Constituency Administrator" },
      });
    }

    return NextResponse.json(
      { error: "Invalid administrator username or password" },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_COOKIE_NAME);

  if (session && session.value === "authenticated_admin") {
    return NextResponse.json({
      authenticated: true,
      user: { username: ADMIN_USERNAME, role: "Constituency Administrator" },
    });
  }

  return NextResponse.json({ authenticated: false });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  return NextResponse.json({ success: true, message: "Logged out" });
}
