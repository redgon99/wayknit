# Wayknit 프로덕션 수동 배포 — Windows용 (HANDOFF §9)
#
# 맥에서는 scripts/deploy-prod.sh 를 쓴다. 하는 일은 같다:
#   Netlify에 등록된 프로덕션 환경변수만으로 빌드 → deploy --prod → 라이브 검증.
#   .env.local 은 쓰지 않는다(개발용 값이 프로덕션에 섞이는 사고 방지).
#
# 사용법:
#   $env:NETLIFY_AUTH_TOKEN="xxx"; .\scripts\deploy-prod.ps1 "배포 메모"
#   또는 .netlify-token 파일(gitignore됨)에 토큰을 넣어두고  .\scripts\deploy-prod.ps1
#   -DryRun 을 주면 배포하지 않고 빌드·검증만 한다

param(
  [string]$Message = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$SiteId  = "1aa56799-32d7-4bfb-a043-068acf9ebfa1"   # netlify: wayknit
$Account = "redgon999"
$SiteUrl = "https://wayknit.netlify.app"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $Message) { $Message = "manual deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
function Say($m) { Write-Host "`n▶ $m" -ForegroundColor White }
function Die($m) { Write-Host "`n✗ $m" -ForegroundColor Red; exit 1 }

# ── 토큰 ────────────────────────────────────────────────────────────────
$Token = $env:NETLIFY_AUTH_TOKEN
if (-not $Token -and (Test-Path "$Root\.netlify-token")) {
  $Token = (Get-Content "$Root\.netlify-token" -Raw).Trim()
}
if (-not $Token) {
  Die "토큰이 없다. `$env:NETLIFY_AUTH_TOKEN 을 주거나 .netlify-token 파일을 만들 것.
   발급: https://app.netlify.com/user/applications → Personal access tokens"
}
$env:NETLIFY_AUTH_TOKEN = $Token

# ── 사전 점검 ───────────────────────────────────────────────────────────
Say "사전 점검"
$dirty = git status --porcelain -- src supabase index.html vite.config.ts
if ($dirty) {
  Write-Host "  ⚠ 커밋되지 않은 소스 변경이 있다. 배포되는 건 워킹트리 상태다." -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "    $_" }
}
Write-Host "  HEAD: $(git log --oneline -1)"
npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { Die "타입체크 실패 — 배포 중단" }
Write-Host "  타입체크 통과"

# ── 프로덕션 환경변수 내려받기 ──────────────────────────────────────────
Say "Netlify에서 프로덕션 환경변수 가져오기"
$rows = Invoke-RestMethod -Method Get `
  -Uri "https://api.netlify.com/api/v1/accounts/$Account/env?site_id=$SiteId" `
  -Headers @{ Authorization = "Bearer $Token" }

$prod = @{}
foreach ($r in $rows) {
  if ($r.key -notlike "VITE_*") { continue }   # 프론트 번들에 들어가는 건 VITE_* 뿐
  $v = ($r.values | Where-Object { $_.context -in @("all","production") } | Select-Object -First 1).value
  if ($null -eq $v) { $v = "" }
  $prod[$r.key] = $v
}
if ($prod.Count -eq 0) { Die "VITE_* 환경변수가 하나도 없다 — 배포하면 또 미설정 번들이 나온다" }
Write-Host ("  " + (($prod.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)<$($_.Value.Length)자>" }) -join "  "))

# ── .env 파일 격리 ──────────────────────────────────────────────────────
# 셸 변수가 우선하지만, 셸에 없고 파일에만 있는 키는 그대로 로드된다.
$Stash = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "wayknit-env-$(Get-Random)")
$Moved = @()
function Restore-EnvFiles {
  foreach ($f in $script:Moved) {
    $src = Join-Path $Stash $f
    if (Test-Path $src) { Move-Item -Force $src (Join-Path $Root $f) }
  }
  if (Test-Path $Stash) { Remove-Item -Recurse -Force $Stash -ErrorAction SilentlyContinue }
}

try {
  Say "개발용 .env 파일 격리"
  foreach ($f in @(".env", ".env.local", ".env.production", ".env.production.local")) {
    $p = Join-Path $Root $f
    if (Test-Path $p) { Move-Item $p (Join-Path $Stash $f); $Moved += $f; Write-Host "  치움: $f" }
  }
  if ($Moved.Count -eq 0) { Write-Host "  (치울 파일 없음)" }

  # ── 빌드 ──────────────────────────────────────────────────────────────
  Say "빌드"
  foreach ($k in $prod.Keys) { Set-Item -Path "Env:$k" -Value $prod[$k] }
  if (-not $prod.ContainsKey("VITE_SITE_URL")) { $env:VITE_SITE_URL = $SiteUrl }
  npm run build; if ($LASTEXITCODE -ne 0) { Die "빌드 실패" }

  # ── 번들 검증 ─────────────────────────────────────────────────────────
  Say "빌드 결과 검증"
  $bundle = Get-ChildItem "dist\assets\index-*.js" | Sort-Object LastWriteTime -Desc | Select-Object -First 1
  if (-not $bundle) { Die "번들을 찾지 못했다" }
  $text = Get-Content $bundle.FullName -Raw
  $fail = $false
  foreach ($k in @("VITE_SUPABASE_URL","VITE_SUPABASE_ANON_KEY","VITE_KAKAO_JS_KEY")) {
    $v = $prod[$k]
    if (-not $v)                { Write-Host "  ✗ $k 값이 비어 있다"; $fail = $true }
    elseif ($text.Contains($v)) { Write-Host "  ✅ $k 인라인됨" }
    else                        { Write-Host "  ✗ $k 가 번들에 없다"; $fail = $true }
  }
  foreach ($leak in @("PORTONE","MAP_PROVIDER_FORCE")) {
    if ($text.Contains($leak)) { Write-Host "  ⚠ 번들에 $leak 흔적이 있다 — 확인할 것" -ForegroundColor Yellow }
  }
  if ($fail) { Die "번들 검증 실패 — 배포하지 않는다" }

  if ($DryRun) { Say "-DryRun 이므로 배포하지 않고 종료"; return }

  # ── 배포 ──────────────────────────────────────────────────────────────
  Say "배포"
  npx --yes netlify-cli@latest deploy --prod --dir=dist --site $SiteId --message $Message
  if ($LASTEXITCODE -ne 0) { Die "배포 실패" }
}
finally {
  Restore-EnvFiles
}

# ── 라이브 검증 ─────────────────────────────────────────────────────────
Say "라이브 검증"
Start-Sleep -Seconds 5
$html = (Invoke-WebRequest "$SiteUrl/" -UseBasicParsing).Content
$asset = ([regex]::Match($html, 'assets/index-[A-Za-z0-9_-]+\.js')).Value
Write-Host "  라이브 번들: $asset"
$live = (Invoke-WebRequest "$SiteUrl/$asset" -UseBasicParsing).Content
foreach ($k in @("VITE_SUPABASE_URL","VITE_KAKAO_JS_KEY")) {
  if ($live.Contains($prod[$k])) { Write-Host "  ✅ $k 반영됨" } else { Write-Host "  ✗ $k 미반영" }
}
$n = ([regex]::Matches($live, 'VITE_KAKAO_JS_KEY 환경 변수가 필요합니다')).Count
Write-Host "  카카오 에러 문자열: ${n}회 $(if ($n -eq 0) { '(정상)' } else { '(키 누락!)' })"

Write-Host @"

────────────────────────────────────────────────────────────
배포 완료: $SiteUrl

확인하실 때 주의: PWA 서비스워커가 구 번들을 캐싱합니다.
  데스크톱  Ctrl+Shift+R
  모바일    브라우저 캐시 삭제 또는 시크릿 탭

deno.lock 이 바뀌었으면 정상입니다 (Netlify Edge Function 번들러가 의존성을 추가만 함).
────────────────────────────────────────────────────────────
"@
