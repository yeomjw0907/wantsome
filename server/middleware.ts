import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";

// 페이지 경로와 API 경로 모두 포함
const SUPERADMIN_ONLY_SEGMENTS = ["points", "system", "admins"];

function isSuperadminOnly(pathname: string): boolean {
  return SUPERADMIN_ONLY_SEGMENTS.some(
    (seg) =>
      pathname.startsWith(`/admin/${seg}`) ||
      pathname.startsWith(`/admin/api/${seg}`)
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/admin/api/");
}

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
    if (isApiRoute(pathname)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const supabase = createSupabaseClient(accessToken);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
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
    if (isApiRoute(pathname)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
  }

  if (isSuperadminOnly(pathname) && userRow.role !== "superadmin") {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ message: "superadmin만 접근 가능합니다." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
  }

  // 외부에서 임의로 주입된 헤더를 덮어쓴다
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
