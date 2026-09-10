import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { PlanId } from '../lib/subscription';
import { isPlusOrTeam, PLUS_MONTHLY_PRICE_KRW } from '../lib/subscription';
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
        <ul className="upgrade-features">
          <li>{t('features.unlimitedTrips')}</li>
          <li>{t('features.cloudSync')}</li>
          <li>{t('features.exportI18n')}</li>
          <li>{t('features.realRoute')}</li>
        </ul>
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
