export const metadata = {
  title: "이용약관 | wantsome",
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.8, color: "#222" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>이용약관</h1>
      <p style={{ color: "#888", marginBottom: 40 }}>최종 수정일: 2025년 00월 00일</p>

      {/* ====================================================================
          TODO: 아래 내용을 실제 서비스 이용약관으로 교체하세요.
          법무사 검토를 권장합니다.
      ==================================================================== */}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제1조 (목적)</h2>
        <p>본 약관은 wantsome(이하 "회사")이 운영하는 서비스의 이용조건 및 절차, 회사와 이용자 간의 권리·의무 등을 규정함을 목적으로 합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제2조 (서비스 이용 자격)</h2>
        <p>본 서비스는 만 18세 이상 성인만 이용 가능합니다. 회원가입 시 PASS 본인인증을 통해 연령을 확인합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제3조 (서비스 내용)</h2>
        <ul>
          <li>크리에이터와의 화상통화 서비스 (블루/레드 모드)</li>
          <li>크리에이터 예약 서비스</li>
          <li>크리에이터 쇼핑 서비스</li>
          <li>포인트 충전 및 사용</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제4조 (결제 및 환불)</h2>
        <p>포인트는 인앱 결제를 통해 구매하며, 관련 법령 및 앱스토어 정책에 따라 환불이 처리됩니다. 사용된 포인트는 환불되지 않습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제5조 (금지행위)</h2>
        <ul>
          <li>미성년자 이용</li>
          <li>성매매 유도 또는 알선</li>
          <li>불법 촬영 및 녹화</li>
          <li>타인 사칭</li>
          <li>서비스 시스템 해킹</li>
        </ul>
        <p>위반 시 즉시 서비스 이용이 제한될 수 있습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제6조 (면책조항)</h2>
        <p>회사는 크리에이터와 이용자 간 거래에서 발생하는 분쟁에 대해 중개자 역할만 합니다. 크리에이터가 제공하는 서비스 내용에 대한 책임은 해당 크리에이터에게 있습니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>제7조 (관할법원)</h2>
        <p>본 약관과 관련된 분쟁은 대한민국 법률에 따르며, 관할법원은 회사 소재지를 관할하는 법원으로 합니다.</p>
      </section>

      <p style={{ marginTop: 48, color: "#888", fontSize: 14 }}>
        본 약관은 2025년 00월 00일부터 시행됩니다.
      </p>
    </div>
  );
}
