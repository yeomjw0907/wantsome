"use client";
import { useEffect, useState, useCallback } from "react";
import { User, CheckCircle2, Coins, PhoneCall, CreditCard, X } from "lucide-react";

interface AdminUser {
  id: string;
  nickname: string;
  email?: string;
  role: string;
  points: number;
  created_at: string;
  deleted_at: string | null;
  suspended_until: string | null;
  is_verified: boolean;
  total_charges?: number;
  total_calls?: number;
}

interface UserDetail {
  id: string;
  nickname: string;
  email?: string;
  role: string;
  points: number;
  is_verified: boolean;
  created_at: string;
  suspended_until: string | null;
  deleted_at: string | null;
  total_charge_amount: number;
  total_calls: number;
  total_call_minutes: number;
  total_purchase_amount: number;
}

export default function UsersPage() {
  const [users,       setUsers]       = useState<AdminUser[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [search,      setSearch]      = useState("");
  const [roleFilter,  setRoleFilter]  = useState("all");
  const [toast,       setToast]       = useState<{ msg: string; type: string } | null>(null);

  // 상세 모달
  const [selected,    setSelected]    = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 포인트 추가
  const [pointAmount, setPointAmount] = useState("");
  const [pointReason, setPointReason] = useState("");
  const [pointSaving, setPointSaving] = useState(false);

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
      if (selected?.id === userId) setSelected(null);
    } else {
      showToast("처리 실패", "error");
    }
  };

  const openDetail = async (user: AdminUser) => {
    setDetailLoading(true);
    setSelected(null);
    setPointAmount("");
    setPointReason("");

    try {
      // 기본 정보 + 통계 병렬 조회
      const [chargesRes, callsRes, ordersRes] = await Promise.all([
        fetch(`/admin/api/users?q=${encodeURIComponent(user.id)}&include_stats=1`),
        fetch(`/admin/api/users/${user.id}/calls`).catch(() => null),
        fetch(`/admin/api/users/${user.id}/orders`).catch(() => null),
      ]);

      let totalChargeAmount = 0;
      let totalCalls = 0;
      let totalCallMinutes = 0;
      let totalPurchaseAmount = 0;

      if (callsRes?.ok) {
        const cd = await callsRes.json();
        totalCalls = cd.total ?? 0;
        totalCallMinutes = cd.total_minutes ?? 0;
      }
      if (ordersRes?.ok) {
        const od = await ordersRes.json();
        totalPurchaseAmount = od.total_amount ?? 0;
      }

      // charges 조회
      const chargesDirectRes = await fetch(`/admin/api/points?userId=${user.id}`).catch(() => null);
      if (chargesDirectRes?.ok) {
        const cd = await chargesDirectRes.json();
        totalChargeAmount = cd.total_charged ?? 0;
      }

      setSelected({
        ...user,
        total_charge_amount: totalChargeAmount,
        total_calls: totalCalls,
        total_call_minutes: totalCallMinutes,
        total_purchase_amount: totalPurchaseAmount,
      });
    } catch {
      setSelected({
        ...user,
        total_charge_amount: 0,
        total_calls: 0,
        total_call_minutes: 0,
        total_purchase_amount: 0,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePointAdjust = async () => {
    if (!selected || !pointAmount || !pointReason.trim()) {
      showToast("금액과 사유를 입력해주세요.", "error");
      return;
    }
    const amount = parseInt(pointAmount, 10);
    if (isNaN(amount) || amount === 0) {
      showToast("유효한 금액을 입력해주세요.", "error");
      return;
    }
    setPointSaving(true);
    const res = await fetch("/admin/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected.id, amount, reason: pointReason }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast(`포인트 조정 완료 (${d.before}P → ${d.after}P)`);
      setSelected((prev) => prev ? { ...prev, points: d.after } : null);
      setPointAmount("");
      setPointReason("");
      loadUsers();
    } else {
      showToast(d.message ?? "처리 실패", "error");
    }
    setPointSaving(false);
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
        <div className="topbar-actions">
          <span style={{ fontSize: 12, color: "var(--gray-400)" }}>총 {users.length}명</span>
        </div>
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
            <option value="creator">크리에이터</option>
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
                      <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => openDetail(u)}>
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
                            ["creator","both"].includes(u.role) ? "badge-pink" :
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
                        <td onClick={(e) => e.stopPropagation()}>
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

      {/* ── 유저 상세 모달 ── */}
      {(detailLoading || selected) && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {detailLoading ? "로딩 중..." : `${selected?.nickname} 상세`}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)" }}>×</button>
            </div>

            {detailLoading ? (
              <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
            ) : selected && (
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 기본 정보 */}
                <div style={{ background: "var(--gray-50)", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "ID",    value: selected.id.slice(0, 12) + "..." },
                      { label: "역할",  value: selected.role },
                      { label: "인증",  value: selected.is_verified ? "✅ 인증됨" : "미인증" },
                      { label: "가입일", value: new Date(selected.created_at).toLocaleDateString("ko-KR") },
                    ].map((row) => (
                      <div key={row.label}>
                        <div style={{ fontSize: 11, color: "var(--gray-400)", marginBottom: 2 }}>{row.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 활동 통계 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { icon: <Coins size={16} color="#FF6B9D" />, label: "현재 포인트", value: `${(selected.points ?? 0).toLocaleString()}P`, color: "#FF6B9D" },
                    { icon: <PhoneCall size={16} color="#4D9FFF" />, label: "통화 횟수", value: `${selected.total_calls}회`, color: "#4D9FFF" },
                    { icon: <CreditCard size={16} color="#22C55E" />, label: "구매 내역", value: `${selected.total_purchase_amount.toLocaleString()}P`, color: "#22C55E" },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: "var(--gray-50)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{stat.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* 포인트 조정 */}
                <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>
                    💰 포인트 조정
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-500)", display: "block", marginBottom: 4 }}>
                        금액 (양수=지급, 음수=차감)
                      </label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="예) 1000 또는 -500"
                        value={pointAmount}
                        onChange={(e) => setPointAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--gray-500)", display: "block", marginBottom: 4 }}>
                        사유 *
                      </label>
                      <input
                        className="form-input"
                        placeholder="이벤트 보상 등..."
                        value={pointReason}
                        onChange={(e) => setPointReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    onClick={handlePointAdjust}
                    disabled={pointSaving || !pointAmount || !pointReason.trim()}
                  >
                    {pointSaving ? "처리 중..." : "포인트 조정 적용"}
                  </button>
                </div>

                {/* 정지 조치 */}
                {isActive(selected) && (
                  <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 10 }}>🚫 이용 제한</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleSuspend(selected.id, 7)}>7일 정지</button>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleSuspend(selected.id, 30)}>30일 정지</button>
                      <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleSuspend(selected.id, 36500)}>영구 정지</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
