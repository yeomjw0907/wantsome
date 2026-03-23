import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";

const SUPERADMIN_ONLY = ["/admin/points", "/admin/system", "/admin/admins"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login" || pathname === "/admin/unauthorized") {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get("sb-access-token")?.value;
  if (!accessToken) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const supabase = createSupabaseClient(accessToken);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const admin = createSupabaseAdmin();
  const { data: userRow } = await admin
    .from("users")
    .select("role, deleted_at")
    .eq("id", user.id)
    .single();

  const isAdmin =
    userRow && ["admin", "superadmin"].includes(userRow.role) && !userRow.deleted_at;
  if (!isAdmin) {
    return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
  }

  const isSuperOnly = SUPERADMIN_ONLY.some((prefix) => pathname.startsWith(prefix));
  if (isSuperOnly && userRow.role !== "superadmin") {
    return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-admin-role", userRow.role);
  requestHeaders.set("x-admin-id", user.id);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
