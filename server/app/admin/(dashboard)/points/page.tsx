"use client";
import { useEffect, useState } from "react";
import { Coins, ClipboardList, FileText, ArrowUp, ArrowDown } from "lucide-react";

interface UserResult {
  id: string;
  nickname: string;
  points: number;
  email: string;
  role: string;
}

interface PointLog {
  id: string;
  detail: {
    nickname: string;
    before: number;
    after: number;
    amount: number;
    reason: string;
  };
  created_at: string;
  users: { nickname: string } | null;
}

export default function PointsPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setIsSearching(true);
      const res = await fetch(`/admin/api/points/search?q=${encodeURIComponent(search)}`);
      if (res.ok) { const d = await res.json(); setResults(d.users ?? []); }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadLogs = async () => {
    const res = await fetch("/admin/api/points");
    if (res.ok) { const d = await res.json(); setLogs(d.logs ?? []); }
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const amt = parseInt(amount, 10);
    if (!amt || amt === 0) { showToast("금액을 입력하세요.", "error"); return; }
    if (!reason.trim()) { showToast("사유를 입력하세요.", "error"); return; }

    const action = amt > 0 ? "지급" : "차감";
    if (!confirm(`${selected.nickname}님에게 ${Math.abs(amt).toLocaleString()}P ${action}하시겠습니까?\n사유: ${reason}`)) return;

    setIsSubmitting(true);
    const res = await fetch("/admin/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected.id, amount: amt, reason }),
    });
    const data = await res.json();
    setIsSubmitting(false);

    if (res.ok) {
      showToast(`완료: ${data.nickname} ${amt > 0 ? "+" : ""}${amt.toLocaleString()}P (잔여: ${data.after.toLocaleString()}P)`);
      setSelected({ ...selected, points: data.after });
      setAmount("");
      setReason("");
      loadLogs();
    } else {
      showToast(data.message || "처리 실패", "error");
    }
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">포인트 관리</h2>
        <div className="topbar-actions">
          <span className="badge badge-red" style={{ fontSize: 11 }}>superadmin 전용</span>
        </div>
      </div>

      <div className="page-content">
        <div className="grid-2">
          {/* 포인트 지급/차감 폼 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Coins size={16} /> 포인트 지급 / 차감</span>
            </div>
            <div className="card-body">
              {/* 유저 검색 */}
              <div className="form-group">
                <label className="form-label">유저 검색 (닉네임)</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    placeholder="닉네임 입력..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                  />
                  {isSearching && (
                    <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    </div>
                  )}
                </div>
                {results.length > 0 && !selected && (
                  <div style={{
                    border: "1px solid var(--gray-200)", borderRadius: 10,
                    background: "white", marginTop: 4,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                  }}>
                    {results.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => { setSelected(u); setSearch(u.nickname); setResults([]); }}
                        style={{
                          padding: "10px 14px", cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          borderBottom: "1px solid var(--gray-100)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-50)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nickname}</div>
                          <div style={{ fontSize: 11, color: "var(--gray-400)" }}>{u.email}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy)" }}>
                          {u.points.toLocaleString()}P
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 선택된 유저 */}
              {selected && (
                <div style={{
                  background: "linear-gradient(135deg, #1B2A4A08, #FF6B9D08)",
                  border: "1px solid var(--gray-200)",
                  borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.nickname}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 2 }}>{selected.email}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--gray-400)" }}>현재 포인트</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--navy)" }}>
                      {selected.points.toLocaleString()}P
                    </div>
                  </div>
                </div>
              )}

              {/* 금액 입력 */}
              <div className="form-group">
                <label className="form-label">포인트 금액 (지급: 양수 / 차감: 음수)</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="예: 1000 (지급) 또는 -500 (차감)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ paddingRight: 48 }}
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--gray-400)" }}>P</span>
                </div>
                {amount && selected && (
                  <div style={{ fontSize: 12, color: parseInt(amount) >= 0 ? "var(--green)" : "var(--red)", marginTop: 4 }}>
                    적용 후: {(selected.points + parseInt(amount || "0")).toLocaleString()}P
                  </div>
                )}
              </div>

              {/* 사유 */}
              <div className="form-group">
                <label className="form-label">처리 사유 (필수)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="관리자 메모 (기록에 남습니다)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={handleSubmit}
                disabled={!selected || !amount || !reason.trim() || isSubmitting}
                style={{ justifyContent: "center" }}
              >
                {isSubmitting ? "처리 중..." : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {parseInt(amount || "0") >= 0 ? <><ArrowUp size={15} /> 포인트 지급</> : <><ArrowDown size={15} /> 포인트 차감</>}
                </span>
              )}
              </button>
            </div>
          </div>

          {/* 최근 처리 이력 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={16} /> 처리 이력</span>
              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>최근 100건</span>
            </div>
            {logs.length === 0 ? (
              <div className="empty-state"><div className="icon"><FileText size={32} color="#C8C8D8" /></div><p>아직 처리 이력이 없습니다.</p></div>
            ) : (
              <div style={{ maxHeight: 540, overflowY: "auto" }}>
                {logs.map((log) => {
                  const amt = log.detail?.amount ?? 0;
                  return (
                    <div key={log.id} style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid var(--gray-100)",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{log.detail?.nickname ?? "-"}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: amt > 0 ? "var(--green)" : "var(--red)",
                          }}>
                            {amt > 0 ? "+" : ""}{amt.toLocaleString()}P
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gray-500)", marginBottom: 2 }}>
                          {log.detail?.reason}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--gray-400)" }}>
                          {log.detail?.before?.toLocaleString()}P → {log.detail?.after?.toLocaleString()}P
                          · 처리자: {(log.users as unknown as { nickname: string | null } | null)?.nickname ?? "시스템"}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gray-400)", whiteSpace: "nowrap", marginLeft: 12 }}>
                        {new Date(log.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
