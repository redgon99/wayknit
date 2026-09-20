import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LinkPlaceCandidate } from '../lib/linkPlaces';
import type { DetectedLink } from '../lib/linkPlatform';
import { youtubePlaceChipStyle } from '../lib/youtubePlaceCategory';

interface Props {
  detected: DetectedLink | null;
  /** 마지막 추출에 쓴 sourceKey (유튜브 id / url) — 검색어가 장소명으로 바뀌어도 미리보기 유지 */
  previewKey: string | null;
  previewPlatform: DetectedLink['platform'] | null;
  previewHref: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  places: LinkPlaceCandidate[];
  error: string | null;
  extracting: boolean;
  snsMessage: string | null;
  onSearchCandidate: (query: string) => void;
  /** 없으면(호출부가 안 넘겨주면) 일괄 핀업 버튼 자체를 숨긴다 */
  onBulkPin?: (places: LinkPlaceCandidate[]) => void;
  bulkPinning?: boolean;
  disabled?: boolean;
}

export function LinkExtractResults({
  detected,
  previewKey,
  previewPlatform,
  previewHref,
  title,
  description,
  imageUrl,
  places,
  error,
  extracting,
  snsMessage,
  onSearchCandidate,
  onBulkPin,
  bulkPinning = false,
  disabled,
}: Props) {
  const { t } = useTranslation('planner');
  const [resultsExpanded, setResultsExpanded] = useState(true);
  const [thumbFailed, setThumbFailed] = useState(false);

  const activeHref = detected?.href ?? previewHref;
  const activePlatform = detected?.platform ?? previewPlatform;
  const showPreview = Boolean(activeHref && (detected || previewKey));

  useEffect(() => {
    setThumbFailed(false);
  }, [previewKey, detected?.sourceKey, imageUrl]);

  useEffect(() => {
    if (places.length > 0) setResultsExpanded(true);
  }, [places]);

  if (
    !showPreview &&
    places.length === 0 &&
    !error &&
    !extracting &&
    !snsMessage
  ) {
    return null;
  }

  const ytThumb =
    activePlatform === 'youtube' && (detected?.sourceKey || previewKey)
      ? `https://img.youtube.com/vi/${detected?.sourceKey ?? previewKey}/hqdefault.jpg`
      : null;
  const thumb = imageUrl || ytThumb;

  return (
    <div className="youtube-places-panel youtube-places-panel-embedded">
      {showPreview && activeHref && (
        <a
          className={`youtube-places-preview link-extract-preview link-extract-preview-${activePlatform ?? 'web'}`}
          href={activeHref}
          target="_blank"
          rel="noopener noreferrer"
          title={t('collect.linkOpenSource')}
        >
          {thumb && !thumbFailed ? (
            <img
              src={thumb}
              alt=""
              className="youtube-places-preview-img"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <span className="link-extract-preview-fallback" aria-hidden="true">
              {activePlatform === 'instagram'
                ? 'IG'
                : activePlatform === 'tiktok'
                  ? 'TT'
                  : activePlatform === 'youtube'
                    ? 'YT'
                    : 'WEB'}
            </span>
          )}
          {activePlatform === 'youtube' && (
            <span className="youtube-places-preview-play" aria-hidden="true">
              ▶
            </span>
          )}
          <span className="youtube-places-preview-hint">
            {title
              ? title
              : t(`collect.linkPreview.${detected?.labelKey ?? activePlatform ?? 'web'}`)}
          </span>
        </a>
      )}

      {description && !snsMessage && (
        <p className="link-extract-desc" title={description}>
          {description}
        </p>
      )}

      {snsMessage && (
        <div className="link-extract-sns">
          <p className="link-extract-sns-msg">{snsMessage}</p>
          {activeHref && (
            <a
              className="link-extract-sns-open"
              href={activeHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('collect.linkOpenSource')}
            </a>
          )}
        </div>
      )}

      {extracting && <p className="youtube-places-extracting">{t('collect.youtubeLoading')}</p>}
      {error && <p className="youtube-places-error">{error}</p>}

      {places.length > 0 && (
        <div className="youtube-places-results">
          <button
            type="button"
            className="youtube-places-results-bar"
            onClick={() => setResultsExpanded((v) => !v)}
            aria-expanded={resultsExpanded}
          >
            <span className="youtube-places-results-summary">
              {title ? (
                <span className="youtube-places-results-title" title={title}>
                  {title}
                </span>
              ) : null}
              <span className="youtube-places-results-count">
                {t('collect.youtubePlaceCount', { count: places.length })}
              </span>
            </span>
            <span className="youtube-places-results-toggle">
              {resultsExpanded ? t('collect.youtubeCollapse') : t('collect.youtubeExpand')}
            </span>
          </button>
          {resultsExpanded && onBulkPin && (
            <button
              type="button"
              className="link-extract-bulk-pin-btn"
              onClick={() => onBulkPin(places)}
              disabled={disabled || extracting || bulkPinning}
            >
              {bulkPinning ? (
                <span>{t('collect.bulkPinning')}</span>
              ) : (
                <span>{t('collect.bulkPinAll', { count: places.length })}</span>
              )}
            </button>
          )}
          {resultsExpanded && (
            <div className="youtube-places-buttons" role="list">
              {places.map((place) => {
                const chip = youtubePlaceChipStyle(place.category);
                return (
                  <button
                    key={place.name}
                    type="button"
                    role="listitem"
                    className="youtube-place-btn"
                    data-cat={place.category}
                    style={{
                      background: chip.background,
                      color: chip.color,
                      borderColor: chip.borderColor,
                    }}
                    onClick={() => onSearchCandidate(place.name)}
                    disabled={disabled || extracting}
                    title={t('collect.search')}
                  >
                    {place.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
