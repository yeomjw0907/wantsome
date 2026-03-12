"use client";
import { useEffect, useState, useCallback } from "react";
import { User, CheckCircle2 } from "lucide-react";

interface AdminUser {
  id: string;
  nickname: string;
  role: string;
  points: number;
  created_at: string;
  deleted_at: string | null;
  suspended_until: string | null;
  is_verified: boolean;
  total_charges?: number;
  total_calls?: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    const res = await fetch(`/admin/api/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setIsLoading(false);
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [loadUsers]);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSuspend = async (userId: string, days: number) => {
    if (!confirm(`${days}일 정지 처리하시겠습니까?`)) return;
    const res = await fetch(`/admin/api/users/${userId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    if (res.ok) {
      showToast("정지 처리됐습니다.");
      loadUsers();
    } else {
      showToast("처리 실패", "error");
    }
  };

  const isActive = (user: AdminUser) => {
    if (user.deleted_at) return false;
    if (user.suspended_until && new Date(user.suspended_until) > new Date()) return false;
    return true;
  };

  const getStatus = (user: AdminUser) => {
    if (user.deleted_at) return { label: "탈퇴", color: "badge-gray" };
    if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
      return user.suspended_until === "9999-12-31T00:00:00.000Z"
        ? { label: "영구 정지", color: "badge-red" }
        : { label: "정지중", color: "badge-red" };
    }
    return { label: "정상", color: "badge-green" };
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">유저 관리</h2>
      </div>

      <div className="page-content">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <span className="search-icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            <input
              type="text"
              className="form-input search-input"
              placeholder="닉네임 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-input form-select"
            style={{ width: "auto" }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="consumer">소비자</option>
            <option value="CREATOR">크리에이터</option>
            <option value="admin">관리자</option>
          </select>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><User size={32} color="#C8C8D8" /></div>
              <p>유저가 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>닉네임</th>
                    <th>역할</th>
                    <th>포인트</th>
                    <th>가입일</th>
                    <th>상태</th>
                    <th>조치</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const status = getStatus(u);
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="avatar">{u.nickname?.charAt(0) ?? "?"}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: 4 }}>
                                {u.nickname} {u.is_verified && <CheckCircle2 size={13} color="#22C55E" />}
                              </div>
                              <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{u.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${
                            u.role === "CREATOR" ? "badge-pink" :
                            ["admin", "superadmin"].includes(u.role) ? "badge-blue" :
                            "badge-gray"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{(u.points ?? 0).toLocaleString()}P</td>
                        <td style={{ fontSize: "12px", color: "#6B7280" }}>
                          {new Date(u.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td><span className={`badge ${status.color}`}>{status.label}</span></td>
                        <td>
                          {isActive(u) && (
                            <div className="flex gap-1">
                              <button className="btn btn-secondary btn-sm" onClick={() => handleSuspend(u.id, 7)}>
                                7일 정지
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleSuspend(u.id, 30)}>
                                30일 정지
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
