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

# WSL 에서 돌리면 안 된다 (2026-09-08).
#
# PowerShell 에서 `bash` 는 Git Bash 가 아니라 WSL(C:\Windows\system32\bash.exe)로
# 잡힌다. 그러면 이 스크립트 전체가 리눅스 안에서 돌면서 프로젝트를 /mnt/d/... 로
# 보는데, node_modules 에는 Windows 네이티브 바이너리가 깔려 있어 rollup 이
# "Cannot find module @rollup/rollup-linux-x64-gnu" 류로 죽는다. 원인을 찾기
# 어려운 실패라 여기서 먼저 막는다.
if grep -qi microsoft /proc/version 2>/dev/null && [ "${ROOT#/mnt/}" != "$ROOT" ]; then
  echo "✗ WSL 에서 실행됐다. 이 프로젝트의 node_modules 는 Windows 용이라 빌드가 깨진다." >&2
  echo "  Git Bash 를 열고 거기서 다시 실행할 것:" >&2
  echo "      cd /d/project/wayknit && npm run deploy -- \"메모\"" >&2
  echo "  (PowerShell 을 쓰려면 scripts/deploy-prod.ps1 을 직접 호출한다)" >&2
  exit 1
fi

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
# 누출 검사에서 "Netlify 에도 있는 키"를 걸러내는 데 쓴다
open(sys.argv[2] + ".keys", "w").write("|".join(n.split("<")[0] for n in names))
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
MANIFEST="$STASH/.manifest"

# 이전 실행이 크래시로 남긴 스태시가 있으면 지우지 말고 먼저 되돌린다.
# (예전엔 여기서 rm -rf 를 해서, 사고로 남은 .env.local 을 다음 실행이 지워버렸다.
#  "눈에 보이고 손으로 되돌릴 수 있다"는 설계가 그 한 줄로 무력화돼 있었다.)
if [ -d "$STASH" ]; then
  echo "  이전 실행이 남긴 .deploy-stash 발견 — 먼저 되돌린다"
  for f in .env .env.local .env.production .env.production.local; do
    if [ -f "$STASH/$f" ]; then
      if [ -f "$ROOT/$f" ]; then
        echo "  ✗ $f 가 양쪽에 있다. 어느 쪽이 맞는지 사람이 판단할 것:" >&2
        echo "      작업트리: $ROOT/$f" >&2
        echo "      스태시  : $STASH/$f" >&2
        exit 1
      fi
      mv -f "$STASH/$f" "$ROOT/$f" && echo "    되돌림: $f"
    fi
  done
  rm -f "$MANIFEST"
  rmdir "$STASH" 2>/dev/null || true
fi
mkdir -p "$STASH"
: > "$MANIFEST"

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
  # 매니페스트를 먼저 지워야 rmdir 이 성공한다 (남으면 다음 실행이
  # "이전 스태시 발견"으로 오인한다)
  rm -f "$MANIFEST" 2>/dev/null || true
  rmdir "$STASH" 2>/dev/null || true
  rm -f "$ENVJSON" "$ENVSH" "$ENVSH.keys" 2>/dev/null || true
  return $missing
}

# 정상 종료·중단·실패 어느 경로로도 반드시 되돌린다.
trap 'restore || true' EXIT INT TERM

# 실제로 치우는 단계. 2026-09-08 까지 이 블록이 통째로 빠져 있었다 —
# 스태시도 restore() 도 트랩도 다 있는데 파일을 넣는 코드만 없어서, .env.local 이
# 그대로 남은 채 빌드됐다. 셸 변수가 우선하는 키는 괜찮지만 파일에만 있는 키
# (VITE_MAP_PROVIDER_FORCE, VITE_AUTH_GOOGLE_ENABLED 등)는 프로덕션 번들로 샌다.
say "개발용 .env 파일 격리"
moved_any=0
for f in .env .env.local .env.production .env.production.local; do
  if [ -f "$ROOT/$f" ]; then
    mv "$ROOT/$f" "$STASH/$f" || die "$f 를 치우지 못했다 — 중단한다"
    echo "$f" >> "$MANIFEST"
    echo "  치움: $f"
    moved_any=1
  fi
done
[ "$moved_any" = "1" ] || echo "  (치울 파일 없음)"

# ── 빌드 ────────────────────────────────────────────────────────────────
say "빌드"
# shellcheck disable=SC1090
set -a; . "$ENVSH"; set +a
PROD_KEYS="$(cat "$ENVSH.keys" 2>/dev/null || true)"
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
# 개발 전용 값이 새어 들어갔는지 (§9-4).
# 이름이 아니라 "치워둔 .env.local 의 실제 값"과 대조한다 — Vite 는 식별자를
# 값으로 치환하므로 VITE_XXX 라는 이름은 번들에 남지 않는다. 이름만 grep 하던
# 예전 검사는 사실상 아무것도 잡지 못했다.
# Netlify 에도 있는 키는 정상이므로 제외하고, 8자 미만 값은 흔한 문자열
# ("true", "auto" 등)이라 오탐이 나서 건너뛴다.
if [ -f "$STASH/.env.local" ]; then
  while IFS='=' read -r lk lv; do
    case "$lk" in VITE_*) ;; *) continue ;; esac
    lv="$(printf '%s' "$lv" | tr -d '\r' | sed 's/^"//; s/"$//')"
    [ ${#lv} -ge 8 ] || continue
    # Netlify 에 같은 키가 있으면 그 값이 정본이다
    case "|${PROD_KEYS:-}|" in *"|$lk|"*) continue ;; esac
    if grep -qF -- "$lv" "$BUNDLE"; then
      printf '  \033[33m⚠ %s 의 로컬 값이 번들에 있다 — 격리가 안 됐다\033[0m\n' "$lk"
      fail=1
    fi
  done < "$STASH/.env.local"
fi
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
