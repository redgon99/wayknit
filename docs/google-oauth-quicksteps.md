# Google OAuth 빠른 설정 (프로젝트 api-project-371034185952)

브라우저에 GCP가 열려 있을 때 **아래만 그대로** 입력하세요.

## A. OAuth 동의 화면 (처음 한 번)

1. **User Type**: 외부(External) → 만들기
2. **앱 이름**: `여로담` (또는 `Wayknit`)
3. **사용자 지원 이메일**: 본인 Gmail
4. **개발자 연락처 이메일**: 본인 Gmail
5. 저장 → **테스트 사용자**에 본인 Gmail 추가 (테스트 모드일 때)

## B. OAuth 클라이언트 ID 만들기

1. **애플리케이션 유형**: 웹 애플리케이션
2. **이름**: `Wayknit Web`
3. **승인된 JavaScript 원본** (선택, 로컬용):
   - `http://localhost:5173`
4. **승인된 리디렉션 URI** (필수, 정확히 한 줄):

```
https://ainftwifvclgiookzrwm.supabase.co/auth/v1/callback
```

5. **만들기** → **클라이언트 ID** / **클라이언트 보안 비밀번호** 복사

## C. Supabase에 붙여넣기

https://supabase.com/dashboard/project/ainftwifvclgiookzrwm/auth/providers?provider=Google

- Enable Google ON
- Client ID / Client Secret 붙여넣기 → Save

## D. Redirect URLs

https://supabase.com/dashboard/project/ainftwifvclgiookzrwm/auth/url-configuration

- `http://localhost:5173/login` 추가

## E. 앱 .env

```
VITE_AUTH_GOOGLE_ENABLED=true
```

`npm run dev` 재시작
