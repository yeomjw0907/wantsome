import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

const SUPERADMIN_ONLY = ["/admin/points", "/admin/system", "/admin/admins"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 어드민 경로가 아니면 패스
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 로그인 페이지는 통과
  if (pathname === "/admin/login" || pathname === "/admin/unauthorized") {
    return NextResponse.next();
  }

  // 쿠키에서 Supabase 세션 토큰 조회
  const accessToken = req.cookies.get("sb-access-token")?.value;
  if (!accessToken) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const supabase = createSupabaseClient(accessToken);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // role 확인
  const { data: userRow } = await supabase
    .from("users")
    .select("role, deleted_at")
    .eq("id", user.id)
    .single();

  const isAdmin = userRow && ["admin", "superadmin"].includes(userRow.role) && !userRow.deleted_at;
  if (!isAdmin) {
    return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
  }

  // superadmin 전용 경로 체크
  const isSuperOnly = SUPERADMIN_ONLY.some((p) => pathname.startsWith(p));
  if (isSuperOnly && userRow.role !== "superadmin") {
    return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
  }

  // role을 헤더에 전달
  const response = NextResponse.next();
  response.headers.set("x-admin-role", userRow.role);
  response.headers.set("x-admin-id", user.id);
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
