"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Users,
  AlertTriangle,
  User,
  CreditCard,
  Megaphone,
  Bell,
  Coins,
  Settings,
  ShieldCheck,
} from "lucide-react";

const NAV = [
  {
    section: "메인",
    items: [
      { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    section: "크리에이터",
    items: [
      { href: "/admin/creators/pending", label: "승인 대기", icon: Clock },
      { href: "/admin/creators", label: "전체 목록", icon: Users },
    ],
  },
  {
    section: "운영",
    items: [
      { href: "/admin/reports", label: "신고 관리", icon: AlertTriangle },
      { href: "/admin/users", label: "유저 관리", icon: User },
      { href: "/admin/settlements", label: "정산 관리", icon: CreditCard },
    ],
  },
  {
    section: "마케팅",
    items: [
      { href: "/admin/banners", label: "배너 관리", icon: Megaphone },
      { href: "/admin/push", label: "푸시 알림", icon: Bell },
    ],
  },
  {
    section: "superadmin",
    items: [
      { href: "/admin/points", label: "포인트 관리", icon: Coins },
      { href: "/admin/system", label: "시스템", icon: Settings },
      { href: "/admin/admins", label: "관리자 계정", icon: ShieldCheck },
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
                const isActive = (item as { href: string; label: string; icon: React.ElementType; exact?: boolean }).exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                let badge = 0;
                if (item.href === "/admin/creators/pending") badge = pendingCreators;
                if (item.href === "/admin/reports") badge = pendingReports;

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${isActive ? "active" : ""}`}
                  >
                    <Icon size={16} style={{ flexShrink: 0, opacity: 0.85 }} />
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
