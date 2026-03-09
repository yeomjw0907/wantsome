# wantsome

> MEET SOMEONE SPECIAL  
> 성인 영상통화 플랫폼

**wantsome(원썸)**은 크리에이터 친화형 라이브 영상통화 앱입니다.  
iOS / Android / Web 지원, Expo 기반 React Native 프로젝트입니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React Native, Expo SDK 55, Expo Router |
| 스타일링 | NativeWind (TailwindCSS) |
| 상태관리 | Zustand |
| 백엔드 | Supabase (Auth, Realtime, Storage) |
| 언어 | TypeScript |

---

## 시작하기

### 요구사항

- Node.js 18+
- npm 또는 yarn

### 설치

```bash
git clone https://github.com/yeomjw0907/wantsome.git
cd wantsome
npm install
```

### 환경 변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```bash
cp .env.example .env.local
```

필수 변수 예시:

- `EXPO_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

### 실행

```bash
# 개발 서버
npm start

# 플랫폼별 실행
npm run android
npm run ios
npm run web
```

---

## 프로젝트 구조

```
app/
├── (auth)/          # 로그인, 약관, 본인인증 등 (비로그인)
├── (app)/           # 메인 앱 (피드, 예약, 프로필, 통화, 충전)
└── (creator)/       # 크리에이터 온보딩·대시보드

components/          # 공통 UI 컴포넌트
stores/              # Zustand 스토어
hooks/               # 커스텀 훅
lib/                 # API, Supabase 클라이언트
constants/           # 상수·상품 정의
docs/                # API·디자인·DB 등 문서
```

---

## 문서

자세한 스펙과 가이드는 `docs/` 폴더를 참고하세요.

- **[docs/README.md](docs/README.md)** — 문서 구조 안내 + **버전 이력**
- **[docs/todo.md](docs/todo.md)** — 내일/단기 할 일
- `docs/context/` — 프로젝트 개요, 비즈니스 규칙, 앱 초기화
- `docs/api/` — 인증, 통화, 결제, 크리에이터 API
- `docs/screens/` — 화면별 스펙
- `docs/database/` — DB 스키마
- `docs/GUIDE_*.md` — API 서버, 소셜 로그인, Android 에뮬레이터 등

---

## 라이선스

Private — 원썸 컴퍼니 (WS Company)
