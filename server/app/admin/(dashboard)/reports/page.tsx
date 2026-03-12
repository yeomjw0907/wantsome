"use client";
import { useEffect, useState } from "react";

interface Report {
  id: string;
  category: string;
  description: string | null;
  status: string;
  auto_suspended: boolean;
  created_at: string;
  reporter: { nickname: string } | null;
  target: { nickname: string } | null;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  UNDERAGE: { label: "미성년자 의심", color: "badge-red" },
  ILLEGAL_RECORD: { label: "불법 촬영", color: "badge-red" },
  PROSTITUTION: { label: "성매매 유도", color: "badge-red" },
  HARASSMENT: { label: "괴롭힘", color: "badge-orange" },
  FRAUD: { label: "사기", color: "badge-orange" },
  OTHER: { label: "기타", color: "badge-gray" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "대기중", color: "badge-yellow" },
  WARNED: { label: "경고", color: "badge-orange" },
  SUSPENDED_7: { label: "7일 정지", color: "badge-red" },
  SUSPENDED_30: { label: "30일 정지", color: "badge-red" },
  PERMANENTLY_BANNED: { label: "영구 정지", color: "badge-red" },
  DISMISSED: { label: "기각", color: "badge-gray" },
};

const ACTION_OPTIONS = [
  { value: "warn", label: "경고" },
  { value: "suspend_7", label: "7일 정지" },
  { value: "suspend_30", label: "30일 정지" },
  { value: "dismiss", label: "기각" },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState("PENDING");

  useEffect(() => { loadReports(); }, [filterStatus]);

  const loadReports = async () => {
    setIsLoading(true);
    const res = await fetch(`/admin/api/reports?status=${filterStatus}`);
    if (res.ok) {
      const data = await res.json();
      setReports(data.reports ?? []);
    }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (reportId: string, action: string) => {
    if (!confirm(`"${ACTION_OPTIONS.find(a => a.value === action)?.label}" 처리 하시겠습니까?`)) return;
    setIsProcessing(true);
    const res = await fetch(`/admin/api/reports/${reportId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      showToast("처리됐습니다.");
      setSelected(null);
      loadReports();
    } else {
      showToast("처리 실패", "error");
    }
    setIsProcessing(false);
  };

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">신고 관리</h2>
      </div>

      <div className="page-content">
        <div className="filter-bar">
          <div className="tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
            {[
              { value: "PENDING", label: "대기중" },
              { value: "all", label: "전체" },
              { value: "DISMISSED", label: "기각됨" },
            ].map((tab) => (
              <button
                key={tab.value}
                className={`tab ${filterStatus === tab.value ? "active" : ""}`}
                onClick={() => setFilterStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="icon">✅</div>
              <p>처리할 신고가 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>신고일</th>
                    <th>카테고리</th>
                    <th>신고자</th>
                    <th>피신고자</th>
                    <th>자동 조치</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const cat = CATEGORY_MAP[r.category] ?? { label: r.category, color: "badge-gray" };
                    const st = STATUS_MAP[r.status] ?? { label: r.status, color: "badge-gray" };
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize: "12px", color: "#6B7280" }}>
                          {new Date(r.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td><span className={`badge ${cat.color}`}>{cat.label}</span></td>
                        <td>{r.reporter?.nickname ?? "-"}</td>
                        <td>{r.target?.nickname ?? "-"}</td>
                        <td>
                          {r.auto_suspended ? (
                            <span className="badge badge-red">자동 정지</span>
                          ) : (
                            <span className="badge badge-gray">없음</span>
                          )}
                        </td>
                        <td><span className={`badge ${st.color}`}>{st.label}</span></td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(r)}>
                            상세
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

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">신고 상세</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#9CA3AF" }}>×</button>
            </div>
            <div className="modal-body">
              <div className="grid-2 mb-4">
                <div>
                  <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>신고자</div>
                  <div style={{ fontWeight: 600 }}>{selected.reporter?.nickname ?? "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>피신고자</div>
                  <div style={{ fontWeight: 600 }}>{selected.target?.nickname ?? "-"}</div>
                </div>
              </div>

              <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>카테고리</div>
                <span className={`badge ${CATEGORY_MAP[selected.category]?.color ?? "badge-gray"}`}>
                  {CATEGORY_MAP[selected.category]?.label ?? selected.category}
                </span>
              </div>

              {selected.description && (
                <div style={{ background: "#F9FAFB", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "4px" }}>신고 내용</div>
                  <p style={{ fontSize: "13px", color: "#374151" }}>{selected.description}</p>
                </div>
              )}

              {selected.auto_suspended && (
                <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                  <p style={{ fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>
                    🚨 자동 정지 처리됨 (긴급 카테고리)
                  </p>
                </div>
              )}

              {selected.status === "PENDING" && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "10px" }}>조치 선택</div>
                  <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                    {ACTION_OPTIONS.map((action) => (
                      <button
                        key={action.value}
                        className={`btn btn-sm ${action.value === "dismiss" ? "btn-secondary" : "btn-danger"}`}
                        onClick={() => handleAction(selected.id, action.value)}
                        disabled={isProcessing}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
