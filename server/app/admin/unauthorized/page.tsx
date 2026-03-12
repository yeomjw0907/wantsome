export default function UnauthorizedPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#1B2A4A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "16px",
      color: "white",
      fontFamily: "sans-serif",
    }}>
      <div style={{ fontSize: "48px" }}>🚫</div>
      <h1 style={{ fontSize: "24px", fontWeight: 700 }}>접근 권한이 없습니다</h1>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>이 페이지는 관리자만 접근할 수 있습니다.</p>
      <a href="/admin/login" style={{
        background: "#FF6B9D",
        color: "white",
        padding: "10px 24px",
        borderRadius: "10px",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: 600,
        marginTop: "8px",
      }}>
        로그인으로 돌아가기
      </a>
    </div>
  );
}
