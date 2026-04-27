import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true });

  return NextResponse.json({ banners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("banners")
    .insert({
      title: body.title,
      subtitle: body.subtitle ?? null,
      image_url: body.image_url ?? null,
      link_url: body.link_url ?? null,
      type: body.type ?? "PROMO",
      is_active: body.is_active ?? true,
      starts_at: body.starts_at ?? null,
      ends_at: body.ends_at ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ banner: data });
}
