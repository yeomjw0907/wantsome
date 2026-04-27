# wantsome — 관리자 페이지 설계 v2

> URL: admin.wantsome.kr
> 기술: Next.js 15 App Router (wantsome API 서버와 동일 repo)
> 접근: superadmin / admin 2단계 권한

---

## 관리자 권한 구조

| 기능 | superadmin | admin |
|------|-----------|-------|
| 크리에이터 승인/반려 | ✅ | ✅ |
| 신고 처리 (경고/7일/30일) | ✅ | ✅ |
| 유저 조회 | ✅ | ✅ |
| 대시보드/통계 조회 | ✅ | ✅ |
| 정산 내역 조회 | ✅ | ✅ |
| 배너 내용 수정 | ✅ | ✅ |
| 전체 푸시 발송 | ✅ | ✅ |
| **영구 정지 + CI 블랙리스트** | ✅ | ❌ |
| **포인트 수동 지급/차감** | ✅ | ❌ |
| **정산 이체 완료 처리** | ✅ | ❌ |
| **배너 ON/OFF 토글** | ✅ | ❌ |
| **시스템 설정 (긴급점검 등)** | ✅ | ❌ |
| **CI 블랙리스트 수동 추가/삭제** | ✅ | ❌ |
| **관리자 계정 추가/삭제/권한변경** | ✅ | ❌ |
| **관리자 활동 로그 조회** | ✅ | ❌ |
| **앱 버전 관리** | ✅ | ❌ |

### 최초 superadmin 세팅 (딱 1번)
```sql
-- Supabase SQL Editor에서 직접 실행
UPDATE users SET role = 'superadmin' WHERE id = '너의 user_id';
```
이후부터는 관리자 페이지 UI에서 관리

---

## 사이드바 메뉴 구조

```
📊 대시보드
👥 크리에이터
   ├── 승인 대기
   └── 전체 목록
🚨 신고 관리
👤 유저 관리
💰 포인트 관리         ← superadmin만
💳 정산 관리
📢 공지/배너
🔔 푸시 알림
🎧 고객센터
⚙️  시스템              ← superadmin만
   ├── 앱 버전 관리
   ├── 긴급 점검 모드
   └── CI 블랙리스트
👑 관리자 계정          ← superadmin만
   ├── 계정 목록
   └── 활동 로그
```

---

## 1. 대시보드 (/)

### 주요 지표 카드 (오늘 / 이번달 / 누적)

| 지표 | 설명 |
|------|------|
| 총 충전금 | point_charges SUM(amount_krw) |
| 플랫폼 순매출 | 충전금 × 0.70 × 0.25 |
| 신규 가입 | users COUNT(created_at) |
| 신규 크리에이터 | creator_profiles COUNT |
| 총 통화 시간 | call_sessions SUM(duration_sec) |
| 미처리 신고 | reports WHERE status='PENDING' |
| 승인 대기 | creator_profiles WHERE status='PENDING' |

### 차트
- 최근 7일 매출 추이 (Bar)
- 최근 7일 신규 가입 추이 (Line)
- 모드별 통화 비율 파란불/빨간불 (Pie)

---

## 2. 크리에이터 승인 (/creators/pending)

### 목록
- 신청일 / 닉네임 / 연령 / 신청 모드(🔵🔴) / 대기 시간
- 24시간 초과 시 빨간색 강조

### 상세 모달
```
┌─────────────────────────────┐
│ 프로필 사진 + 기본정보       │
│ 신청 모드: 🔵 파란불 🔴 빨간불│
│                              │
│ [신분증 보기] ← private URL  │
│  └ 신분증 이미지 팝업 표시   │
│                              │
│ 계좌: 국민은행 ***-**-****   │
│ 예금주: 홍길동               │
│                              │
│ 계약서: [PDF 보기]           │
│                              │
│ [반려] [승인 ✓]             │
└─────────────────────────────┘
```

### 승인 처리
```
승인 → creator_profiles.status = 'APPROVED'
     → creators 테이블 INSERT
     → 앱 푸시 "크리에이터 심사가 완료됐습니다 🎉"
     → Gmail: 승인 안내 이메일 발송 (Gmail MCP 활용)

반려 → status = 'REJECTED'
     → 반려 사유 입력 필수
     → 앱 푸시 "재제출 요청: {사유}"
     → Gmail: 반려 사유 이메일 발송
```

### 전체 목록 (/creators/list)
- 등급 필터 (신규/일반/인기/탑)
- 온라인 상태 필터
- 검색 (닉네임)
- 등급 수동 변경 버튼 → 탑 크리에이터 선정 (superadmin만)

---

## 3. 신고 관리 (/reports)

### 목록
- 카테고리 탭: 전체 / 미성년자 / 불법촬영 / 성매매 / 괴롭힘 / 사기 / 기타
- 컬럼: 신고일 / 카테고리 / 신고자 / 피신고자 / 상태 / 자동조치여부

### 상세 모달
```
신고자: @닉네임
피신고자: @닉네임
카테고리: 미성년자 의심 🔴
신고 시각: 2026-03-09 14:32
관련 통화: 통화 메타데이터 (duration, mode)
설명: "..."

현재 상태: 즉시 정지 처리됨 (자동)

[조치 버튼 - admin 가능]
경고  /  7일 정지  /  30일 정지  /  기각

[조치 버튼 - superadmin만]
영구 정지
```

### 조치별 처리
```
경고        → 경고 메시지 앱 푸시 발송
7일 정지    → suspended_until = NOW() + 7d
30일 정지   → suspended_until = NOW() + 30d
영구 정지   → suspended_until = '9999-12-31' + ci_blacklist INSERT (superadmin만)
기각        → reports.status = 'DISMISSED'
```

---

## 4. 유저 관리 (/users)

### 목록
- 검색: 닉네임 / 전화번호 (마스킹)
- 필터: 전체 / 정지중 / 크리에이터 / 탈퇴
- 컬럼: 가입일 / 닉네임 / 역할 / 포인트잔액 / 총충전금 / 상태

### 상세 모달
```
기본 정보 (닉네임, 가입일, 역할, 인증여부)
포인트 잔액: 12,500P
총 충전 내역: 89,700원
통화 기록: 23건 / 총 145분
탈퇴 여부: 정상 / 탈퇴(탈퇴일 표시)

[정지]                ← admin 가능
[포인트 지급/차감]    ← superadmin만
[영구 차단]           ← superadmin만
```

---

## 5. 포인트 관리 (/points) ← superadmin만

### 수동 지급/차감
```
유저 검색 (닉네임 or ID)
  └ 지급 / 차감 선택
  └ 포인트 입력
  └ 사유 입력 (필수)
  └ [처리]

처리 시:
  users.points += amount (지급) or -= amount (차감)
  point_charges INSERT (type='manual_grant' or 'manual_deduct')
  admin_note 기록
  슬랙 #포인트-로그 알림
```

### 충전 내역 로그
- 날짜 범위 필터
- 플랫폼 (iOS/Android) 필터
- 상품별 집계 테이블
- CSV 다운로드

---

## 6. 정산 관리 (/settlements)

### 월별 정산 목록
- 기간 선택 (월)
- 크리에이터별: 총포인트 / 세전금액 / 원천징수 / 실지급액 / 상태

### 정산 상세
```
크리에이터: @닉네임
정산 기간: 2026년 2월
계좌: 국민은행 ***-**-**** (홍길동)

총 통화 포인트: 125,000P
정산율: 75%
세전 정산액: 93,750원
원천징수 (3.3%): 3,094원
실지급액: 90,656원

상태: 대기중

[이체 완료 처리] ← superadmin만
```

### 정산 분쟁 처리
```
크리에이터가 정산액 이의 제기 시:
  → 정산 상세에서 [분쟁 처리] 버튼
  → 해당 월 call_sessions 원본 데이터 조회
  → 수동 재계산 후 [정산액 수정] (superadmin만)
  → Gmail: 크리에이터에게 수정 내역 발송
```

### 일괄 처리
- 해당 월 전체 "이체 완료" 일괄 처리 버튼 (superadmin만)
- 처리 후 크리에이터 앱 푸시 "정산이 완료됐습니다 💰"
- Gmail: 정산 완료 이메일 일괄 발송

---

## 7. 공지/배너 관리 (/banners)

### 배너 목록
| 배너 | 위치 | 상태 | 기간 |
|------|------|------|------|
| 첫충전 100% 이벤트 | 충전화면 상단 | 🟢 ON | 상시 |
| 신규 크리에이터 이벤트 | 메인 피드 | 🔴 OFF | - |

### 배너 편집 (admin 가능)
```
제목, 설명, 이미지 URL
노출 위치: 충전화면 / 메인피드 / 온보딩
노출 기간: 시작일 ~ 종료일
```

### ON/OFF 토글 (superadmin만)
```
→ Supabase banners 테이블 업데이트
→ 앱은 시작 시 banners 테이블 조회해서 즉시 반영
```

### 첫충전 이벤트 컨트롤 (superadmin만)
```
첫충전 보너스율: [100]% ← 수정 가능
이벤트 유효시간: [72]시간
ON/OFF 토글
```

---

## 8. 푸시 알림 관리 (/push)

### 전체 푸시 발송
```
대상: 전체 유저 / 소비자만 / 크리에이터만 / 특정 유저 ID
제목 입력
내용 입력
예약 발송 (날짜/시간 설정) or 즉시 발송

→ Expo Notifications 일괄 발송
→ 발송 이력 로그 저장
```

### 발송 이력
- 발송일 / 대상 / 제목 / 발송수 / 성공수

---

## 9. 고객센터 (/cs)

### CS 채널 설정 (superadmin만)
```
카카오 오픈채팅 URL: [________________]
  ← URL 생기면 여기 입력
  → system_config('cs_url') 업데이트
  → 앱 내 고객센터 버튼에 즉시 반영
```

### 앱 내 고객센터 버튼 동작
```
앱 시작 시 /api/system/status 조회
→ cs_url 값 있으면 → 웹뷰로 오픈채팅 열기
→ cs_url 없으면   → "준비 중입니다" 메시지 표시
```

### 환불 처리 원칙
```
앱스토어 결제 환불 → 애플/구글이 직접 처리 (wantsome 개입 불가)

미사용 포인트 환불 요청 시 (예외 케이스):
  → 관리자 포인트 차감 (superadmin)
  → 계좌 수동 이체
  → point_charges INSERT (type='refund')

환불 불가 기준:
  - 이미 통화에 사용된 포인트
  - 이벤트 보너스 포인트
  - 정책 위반으로 정지된 계정
```

---

## 10. 시스템 (/system) ← superadmin만

### 앱 버전 관리
```
최소 지원 버전:
  iOS:     [1.0.0] ← 수정 가능
  Android: [1.0.0] ← 수정 가능

강제 업데이트 메시지:
  [새 버전이 출시됐습니다. 업데이트 후 이용해주세요.]

→ 앱 시작 시 버전 체크:
   현재 앱 버전 < min_version
   → 강제 업데이트 화면 표시 (뒤로가기 불가)
   → 업데이트 버튼 → 앱스토어/플레이스토어 이동
```

### 긴급 점검 모드
```
ON/OFF 토글
점검 메시지 입력
예상 완료 시각 입력

→ 앱 시작 시 maintenance=true → 점검 화면 표시
→ 관리자는 점검 중에도 접속 가능
```

### CI 블랙리스트
- 목록: CI(마스킹) / 등록일 / 사유 / 등록자
- 수동 추가: CI 직접 입력 + 사유
- 삭제 (실수 등록 시, 사유 필수)

### system_config 전체 초기값
```sql
INSERT INTO system_config (key, value, updated_at) VALUES
  ('maintenance_mode',        'false',                                        NOW()),
  ('maintenance_message',     '서비스 점검 중입니다.',                          NOW()),
  ('maintenance_eta',         '',                                             NOW()),
  ('first_charge_bonus_rate', '100',                                          NOW()),
  ('first_charge_hours',      '72',                                           NOW()),
  ('cs_url',                  '',                                             NOW()),
  ('min_version_ios',         '1.0.0',                                        NOW()),
  ('min_version_android',     '1.0.0',                                        NOW()),
  ('force_update_message',    '새 버전이 출시됐습니다. 업데이트 후 이용해주세요.', NOW());
```

---

## 11. 관리자 계정 (/admins) ← superadmin만

### 계정 목록
| 이름 | 이메일 | 권한 | 가입일 | 최근 접속 | 상태 |
|------|--------|------|--------|---------|------|
| 홍길동 | admin@wantsome.kr | superadmin | 2026-03-01 | 방금 | 활성 |
| 김철수 | cs@wantsome.kr | admin | 2026-03-05 | 1시간 전 | 활성 |

### 계정 추가
```
이름 입력
이메일 입력
권한 선택: superadmin / admin
임시 비밀번호 자동 생성
→ Gmail: 초대 이메일 발송 (임시 비번 포함)
→ 최초 로그인 시 비밀번호 변경 강제
```

### 계정 관리
```
[권한 변경] superadmin ↔ admin
[비밀번호 초기화] → Gmail 발송
[계정 비활성화] → 로그인 차단
[계정 삭제]
```

### 활동 로그 (/admins/logs)
```
모든 관리자 행위 자동 기록:
  - 로그인/로그아웃
  - 크리에이터 승인/반려
  - 신고 조치
  - 포인트 지급/차감
  - 정산 이체 완료
  - 시스템 설정 변경
  - 관리자 계정 변경

컬럼: 시각 / 관리자 / 행위 / 대상 / 상세내용 / IP
```

---

## 탈퇴 처리 설계

### 앱에서 탈퇴 요청 시
```
탈퇴 전 체크:
  1. 잔여 포인트 > 0 → "포인트가 소멸됩니다. 계속하시겠습니까?"
  2. 크리에이터인 경우 미정산 수익 > 0 → "정산 후 탈퇴해주세요"
  3. 진행 중인 통화 → 탈퇴 불가

탈퇴 처리 (소프트 딜리트):
  users.deleted_at    = NOW()
  users.nickname      = '탈퇴한 유저'
  users.profile_img   = NULL
  users.phone         = NULL        ← 개인정보 즉시 삭제
  users.verified_name = NULL
  잔여 포인트         = 0 (소멸)

보관 기간:
  CI           → 90일 후 삭제 (재가입 방지 기간)
  통화 메타데이터 → 90일 후 삭제
  신고 이력    → 영구 보관 (법적 근거)
```

---

## DB 추가 테이블

```sql
-- 관리자 활동 로그
CREATE TABLE admin_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT,   -- 'user'|'creator'|'report'|'settlement'|'system'|'admin'
  target_id   TEXT,
  detail      JSONB,
  ip          VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_admin_logs ON admin_logs(admin_id, created_at);

-- 푸시 발송 이력
CREATE TABLE push_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES users(id),
  target        TEXT,   -- 'all'|'consumer'|'creator'|'{user_id}'
  title         TEXT,
  body          TEXT,
  sent_count    INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- users 탈퇴 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- users role 확장 (superadmin 추가)
-- role: 'consumer'|'creator'|'both'|'admin'|'superadmin'
```

---

## 관리자 인증 미들웨어

```ts
// middleware.ts (Next.js)
const SUPERADMIN_ONLY = ['/admin/points', '/admin/system', '/admin/admins']

export async function middleware(req: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.redirect('/admin/login')

  const { data: user } = await supabase
    .from('users')
    .select('role, deleted_at')
    .eq('id', session.user.id)
    .single()

  const isAdmin = ['admin', 'superadmin'].includes(user?.role)
  if (!isAdmin || user?.deleted_at) return NextResponse.redirect('/admin/unauthorized')

  // superadmin 전용 경로 체크
  const isSuperOnly = SUPERADMIN_ONLY.some(p => req.nextUrl.pathname.startsWith(p))
  if (isSuperOnly && user.role !== 'superadmin') {
    return NextResponse.redirect('/admin/unauthorized')
  }
}

export const config = { matcher: ['/admin/:path*'] }
```

---

## MCP 활용 가이드

### Supabase MCP 🔴 필수 (개발 시작 전 세팅)
```
Cursor에서 DB 직접 조작:
  - 테이블 생성/수정
  - RLS 정책 설정
  - 쿼리 최적화
  - 마이그레이션 실행

설정: Cursor Settings → MCP → Add → Supabase
```

### Slack MCP 🔴 필수 (운영 필수)
```
신고/정산/포인트 알림 자동화
Cursor가 웹훅 코드 직접 테스트/수정 가능

슬랙 채널:
  #긴급-신고       ← 미성년자/불법촬영 즉시
  #크리에이터-심사  ← 승인 대기
  #포인트-로그     ← 수동 지급/차감
  #정산-알림       ← 월 정산
  #매출-리포트     ← 매일 오전 9시 자동
  #운영-알림       ← 탈퇴/강제업데이트 등
```

### Gmail MCP 🟡 권장
```
크리에이터 심사 결과 이메일
정산 완료 알림
관리자 초대 이메일
정산 분쟁 처리 결과
Cursor가 이메일 템플릿 직접 작성 가능
```

### GitHub MCP 🟡 권장
```
PR 생성, 이슈 관리
Cursor가 직접 커밋/PR 생성 가능
```

### Vercel MCP 🟡 권장
```
배포 상태 확인, 환경변수 관리
Cursor가 배포 로그 보면서 에러 수정
```

### Sentry MCP 🟢 운영 후 추가
```
에러 로그 → Cursor가 바로 수정
운영 시작 후 추가 권장
```

---

## 슬랙 알림 기준

| 이벤트 | 채널 | 긴급도 |
|--------|------|--------|
| 미성년자/불법촬영 신고 | #긴급-신고 | 🔴 즉시 |
| 크리에이터 승인 신청 | #크리에이터-심사 | 🟡 1시간 내 |
| 포인트 수동 처리 | #포인트-로그 | 🟢 기록용 |
| 정산 완료 | #정산-알림 | 🟢 기록용 |
| 일 매출 리포트 | #매출-리포트 | 🟢 매일 오전 9시 |
| 탈퇴 유저 발생 | #운영-알림 | 🟢 기록용 |
| 강제 업데이트 발동 | #운영-알림 | 🟡 확인 필요 |
