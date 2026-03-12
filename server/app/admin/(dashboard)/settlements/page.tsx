"use client";
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

interface Settlement {
  id: string;
  creator_id: string;
  period: string;
  total_points: number;
  settlement_amount: number;
  tax_amount: number;
  net_amount: number;
  status: "PENDING" | "PAID";
  paid_at: string | null;
  creator: { display_name: string; profile_image_url: string | null } | null;
}

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  useEffect(() => { loadSettlements(); }, [period]);

  const loadSettlements = async () => {
    setIsLoading(true);
    const res = await fetch(`/admin/api/settlements?period=${period}`);
    if (res.ok) {
      const data = await res.json();
      setSettlements(data.settlements ?? []);
    }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleMarkPaid = async (settlementId: string) => {
    if (!confirm("이체 완료 처리하시겠습니까?")) return;
    const res = await fetch(`/admin/api/settlements/${settlementId}/paid`, { method: "POST" });
    if (res.ok) {
      showToast("이체 완료 처리됐습니다.");
      loadSettlements();
    } else {
      showToast("처리 실패", "error");
    }
  };

  const handleBulkPaid = async () => {
    const pending = settlements.filter((s) => s.status === "PENDING");
    if (pending.length === 0) { showToast("처리할 정산이 없습니다.", "error"); return; }
    if (!confirm(`${pending.length}건을 일괄 이체 완료 처리하시겠습니까?`)) return;
    const res = await fetch(`/admin/api/settlements/bulk-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    if (res.ok) {
      showToast("일괄 처리됐습니다.");
      loadSettlements();
    } else {
      showToast("처리 실패", "error");
    }
  };

  const totalNet = settlements.reduce((s, c) => s + c.net_amount, 0);
  const pendingCount = settlements.filter((s) => s.status === "PENDING").length;

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">정산 관리</h2>
        <div className="topbar-actions">
          <input
            type="month"
            className="form-input"
            style={{ width: "auto" }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          {pendingCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={handleBulkPaid}>
              일괄 이체 완료 ({pendingCount}건)
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* 요약 카드 */}
        <div className="stats-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">총 정산 크리에이터</div>
            <div className="stat-value">{settlements.length}명</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">총 실지급액</div>
            <div className="stat-value" style={{ color: "#FF6B9D" }}>{totalNet.toLocaleString()}원</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">대기 건수</div>
            <div className="stat-value" style={{ color: pendingCount > 0 ? "#F59E0B" : "#22C55E" }}>{pendingCount}건</div>
          </div>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : settlements.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><CreditCard size={32} color="#C8C8D8" /></div>
              <p>{period} 정산 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>크리에이터</th>
                    <th>총 포인트</th>
                    <th>세전 정산액</th>
                    <th>원천징수(3.3%)</th>
                    <th>실지급액</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar">{s.creator?.display_name?.charAt(0) ?? "?"}</div>
                          <span style={{ fontWeight: 600, fontSize: "13px" }}>
                            {s.creator?.display_name ?? "-"}
                          </span>
                        </div>
                      </td>
                      <td>{s.total_points.toLocaleString()}P</td>
                      <td>{s.settlement_amount.toLocaleString()}원</td>
                      <td style={{ color: "#FF5C7A" }}>-{s.tax_amount.toLocaleString()}원</td>
                      <td style={{ fontWeight: 700, color: "#1B2A4A" }}>{s.net_amount.toLocaleString()}원</td>
                      <td>
                        <span className={`badge ${s.status === "PAID" ? "badge-green" : "badge-yellow"}`}>
                          {s.status === "PAID" ? "이체 완료" : "대기중"}
                        </span>
                      </td>
                      <td>
                        {s.status === "PENDING" && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleMarkPaid(s.id)}>
                            이체 완료
                          </button>
                        )}
                        {s.status === "PAID" && s.paid_at && (
                          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
                            {new Date(s.paid_at).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
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
