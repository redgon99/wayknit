import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { PlanId } from '../lib/subscription';
import {
  isPlusOrTeam,
  PLUS_MONTHLY_PRICE_KRW,
  FREE_MAX_TRIPS,
  FREE_DAILY_GOOGLE_SEARCHES,
  FREE_MAX_TRIP_MATERIALS,
} from '../lib/subscription';
import { isPortOneConfigured } from '../lib/portone';
import { startPlusSubscription, cancelPlusSubscription } from '../lib/billing';

interface Props {
  open: boolean;
  onClose: () => void;
  plan: PlanId;
  userId?: string;
  /** 결제 성공/해지 성공 후 플랜 상태를 다시 불러오도록 호출자에게 알림 */
  onPlanChanged?: () => void;
}

type FlowState = 'idle' | 'processing' | 'error';

export function UpgradeModal({ open, onClose, plan, userId, onPlanChanged }: Props) {
  const { t, i18n } = useTranslation('billing');
  const [flow, setFlow] = useState<FlowState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  const isPaid = isPlusOrTeam(plan);

  async function handleUpgrade() {
    if (!userId || !isPortOneConfigured()) {
      alert(t('checkout.notConfigured'));
      return;
    }
    setFlow('processing');
    setErrorMessage(null);
    const result = await startPlusSubscription(userId);
    if (!result.ok) {
      setFlow('error');
      setErrorMessage(result.message);
      return;
    }
    setFlow('idle');
    onPlanChanged?.();
    onClose();
  }

  async function handleCancel() {
    if (!confirm(t('cancel.confirm'))) return;
    setFlow('processing');
    setErrorMessage(null);
    const result = await cancelPlusSubscription();
    if (!result.ok) {
      setFlow('error');
      setErrorMessage(result.message);
      return;
    }
    setFlow('idle');
    onPlanChanged?.();
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card upgrade-modal"
        role="dialog"
        aria-labelledby="upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="close">
          <Icon name="close" />
        </button>
        <h2 id="upgrade-title">{t('upgrade.title')}</h2>
        <p className="upgrade-subtitle">{t('upgrade.subtitle')}</p>
        <p className="upgrade-current">{t('upgrade.currentPlan', { plan: t(`plan.${plan}`) })}</p>
        {/*
          F07(모바일 감사 보고서, 2026-09-10) — 기능 목록과 결제 버튼만
          있고 가격·결제 주기 안내가 없어, 사용자가 비용을 모른 채
          "Plus 업그레이드"를 눌러야 했다. 실제 결제 금액
          (PLUS_MONTHLY_PRICE_KRW, lib/billing.ts가 PortOne에 그대로
          넘기는 값)을 그대로 보여준다 — 화면 문구와 실제 청구액이
          따로 노는 걸 막기 위해 새 상수를 만들지 않고 결제에 쓰는
          값을 그대로 재사용했다.
        */}
        <p className="upgrade-price">
          <span className="upgrade-price-amount">
            {t('upgrade.price', {
              amount: new Intl.NumberFormat(i18n.language).format(PLUS_MONTHLY_PRICE_KRW),
            })}
          </span>
          <span className="upgrade-price-note">{t('upgrade.priceNote')}</span>
        </p>
        {/*
          2026-09-15 — 불릿 목록("~됨" 나열)이던 것을 Free/Plus 비교표로.
          사용자가 스크린샷을 보고 "무료버전과 유료버전을 비교하는 표로"
          요청했다. 행 3개는 §29-43에서 확인한 **실제 게이트 3개**와 정확히
          일치한다(subscription.ts) — 숫자(3개·40회)는 하드코딩하지 않고
          FREE_MAX_TRIPS/FREE_DAILY_GOOGLE_SEARCHES를 그대로 읽어, 나중에
          한도가 바뀌어도 이 표만 따로 안 고쳐도 된다(가격 표시와 같은 원칙,
          위 F07 주석 참고).
        */}
        <table className="upgrade-compare">
          <thead>
            <tr>
              <th scope="col">{t('compare.feature')}</th>
              <th scope="col">{t('plan.free')}</th>
              <th scope="col" className="upgrade-compare-plus-col">
                {t('plan.plus')}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t('compare.trips')}</th>
              <td>{t('compare.tripsFree', { n: FREE_MAX_TRIPS })}</td>
              <td className="upgrade-compare-plus-col">{t('compare.unlimited')}</td>
            </tr>
            <tr>
              <th scope="row">{t('compare.export')}</th>
              <td>{t('compare.no')}</td>
              <td className="upgrade-compare-plus-col">{t('compare.exportPlus')}</td>
            </tr>
            <tr>
              <th scope="row">{t('compare.search')}</th>
              <td>{t('compare.searchFree', { n: FREE_DAILY_GOOGLE_SEARCHES })}</td>
              <td className="upgrade-compare-plus-col">{t('compare.unlimited')}</td>
            </tr>
            <tr>
              <th scope="row">{t('compare.materials')}</th>
              <td>{t('compare.materialsFree', { n: FREE_MAX_TRIP_MATERIALS })}</td>
              <td className="upgrade-compare-plus-col">{t('compare.unlimited')}</td>
            </tr>
            <tr>
              <th scope="row">{t('compare.offline')}</th>
              <td>{t('compare.no')}</td>
              <td className="upgrade-compare-plus-col">{t('compare.offlinePlus')}</td>
            </tr>
          </tbody>
        </table>
        {flow === 'error' && errorMessage && (
          <p className="upgrade-error">{t('checkout.failed', { message: errorMessage })}</p>
        )}
        {isPaid ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={flow === 'processing'}
          >
            {flow === 'processing' ? t('cancel.processing') : t('cancel.button')}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleUpgrade}
            disabled={flow === 'processing'}
          >
            {flow === 'processing' ? t('checkout.processing') : t('upgrade.cta')}
          </button>
        )}
      </div>
    </div>
  );
}
