import { useTranslation } from 'react-i18next';
import type { MapProvider } from '../lib/mapProvider';
import { isGoogleMapsConfigured, isKakaoMapsConfigured } from '../lib/mapProviderPreference';

interface Props {
  value: MapProvider;
  onChange: (provider: MapProvider) => void;
}

export function MapProviderPicker({ value, onChange }: Props) {
  const { t } = useTranslation('common');
  const kakaoOk = isKakaoMapsConfigured();
  const googleOk = isGoogleMapsConfigured();

  return (
    <div className="map-provider-picker" role="group" aria-label={t('mapProvider.groupAria')}>
      <button
        type="button"
        className={`map-provider-btn ${value === 'kakao' ? 'active' : ''}`}
        onClick={() => onChange('kakao')}
        disabled={!kakaoOk}
        title={t('mapProvider.kakao')}
        aria-pressed={value === 'kakao'}
      >
        <KakaoMapBrandIcon />
        <span className="map-provider-label">{t('mapProvider.kakao')}</span>
      </button>
      <button
        type="button"
        className={`map-provider-btn ${value === 'google' ? 'active' : ''}`}
        onClick={() => onChange('google')}
        disabled={!googleOk}
        title={t('mapProvider.google')}
        aria-pressed={value === 'google'}
      >
        <GoogleMapBrandIcon />
        <span className="map-provider-label">{t('mapProvider.google')}</span>
      </button>
    </div>
  );
}

function KakaoMapBrandIcon() {
  return (
    <svg className="map-brand-icon" viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#FEE500" />
      <path
        fill="#3C1E1E"
        d="M12 6.2c-2.8 0-4.5 1.5-4.5 3.6 0 1.4.8 2.4 2.1 3l-1.3 2.4h2.4l.9-1.7c.3-.1.6-.1.9-.1 2.8 0 4.5-1.5 4.5-3.6S14.8 6.2 12 6.2z"
      />
    </svg>
  );
}

function GoogleMapBrandIcon() {
  return (
    <svg className="map-brand-icon" viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path fill="#EA4335" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" />
      <circle cx="12" cy="9" r="2.8" fill="#fff" />
      <path fill="#4285F4" d="M12 2v7h5.2C16.5 4.6 14.5 2 12 2z" opacity="0.35" />
    </svg>
  );
}
