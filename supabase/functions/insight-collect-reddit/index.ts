import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient, recordFailedRun } from '../_shared/insightDb.ts';

/**
 * Reddit 자동 수집 지원 종료(2026-09-23).
 *
 * 1) OAuth script 앱 셀프서비스 등록이 막혔다(reddit.com/r/reddit.com/wiki/api
 *    공지 — "정당한 모더레이션 용도"만 신청 가능, 리서치 목적으로는 발급 불가).
 * 2) 대안으로 시도한 공개 `/r/{subreddit}/new.json` 무인증 접근도 실측 결과
 *    막혀 있었다(www.reddit.com 403, old.reddit.com 302 — User-Agent를 여러
 *    조합으로 바꿔도 동일).
 *
 * 두 경로 다 막혀 있어 자동 수집을 더 이상 시도하지 않는다 — 대신 관리자가
 * Reddit을 직접 읽고 "수동 등록"(단건)이나 "리서치 리포트"(종합 요약)로
 * 넣는 흐름을 쓴다. 이 함수는 그 안내만 반환한다(실제 요청은 없음 — 막힌 걸
 * 알면서 매번 호출해 로그를 어지럽히지 않는다).
 */
const MESSAGE =
  'Reddit 자동 수집은 지원 종료됐습니다(API 셀프등록 차단 + 공개 JSON도 차단, 2026-09-23 확인). ' +
  '"수동 등록" 또는 "리서치 리포트"로 직접 입력해 주세요.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  await recordFailedRun(getServiceClient(), 'reddit', MESSAGE);

  return new Response(JSON.stringify({ error: MESSAGE }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
