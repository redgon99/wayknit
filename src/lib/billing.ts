import { getSupabase } from './supabase';
import { loadPortOneSdk, getPortOneStoreId, getPortOneChannelKey, isPortOneConfigured } from './portone';
import { PLUS_MONTHLY_PRICE_KRW } from './subscription';

export type BillingResult = { ok: true } | { ok: false; message: string };

/**
 * 카드 등록 + 즉시 첫 결제(빌링키 발급과 동시 결제) → 서버(billing-subscribe)에
 * billingKey를 전달해 구독을 확정한다. profiles.plan 반영은 서버(Edge Function)에서만 이루어진다.
 *
 * 주의: PortOne.requestIssueBillingKeyAndPay의 정확한 파라미터 형태(특히 amount 필드 구조,
 * billingKeyMethod 옵션값)는 실제 포트원 콘솔에서 storeId/channelKey를 발급받은 뒤
 * https://developers.portone.io/sdk/ko/v2-sdk/billing-key-request 최신 문서로 반드시 재확인할 것.
 * 여기서는 문서 조사 시점 기준으로 합리적인 형태를 작성했다.
 */
export async function startPlusSubscription(userId: string): Promise<BillingResult> {
  if (!isPortOneConfigured()) {
    return { ok: false, message: 'not_configured' };
  }

  let PortOne: any;
  try {
    PortOne = await loadPortOneSdk();
  } catch {
    return { ok: false, message: 'sdk_load_failed' };
  }

  const issueResponse = await PortOne.requestIssueBillingKeyAndPay({
    storeId: getPortOneStoreId(),
    channelKey: getPortOneChannelKey(),
    billingKeyMethod: 'CARD',
    issueId: `plus-${userId}-${Date.now()}`,
    issueName: 'Wayknit Plus 구독',
    customer: { customerId: userId },
    orderName: 'Wayknit Plus (월간)',
    amount: { total: PLUS_MONTHLY_PRICE_KRW },
    currency: 'KRW',
  });

  if (issueResponse?.code) {
    // 포트원 SDK는 실패 시 code/message를 채워 반환한다(throw하지 않음)
    return { ok: false, message: issueResponse.message ?? issueResponse.code };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: 'supabase_not_configured' };

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'billing-subscribe',
    {
      body: {
        billingKey: issueResponse.billingKey,
        paymentId: issueResponse.paymentId,
      },
    }
  );
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? 'server_error' };
  return { ok: true };
}

export async function cancelPlusSubscription(): Promise<BillingResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: 'supabase_not_configured' };

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'billing-cancel',
    { body: {} }
  );
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? 'server_error' };
  return { ok: true };
}
