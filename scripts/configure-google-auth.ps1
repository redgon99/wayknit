# Wayknit (여로담) — Google OAuth + Supabase 연동 (반자동)
# Google Client ID/Secret은 GCP에서 직접 발급해야 합니다.
#
# 사용 예:
#   $env:GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
#   $env:GOOGLE_CLIENT_SECRET="GOCSPX-..."
#   $env:SUPABASE_ACCESS_TOKEN="sbp_..."   # https://supabase.com/dashboard/account/tokens
#   .\scripts\configure-google-auth.ps1

$ErrorActionPreference = 'Stop'
$ProjectRef = 'ainftwifvclgiookzrwm'
$CallbackUrl = "https://$ProjectRef.supabase.co/auth/v1/callback"

Write-Host ""
Write-Host "=== Wayknit Google 로그인 설정 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) Google Cloud Console — OAuth 클라이언트 만들기"
Write-Host "   승인된 리디렉션 URI에 아래를 추가:"
Write-Host "   $CallbackUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "2) Supabase — Google Provider 활성화 + Client ID/Secret 입력"
Write-Host "   https://supabase.com/dashboard/project/$ProjectRef/auth/providers?provider=Google"
Write-Host ""
Write-Host "3) Supabase — Redirect URLs"
Write-Host "   http://localhost:5173/login"
Write-Host "   (배포 URL이 있으면 https://your-site/login 도 추가)"
Write-Host ""

$open = Read-Host "대시보드를 브라우저에서 열까요? (Y/n)"
if ($open -ne 'n' -and $open -ne 'N') {
  Start-Process "https://console.cloud.google.com/apis/credentials"
  Start-Process "https://supabase.com/dashboard/project/$ProjectRef/auth/providers?provider=Google"
  Start-Process "https://supabase.com/dashboard/project/$ProjectRef/auth/url-configuration"
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host ""
  Write-Host "SUPABASE_ACCESS_TOKEN 이 없어 Supabase API 자동 설정은 건너뜁니다." -ForegroundColor DarkYellow
  Write-Host "토큰 발급: https://supabase.com/dashboard/account/tokens"
  Write-Host "발급 후 Client ID/Secret과 함께 이 스크립트를 다시 실행하세요."
  exit 0
}

if (-not $env:GOOGLE_CLIENT_ID -or -not $env:GOOGLE_CLIENT_SECRET) {
  Write-Host ""
  Write-Host "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 환경 변수를 설정한 뒤 다시 실행하세요." -ForegroundColor DarkYellow
  exit 0
}

$body = @{
  external_google_enabled = $true
  external_google_client_id = $env:GOOGLE_CLIENT_ID
  external_google_secret = $env:GOOGLE_CLIENT_SECRET
} | ConvertTo-Json

Write-Host ""
Write-Host "Supabase Auth 설정 업데이트 중..." -ForegroundColor Cyan

try {
  Invoke-RestMethod `
    -Method Patch `
    -Uri "https://api.supabase.com/v1/projects/$ProjectRef/config/auth" `
    -Headers @{
      Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN"
      'Content-Type' = 'application/json'
    } `
    -Body $body | Out-Null
  Write-Host "완료: Google Provider가 활성화되었습니다." -ForegroundColor Green
  Write-Host ""
  Write-Host ".env 에 추가:"
  Write-Host "VITE_AUTH_GOOGLE_ENABLED=true"
} catch {
  Write-Host "API 오류: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
