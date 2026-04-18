import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /admin/api/me
 * 현재 로그인한 어드민의 id와 role을 반환.
 * 미들웨어가 x-admin-role / x-admin-id 헤더를 보장하므로 별도 DB 조회 불필요.
 */
export async function GET(req: NextRequest) {
  const role = req.headers.get("x-admin-role");
  const id = req.headers.get("x-admin-id");

  if (!role || !id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ id, role });
}
