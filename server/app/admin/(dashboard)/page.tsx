import { createSupabaseAdmin } from "@/lib/supabase";
import { AlertCircle, Clock, AlertTriangle, User, CreditCard, Bell } from "lucide-react";

async function getDashboardData() {
  const admin = createSupabaseAdmin();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    todayCharges,
    monthCharges,
    todayUsers,
    monthUsers,
    todayCalls,
    pendingCreators,
    pendingReports,
    totalUsers,
  ] = await Promise.all([
    admin.from("point_charges").select("amount_krw").eq("status", "PAID").gte("created_at", todayStart),
    admin.from("point_charges").select("amount_krw").eq("status", "PAID").gte("created_at", monthStart),
    admin.from("users").select("id", { count: "exact", head: true }).gte("created_at", todayStart).is("deleted_at", null),
    admin.from("users").select("id", { count: "exact", head: true }).gte("created_at", monthStart).is("deleted_at", null),
    admin.from("call_sessions").select("duration_sec").eq("status", "ended").gte("started_at", todayStart),
    admin.from("creator_profiles").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    admin.from("users").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const todayRevenue = (todayCharges.data ?? []).reduce((s, c) => s + (c.amount_krw ?? 0), 0);
  const monthRevenue = (monthCharges.data ?? []).reduce((s, c) => s + (c.amount_krw ?? 0), 0);
  const todayCallMin = Math.floor(
    (todayCalls.data ?? []).reduce((s, c) => s + (c.duration_sec ?? 0), 0) / 60
  );

  return {
    todayRevenue,
    monthRevenue,
    todayUsers: todayUsers.count ?? 0,
    monthUsers: monthUsers.count ?? 0,
    todayCallMin,
    pendingCreators: pendingCreators.count ?? 0,
    pendingReports: pendingReports.count ?? 0,
    totalUsers: totalUsers.count ?? 0,
  };
}

function formatKRW(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M원`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K원`;
  return `${v.toLocaleString()}원`;
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  const stats = [
    { label: "오늘 충전액", value: formatKRW(data.todayRevenue), sub: "결제 완료 기준", color: "#FF6B9D" },
    { label: "이번달 충전액", value: formatKRW(data.monthRevenue), sub: "MTD", color: "#4D9FFF" },
    { label: "오늘 신규 가입", value: `${data.todayUsers}명`, sub: `이번달 +${data.monthUsers}명`, color: "#22C55E" },
    { label: "전체 회원", value: `${data.totalUsers.toLocaleString()}명`, sub: "탈퇴 제외", color: "#1B2A4A" },
    { label: "오늘 통화 시간", value: `${data.todayCallMin}분`, sub: "완료된 통화 기준", color: "#FF9800" },
    { label: "승인 대기", value: `${data.pendingCreators}건`, sub: "크리에이터 심사", color: data.pendingCreators > 0 ? "#FF5C7A" : "#22C55E" },
    { label: "미처리 신고", value: `${data.pendingReports}건`, sub: "PENDING 상태", color: data.pendingReports > 0 ? "#FF5C7A" : "#22C55E" },
  ];

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">대시보드</h2>
        <div className="topbar-actions">
          <span className="text-gray text-sm">{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>

      <div className="page-content">
        {/* 핵심 지표 */}
        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
              <div className="stat-sub">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* 긴급 알림 */}
        {(data.pendingCreators > 0 || data.pendingReports > 0) && (
          <div className="card mb-6" style={{ borderColor: "#FCA5A5" }}>
            <div className="card-header" style={{ background: "#FEF2F2" }}>
              <span className="card-title" style={{ color: "#DC2626", display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={16} /> 즉시 처리 필요</span>
            </div>
            <div className="card-body">
              <div className="flex gap-4">
                {data.pendingCreators > 0 && (
                  <a href="/admin/creators/pending" style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "#FEF9C3",
                      border: "1px solid #FEF08A",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      cursor: "pointer",
                    }}>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#854D0E" }}>{data.pendingCreators}건</div>
                      <div style={{ fontSize: "12px", color: "#854D0E" }}>크리에이터 심사 대기</div>
                    </div>
                  </a>
                )}
                {data.pendingReports > 0 && (
                  <a href="/admin/reports" style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "#FEE2E2",
                      border: "1px solid #FCA5A5",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      cursor: "pointer",
                    }}>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#DC2626" }}>{data.pendingReports}건</div>
                      <div style={{ fontSize: "12px", color: "#DC2626" }}>미처리 신고</div>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 빠른 이동 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">빠른 이동</span>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
              {[
                { href: "/admin/creators/pending", label: "크리에이터 심사", icon: Clock },
                { href: "/admin/reports", label: "신고 처리", icon: AlertTriangle },
                { href: "/admin/users", label: "유저 조회", icon: User },
                { href: "/admin/settlements", label: "정산 관리", icon: CreditCard },
                { href: "/admin/push", label: "푸시 발송", icon: Bell },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 14px",
                    background: "#F9FAFB",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#1B2A4A",
                    textDecoration: "none",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <item.icon size={15} style={{ opacity: 0.6 }} />
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
