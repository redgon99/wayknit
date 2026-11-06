import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Place } from '../types';
import { Icon } from './Icon';
import { getCategoryMeta } from '../lib/categories';
import { getPlaceEmoji } from '../lib/categoryEmoji';
import { proxiedThumbnailUrl } from '../lib/kakaoPlaceApi';

interface Props {
  place: Place;
  isClosed?: boolean;
  onOpenPhotos: (place: Place) => void;
  /**
   * emoji — PC 시안과 동일: #f1f5f9 타일 + Unicode 이모지 (사진보다 우선)
   * photo — 썸네일 있으면 사진, 없으면 이모지 폴백
   */
  variant?: 'emoji' | 'photo';
}

export function PlaceThumb({
  place,
  isClosed = false,
  onOpenPhotos,
  variant = 'photo',
}: Props) {
  const { t } = useTranslation('planner');
  const meta = getCategoryMeta(place.categoryCode, place.category);
  const emoji = getPlaceEmoji(place);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [place.id, place.thumbnailUrl]);

  const thumbSrc = proxiedThumbnailUrl(place.thumbnailUrl);
  const showImage = variant === 'photo' && Boolean(thumbSrc) && !imgFailed;
  const preferEmoji = variant === 'emoji' || !showImage;

  const accent = isClosed ? '#9ca3af' : meta.bgColor;

  return (
    <button
      type="button"
      className={`result-thumb ${preferEmoji ? 'result-thumb-emoji' : ''}`}
      style={{
        borderColor: accent,
        boxShadow: preferEmoji ? undefined : `0 0 0 1px ${accent}33`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpenPhotos(place);
      }}
      title={t('map.viewPhoto', { name: place.name })}
      aria-label={t('map.viewPhoto', { name: place.name })}
    >
      {showImage ? (
        <img
          src={thumbSrc}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="result-thumb-fallback result-thumb-emoji-face" aria-hidden>
          {emoji}
        </span>
      )}
      {showImage && (
        <span className="result-thumb-badge" aria-hidden="true">
          <Icon name="photo" size={14} />
        </span>
      )}
    </button>
  );
}
