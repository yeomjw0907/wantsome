export const metadata = {
  title: "개인정보처리방침 | wantsome",
};

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 14 };
const thStyle: React.CSSProperties = { background: "#F9FAFB", padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #E5E7EB", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #E5E7EB", verticalAlign: "top" };
const secStyle: React.CSSProperties = { marginBottom: 36 };
const h2Style: React.CSSProperties = { fontSize: 19, fontWeight: 700, marginBottom: 12, color: "#1B2A4A" };
const ulStyle: React.CSSProperties = { paddingLeft: 20 };
const liStyle: React.CSSProperties = { marginBottom: 6 };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px", fontFamily: "sans-serif", lineHeight: 1.9, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>개인정보처리방침</h1>
      <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>시행일: 2026년 4월 27일 | 최종 수정일: 2026년 4월 27일</p>

      <div style={{ background: "#FFF5F7", border: "1px solid #FECDD3", borderRadius: 8, padding: "12px 16px", marginBottom: 32, fontSize: 14, color: "#BE123C" }}>
        ⚠️ wantsome 서비스는 <strong>만 19세 이상만</strong> 이용할 수 있습니다. 본 방침은 크리에이터 영상통화 서비스 운영에 관한 개인정보 처리 방침입니다.
      </div>

      <section style={secStyle}>
        <h2 style={h2Style}>제1조 (개인정보 수집 항목)</h2>
        <p>wantsome(이하 "회사")은 서비스 제공을 위해 최소한의 개인정보를 수집합니다.</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>구분</th>
              <th style={thStyle}>수집 항목</th>
              <th style={thStyle}>필수/선택</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>소셜 로그인 (Google/Apple/카카오)</td>
              <td style={tdStyle}>이메일 주소, 이름, 프로필 사진</td>
              <td style={tdStyle}>필수</td>
            </tr>
            <tr>
              <td style={tdStyle}>전화번호 로그인</td>
              <td style={tdStyle}>휴대폰 번호</td>
              <td style={tdStyle}>필수</td>
            </tr>
            <tr>
              <td style={tdStyle}>연령 확인</td>
              <td style={tdStyle}>생년월일 (기기에만 저장, 서버 미전송)</td>
              <td style={tdStyle}>필수</td>
            </tr>
            <tr>
              <td style={tdStyle}>화상·음성통화</td>
              <td style={tdStyle}>통화 로그 (세션 ID, 시작·종료 시간). 영상·음성 데이터는 서버에 저장되지 않습니다.</td>
              <td style={tdStyle}>자동 수집</td>
            </tr>
            <tr>
              <td style={tdStyle}>결제</td>
              <td style={tdStyle}>포인트 거래 내역, 앱스토어 영수증 ID (카드 정보는 앱스토어가 처리하며 회사 미수집)</td>
              <td style={tdStyle}>자동 수집</td>
            </tr>
            <tr>
              <td style={tdStyle}>서비스 이용</td>
              <td style={tdStyle}>접속 로그, IP 주소, 앱 버전, 기기 모델, OS 버전</td>
              <td style={tdStyle}>자동 수집</td>
            </tr>
            <tr>
              <td style={tdStyle}>신고 정보</td>
              <td style={tdStyle}>신고자 ID, 피신고자 ID, 신고 사유</td>
              <td style={tdStyle}>자동 수집</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제2조 (개인정보 수집 및 이용 목적)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>회원 가입 및 관리: 본인 확인, 중복 가입·부정 이용 방지</li>
          <li style={liStyle}>연령 인증: 만 19세 미만 이용자 접근 차단 (정보통신망법, 청소년보호법)</li>
          <li style={liStyle}>서비스 제공: 화상통화 연결, 크리에이터 예약, 쇼핑, 포인트 관리</li>
          <li style={liStyle}>결제 처리: 인앱 결제 확인, 포인트 지급 및 정산</li>
          <li style={liStyle}>서비스 개선: 이용 패턴 분석, 오류 진단 (비식별 처리)</li>
          <li style={liStyle}>법적 의무 이행: 신고 처리, 수사 기관 협조, 분쟁 해결</li>
          <li style={liStyle}>고객 지원: 민원 처리 및 공지 발송</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제3조 (개인정보의 보유 및 이용 기간)</h2>
        <p>서비스 탈퇴 시 개인정보를 즉시 파기합니다. 단, 관계 법령에 따라 일정 기간 보관합니다.</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>항목</th>
              <th style={thStyle}>보유 기간</th>
              <th style={thStyle}>근거 법령</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>전자상거래 거래 기록</td>
              <td style={tdStyle}>5년</td>
              <td style={tdStyle}>전자상거래 등에서의 소비자 보호에 관한 법률</td>
            </tr>
            <tr>
              <td style={tdStyle}>소비자 불만·분쟁 기록</td>
              <td style={tdStyle}>3년</td>
              <td style={tdStyle}>전자상거래 등에서의 소비자 보호에 관한 법률</td>
            </tr>
            <tr>
              <td style={tdStyle}>접속 로그 (IP 등)</td>
              <td style={tdStyle}>3개월</td>
              <td style={tdStyle}>통신비밀보호법</td>
            </tr>
            <tr>
              <td style={tdStyle}>신고 처리 기록</td>
              <td style={tdStyle}>3년</td>
              <td style={tdStyle}>내부 운영 방침 (분쟁 해결 목적)</td>
            </tr>
            <tr>
              <td style={tdStyle}>통화 메타데이터</td>
              <td style={tdStyle}>90일</td>
              <td style={tdStyle}>결제 정확성 확인 목적</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제4조 (개인정보의 제3자 제공)</h2>
        <p>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 다음의 경우 예외입니다.</p>
        <ul style={ulStyle}>
          <li style={liStyle}>이용자가 사전에 동의한 경우</li>
          <li style={liStyle}>법령에 의거하거나 수사기관이 적법하게 요청하는 경우</li>
          <li style={liStyle}>미성년자 이용 의심 등 긴급히 생명·신체 보호가 필요한 경우</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제5조 (개인정보 처리 위탁)</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>수탁업체</th>
              <th style={thStyle}>위탁 업무</th>
              <th style={thStyle}>보유·이용 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Supabase Inc.</td>
              <td style={tdStyle}>인증 및 데이터베이스 서비스</td>
              <td style={tdStyle}>서비스 이용 기간</td>
            </tr>
            <tr>
              <td style={tdStyle}>Agora.io Inc.</td>
              <td style={tdStyle}>화상·음성통화 인프라 (통화 내용 미저장)</td>
              <td style={tdStyle}>통화 세션 종료 즉시 파기</td>
            </tr>
            <tr>
              <td style={tdStyle}>Apple Inc. / Google LLC</td>
              <td style={tdStyle}>인앱 결제 처리</td>
              <td style={tdStyle}>각 사 정책에 따름</td>
            </tr>
            <tr>
              <td style={tdStyle}>Vercel Inc.</td>
              <td style={tdStyle}>서버 호스팅 및 CDN</td>
              <td style={tdStyle}>서비스 이용 기간</td>
            </tr>
            <tr>
              <td style={tdStyle}>주식회사 코리아포트원 (PortOne)</td>
              <td style={tdStyle}>굿즈(실물) 결제 처리, 본인인증(PASS) 중개</td>
              <td style={tdStyle}>「전자상거래 등에서의 소비자보호에 관한 법률」에 따른 5년</td>
            </tr>
            <tr>
              <td style={tdStyle}>Slack Technologies, LLC</td>
              <td style={tdStyle}>운영자 알림 (정산 요약·신고 알림 — 개인 식별정보 포함되지 않음)</td>
              <td style={tdStyle}>알림 처리 후 30일</td>
            </tr>
            <tr>
              <td style={tdStyle}>Expo (Expo, Inc.)</td>
              <td style={tdStyle}>푸시 알림 발송 (Expo Push Notification Service)</td>
              <td style={tdStyle}>회원 탈퇴 또는 푸시 토큰 폐기 시까지</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
          위탁업무의 내용이나 수탁자가 변경될 경우 본 처리방침을 통해 지체 없이 공지합니다.
        </p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제6조 (화상통화·음성 데이터 처리 특칙)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}><strong>비저장 원칙:</strong> 화상통화 및 음성 데이터는 Agora WebRTC 기술로 실시간 전달되며, 당사 서버에 저장되지 않습니다.</li>
          <li style={liStyle}><strong>암호화 전송:</strong> 통화 내용은 AES-128 암호화를 적용하여 전송됩니다.</li>
          <li style={liStyle}><strong>녹화·캡처 방지:</strong> 앱은 OS 수준의 화면 녹화 및 캡처 방지 기능을 적용합니다.</li>
          <li style={liStyle}><strong>통화 메타데이터:</strong> 세션 ID, 시작·종료 시간, 요금 정보는 결제 정확성 확인 목적으로만 90일 보관 후 삭제합니다.</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제7조 (이용자 권리 및 행사 방법)</h2>
        <p>이용자 및 법정 대리인은 언제든지 다음 권리를 행사할 수 있습니다.</p>
        <ul style={ulStyle}>
          <li style={liStyle}>개인정보 열람 요청</li>
          <li style={liStyle}>오류 정정 요청</li>
          <li style={liStyle}>삭제(회원 탈퇴) 요청</li>
          <li style={liStyle}>처리 정지 요청</li>
        </ul>
        <p><strong>요청 방법:</strong> 앱 내 마이페이지 → 설정 → 회원 탈퇴 또는 이메일(privacy@wantsome.kr)</p>
        <p>요청 접수 후 10일 이내에 처리 결과를 안내합니다.</p>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제8조 (개인정보의 파기)</h2>
        <ul style={ulStyle}>
          <li style={liStyle}>전자 파일: 복구 불가능한 방식으로 영구 삭제</li>
          <li style={liStyle}>기기 저장 데이터: 앱 삭제 또는 초기화 시 자동 삭제</li>
        </ul>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제9조 (개인정보 보호책임자)</h2>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600, width: 180 }}>이메일</td>
              <td style={tdStyle}>privacy@wantsome.kr</td>
            </tr>
            <tr>
              <td style={{ ...tdStyle, fontWeight: 600 }}>개인정보 침해 신고</td>
              <td style={tdStyle}>개인정보보호위원회 (www.privacy.go.kr, 국번없이 182)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={secStyle}>
        <h2 style={h2Style}>제10조 (방침 변경)</h2>
        <p>본 방침 변경 시 시행 7일 전 앱 및 웹사이트를 통해 공지합니다. 중요 변경 사항은 30일 전에 공지합니다.</p>
      </section>

      <div style={{ marginTop: 60, borderTop: "1px solid #E5E7EB", paddingTop: 24, color: "#888", fontSize: 13 }}>
        <p>본 개인정보처리방침은 <strong>2026년 4월 27일</strong>부터 시행됩니다.</p>
        <p>wantsome | privacy@wantsome.kr | wantsome.kr</p>
      </div>
    </div>
  );
}
