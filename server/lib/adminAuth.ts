import { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * 어드민 미들웨어가 설정한 x-admin-role 헤더를 기반으로 인증 확인
 * /admin/** 경로에서 사용
 */
export function verifyAdminSession(req: NextRequest): { id: string; role: string } | null {
  const role = req.headers.get("x-admin-role");
  const id = req.headers.get("x-admin-id");
  if (!role || !id) return null;
  return { id, role };
}

/**
 * Bearer 토큰 기반 어드민 인증 (외부 API용)
 * users.role이 admin 또는 superadmin인지 확인
 */
export async function verifyAdminToken(token: string): Promise<{ id: string; role: string } | null> {
  try {
    const { createSupabaseClient } = await import("@/lib/supabase");
    const supabase = createSupabaseClient(token);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const admin = createSupabaseAdmin();
    const { data: userRow } = await admin
      .from("users")
      .select("role, deleted_at")
      .eq("id", user.id)
      .single();

    if (!userRow || !["admin", "superadmin"].includes(userRow.role) || userRow.deleted_at) {
      return null;
    }
    return { id: user.id, role: userRow.role };
  } catch {
    return null;
  }
}
