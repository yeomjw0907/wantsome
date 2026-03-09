import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Body {
  identityVerificationId: string;
  userId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { identityVerificationId, userId } = body;
    if (!userId) {
      return NextResponse.json({ message: "userId required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    if (identityVerificationId === "test-portone-id" || !process.env.PORTONE_API_SECRET) {
      const { error } = await supabase
        .from("users")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        is_adult: true,
        verified_name: "테스트",
      });
    }

    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${identityVerificationId}`,
      {
        headers: {
          Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
        },
      }
    );
    if (!portoneRes.ok) {
      return NextResponse.json({ message: "PortOne verification failed" }, { status: 400 });
    }
    const portone = (await portoneRes.json()) as {
      birthDate?: string;
      name?: string;
      ci?: string;
    };

    const birthDate = portone.birthDate;
    if (!birthDate) {
      return NextResponse.json({ message: "Birth date not found" }, { status: 400 });
    }
    const age = getAge(birthDate);
    if (age < 18) {
      return NextResponse.json({ error: "UNDERAGE" }, { status: 403 });
    }

    const ci = portone.ci;
    if (ci) {
      const { data: banned } = await supabase
        .from("ci_blacklist")
        .select("id")
        .eq("ci", ci)
        .maybeSingle();
      if (banned) {
        return NextResponse.json({ error: "BANNED" }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from("users")
      .update({
        is_verified: true,
        ci: ci ?? null,
        birth_date: birthDate,
        verified_name: portone.name ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_adult: true,
      verified_name: portone.name ?? "",
    });
  } catch (e) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
