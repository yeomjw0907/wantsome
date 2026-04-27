"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !data.session) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setIsLoading(false);
      return;
    }

    // admin role 확인
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!user || !["admin", "superadmin"].includes(user.role)) {
      setError("관리자 권한이 없습니다.");
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    // 쿠키 저장 후 리디렉트
    document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Strict`;
    window.location.href = "/admin";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1B2A4A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "40px",
        width: "100%",
        maxWidth: "380px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1B2A4A", marginBottom: "4px" }}>
            want<span style={{ color: "#FF6B9D" }}>some</span>
          </h1>
          <p style={{ color: "#6B7280", fontSize: "13px" }}>관리자 로그인</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@wantsome.kr"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#FEE2E2",
              color: "#DC2626",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "16px",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px",
              background: isLoading ? "#9CA3AF" : "#FF6B9D",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
