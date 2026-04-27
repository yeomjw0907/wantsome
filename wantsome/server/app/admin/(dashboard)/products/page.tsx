"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ImagePlus, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  detail_content?: string;
  price: number;
  original_price?: number;
  category: string;
  owner_type: "company" | "creator";
  creator_id?: string | null;
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
  detail_content: "",
  price: "",
  original_price: "",
  category: "general",
  owner_type: "company" as "company" | "creator",
  creator_id: "",
  tags: "",
  imageUrls: [] as string[],
  stock: "-1",
};

export default function AdminProductsPage() {
  const [products,       setProducts]       = useState<Product[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [toast,          setToast]          = useState<{ msg: string; type: string } | null>(null);
  const [filterCat,      setFilterCat]      = useState("all");
  const [showModal,      setShowModal]      = useState(false);
  const [editing,        setEditing]        = useState<Product | null>(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [isSaving,       setIsSaving]       = useState(false);
  const [uploadingImg,   setUploadingImg]   = useState(false);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      name:           p.name,
      description:    p.description ?? "",
      detail_content: p.detail_content ?? "",
      price:          String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      category:       p.category,
      owner_type:     p.owner_type ?? "company",
      creator_id:     p.creator_id ?? "",
      tags:           p.tags.join(", "),
      imageUrls:      [...(p.images ?? [])],
      stock:          String(p.stock),
    });
    setShowModal(true);
  };

  /** 이미지 업로드 핸들러 */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (form.imageUrls.length + files.length > 5) {
      showToast("이미지는 최대 5장까지 등록할 수 있습니다.", "error");
      return;
    }
    setUploadingImg(true);
    const uploaded: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "product-images");
      const res = await fetch("/admin/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        uploaded.push(d.url);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.message ?? "업로드 실패", "error");
      }
    }
    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...uploaded] }));
    setUploadingImg(false);
    // 파일 인풋 초기화
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      showToast("상품명과 가격은 필수입니다.", "error");
      return;
    }
    setIsSaving(true);
    const payload = {
      name:           form.name.trim(),
      description:    form.description.trim() || null,
      detail_content: form.detail_content.trim() || null,
      price:          parseInt(form.price, 10),
      original_price: form.original_price ? parseInt(form.original_price, 10) : null,
      category:       form.category,
      owner_type:     form.owner_type,
      creator_id:     form.owner_type === "creator" && form.creator_id.trim() ? form.creator_id.trim() : null,
      tags:           form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      images:         form.imageUrls,
      stock:          parseInt(form.stock, 10),
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

  const F = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <div className="topbar">
        <h2 className="topbar-title">상품 관리</h2>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> 상품 등록
          </button>
        </div>
      </div>

      <div className="page-content">
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
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
                          {p.images[0] ? (
                            <img src={p.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#F3F4F6", flexShrink: 0 }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            {p.description && (
                              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                            )}
                          </div>
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
                          <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>
                            <Pencil size={12} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleToggleActive(p)}
                            title={p.is_active ? "숨기기" : "활성화"}
                          >
                            {p.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div style={{ textAlign: "center", padding: 16 }}>
              <button className="btn btn-secondary" onClick={() => loadProducts(page + 1)}>더 보기</button>
            </div>
          )}
        </div>
      </div>

      {/* ── 상품 등록/수정 모달 ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 640, width: "90%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title">{editing ? "상품 수정" : "상품 등록"}</span>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--gray-400)" }}
              >×</button>
            </div>

            <div className="modal-body">
              {/* 상품명 */}
              <div className="form-group">
                <label className="form-label">상품명 *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => F("name", e.target.value)}
                  placeholder="상품명 입력"
                />
              </div>

              {/* 간단 설명 */}
              <div className="form-group">
                <label className="form-label">간단 설명</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={(e) => F("description", e.target.value)}
                  placeholder="리스트에 표시되는 한 줄 설명"
                />
              </div>

              {/* 판매자 유형 */}
              <div className="form-group">
                <label className="form-label">판매자 유형 *</label>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {(["company", "creator"] as const).map((type) => (
                    <label
                      key={type}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                        border: `1.5px solid ${form.owner_type === type ? "var(--pink)" : "var(--gray-200)"}`,
                        background: form.owner_type === type ? "var(--pink-light)" : "#fff",
                        fontWeight: form.owner_type === type ? 700 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="owner_type"
                        value={type}
                        checked={form.owner_type === type}
                        onChange={() => F("owner_type", type)}
                        style={{ accentColor: "var(--pink)" }}
                      />
                      {type === "company" ? "🌸 원썸 본사" : "⭐ 크리에이터"}
                    </label>
                  ))}
                </div>
              </div>

              {/* 크리에이터 ID (크리에이터 소유 시) */}
              {form.owner_type === "creator" && (
                <div className="form-group">
                  <label className="form-label">크리에이터 User ID</label>
                  <input
                    className="form-input"
                    value={form.creator_id}
                    onChange={(e) => F("creator_id", e.target.value)}
                    placeholder="크리에이터의 UUID 입력 (users 테이블 id)"
                  />
                  <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 4 }}>
                    어드민 → 크리에이터 목록에서 ID를 복사하여 입력하세요
                  </p>
                </div>
              )}

              {/* 가격 + 원가 */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">판매가 (P) *</label>
                  <input
                    className="form-input"
                    type="number"
                    value={form.price}
                    onChange={(e) => F("price", e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">원가 (P) <span style={{ fontWeight: 400, color: "var(--gray-400)" }}>할인 전</span></label>
                  <input
                    className="form-input"
                    type="number"
                    value={form.original_price}
                    onChange={(e) => F("original_price", e.target.value)}
                    placeholder="미입력 시 할인표시 없음"
                  />
                </div>
              </div>

              {/* 카테고리 + 재고 */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">카테고리</label>
                  <select
                    className="form-input form-select"
                    value={form.category}
                    onChange={(e) => F("category", e.target.value)}
                  >
                    <option value="general">일반</option>
                    <option value="digital">디지털</option>
                    <option value="adult">성인</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">재고 <span style={{ fontWeight: 400, color: "var(--gray-400)" }}>-1 = 무제한</span></label>
                  <input
                    className="form-input"
                    type="number"
                    value={form.stock}
                    onChange={(e) => F("stock", e.target.value)}
                    placeholder="-1"
                  />
                </div>
              </div>

              {/* 태그 */}
              <div className="form-group">
                <label className="form-label">태그 <span style={{ fontWeight: 400, color: "var(--gray-400)" }}>쉼표로 구분</span></label>
                <input
                  className="form-input"
                  value={form.tags}
                  onChange={(e) => F("tags", e.target.value)}
                  placeholder="선물, 메시지, 맞춤"
                />
              </div>

              {/* 이미지 업로드 */}
              <div className="form-group">
                <label className="form-label">
                  상품 이미지 <span style={{ fontWeight: 400, color: "var(--gray-400)" }}>최대 5장</span>
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {form.imageUrls.map((url, i) => (
                    <div key={i} style={{ position: "relative", width: 88, height: 88 }}>
                      <img
                        src={url}
                        alt=""
                        style={{ width: 88, height: 88, borderRadius: 10, objectFit: "cover", border: "1px solid var(--gray-200)" }}
                      />
                      <button
                        onClick={() => removeImage(i)}
                        style={{
                          position: "absolute", top: -6, right: -6,
                          width: 20, height: 20, borderRadius: "50%",
                          background: "#EF4444", color: "#fff",
                          border: "2px solid #fff",
                          cursor: "pointer", fontSize: 13,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        <X size={11} />
                      </button>
                      {i === 0 && (
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          textAlign: "center", fontSize: 10, fontWeight: 700,
                          background: "rgba(0,0,0,0.5)", color: "#fff",
                          borderRadius: "0 0 10px 10px", padding: "2px 0",
                        }}>대표</div>
                      )}
                    </div>
                  ))}

                  {form.imageUrls.length < 5 && (
                    <label
                      style={{
                        width: 88, height: 88, borderRadius: 10,
                        border: "2px dashed var(--gray-300)",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        cursor: uploadingImg ? "not-allowed" : "pointer",
                        color: "var(--gray-400)", gap: 4,
                        background: uploadingImg ? "var(--gray-100)" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      {uploadingImg ? (
                        <span style={{ fontSize: 11 }}>업로드 중...</span>
                      ) : (
                        <>
                          <ImagePlus size={20} />
                          <span style={{ fontSize: 10 }}>이미지 추가</span>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleImageUpload}
                        disabled={uploadingImg}
                      />
                    </label>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 6 }}>
                  첫 번째 이미지가 대표 이미지로 사용됩니다. JPG, PNG, WebP (최대 10MB)
                </p>
              </div>

              {/* 상품 상세 설명 */}
              <div className="form-group">
                <label className="form-label">
                  상품 상세 설명
                  <span style={{ fontWeight: 400, color: "var(--gray-400)", marginLeft: 6 }}>상세 페이지에 표시</span>
                </label>
                <textarea
                  className="form-input"
                  value={form.detail_content}
                  onChange={(e) => F("detail_content", e.target.value)}
                  rows={5}
                  placeholder="상품의 상세한 설명, 사용 방법, 주의사항 등을 입력하세요."
                  style={{ resize: "vertical", lineHeight: 1.6 }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || uploadingImg}>
                {isSaving ? "저장 중..." : editing ? "수정" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
