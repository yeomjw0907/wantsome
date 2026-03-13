"use client";
import { useEffect, useState } from "react";
import { Crown, KeyRound, ClipboardList, ShieldCheck, AlertCircle, UserPlus, ShieldOff } from "lucide-react";

interface AdminUser {
  id: string;
  nickname: string;
  email: string;
  role: string;
  created_at: string;
  suspended_until: string | null;
}

interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  created_at: string;
  users: { nickname: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  POINT_ADJUST:        "포인트 조정",
  SYSTEM_CONFIG_UPDATE:"시스템 설정 변경",
  ADMIN_CHANGE_ROLE:   "권한 변경",
  ADMIN_DEACTIVATE:    "계정 비활성화",
  ADMIN_REACTIVATE:    "계정 활성화",
  ADMIN_ADD:           "관리자 추가",
  ADMIN_REMOVE:        "관리자 권한 제거",
  CREATOR_APPROVE:     "크리에이터 승인",
  CREATOR_REJECT:      "크리에이터 반려",
  REPORT_ACTION:       "신고 처리",
  SETTLEMENT_PAID:     "정산 이체 완료",
};

export default function AdminsPage() {
  const [admins,    setAdmins]    = useState<AdminUser[]>([]);
  const [logs,      setLogs]      = useState<AdminLog[]>([]);
  const [activeTab, setActiveTab] = useState<"accounts" | "logs">("accounts");
  const [toast,     setToast]     = useState<{ msg: string; type: string } | null>(null);

  // 관리자 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail,     setAddEmail]     = useState("");
  const [addRole,      setAddRole]      = useState<"admin" | "superadmin">("admin");
  const [isAdding,     setIsAdding]     = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const res = await fetch("/admin/api/admins");
    if (res.ok) {
      const d = await res.json();
      setAdmins(d.admins ?? []);
      setLogs(d.logs ?? []);
    }
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (
    action: "change_role" | "deactivate" | "reactivate" | "remove",
    targetId: string,
    targetNick: string,
    role?: string
  ) => {
    const labels: Record<string, string> = {
      change_role: `${targetNick}님의 권한을 '${role}'으로 변경하시겠습니까?`,
      deactivate:  `${targetNick}님의 계정을 비활성화하시겠습니까?`,
      reactivate:  `${targetNick}님의 계정을 다시 활성화하시겠습니까?`,
      remove:      `${targetNick}님의 관리자 권한을 제거하시겠습니까? (일반 유저로 변경됩니다)`,
    };
    if (!confirm(labels[action])) return;

    const res = await fetch("/admin/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId, role }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast("처리됐습니다.");
      loadData();
    } else {
      showToast(d.message || "처리 실패", "error");
    }
  };

  const handleAdd = async () => {
    if (!addEmail.trim()) { showToast("이메일을 입력하세요.", "error"); return; }
    setIsAdding(true);
    const res = await fetch("/admin/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", email: addEmail.trim(), role: addRole }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast(`${addEmail} 계정에 ${addRole} 권한을 부여했습니다.`);
      setShowAddModal(false);
      setAddEmail("");
      setAddRole("admin");
      loadData();
    } else {
      showToast(d.message || "추가 실패", "error");
    }
    setIsAdding(false);
  };

  const isActive = (admin: AdminUser) =>
    !admin.suspended_until || new Date(admin.suspended_until) < new Date();

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">관리자 계정</h2>
        <div className="topbar-actions">
          <span className="badge badge-red" style={{ fontSize: 11, marginRight: 8 }}>superadmin 전용</span>
          {activeTab === "accounts" && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <UserPlus size={14} /> 관리자 추가
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "accounts" ? "active" : ""}`}
            onClick={() => setActiveTab("accounts")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Crown size={14} /> 계정 목록 ({admins.length})
          </button>
          <button
            className={`tab ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ClipboardList size={14} /> 활동 로그
          </button>
        </div>

        {activeTab === "accounts" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "16px 20px", borderBottom: "1px solid var(--gray-100)" }}>
              <span className="card-title">관리자 계정 목록</span>
              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{admins.length}명</span>
            </div>
            {admins.length === 0 ? (
              <div className="empty-state">
                <div className="icon"><ShieldCheck size={32} color="#C8C8D8" /></div>
                <p>관리자 계정이 없습니다.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>계정</th>
                      <th>권한</th>
                      <th>상태</th>
                      <th>가입일</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nickname}</div>
                          <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{a.email}</div>
                        </td>
                        <td>
                          <span
                            className={`badge ${a.role === "superadmin" ? "badge-pink" : "badge-blue"}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            {a.role === "superadmin"
                              ? <><Crown size={11} /> superadmin</>
                              : <><KeyRound size={11} /> admin</>}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${isActive(a) ? "badge-green" : "badge-red"}`}>
                            {isActive(a) ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--gray-400)" }}>
                          {new Date(a.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {a.role !== "superadmin" && (
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => handleAction("change_role", a.id, a.nickname, "superadmin")}
                              >
                                <Crown size={11} style={{ marginRight: 2 }} /> 승격
                              </button>
                            )}
                            {a.role === "superadmin" && (
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => handleAction("change_role", a.id, a.nickname, "admin")}
                              >
                                admin으로 강등
                              </button>
                            )}
                            {isActive(a) ? (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleAction("deactivate", a.id, a.nickname)}
                              >
                                비활성화
                              </button>
                            ) : (
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleAction("reactivate", a.id, a.nickname)}
                              >
                                활성화
                              </button>
                            )}
                            {a.role !== "superadmin" && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleAction("remove", a.id, a.nickname)}
                                title="관리자 권한 제거"
                              >
                                <ShieldOff size={11} /> 권한 제거
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "16px 20px", borderBottom: "1px solid var(--gray-100)" }}>
              <span className="card-title">관리자 활동 로그</span>
              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>최근 50건</span>
            </div>
            {logs.length === 0 ? (
              <div className="empty-state">
                <div className="icon"><ClipboardList size={32} color="#C8C8D8" /></div>
                <p>활동 로그가 없습니다.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>관리자</th>
                      <th>행위</th>
                      <th>대상</th>
                      <th>상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: 12, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
                          {new Date(log.created_at).toLocaleString("ko-KR", {
                            month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>
                          {(log.users as any)?.nickname ?? "-"}
                        </td>
                        <td>
                          <span className="badge badge-blue" style={{ fontSize: 11 }}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--gray-500)" }}>
                          {log.target_type}: {log.target_id?.slice(0, 8)}...
                        </td>
                        <td style={{ fontSize: 12, color: "var(--gray-500)", maxWidth: 200 }}>
                          {(log.detail?.reason as string)
                            ?? (log.detail?.email as string)
                            ?? (log.detail?.nickname as string)
                            ?? JSON.stringify(log.detail ?? {}).slice(0, 60)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 관리자 추가 모달 ── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: 440, width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">관리자 추가</span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)" }}
              >×</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: "#FEF9C3", border: "1px solid #FDE68A",
                borderRadius: 10, padding: "12px 14px", marginBottom: 16,
                display: "flex", gap: 8,
              }}>
                <AlertCircle size={15} style={{ color: "#92400E", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                  추가할 계정은 <strong>먼저 wantsome에 회원가입</strong>되어 있어야 합니다.
                  이미 가입된 일반 유저의 이메일을 입력하면 관리자 권한이 부여됩니다.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">이메일 *</label>
                <input
                  className="form-input"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="admin@wantsome.kr"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">권한</label>
                <select
                  className="form-input form-select"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as "admin" | "superadmin")}
                >
                  <option value="admin">admin — 일반 관리자</option>
                  <option value="superadmin">superadmin — 최고 관리자</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={isAdding}>
                {isAdding ? "처리 중..." : "권한 부여"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
