# Wayknit 프로덕션 수동 배포 — Windows/PowerShell (HANDOFF §9, §12)
#
# 맥에서는 scripts/deploy-prod.sh 를 쓴다. 하는 일은 같다:
#   Netlify에 등록된 프로덕션 환경변수만으로 빌드 → deploy --prod → 라이브 검증.
#   .env.local 은 쓰지 않는다(개발용 값이 프로덕션에 섞이는 사고 방지, §9-4).
#
# 사용법:
#   npm run deploy -- "배포 메모"          ← 권장. OS에 맞는 스크립트로 알아서 간다
#   .\scripts\deploy-prod.ps1 "배포 메모"
#   .\scripts\deploy-prod.ps1 -DryRun      배포하지 않고 빌드·검증만
#
# 토큰: $env:NETLIFY_AUTH_TOKEN 또는 .netlify-token 파일(gitignore됨)
#   발급 https://app.netlify.com/user/applications → Personal access tokens

param(
  [string]$Message = "",
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
# PS 5.1 은 기본 프로토콜이 낮아 Netlify API 가 거절할 수 있다
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$SiteId  = "1aa56799-32d7-4bfb-a043-068acf9ebfa1"   # netlify: wayknit
$Account = "redgon999"
$SiteUrl = "https://wayknit.netlify.app"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $Message) { $Message = "manual deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
function Say($m) { Write-Host "`n▶ $m" -ForegroundColor White }
function Warn($m) { Write-Host "  ⚠ $m" -ForegroundColor Yellow }

$EnvFiles = @(".env", ".env.local", ".env.production", ".env.production.local")
$Stash    = Join-Path $Root ".deploy-stash"
$Manifest = Join-Path $Stash ".manifest"
# 빌드용으로 심은 환경변수 이름 — 끝나면 지운다. 남겨두면 같은 창에서 이어서
# npm run dev 를 할 때 Vite 가 process.env 를 .env.local 보다 우선해
# 개발 서버가 프로덕션 값으로 뜬다.
$InjectedKeys = New-Object System.Collections.Generic.List[string]

function Restore-EnvFiles {
  if (-not (Test-Path $Stash)) { return $true }
  $ok = $true
  foreach ($f in $EnvFiles) {
    $src = Join-Path $Stash $f
    if (Test-Path $src) {
      try {
        Move-Item -Force $src (Join-Path $Root $f)
        Write-Host "  되돌림: $f"
      } catch {
        Write-Host "  ✗ 되돌리기 실패: $f  (수동: move `"$src`" `"$Root\$f`")" -ForegroundColor Red
        $ok = $false
      }
    }
  }
  Remove-Item -Force $Manifest -ErrorAction SilentlyContinue
  Remove-Item -Force $Stash -ErrorAction SilentlyContinue   # 비었을 때만 지워진다
  return $ok
}

function Clear-InjectedEnv {
  foreach ($k in $InjectedKeys) { Remove-Item -Path "Env:$k" -ErrorAction SilentlyContinue }
}

function Die($m) {
  Write-Host "`n✗ $m" -ForegroundColor Red
  Restore-EnvFiles | Out-Null
  Clear-InjectedEnv
  exit 1
}

# Ctrl+C 로도 되돌린다. finally 는 강제 종료에서 안 돌기 때문에 겹쳐 건다.
$null = [Console]::add_CancelKeyPress({
  Write-Host "`n중단됨 — .env 파일을 되돌린다" -ForegroundColor Yellow
  Restore-EnvFiles | Out-Null
})

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
# 2026-11-17: 경고만 하던 것을 멈추게 바꿨다 — 다른 세션의 미완성 작업이 운영에 섞여 나가지 않게.
#   급할 때만 npm run deploy -- --force "메모". --dry-run은 배포하지 않으므로 경고만.
$dirty = git status --porcelain -- src supabase public index.html vite.config.ts package.json package-lock.json
if ($dirty) {
  $dirty | ForEach-Object { Write-Host "    $_" }
  if ($Force -or $DryRun) { Warn "커밋되지 않은 소스 변경이 있다. 배포되는 건 워킹트리 상태다." }
  else { Die "커밋되지 않은 소스 변경이 있다(위 목록). 커밋·푸시 후 다시 실행할 것. 급하면: npm run deploy -- --force `"메모`"" }
}
git fetch -q origin
$ahead = [int](git rev-list --count '@{u}..HEAD')
$behind = [int](git rev-list --count 'HEAD..@{u}')
if ($ahead -gt 0 -or $behind -gt 0) {
  $why = "원격과 다르다: 푸시 안 한 커밋 $ahead 개, 원격에만 있는 커밋 $behind 개."
  if ($Force -or $DryRun) { Warn $why }
  else { Die "$why push/pull 후 다시 실행할 것. 급하면: npm run deploy -- --force `"메모`"" }
}
Write-Host "  HEAD: $(git log --oneline -1)"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Die "타입체크 실패 — 배포 중단" }
Write-Host "  타입체크 통과"

# ── 프로덕션 환경변수 내려받기 ──────────────────────────────────────────
Say "Netlify에서 프로덕션 환경변수 가져오기"
try {
  $rows = Invoke-RestMethod -Method Get `
    -Uri "https://api.netlify.com/api/v1/accounts/$Account/env?site_id=$SiteId" `
    -Headers @{ Authorization = "Bearer $Token" }
} catch {
  Die "환경변수 조회 실패 — 토큰이 유효한지 확인할 것 ($($_.Exception.Message))"
}

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
# 스태시는 프로젝트 안에 둔다(.gitignore됨). %TEMP% 의 난수 폴더는 사고가 나면
# 찾을 수도 없고 사람이 눈으로 확인할 수도 없다. 여기 있으면 바로 보인다.
Say "개발용 .env 파일 격리"

# 이전 실행이 크래시로 남긴 스태시가 있으면 지우지 말고 먼저 되돌린다.
if (Test-Path $Stash) {
  Write-Host "  이전 실행이 남긴 .deploy-stash 발견 — 먼저 되돌린다"
  foreach ($f in $EnvFiles) {
    $src = Join-Path $Stash $f
    if ((Test-Path $src) -and (Test-Path (Join-Path $Root $f))) {
      Write-Host "  ✗ $f 가 양쪽에 있다. 어느 쪽이 맞는지 사람이 판단할 것:" -ForegroundColor Red
      Write-Host "      작업트리: $Root\$f"
      Write-Host "      스태시  : $src"
      exit 1
    }
  }
  Restore-EnvFiles | Out-Null
}
New-Item -ItemType Directory -Force -Path $Stash | Out-Null
Set-Content -Path $Manifest -Value "" -Encoding utf8

$stashedLocal = $null
try {
  $movedAny = $false
  foreach ($f in $EnvFiles) {
    $p = Join-Path $Root $f
    if (Test-Path $p) {
      Move-Item $p (Join-Path $Stash $f)
      Add-Content -Path $Manifest -Value $f -Encoding utf8
      Write-Host "  치움: $f"
      $movedAny = $true
      if ($f -eq ".env.local") { $stashedLocal = Join-Path $Stash $f }
    }
  }
  if (-not $movedAny) { Write-Host "  (치울 파일 없음)" }

  # ── 빌드 ──────────────────────────────────────────────────────────────
  Say "빌드"
  foreach ($k in $prod.Keys) { Set-Item -Path "Env:$k" -Value $prod[$k]; $InjectedKeys.Add($k) }
  if (-not $prod.ContainsKey("VITE_SITE_URL")) { $env:VITE_SITE_URL = $SiteUrl; $InjectedKeys.Add("VITE_SITE_URL") }
  npm run build
  if ($LASTEXITCODE -ne 0) { Die "빌드 실패" }

  # ── 번들 검증 ─────────────────────────────────────────────────────────
  Say "빌드 결과 검증"
  $bundle = Get-ChildItem "dist\assets\index-*.js" | Sort-Object LastWriteTime -Desc | Select-Object -First 1
  if (-not $bundle) { Die "번들을 찾지 못했다" }
  # 2026-11-22 페이지 지연 로딩으로 코드가 여러 조각(dist/assets/*.js)에 나뉜다 — 카카오 키는 플래너 조각에 있다.
  # 메인 파일만 보던 검사를 모든 JS 조각으로 넓히고, 키마다 들어 있는 조각 이름을 기억해 라이브 검증에 쓴다.
  $chunks = @{}
  foreach ($f in Get-ChildItem "dist\assets\*.js") { $chunks[$f.Name] = Get-Content $f.FullName -Raw -Encoding UTF8 }
  $text = ($chunks.Values -join "`n")
  $keyChunk = @{}
  $fail = $false
  foreach ($k in @("VITE_SUPABASE_URL","VITE_SUPABASE_ANON_KEY","VITE_KAKAO_JS_KEY")) {
    $v = $prod[$k]
    if (-not $v) { Write-Host "  ✗ $k 값이 비어 있다" -ForegroundColor Red; $fail = $true; continue }
    $hit = $chunks.Keys | Where-Object { $chunks[$_].Contains($v) } | Sort-Object | Select-Object -First 1
    if ($hit) { $keyChunk[$k] = $hit; Write-Host "  ✅ $k 인라인됨 ($hit)" }
    else      { Write-Host "  ✗ $k 가 번들에 없다" -ForegroundColor Red; $fail = $true }
  }

  # 개발 전용 값이 새어 들어갔는지 (§9-4).
  # 이름이 아니라 치워둔 .env.local 의 실제 값과 대조한다 — Vite 는 식별자를
  # 값으로 치환하므로 VITE_XXX 라는 이름 자체는 번들에 남지 않는다.
  # Netlify 에도 있는 키는 그 값이 정본이므로 제외하고, 8자 미만은 흔한
  # 문자열("true","auto")이라 오탐이 나서 건너뛴다.
  if ($stashedLocal -and (Test-Path $stashedLocal)) {
    foreach ($line in Get-Content $stashedLocal) {
      if ($line -notmatch '^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)$') { continue }
      $lk = $Matches[1]
      $lv = $Matches[2].Trim().Trim('"').Trim("'")
      if ($lv.Length -lt 8) { continue }
      if ($prod.ContainsKey($lk)) { continue }
      if ($text.Contains($lv)) {
        Write-Host "  ⚠ $lk 의 로컬 값이 번들에 있다 — 격리가 안 됐다" -ForegroundColor Yellow
        $fail = $true
      }
    }
  }
  if ($fail) { Die "번들 검증 실패 — 배포하지 않는다" }

  if ($DryRun) { Say "-DryRun 이므로 배포하지 않고 종료" }
  else {
    # ── 배포 ────────────────────────────────────────────────────────────
    Say "배포"
    npx --yes netlify-cli@latest deploy --prod --dir=dist --site $SiteId --message $Message
    if ($LASTEXITCODE -ne 0) { Die "배포 실패" }
  }
}
finally {
  Restore-EnvFiles | Out-Null
  Clear-InjectedEnv
}

# ── 복원 최종 확인 ──────────────────────────────────────────────────────
# finally 만 믿지 않는다. 안 돌아왔으면 조용히 넘어가지 말고 크게 실패한다.
if (Test-Path $Stash) {
  $left = Get-ChildItem $Stash -Force | Where-Object { $_.Name -ne ".manifest" }
  if ($left) {
    Write-Host "`n✗ 되돌리지 못한 파일이 남아 있다 — 직접 옮길 것:" -ForegroundColor Red
    $left | ForEach-Object { Write-Host "    move `"$($_.FullName)`" `"$Root\$($_.Name)`"" }
    exit 1
  }
  Remove-Item -Recurse -Force $Stash -ErrorAction SilentlyContinue
}

if ($DryRun) { exit 0 }

# ── 라이브 검증 ─────────────────────────────────────────────────────────
Say "라이브 검증"
Start-Sleep -Seconds 5
$html = (Invoke-WebRequest "$SiteUrl/" -UseBasicParsing).Content
$asset = ([regex]::Match($html, 'assets/index-[A-Za-z0-9_-]+\.js')).Value
Write-Host "  라이브 번들: $asset"
# 방금 만든 메인 파일이 라이브에 걸렸는지(배포가 실제로 나갔는지)
if ($asset -eq "assets/$($bundle.Name)") { Write-Host "  ✅ 라이브 메인 파일 = 이번 빌드" }
else { Write-Host "  ✗ 라이브 메인 파일이 이번 빌드($($bundle.Name))와 다르다" -ForegroundColor Red }
# 키가 든 조각을 라이브에서 받아 확인(조각 이름은 빌드 검증 때 기억한 것)
$liveChunk = @{}
foreach ($k in @("VITE_SUPABASE_URL","VITE_KAKAO_JS_KEY")) {
  $name = $keyChunk[$k]
  if (-not $liveChunk.ContainsKey($name)) { $liveChunk[$name] = (Invoke-WebRequest "$SiteUrl/assets/$name" -UseBasicParsing).Content }
  if ($liveChunk[$name].Contains($prod[$k])) { Write-Host "  ✅ $k 반영됨 ($name)" } else { Write-Host "  ✗ $k 미반영 ($name)" -ForegroundColor Red }
}
# 에러 문자열이 남아 있으면 키가 안 들어간 것이다 (§9-2) — 카카오 코드가 든 조각에서 센다
$n = ([regex]::Matches($liveChunk[$keyChunk["VITE_KAKAO_JS_KEY"]], 'VITE_KAKAO_JS_KEY 환경 변수가 필요합니다')).Count
Write-Host "  카카오 에러 문자열: ${n}회 $(if ($n -eq 0) { '(정상)' } else { '(키 누락!)' })"

Write-Host @"

────────────────────────────────────────────────────────────
배포 완료: $SiteUrl

확인하실 때 주의: PWA 서비스워커가 구 번들을 캐싱합니다.
  데스크톱  Ctrl+Shift+R
  모바일    시크릿 탭

deno.lock 이 바뀌었으면 정상입니다 (Netlify Edge Function 번들러가 의존성을 추가만 함).
────────────────────────────────────────────────────────────
"@
