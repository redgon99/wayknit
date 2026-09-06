// 매일 1회 크론으로 호출 — 만료된 구독을 재청구(active)하거나 free로 되돌린다(cancelled).
// 크론 호출 방식(pg_cron/pg_net 또는 외부 스케줄러) 확정 전까지는 CRON_SECRET 헤더로만 보호한다.
// 참고: docs/Wayknit_수익화_실행계획_2026-08-27.md §1.3, §5(크론 방식 결정 필요)

import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/serviceClient.ts';
import { chargeWithBillingKey } from '../_shared/portoneApi.ts';

const PLUS_MONTHLY_PRICE_KRW = 4900;

interface DueProfile {
  id: string;
  subscription_status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('unauthorized', { status: 401 });
  }

  const sb = getServiceClient();
  const nowIso = new Date().toISOString();

  const { data: dueProfiles, error: fetchError } = await sb
    .from('profiles')
    .select('id, subscription_status')
    .in('subscription_status', ['active', 'cancelled'])
    .lte('subscription_expires_at', nowIso);

  if (fetchError) {
    return new Response(JSON.stringify({ ok: false, error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ userId: string; action: string; ok: boolean }> = [];

  for (const profile of (dueProfiles ?? []) as DueProfile[]) {
    // 해지 예약된 구독 → 만료됐으니 free로 되돌린다 (재청구하지 않음)
    if (profile.subscription_status === 'cancelled') {
      const { error } = await sb
        .from('profiles')
        .update({ plan: 'free', subscription_status: null, subscription_expires_at: null })
        .eq('id', profile.id);
      results.push({ userId: profile.id, action: 'downgraded', ok: !error });
      continue;
    }

    // 활성 구독 → 저장된 빌링키로 재청구
    const { data: customer, error: customerError } = await sb
      .from('billing_customers')
      .select('billing_key')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (customerError || !customer) {
      await sb
        .from('profiles')
        .update({ plan: 'free', subscription_status: 'payment_failed' })
        .eq('id', profile.id);
      await sb.from('billing_events').insert({
        user_id: profile.id,
        provider_event_id: `charge-missing-key:${profile.id}:${Date.now()}`,
        type: 'payment_failed',
        raw_payload: { reason: 'no billing_key' },
      });
      results.push({ userId: profile.id, action: 'failed_no_key', ok: false });
      continue;
    }

    try {
      const paymentId = `renew-${profile.id}-${Date.now()}`;
      const payment = await chargeWithBillingKey({
        billingKey: customer.billing_key,
        paymentId,
        orderName: 'Wayknit Plus (월간 갱신)',
        amountTotal: PLUS_MONTHLY_PRICE_KRW,
        customerId: profile.id,
      });

      if (payment.status !== 'PAID') {
        throw new Error(`재결제 상태 이상: ${payment.status}`);
      }

      const nextExpiry = new Date();
      nextExpiry.setMonth(nextExpiry.getMonth() + 1);

      await sb
        .from('profiles')
        .update({ subscription_expires_at: nextExpiry.toISOString() })
        .eq('id', profile.id);
      await sb.from('billing_events').insert({
        user_id: profile.id,
        provider_event_id: `renew:${paymentId}`,
        type: 'renewed',
        amount: PLUS_MONTHLY_PRICE_KRW,
        raw_payload: { paymentId },
      });
      results.push({ userId: profile.id, action: 'renewed', ok: true });
    } catch (err) {
      // 최초 버전은 단순하게: 재결제 1회 실패 시 유예 없이 즉시 free 처리
      // (docs/Wayknit_수익화_실행계획_2026-08-27.md §4 리스크 참고 — 실패율을 본 뒤 유예 로직 추가 검토)
      await sb
        .from('profiles')
        .update({ plan: 'free', subscription_status: 'payment_failed' })
        .eq('id', profile.id);
      await sb.from('billing_events').insert({
        user_id: profile.id,
        provider_event_id: `charge-failed:${profile.id}:${Date.now()}`,
        type: 'payment_failed',
        raw_payload: { error: err instanceof Error ? err.message : String(err) },
      });
      results.push({ userId: profile.id, action: 'failed', ok: false });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
