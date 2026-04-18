"use client";
import { useEffect, useState } from "react";
import { Trash2, Eye, EyeOff } from "lucide-react";

interface AdminPost {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  caption: string;
  images: string[];
  like_count: number;
  view_count: number;
  is_deleted: boolean;
  created_at: string;
}

export default function AdminPostsPage() {
  const [posts,     setPosts]     = useState<AdminPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [toast,     setToast]     = useState<{ msg: string; type: string } | null>(null);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(true);
  const [preview,   setPreview]   = useState<AdminPost | null>(null);

  useEffect(() => { loadPosts(1); }, [filter]);

  const loadPosts = async (p: number) => {
    setIsLoading(true);
    const res = await fetch(`/admin/api/posts?page=${p}&filter=${filter}`);
    if (res.ok) {
      const data = await res.json();
      if (p === 1) setPosts(data.posts ?? []);
      else setPosts((prev) => [...prev, ...(data.posts ?? [])]);
      setHasMore(data.hasMore ?? false);
      setPage(p);
    }
    setIsLoading(false);
  };

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("이 포스트를 삭제하시겠습니까?")) return;
    const res = await fetch(`/admin/api/posts/${postId}/delete`, { method: "POST" });
    if (res.ok) {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_deleted: true } : p));
      showToast("포스트가 삭제됐습니다.");
    } else {
      showToast("삭제 실패", "error");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">포스트 관리</h1>
        <p className="page-desc">크리에이터가 업로드한 피드 포스트를 관리합니다.</p>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "all", label: "전체" },
          { key: "reported", label: "신고된 포스트" },
          { key: "deleted", label: "삭제된 포스트" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn ${filter === f.key ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 그리드 */}
      {isLoading && posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>로딩 중...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>포스트가 없습니다</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {posts.map((post) => (
            <div
              key={post.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                opacity: post.is_deleted ? 0.5 : 1,
              }}
            >
              {/* 썸네일 */}
              <div
                style={{ aspectRatio: "1", background: "#F5F5FA", position: "relative", cursor: "pointer" }}
                onClick={() => setPreview(post)}
              >
                {post.images[0] ? (
                  <img src={post.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#C8C8D8", fontSize: 12 }}>
                    이미지 없음
                  </div>
                )}
                {post.images.length > 1 && (
                  <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#fff" }}>
                    +{post.images.length - 1}
                  </div>
                )}
                {post.is_deleted && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, background: "#EF4444", padding: "2px 8px", borderRadius: 4 }}>삭제됨</span>
                  </div>
                )}
              </div>

              {/* 정보 */}
              <div style={{ padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {post.creator_avatar && (
                    <img src={post.creator_avatar} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1B2A4A" }}>{post.creator_name}</span>
                </div>
                {post.caption && (
                  <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as string }}>
                    {post.caption}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#9CA3AF" }}>
                    <span>❤️ {post.like_count}</span>
                    <span>👁 {post.view_count}</span>
                  </div>
                  {!post.is_deleted && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => handleDelete(post.id)}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <button className="btn btn-secondary" onClick={() => loadPosts(page + 1)}>더 보기</button>
        </div>
      )}

      {/* 이미지 프리뷰 모달 */}
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth: 480, width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{preview.creator_name}의 포스트</h3>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF" }}>×</button>
            </div>
            <div style={{ padding: "0 20px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {preview.images.map((img, i) => (
                  <img key={i} src={img} alt="" style={{ width: "100%", borderRadius: 8 }} />
                ))}
              </div>
              {preview.caption && (
                <p style={{ marginTop: 12, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{preview.caption}</p>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>
                <span>❤️ {preview.like_count}  👁 {preview.view_count}</span>
                <span>{new Date(preview.created_at).toLocaleString("ko-KR")}</span>
              </div>
            </div>
            <div className="modal-footer">
              {!preview.is_deleted && (
                <button
                  className="btn btn-danger"
                  onClick={async () => { await handleDelete(preview.id); setPreview(null); }}
                >
                  포스트 삭제
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>닫기</button>
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
