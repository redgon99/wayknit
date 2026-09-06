# Google 로그인 설정 (Wayknit / 여로담)

프로젝트: `ainftwifvclgiookzrwm`  
Supabase URL: `https://ainftwifvclgiookzrwm.supabase.co`

## 현재 상태 (확인됨)

- **이메일 매직 링크**: 정상 동작
- **Google 로그인**: Supabase에서 Provider **비활성** → `provider is not enabled` 오류

## 1. Google Cloud Console

1. [API 및 서비스 → 사용자 인증 정보](https://console.cloud.google.com/apis/credentials)
2. **OAuth 클라이언트 ID** 생성 (유형: **웹 애플리케이션**)
3. **승인된 리디렉션 URI**에 **아래 한 줄** 추가:

```
https://ainftwifvclgiookzrwm.supabase.co/auth/v1/callback
```

4. Client ID / Client Secret 복사

> 로그인만 쓰면 OAuth 자체는 무료입니다. Maps 등 다른 유료 API는 같은 프로젝트에서 켜지 않았는지 확인하세요.

## 2. Supabase 대시보드

### Google Provider

[Authentication → Providers → Google](https://supabase.com/dashboard/project/ainftwifvclgiookzrwm/auth/providers?provider=Google)

- **Enable Google** 켜기
- Client ID / Client Secret 붙여넣기
- 저장

### Redirect URLs

[URL Configuration](https://supabase.com/dashboard/project/ainftwifvclgiookzrwm/auth/url-configuration)

**Site URL** (예시):

```
http://localhost:5173
```

**Redirect URLs**에 추가:

```
http://localhost:5173/login
http://127.0.0.1:5173/login
```

배포(Netlify) URL이 있으면:

```
https://YOUR-SITE.netlify.app/login
```

## 3. 앱 `.env`

```env
VITE_AUTH_GOOGLE_ENABLED=true
```

`npm run dev` 재시작 후 `/login`에서 **Google로 계속** 버튼 확인.

## 반자동 스크립트 (선택)

Client ID/Secret과 Supabase Personal Access Token이 있으면:

```powershell
$env:GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="GOCSPX-..."
$env:SUPABASE_ACCESS_TOKEN="sbp_...."
.\scripts\configure-google-auth.ps1
```

토큰: https://supabase.com/dashboard/account/tokens
