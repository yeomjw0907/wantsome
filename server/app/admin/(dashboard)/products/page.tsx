"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number;
  category: string;
  tags: string[];
  images: string[];
  stock: number;
  is_active: boolean;
  sold_count: number;
  created_at: string;
}

const CATEGORY_MAP: Record<string, string> = {
  general: "일반",
  digital: "디지털",
  adult: "성인",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  original_price: "",
  category: "general",
  tags: "",
  images: "",
  stock: "-1",
};

export default function AdminProductsPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [toast,      setToast]      = useState<{ msg: string; type: string } | null>(null);
  const [filterCat,  setFilterCat]  = useState("all");
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState<Product | null>(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [isSaving,   setIsSaving]   = useState(false);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);

  useEffect(() => { loadProducts(1); }, [filterCat]);

  const loadProducts = async (p: number) => {
    setIsLoading(true);
    const res = await fetch(`/admin/api/products?page=${p}&category=${filterCat}`);
    if (res.ok) {
      const data = await res.json();
      if (p === 1) setProducts(data.products ?? []);
      else setProducts((prev) => [...prev, ...(data.products ?? [])]);
      setHasMore(data.hasMore ?? false);
      setPage(p);
    }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      category: p.category,
      tags: p.tags.join(", "),
      images: p.images.join("\n"),
      stock: String(p.stock),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      showToast("상품명과 가격은 필수입니다.", "error");
      return;
    }
    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseInt(form.price, 10),
      original_price: form.original_price ? parseInt(form.original_price, 10) : null,
      category: form.category,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      images: form.images ? form.images.split("\n").map((u) => u.trim()).filter(Boolean) : [],
      stock: parseInt(form.stock, 10),
    };

    const url    = editing ? `/admin/api/products/${editing.id}` : "/admin/api/products";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

    if (res.ok) {
      showToast(editing ? "상품이 수정됐습니다." : "상품이 등록됐습니다.");
      setShowModal(false);
      loadProducts(1);
    } else {
      const d = await res.json();
      showToast(d.message ?? "저장 실패", "error");
    }
    setIsSaving(false);
  };

  const handleToggleActive = async (product: Product) => {
    const res = await fetch(`/admin/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !product.is_active }),
    });
    if (res.ok) {
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
      showToast(product.is_active ? "상품을 비활성화했습니다." : "상품을 활성화했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 상품을 삭제(비활성화)하시겠습니까?")) return;
    const res = await fetch(`/admin/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("상품이 삭제됐습니다.");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      showToast("삭제 실패", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">상품 관리</h1>
          <p className="page-desc">쇼핑 탭에 표시되는 상품을 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> 상품 등록
        </button>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "general", "digital", "adult"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`btn ${filterCat === cat ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            {cat === "all" ? "전체" : CATEGORY_MAP[cat]}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>상품명</th>
              <th>카테고리</th>
              <th>판매가</th>
              <th>원가</th>
              <th>재고</th>
              <th>판매수</th>
              <th>상태</th>
              <th>등록일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && products.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>로딩 중...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#9CA3AF" }}>등록된 상품이 없습니다</td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.images[0] && (
                        <img src={p.images[0]} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                      )}
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-gray">{CATEGORY_MAP[p.category] ?? p.category}</span></td>
                  <td style={{ fontWeight: 700, color: "#FF6B9D" }}>{p.price.toLocaleString()}P</td>
                  <td style={{ color: "#9CA3AF", textDecoration: "line-through", fontSize: 12 }}>
                    {p.original_price ? `${p.original_price.toLocaleString()}P` : "-"}
                  </td>
                  <td>{p.stock === -1 ? "무제한" : p.stock}</td>
                  <td>{p.sold_count.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${p.is_active ? "badge-green" : "badge-gray"}`}>
                      {p.is_active ? "판매중" : "숨김"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        onClick={() => handleToggleActive(p)}
                        title={p.is_active ? "숨기기" : "활성화"}
                      >
                        {p.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {hasMore && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <button className="btn btn-secondary" onClick={() => loadProducts(page + 1)}>더 보기</button>
          </div>
        )}
      </div>

      {/* 상품 등록/수정 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560, width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? "상품 수정" : "상품 등록"}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF" }}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>상품명 *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="상품명 입력" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>설명</label>
                <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="상품 설명" style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>판매가 (P) *</label>
                  <input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="1000" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>원가 (P)</label>
                  <input className="input" type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="할인 전 가격" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>카테고리</label>
                  <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="general">일반</option>
                    <option value="digital">디지털</option>
                    <option value="adult">성인</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>재고 (-1: 무제한)</label>
                  <input className="input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="-1" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>태그 (쉼표로 구분)</label>
                <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="선물, 메시지, 맞춤" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>이미지 URL (줄바꿈으로 구분)</label>
                <textarea className="input" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} rows={2} placeholder="https://..." style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "저장 중..." : editing ? "수정" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>{toast.msg}</div>
      )}
    </div>
  );
}
