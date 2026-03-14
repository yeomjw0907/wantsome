export const metadata = {
  title: "개인정보처리방침 | wantsome",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.8, color: "#222" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: "#888", marginBottom: 40 }}>최종 수정일: 2025년 00월 00일</p>

      {/* ====================================================================
          TODO: 아래 내용을 실제 개인정보처리방침으로 교체하세요.
          법무사 또는 개인정보보호 전문가의 검토를 권장합니다.
          참고: https://www.privacy.go.kr (개인정보보호위원회)
      ==================================================================== */}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>1. 수집하는 개인정보 항목</h2>
        <p>wantsome(이하 "회사")은 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.</p>
        <ul>
          <li>필수: 이름, 생년월일, 휴대폰 번호 (PASS 본인인증)</li>
          <li>선택: 프로필 사진, 닉네임</li>
          <li>자동 수집: 기기 정보, 서비스 이용 기록, 접속 로그</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>2. 개인정보의 수집 및 이용목적</h2>
        <ul>
          <li>회원 가입 및 관리</li>
          <li>서비스 제공 (화상통화, 예약, 쇼핑)</li>
          <li>본인인증 및 연령 확인 (만 18세 이상)</li>
          <li>결제 처리 및 환불</li>
          <li>고객 문의 처리</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>3. 개인정보의 보유 및 이용기간</h2>
        <p>회원 탈퇴 시 즉시 파기. 단, 관계 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>
        <ul>
          <li>전자상거래 기록: 5년 (전자상거래법)</li>
          <li>소비자 불만·분쟁 기록: 3년 (전자상거래법)</li>
          <li>접속 로그: 3개월 (통신비밀보호법)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>4. 개인정보의 제3자 제공</h2>
        <p>회사는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 법령에 의거하거나 수사 기관의 적법한 요청이 있는 경우 예외로 합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>5. 개인정보 보호책임자</h2>
        <p>이름: [담당자명]<br />이메일: [이메일 주소]<br />연락처: [전화번호]</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>6. 이용자의 권리</h2>
        <p>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 앱 내 고객센터 또는 이메일로 요청하세요.</p>
      </section>

      <p style={{ marginTop: 48, color: "#888", fontSize: 14 }}>
        본 방침은 2025년 00월 00일부터 시행됩니다.
      </p>
    </div>
  );
}
