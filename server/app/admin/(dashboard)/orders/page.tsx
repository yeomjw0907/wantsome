"use client";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

interface AdminOrder {
  id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  users: { id: string; nickname: string; profile_img: string | null } | null;
  products: { id: string; name: string; images: string[]; price: number; category: string } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  completed: { label: "완료", color: "badge-green" },
  refunded:  { label: "환불", color: "badge-orange" },
  pending:   { label: "대기", color: "badge-yellow" },
};

export default function AdminOrdersPage() {
  const [orders,    setOrders]    = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status,    setStatus]    = useState("all");
  const [toast,     setToast]     = useState<{ msg: string; type: string } | null>(null);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(true);
  const [stats,     setStats]     = useState({ total: 0, revenue: 0, refunded: 0 });

  useEffect(() => { loadOrders(1); }, [status]);

  const loadOrders = async (p: number) => {
    setIsLoading(true);
    const res = await fetch(`/admin/api/orders?page=${p}&status=${status}`);
    if (res.ok) {
      const data = await res.json();
      const list: AdminOrder[] = data.orders ?? [];
      if (p === 1) {
        setOrders(list);
        // 통계 계산
        const allRes = await fetch(`/admin/api/orders?page=1&status=all&limit=200`);
        if (allRes.ok) {
          const allData = await allRes.json();
          const all: AdminOrder[] = allData.orders ?? [];
          setStats({
            total: all.length,
            revenue: all.filter((o) => o.status === "completed").reduce((s, o) => s + o.total_price, 0),
            refunded: all.filter((o) => o.status === "refunded").reduce((s, o) => s + o.total_price, 0),
          });
        }
      } else {
        setOrders((prev) => [...prev, ...list]);
      }
      setHasMore(data.hasMore ?? false);
      setPage(p);
    }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRefund = async (order: AdminOrder) => {
    if (!confirm(`"${order.products?.name}" 주문 ${order.total_price.toLocaleString()}P를 환불하시겠습니까?\n포인트가 유저에게 복구됩니다.`)) return;
    const res = await fetch(`/admin/api/orders/${order.id}/refund`, { method: "POST" });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "refunded" } : o));
      showToast(`${order.total_price.toLocaleString()}P 환불 완료`);
    } else {
      const d = await res.json();
      showToast(d.message ?? "환불 실패", "error");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">주문 관리</h1>
        <p className="page-desc">쇼핑 탭의 포인트 구매 내역을 관리합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">총 주문 수</div>
          <div className="stat-value">{stats.total.toLocaleString()}건</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">총 매출 (포인트)</div>
          <div className="stat-value" style={{ color: "#FF6B9D" }}>{stats.revenue.toLocaleString()}P</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">총 환불 (포인트)</div>
          <div className="stat-value" style={{ color: "#F59E0B" }}>{stats.refunded.toLocaleString()}P</div>
        </div>
      </div>

      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "all", label: "전체" },
          { key: "completed", label: "완료" },
          { key: "refunded", label: "환불" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={`btn ${status === s.key ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>상품</th>
              <th>구매자</th>
              <th>카테고리</th>
              <th>수량</th>
              <th>결제금액</th>
              <th>상태</th>
              <th>구매일시</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && orders.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>로딩 중...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>주문 내역이 없습니다</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {order.products?.images?.[0] && (
                        <img src={order.products.images[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{order.products?.name ?? "삭제된 상품"}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {order.users?.profile_img && (
                        <img src={order.users.profile_img} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                      )}
                      <span style={{ fontSize: 13 }}>{order.users?.nickname ?? "탈퇴 회원"}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gray" style={{ fontSize: 11 }}>
                      {order.products?.category === "digital" ? "디지털" : order.products?.category === "adult" ? "성인" : "일반"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{order.quantity}개</td>
                  <td style={{ fontWeight: 700, color: "#FF6B9D", fontSize: 13 }}>{order.total_price.toLocaleString()}P</td>
                  <td>
                    <span className={`badge ${STATUS_MAP[order.status]?.color ?? "badge-gray"}`}>
                      {STATUS_MAP[order.status]?.label ?? order.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {new Date(order.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td>
                    {order.status === "completed" && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                        onClick={() => handleRefund(order)}
                      >
                        <RotateCcw size={11} /> 환불
                      </button>
                    )}
                    {order.status === "refunded" && (
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>환불완료</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {hasMore && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <button className="btn btn-secondary" onClick={() => loadOrders(page + 1)}>더 보기</button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>{toast.msg}</div>
      )}
    </div>
  );
}
