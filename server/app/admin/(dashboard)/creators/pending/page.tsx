"use client";
import { useEffect, useState } from "react";

interface CreatorPending {
  id: string;
  user_id: string;
  status: string;
  submitted_at: string;
  bank_name: string | null;
  account_holder: string | null;
  id_card_path: string | null;
  user: {
    nickname: string;
    profile_img: string | null;
    email: string;
    created_at: string;
  } | null;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "방금";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function PendingCreatorsPage() {
  const [creators, setCreators] = useState<CreatorPending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<CreatorPending | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => { loadCreators(); }, []);

  const loadCreators = async () => {
    setIsLoading(true);
    const res = await fetch("/admin/api/creators/pending");
    if (res.ok) {
      const data = await res.json();
      setCreators(data.creators ?? []);
    }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (creatorId: string) => {
    if (!confirm("크리에이터를 승인하시겠습니까?")) return;
    setIsProcessing(true);
    const res = await fetch(`/admin/api/creators/${creatorId}/approve`, { method: "POST" });
    if (res.ok) {
      showToast("승인됐습니다.");
      setSelected(null);
      loadCreators();
    } else {
      showToast("승인 처리 실패", "error");
    }
    setIsProcessing(false);
  };

  const handleReject = async (creatorId: string) => {
    if (!rejectReason.trim()) {
      alert("반려 사유를 입력해주세요.");
      return;
    }
    setIsProcessing(true);
    const res = await fetch(`/admin/api/creators/${creatorId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (res.ok) {
      showToast("반려됐습니다.");
      setSelected(null);
      setRejectReason("");
      loadCreators();
    } else {
      showToast("반려 처리 실패", "error");
    }
    setIsProcessing(false);
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">크리에이터 승인 대기</h2>
        <span className="badge" style={{ background: creators.length > 0 ? "#FF5C7A" : "#22C55E", color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "13px" }}>
          {creators.length}건
        </span>
      </div>

      <div className="page-content">
        <div className="card">
          {isLoading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : creators.length === 0 ? (
            <div className="empty-state">
              <div className="icon">✅</div>
              <p>처리할 심사 항목이 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>신청자</th>
                    <th>신청일</th>
                    <th>대기 시간</th>
                    <th>은행</th>
                    <th>예금주</th>
                    <th>신분증</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => {
                    const hours = Math.floor((Date.now() - new Date(c.submitted_at ?? c.id).getTime()) / 3600000);
                    const isUrgent = hours >= 24;

                    return (
                      <tr key={c.id} style={{ background: isUrgent ? "#FFF5F5" : undefined }}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="avatar">{c.user?.nickname?.charAt(0) ?? "?"}</div>
                            <div>
                              <div style={{ fontWeight: 600, color: "#1B2A4A", fontSize: "13px" }}>
                                {c.user?.nickname ?? "-"}
                              </div>
                              <div style={{ fontSize: "11px", color: "#9CA3AF" }}>{c.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: "12px", color: "#6B7280" }}>
                          {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString("ko-KR") : "-"}
                        </td>
                        <td>
                          <span className={`badge ${isUrgent ? "badge-red" : "badge-yellow"}`}>
                            {timeAgo(c.submitted_at ?? new Date().toISOString())}
                          </span>
                        </td>
                        <td>{c.bank_name ?? "-"}</td>
                        <td>{c.account_holder ?? "-"}</td>
                        <td>
                          {c.id_card_path ? (
                            <span className="badge badge-green">제출됨</span>
                          ) : (
                            <span className="badge badge-gray">미제출</span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => setSelected(c)}>
                            심사하기
                          </button>
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

      {/* 심사 모달 */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">크리에이터 심사</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#9CA3AF" }}>×</button>
            </div>
            <div className="modal-body">
              <div className="flex items-center gap-3 mb-4">
                <div className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
                  {selected.user?.nickname?.charAt(0) ?? "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "#1B2A4A" }}>{selected.user?.nickname}</div>
                  <div style={{ fontSize: "12px", color: "#9CA3AF" }}>{selected.user?.email}</div>
                </div>
              </div>

              <div className="grid-2 mb-4">
                <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>은행</div>
                  <div style={{ fontWeight: 600, color: "#1B2A4A" }}>{selected.bank_name ?? "-"}</div>
                </div>
                <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>예금주</div>
                  <div style={{ fontWeight: 600, color: "#1B2A4A" }}>{selected.account_holder ?? "-"}</div>
                </div>
              </div>

              <div style={{ background: "#F0FDF4", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#15803D", marginBottom: "4px" }}>신분증</div>
                <div style={{ fontWeight: 600, color: "#15803D" }}>
                  {selected.id_card_path ? "✅ 제출됨" : "❌ 미제출"}
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label className="form-label">반려 사유 (반려 시 필수)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="반려 사유를 입력하세요..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={() => handleReject(selected.user_id)}
                disabled={isProcessing}
              >
                반려
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleApprove(selected.user_id)}
                disabled={isProcessing}
              >
                {isProcessing ? "처리 중..." : "✓ 승인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
