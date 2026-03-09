# wantsome — API 서버 설정 가이드 (4단계)

## 1. Supabase DB 설정

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **SQL Editor** 열기
3. `server/supabase/001_initial.sql` 내용을 복사해 붙여넣고 **Run** 실행
4. `system_config`, `users`, `ci_blacklist` 테이블과 RLS가 생성됩니다.

## 2. API 서버 로컬 실행

```bash
cd server
cp .env.example .env
# .env에 Supabase URL, anon key, service_role key 입력
npm install
npm run dev
```

- 서버: http://localhost:3000
- 공개 API: `GET /api/system/status`, `POST /api/auth/social-login`, `POST /api/auth/verify-identity`
- 인증 필요: `GET /api/users/me` (Authorization: Bearer \<Supabase access_token\>)

## 3. 앱에서 API 주소 지정

Expo 앱 `.env.local`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

실기기에서 로컬 서버 접속 시 같은 Wi‑Fi에서 PC IP 사용 (예: `http://192.168.0.10:3000`).

## 4. Vercel 배포 (선택)

1. Vercel에 `server` 폴더만 배포하거나, 루트를 `server`로 설정
2. 환경 변수: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (필수)
3. 앱 `EXPO_PUBLIC_API_BASE_URL`을 Vercel URL로 변경 (예: `https://xxx.vercel.app`)

## 5. 엔드포인트 요약

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/system/status | 없음 | 점검/버전/cs_url |
| POST | /api/auth/social-login | body: provider, token | 소셜 로그인 후 users upsert |
| POST | /api/auth/verify-identity | body: identityVerificationId, userId | 본인인증 처리 |
| GET | /api/users/me | Bearer JWT | 내 정보·포인트·정지 여부 |
