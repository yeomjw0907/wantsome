"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    section: "메인",
    items: [
      { href: "/admin", label: "📊 대시보드", exact: true },
    ],
  },
  {
    section: "크리에이터",
    items: [
      { href: "/admin/creators/pending", label: "⏳ 승인 대기" },
      { href: "/admin/creators", label: "👥 전체 목록" },
    ],
  },
  {
    section: "운영",
    items: [
      { href: "/admin/reports", label: "🚨 신고 관리" },
      { href: "/admin/users", label: "👤 유저 관리" },
      { href: "/admin/settlements", label: "💳 정산 관리" },
    ],
  },
  {
    section: "마케팅",
    items: [
      { href: "/admin/push", label: "🔔 푸시 알림" },
    ],
  },
  {
    section: "superadmin",
    items: [
      { href: "/admin/points", label: "💰 포인트 관리" },
      { href: "/admin/system", label: "⚙️ 시스템" },
      { href: "/admin/admins", label: "👑 관리자 계정" },
    ],
  },
];

interface Props {
  role: string;
  pendingCreators?: number;
  pendingReports?: number;
}

export default function Sidebar({ role, pendingCreators = 0, pendingReports = 0 }: Props) {
  const pathname = usePathname();

  const isSuperAdmin = role === "superadmin";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>want<span>some</span></h1>
        <p>관리자 패널 {isSuperAdmin ? "· superadmin" : "· admin"}</p>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((section) => {
          // superadmin 섹션은 superadmin만 표시
          if (section.section === "superadmin" && !isSuperAdmin) return null;

          return (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {section.items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                let badge = 0;
                if (item.href === "/admin/creators/pending") badge = pendingCreators;
                if (item.href === "/admin/reports") badge = pendingReports;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                    {badge > 0 && <span className="badge">{badge}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <form action="/admin/api/logout" method="POST">
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "8px",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
