# 02. Twilio SMS 설정 (전화번호 OTP 인증)

> **선행 조건:** 없음 (사업자 등록 불필요)
> **소요 시간:** 30분
> **비용:** 약 62원/건 (한국 +82)
> **왜 필요한가:** 전화번호 로그인 시 Supabase가 OTP SMS를 발송해야 함

---

## 전체 흐름

```
Supabase Auth (전화번호 OTP 요청)
    ↓
Twilio (SMS 발송 → 사용자 +82-010-xxxx-xxxx)
    ↓
사용자 6자리 코드 입력 → Supabase 인증 완료
```

---

## Step 1. Twilio 계정 생성

1. [twilio.com](https://www.twilio.com) 접속 → **Sign Up** 클릭
2. 이메일, 비밀번호 입력
3. 전화번호 인증 (본인 번호)
4. 설문 응답:
   - "What do you want to build?" → **SMS**
   - "What do you plan to build with Twilio?" → **Verify users with OTP**
   - "How do you want to build?" → **With code**

---

## Step 2. Console 설정

### 2-1. Account SID / Auth Token 확인

1. [console.twilio.com](https://console.twilio.com) 접속 (로그인 후 자동 이동)
2. 대시보드 상단에 바로 표시:

```
Account SID:  ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token:   (클릭하면 보임) xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ Auth Token은 절대 외부에 노출하지 마세요. `.env`에만 저장.

### 2-2. Messaging Service 생성 (한국 발신용)

한국(+82) SMS 발송은 일반 Twilio 번호가 아닌 **Messaging Service**를 사용해야 합니다.

1. 좌측 메뉴 → **Messaging** → **Services** 클릭
2. **Create Messaging Service** 버튼 클릭
3. 설정:
   ```
   Friendly Name: wantsome-otp
   Use case: Verify Users with OTP
   ```
4. **Add Senders** 단계 → **Buy a Number** 클릭
   - Country: United States (한국 발신은 US 번호로도 가능)
   - Type: Local
   - 적당한 번호 구매 (~$1.15/월)
5. **Step 3: Set up integration** → 기본값 유지
6. 완료 후 **Service SID** 확인:
   ```
   Messaging Service SID: MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

> 💡 **Alphanumeric Sender ID (발신자 이름)**: 일부 국가에서 번호 대신 "wantsome" 같은 이름으로 발신 가능. 한국은 현재 지원 안 됨.

---

## Step 3. Supabase Phone Auth 활성화

1. [supabase.com/dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 `ftnfdtvaxsvosdyjdxfq` 선택
3. 좌측 메뉴 → **Authentication** → **Providers**
4. **Phone** 항목 찾아서 클릭
5. 설정:

```
Enable Phone provider: ✅ ON (토글 활성화)

SMS provider: Twilio

Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Message Service SID: MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

6. **Save** 버튼 클릭

---

## Step 4. 테스트

Supabase Dashboard → **Authentication** → **Users** → **Add user** → 전화번호로 테스트 유저 추가 후 앱에서 OTP 발송 테스트.

또는 SQL Editor에서 직접 확인:
```sql
-- OTP 로그 확인 (Supabase 내부)
SELECT * FROM auth.users WHERE phone IS NOT NULL ORDER BY created_at DESC LIMIT 10;
```

---

## 비용 계산

| 건수 | 단가 | 월 비용 |
|------|------|---------|
| 100건 | $0.045 (62원) | 약 6,200원 |
| 1,000건 | $0.045 (62원) | 약 62,000원 |
| 5,000건 | $0.045 (62원) | 약 310,000원 |
| Twilio 번호 유지비 | $1.15/월 | 약 1,600원 |

> 사업자 등록 후 NHN Cloud로 전환하면 **8원/건**으로 약 7.7배 절감됩니다.
> → [08_nhn-sms.md](08_nhn-sms.md) 참고

---

## 완료 체크

- [ ] Twilio 계정 생성
- [ ] Account SID 확인 및 저장
- [ ] Auth Token 확인 및 저장
- [ ] Messaging Service 생성 → Service SID 확인
- [ ] Supabase → Authentication → Phone Provider 활성화
- [ ] Twilio 3개 값 Supabase에 입력 + Save
- [ ] 앱에서 전화번호 OTP 수신 테스트 ✅

---

## 환경 변수 (참고)

Twilio 키는 Supabase Dashboard에서 관리하므로 별도 `.env` 설정 불필요.
Supabase가 Twilio API를 직접 호출합니다.
