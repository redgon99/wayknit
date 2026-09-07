#!/usr/bin/env bash
#
# Wayknit 프로덕션 수동 배포 (HANDOFF §9)
#
# 이 사이트는 Netlify에 Git 연동이 없다. 푸시해도 배포되지 않고, Netlify UI에
# 등록한 환경변수도 저절로 적용되지 않는다(빌드를 Netlify가 하지 않으므로).
# 배포는 항상 이 스크립트로 한다.
#
# 하는 일:
#   1. 타입체크
#   2. Netlify에 등록된 **프로덕션 환경변수를 내려받아** 그것만으로 빌드
#      (.env.local을 쓰지 않는다 — 개발용 값이 프로덕션에 섞이는 사고를 막는다)
#   3. netlify deploy --prod
#   4. 라이브 번들에 값이 실제로 박혔는지 검증
#
# 사용법:
#   NETLIFY_AUTH_TOKEN=xxx ./scripts/deploy-prod.sh "배포 메모"
#   또는 .netlify-token 파일(gitignore됨)에 토큰을 넣어두고  ./scripts/deploy-prod.sh
#
#   --dry-run  배포하지 않고 빌드·검증만 한다

set -euo pipefail

SITE_ID="1aa56799-32d7-4bfb-a043-068acf9ebfa1"   # netlify: wayknit
ACCOUNT="redgon999"
SITE_URL="https://wayknit.netlify.app"

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

DRY_RUN=0
MESSAGE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) MESSAGE="$arg" ;;
  esac
done
[ -n "$MESSAGE" ] || MESSAGE="manual deploy $(date '+%Y-%m-%d %H:%M')"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ── 토큰 ────────────────────────────────────────────────────────────────
TOKEN="${NETLIFY_AUTH_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$ROOT/.netlify-token" ]; then
  TOKEN="$(tr -d '[:space:]' < "$ROOT/.netlify-token")"
fi
[ -n "$TOKEN" ] || die "토큰이 없다. NETLIFY_AUTH_TOKEN 환경변수를 주거나 .netlify-token 파일을 만들 것.
   발급: https://app.netlify.com/user/applications → Personal access tokens"
export NETLIFY_AUTH_TOKEN="$TOKEN"

# ── 사전 점검 ───────────────────────────────────────────────────────────
say "사전 점검"
if [ -n "$(git status --porcelain -- src supabase index.html vite.config.ts 2>/dev/null)" ]; then
  printf '  \033[33m⚠ 커밋되지 않은 소스 변경이 있다. 배포되는 건 워킹트리 상태다.\033[0m\n'
  git status --short -- src supabase index.html vite.config.ts | sed 's/^/    /'
fi
echo "  HEAD: $(git log --oneline -1)"
npx tsc --noEmit || die "타입체크 실패 — 배포 중단"
echo "  타입체크 통과"

# ── 프로덕션 환경변수 내려받기 ──────────────────────────────────────────
# Netlify에 등록된 값이 프로덕션의 유일한 기준이다. .env.local을 쓰지 않는다.
say "Netlify에서 프로덕션 환경변수 가져오기"
ENVJSON="$(mktemp)"
trap 'rm -f "$ENVJSON"' EXIT
code=$(curl -s -o "$ENVJSON" -w '%{http_code}' \
  "https://api.netlify.com/api/v1/accounts/${ACCOUNT}/env?site_id=${SITE_ID}" \
  -H "Authorization: Bearer $TOKEN")
[ "$code" = "200" ] || die "환경변수 조회 실패 (HTTP $code) — 토큰이 유효한지 확인할 것"

ENVSH="$(mktemp)"
trap 'rm -f "$ENVJSON" "$ENVSH"' EXIT
python3 - "$ENVJSON" "$ENVSH" <<'PY'
import json, sys, shlex
rows = json.load(open(sys.argv[1]))
out, names = [], []
for r in rows:
    key = r["key"]
    if not key.startswith("VITE_"):
        continue                      # 프론트 번들에 들어가는 건 VITE_* 뿐
    vals = r.get("values") or []
    val = next((v.get("value", "") for v in vals if v.get("context") in ("all", "production")), "")
    out.append(f"export {key}={shlex.quote(val)}")
    names.append(f"{key}<{len(val)}자>")
open(sys.argv[2], "w").write("\n".join(out) + "\n")
print("  " + ("  ".join(names) if names else "(없음)"))
if not names:
    raise SystemExit("VITE_* 환경변수가 하나도 없다 — 배포하면 또 미설정 번들이 나온다")
PY

# ── .env 파일 격리 ──────────────────────────────────────────────────────
# Vite는 build 시 .env / .env.local / .env.production* 를 읽는다.
# 셸 변수가 우선하긴 하지만, 셸에 없고 파일에만 있는 키는 그대로 로드된다
# (VITE_PORTONE_* 등). 개발용 값이 프로덕션에 섞이지 않도록 파일 자체를 치운다.
# 스태시는 프로젝트 안에 둔다(.gitignore됨). /var/folders 는 사고가 나면
# 찾기 어렵고, 사람이 눈으로 확인할 수도 없다. 여기 있으면 바로 보인다.
STASH="$ROOT/.deploy-stash"
rm -rf "$STASH"; mkdir -p "$STASH"

# 복원은 몇 번 불려도 안전해야 하고, 중간에 하나 실패해도 나머지를 계속해야 한다.
# set -e 가 트랩 안에서 함수를 중간에 끊어버리지 않도록 각 단계를 || true 로 감싼다.
restore() {
  local f src dst missing=0
  [ -d "$STASH" ] || return 0
  for f in .env .env.local .env.production .env.production.local; do
    src="$STASH/$f"; dst="$ROOT/$f"
    if [ -f "$src" ]; then
      if mv -f "$src" "$dst" 2>/dev/null; then
        echo "  되돌림: $f"
      else
        echo "  ✗ 되돌리기 실패: $f  (수동: mv '$src' '$dst')" >&2
        missing=1
      fi
    fi
  done
  rmdir "$STASH" 2>/dev/null || true
  rm -f "$ENVJSON" "$ENVSH" 2>/dev/null || true
  return $missing
}

# 정상 종료·중단·실패 어느 경로로도 반드시 되돌린다.
trap 'restore || true' EXIT INT TERM

# ── 빌드 ────────────────────────────────────────────────────────────────
say "빌드"
# shellcheck disable=SC1090
set -a; . "$ENVSH"; set +a
export VITE_SITE_URL="${VITE_SITE_URL:-$SITE_URL}"
npm run build || die "빌드 실패"

# ── 번들 자체 검증 (배포 전) ────────────────────────────────────────────
say "빌드 결과 검증"
BUNDLE="$(ls -t dist/assets/index-*.js 2>/dev/null | head -1)"
[ -n "$BUNDLE" ] || die "번들을 찾지 못했다"
fail=0
for k in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_KAKAO_JS_KEY; do
  v="${!k:-}"
  if [ -z "$v" ]; then echo "  ✗ $k 값이 비어 있다"; fail=1
  elif grep -qF -- "$v" "$BUNDLE"; then echo "  ✅ $k 인라인됨"
  else echo "  ✗ $k 가 번들에 없다"; fail=1; fi
done
# 개발 전용 값이 새어 들어갔는지 (§9-4)
for leak in PORTONE MAP_PROVIDER_FORCE; do
  if grep -q "$leak" "$BUNDLE" 2>/dev/null; then
    printf '  \033[33m⚠ 번들에 %s 흔적이 있다 — 확인할 것\033[0m\n' "$leak"
  fi
done
[ $fail -eq 0 ] || die "번들 검증 실패 — 배포하지 않는다"

if [ $DRY_RUN -eq 1 ]; then
  say "--dry-run 이므로 배포하지 않고 종료"
  exit 0
fi

# ── 배포 ────────────────────────────────────────────────────────────────
say "배포"
npx --yes netlify-cli@latest deploy --prod --dir=dist --site "$SITE_ID" --message "$MESSAGE" \
  || die "배포 실패"

# ── 라이브 검증 ─────────────────────────────────────────────────────────
say "라이브 검증"
sleep 5
LIVE_JS="$(mktemp)"
A=$(curl -s "$SITE_URL/" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
echo "  라이브 번들: $A"
curl -s "$SITE_URL/$A" -o "$LIVE_JS"
for k in VITE_SUPABASE_URL VITE_KAKAO_JS_KEY; do
  v="${!k:-}"
  grep -qF -- "$v" "$LIVE_JS" && echo "  ✅ $k 반영됨" || echo "  ✗ $k 미반영"
done
# 에러 문자열이 남아 있으면 키가 안 들어간 것이다 (§9-2)
n=$(grep -c 'VITE_KAKAO_JS_KEY 환경 변수가 필요합니다' "$LIVE_JS" || true)
echo "  카카오 에러 문자열: ${n}회 $([ "$n" = "0" ] && echo '(정상)' || echo '(키 누락!)')"
rm -f "$LIVE_JS"

# ── 복원 최종 확인 ──────────────────────────────────────────────────────
# 트랩만 믿지 않는다. 명시적으로 한 번 부르고, 그래도 안 돌아왔으면 크게 실패한다.
# (2026-09-07 실제로 트랩이 돌지 않아 .env.local 을 잃을 뻔했다. 원인 미상.)
restore || true
if [ -d "$STASH" ] && [ -n "$(ls -A "$STASH" 2>/dev/null | grep -v '^.manifest$' || true)" ]; then
  printf '\n\033[31m✗ 되돌리지 못한 파일이 남아 있다 — 직접 옮길 것:\033[0m\n' >&2
  ls -A "$STASH" | grep -v '^.manifest$' | sed "s|^|    mv '$STASH/|; s|$|' '$ROOT/'|" >&2
  exit 1
fi
for f in .env.local; do
  if grep -qx "$f" "$STASH/.manifest" 2>/dev/null && [ ! -f "$ROOT/$f" ]; then
    die "$f 가 복원되지 않았다 — .deploy-stash 를 확인할 것"
  fi
done
rm -rf "$STASH" 2>/dev/null || true
echo "  ✅ 개발용 .env 파일 복원 확인"

cat <<EOF

────────────────────────────────────────────────────────────
배포 완료: $SITE_URL

확인하실 때 주의: PWA 서비스워커가 구 번들을 캐싱합니다.
  데스크톱  Ctrl+Shift+R (맥: Cmd+Shift+R)
  모바일    브라우저 캐시 삭제 또는 시크릿 탭

deno.lock 이 바뀌었으면 정상입니다 (Netlify Edge Function 번들러가 의존성을 추가만 함).
────────────────────────────────────────────────────────────
EOF
