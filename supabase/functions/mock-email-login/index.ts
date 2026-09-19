import { corsHeaders } from '../_shared/cors.ts';

/**
 * 보안 검토(2026-09-20)에서 발견 — verify_jwt:true만으로는 공개 anon 키를 가진
 * 누구나 호출이 가능해 실질적인 잠금이 안 된다(Supabase 공식 문서: anon 키도
 * 유효한 JWT라 verify_jwt 체크를 통과함). 이 기능은 "세션이 아예 없는 사람이
 * 로그인하기 위한" 용도라 "이미 로그인된 사람만 허용"하는 식으로도 고칠 수
 * 없다 — 시험용으로만 넣었던 기능이라 프로덕션에서는 완전히 막는 게 맞다.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ error: '목업 로그인은 프로덕션에서 비활성화되었습니다.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
