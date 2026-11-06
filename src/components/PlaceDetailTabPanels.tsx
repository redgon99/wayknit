import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import type { Place } from '../types';
import { proxiedThumbnailUrl } from '../lib/kakaoPlaceApi';
import { getPanelSummary, hasMenu } from '../lib/placePanelTabs';
import { computeNearbyRanking, type NearbyRankingResult } from '../lib/nearbyRanking';
import type { PlacePanelTabId } from '../lib/placePanelTabs';
import {
  getBusinessOpenStatus,
  parseClosingAtMs,
  parseOpeningAtMs,
  type BusinessOpenStatus,
} from '../lib/openHoursStatus';
import { OpenStatusBadge } from './OpenStatusBadge';
import { parseStoreFacilities } from '../lib/storeFacilities';
import type { GooglePlaceReview } from '../lib/googlePlaceDetail';
import { glossKoreanMenuName, shouldShowMenuGloss } from '../lib/koreanMenuGloss';
import { normalizeLocale } from '../lib/locale';
import i18n from '../lib/i18n';

interface TabProps {
  panel: Record<string, unknown> | null;
  place?: Place | null;
}

export function PlaceDetailTabPanel({
  tabId,
  panel,
  place,
}: TabProps & { tabId: PlacePanelTabId }) {
  const { t } = useTranslation('planner');
  switch (tabId) {
    case 'SUMMARY':
      if (panel?.provider === 'tour') return <TourSummaryTab panel={panel} place={place} />;
      return <SummaryTab panel={panel} place={place} />;
    case 'PRODUCT':
      return <MenuTab panel={panel} />;
    case 'REVIEW':
      if (panel?.provider === 'google') return <GoogleReviewTab panel={panel} />;
      return <KakaoReviewTab panel={panel} />;
    case 'MAP':
      if (panel?.provider === 'google') return <GoogleMapTab panel={panel} />;
      return <EmptyTab message={t('place.detail.empty.map')} />;
    case 'INFO':
      if (panel?.provider === 'google') return <GoogleInfoTab panel={panel} />;
      return <EmptyTab message={t('place.detail.empty.info')} />;
    case 'BLOG':
      return <BlogReviewTab panel={panel} />;
    case 'BOOKING':
      return <BookingTab panel={panel} />;
    case 'NEWS':
      return <NewsTab panel={panel} />;
    case 'SPECIAL':
      return <SpecialTab panel={panel} />;
    case 'RANKING':
      return <RankingTab panel={panel} place={place} />;
    case 'HOME':
      return <HomeTab panel={panel} />;
    default:
      return <EmptyTab message={t('place.detail.empty.tab')} />;
  }
}

function EmptyTab({ message }: { message: string }) {
  return <p className="place-detail-empty">{message}</p>;
}

function SummaryTab({ panel, place }: TabProps) {
  const { t } = useTranslation('planner');
  const provider = panel?.provider;
  if (provider === 'google') {
    return <GoogleSummaryTab panel={panel} place={place} />;
  }

  const summary = getPanelSummary(panel);
  const hoursBlock = getOpenHoursBlock(panel);
  const address =
    formatKakaoAddress(summary) ?? place?.roadAddress ?? place?.address;
  const phones = collectPhones(summary, place);
  const links = collectHomepageLinks(summary);
  const storeFacilities = parseStoreFacilities(panel);
  const cardTags = Array.isArray(panel?.panel_card_tags)
    ? (panel.panel_card_tags as string[])
    : [];
  const bizVerified = cardTags.includes('BIZ') && summary?.status === 'Y';
  const daysOff = pickStr(
    hoursBlock?.headline_addition as Record<string, unknown> | undefined,
    'days_off_desc'
  );
  const businessStatus = resolveBusinessStatus(hoursBlock?.headline, place);
  const closesAt =
    businessStatus === 'open' && hoursBlock?.headline
      ? (place?.closesAt ??
        parseClosingAtMs(hoursBlock.headline, hoursBlock.rawHeadline))
      : undefined;
  const opensAt =
    businessStatus === 'scheduled' && hoursBlock?.headline
      ? (place?.opensAt ??
        parseOpeningAtMs(hoursBlock.headline, hoursBlock.rawHeadline))
      : undefined;

  const koName = place?.nameKo ?? place?.name;

  if (!summary && !address && phones.length === 0 && links.length === 0 && !koName) {
    return <EmptyTab message={t('place.detail.empty.summary')} />;
  }

  return (
    <div className="place-detail-summary">
      {koName && (
        <SummaryRow icon="mapPin" copyText={koName} copyLabel={t('place.detail.koreanName')}>
          <p className="place-detail-summary-text place-detail-name-ko">{koName}</p>
        </SummaryRow>
      )}
      {hoursBlock?.headline && (
        <SummaryRow icon="clock">
          <div className="place-detail-summary-hours-wrap">
            {businessStatus && (
              <OpenStatusBadge
                status={businessStatus}
                closesAt={closesAt}
                opensAt={opensAt}
                className="place-detail-open-status"
              />
            )}
            <p className="place-detail-summary-text place-detail-summary-hours-detail">
              {hoursBlock.headline.displayText}
              {hoursBlock.headline.displayTextInfo
                ? ` ${hoursBlock.headline.displayTextInfo}`
                : ''}
            </p>
            {daysOff && <p className="place-detail-summary-sub">{daysOff}</p>}
          </div>
        </SummaryRow>
      )}

      {links.map((link) => (
        <SummaryRow key={link.url} icon="globe">
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </SummaryRow>
      ))}

      {address && (
        <SummaryRow icon="mapPin" copyText={address} copyLabel={t('place.detail.address')}>
          <p className="place-detail-summary-text">{address}</p>
        </SummaryRow>
      )}

      {phones.map((tel) => (
        <SummaryRow key={tel} icon="phone" copyText={tel} copyLabel={t('place.detail.phone')}>
          <a href={`tel:${tel.replace(/\s/g, '')}`} className="place-detail-summary-text">
            {tel}
          </a>
        </SummaryRow>
      ))}

      {bizVerified && (
        <p className="place-detail-summary-verified">
          <Icon name="check" />
          {t('place.detail.bizVerified')}
        </p>
      )}

      {(storeFacilities.chips.length > 0 || storeFacilities.details.length > 0) && (
        <StoreFacilitySection section={storeFacilities} />
      )}
    </div>
  );
}

function GoogleSummaryTab({ panel, place }: TabProps) {
  const { t } = useTranslation('planner');
  const summary = (panel?.summary as Record<string, unknown> | undefined) ?? {};
  const address = pickStr(summary, 'address') ?? place?.roadAddress ?? place?.address;
  const phone = pickStr(summary, 'phone') ?? place?.phone;
  const website = pickStr(summary, 'website');
  const openingText = pickStr(summary, 'openingText');
  const todayHours = pickStr(summary, 'todayHours');
  const openingNowRaw = summary.openingNow;
  const openingNow =
    typeof openingNowRaw === 'boolean'
      ? openingNowRaw
      : openingNowRaw != null
        ? String(openingNowRaw).toLowerCase() === 'true'
        : undefined;
  const openingStatus: BusinessOpenStatus | null =
    openingNow === true ? 'open' : openingNow === false ? 'closed' : null;
  const editorial = pickStr(summary, 'editorialSummary');
  const categoryLabel = pickStr(summary, 'categoryLabel') ?? place?.categoryLabel;
  // 가격대는 숫자(0~4)로 받아 여기서 번역한다. 숫자가 없는 예전 캐시만 저장된 라벨을 쓴다.
  const priceLevelLabel =
    typeof summary.priceLevel === 'number'
      ? googlePriceLevelLabel(summary.priceLevel, t)
      : pickStr(summary, 'priceLevelLabel');
  const ratingRaw = summary.rating;
  const reviewRaw = summary.reviewCount;
  const rating =
    typeof ratingRaw === 'number'
      ? ratingRaw
      : ratingRaw != null
        ? Number(ratingRaw)
        : place?.rating;
  const reviewCount =
    typeof reviewRaw === 'number'
      ? reviewRaw
      : reviewRaw != null
        ? Number(reviewRaw)
        : place?.reviewCount;
  const hoursDisplay = todayHours ?? openingText;

  if (!address && !phone && !website && !hoursDisplay && rating == null && !editorial) {
    return <EmptyTab message={t('place.detail.empty.summary')} />;
  }

  return (
    <div className="place-detail-summary place-detail-google-summary">
      {(rating != null && !Number.isNaN(rating)) ||
      categoryLabel ||
      priceLevelLabel ? (
        <div className="place-detail-google-hero">
          {rating != null && !Number.isNaN(rating) && (
            <div className="place-detail-google-rating">
              <span className="place-detail-google-rating-value">{rating.toFixed(1)}</span>
              <span className="place-detail-google-rating-stars" aria-hidden="true">
                <Icon name="star" size={16} />
              </span>
              {reviewCount != null && !Number.isNaN(reviewCount) && (
                <span className="place-detail-google-rating-count">
                  {t('search.reviewsSuffix', { count: Math.round(reviewCount) })}
                </span>
              )}
            </div>
          )}
          <div className="place-detail-google-meta-chips">
            {priceLevelLabel && (
              <span className="place-detail-google-chip">{priceLevelLabel}</span>
            )}
            {categoryLabel && (
              <span className="place-detail-google-chip">{categoryLabel}</span>
            )}
          </div>
        </div>
      ) : null}

      {editorial && <p className="place-detail-google-editorial">{editorial}</p>}

      {hoursDisplay && (
        <SummaryRow icon="clock">
          <div className="place-detail-summary-hours-wrap">
            {openingStatus && (
              <OpenStatusBadge
                status={openingStatus}
                className="place-detail-open-status"
              />
            )}
            <p
              className={`place-detail-summary-text place-detail-summary-hours-detail${openingText?.includes('\n') ? ' place-detail-summary-preline' : ''}`}
            >
              {hoursDisplay}
            </p>
          </div>
        </SummaryRow>
      )}

      {address && (
        <SummaryRow icon="mapPin" copyText={address} copyLabel={t('place.detail.address')}>
          <p className="place-detail-summary-text">{address}</p>
        </SummaryRow>
      )}

      {phone && (
        <SummaryRow icon="phone" copyText={phone} copyLabel={t('place.detail.phone')}>
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="place-detail-summary-text">
            {phone}
          </a>
        </SummaryRow>
      )}

      {website && (
        <SummaryRow icon="globe">
          <a href={website} target="_blank" rel="noopener noreferrer">
            {website}
          </a>
        </SummaryRow>
      )}

      {panel?.api_source != null && (
        <p className="place-detail-google-api-note">
          {t('place.detail.googleApiNote', {
            source: String(panel.api_source) === 'new' ? 'Places API (New)' : 'Places API',
          })}
        </p>
      )}
    </div>
  );
}

function TourSummaryTab({ panel, place }: TabProps) {
  const { t } = useTranslation('planner');
  const overview = pickStr(panel ?? undefined, 'overview');
  const homepage = pickStr(panel ?? undefined, 'homepage');
  const tel = pickStr(panel ?? undefined, 'tel') ?? place?.phone;
  const address = pickStr(panel ?? undefined, 'address') ?? place?.roadAddress ?? place?.address;
  const intro = (panel?.intro as Record<string, string> | undefined) ?? {};

  if (!overview && !homepage && !tel && !address && Object.keys(intro).length === 0) {
    return <EmptyTab message={t('place.detail.empty.summary')} />;
  }

  return (
    <div className="place-detail-summary">
      {overview && <p className="place-detail-summary-text place-detail-tour-overview">{overview}</p>}

      {intro.hours && (
        <SummaryRow icon="clock">
          <p className="place-detail-summary-text">{intro.hours}</p>
          {intro.restDate && <p className="place-detail-summary-sub">{t('place.detail.restDate')}: {intro.restDate}</p>}
        </SummaryRow>
      )}
      {!intro.hours && intro.restDate && (
        <SummaryRow icon="clock">
          <p className="place-detail-summary-text">{t('place.detail.restDate')}: {intro.restDate}</p>
        </SummaryRow>
      )}

      {address && (
        <SummaryRow icon="mapPin" copyText={address} copyLabel={t('place.detail.address')}>
          <p className="place-detail-summary-text">{address}</p>
        </SummaryRow>
      )}

      {tel && (
        <SummaryRow icon="phone" copyText={tel} copyLabel={t('place.detail.phone')}>
          <a href={`tel:${tel.replace(/\s/g, '')}`} className="place-detail-summary-text">
            {tel}
          </a>
        </SummaryRow>
      )}

      {homepage && (
        <SummaryRow icon="globe">
          <a href={homepage} target="_blank" rel="noopener noreferrer">
            {homepage}
          </a>
        </SummaryRow>
      )}

      {(intro.parking || intro.infoCenter || intro.fee) && (
        <ul className="place-detail-facility-details">
          {intro.fee && <li className="place-detail-facility-detail">{t('place.detail.fee')}: {intro.fee}</li>}
          {intro.parking && <li className="place-detail-facility-detail">{t('place.detail.parking')}: {intro.parking}</li>}
          {intro.infoCenter && <li className="place-detail-facility-detail">{t('place.detail.infoCenter')}: {intro.infoCenter}</li>}
        </ul>
      )}

      <p className="place-detail-tour-attribution">{t('place.detail.tourAttribution')}</p>
    </div>
  );
}

function GoogleReviewTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const summary = (panel?.summary as Record<string, unknown> | undefined) ?? {};
  const reviews = (panel?.reviews as GooglePlaceReview[] | undefined) ?? [];
  const ratingRaw = summary.rating;
  const reviewRaw = summary.reviewCount;
  const rating =
    typeof ratingRaw === 'number' ? ratingRaw : ratingRaw != null ? Number(ratingRaw) : undefined;
  const reviewCount =
    typeof reviewRaw === 'number'
      ? reviewRaw
      : reviewRaw != null
        ? Number(reviewRaw)
        : undefined;

  if (reviews.length === 0 && rating == null) {
    return <EmptyTab message={t('place.detail.empty.reviews')} />;
  }

  // 이름 없는 작성자는 저장할 때 빈 문자열로 두고 여기서 지금 언어로 채운다.
  const authorOf = (r: GooglePlaceReview) =>
    r.authorName ? String(r.authorName) : t('place.detail.googleUser');

  return (
    <div className="place-detail-google-reviews">
      {rating != null && !Number.isNaN(rating) && (
        <div className="place-detail-google-review-summary">
          <span className="place-detail-google-rating-value">{rating.toFixed(1)}</span>
          <Icon name="star" size={18} />
          {reviewCount != null && !Number.isNaN(reviewCount) && (
            <span className="place-detail-google-rating-count">
              {t('search.reviewsSuffix', { count: Math.round(reviewCount) })}
            </span>
          )}
        </div>
      )}
      <ul className="place-detail-google-review-list">
        {reviews.map((r, i) => (
          <li key={`${authorOf(r)}-${i}`} className="place-detail-google-review-item">
            <div className="place-detail-google-review-head">
              <div className="place-detail-google-review-author">
                {r.profilePhotoUrl ? (
                  <img
                    src={String(r.profilePhotoUrl)}
                    alt=""
                    className="place-detail-google-review-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="place-detail-google-review-avatar-fallback" aria-hidden="true">
                    {authorOf(r).charAt(0)}
                  </span>
                )}
                <div>
                  {r.authorUri ? (
                    <a
                      href={String(r.authorUri)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="place-detail-google-review-author"
                    >
                      {authorOf(r)}
                    </a>
                  ) : (
                    <span className="place-detail-google-review-author">
                      {authorOf(r)}
                    </span>
                  )}
                  {r.relativeTime ? (
                    <time className="place-detail-google-review-time">{r.relativeTime}</time>
                  ) : null}
                </div>
              </div>
              {typeof r.rating === 'number' && (
                <span className="place-detail-google-review-stars">
                  {r.rating.toFixed(1)} <Icon name="star" size={12} />
                </span>
              )}
            </div>
            {r.text != null && String(r.text).length > 0 && (
              <p className="place-detail-google-review-body">{String(r.text)}</p>
            )}
          </li>
        ))}
      </ul>
      <footer className="place-detail-google-attribution">
        {t('place.detail.googleReviewsPartial')}
      </footer>
    </div>
  );
}

function GoogleInfoTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const options =
    (panel?.serviceOptions as Array<{ id?: string; label?: string; available?: boolean }>) ?? [];
  if (options.length === 0) {
    return <EmptyTab message={t('place.detail.empty.googleInfo')} />;
  }

  return (
    <section className="place-detail-google-service-block" aria-label={t('place.detail.serviceOptions')}>
      <h4 className="place-detail-google-section-title">{t('place.detail.serviceOptions')}</h4>
      <ul className="place-detail-google-service-list">
        {options.map((opt) => (
          <li
            key={String(opt.id ?? opt.label)}
            className={`place-detail-google-service-item ${opt.available ? 'available' : 'unavailable'}`}
          >
            <Icon name={opt.available ? 'check' : 'close'} size={14} />
            {/* id가 없는 건 30분 캐시에 남은 예전 데이터 — 저장된 라벨을 그대로 쓴다 */}
            {opt.id
              ? t(`place.detail.service.${opt.id}`, { defaultValue: opt.label })
              : String(opt.label ?? '')}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GoogleMapTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const mapEmbedUrl = panel?.map_embed_url as string | undefined;
  const placeUrl = panel?.place_url as string | undefined;
  if (!mapEmbedUrl) {
    return <EmptyTab message={t('place.detail.empty.mapPreview')} />;
  }

  return (
    <div className="place-detail-google-map-wrap">
      <iframe
        title={t('place.detail.tabs.map')}
        className="place-detail-google-map-embed"
        src={mapEmbedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="place-detail-google-map-hint">{t('place.detail.googleMapHint')}</p>
      {placeUrl && (
        <a
          href={placeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="place-detail-google-map-link"
        >
          {t('place.detail.openOnGoogleShort')}
          <Icon name="externalLink" size={14} />
        </a>
      )}
    </div>
  );
}

function StoreFacilitySection({
  section,
}: {
  section: ReturnType<typeof parseStoreFacilities>;
}) {
  const { t } = useTranslation('planner');
  return (
    <section className="place-detail-store-section" aria-label={t('place.detail.storeInfo')}>
      <h4 className="place-detail-store-title">{t('place.detail.storeInfo')}</h4>
      {section.chips.length > 0 && (
        <ul className="place-detail-facility-grid" role="list">
          {section.chips.map((chip) => (
            <li key={chip.key} className="place-detail-facility-chip" role="listitem">
              <span className="place-detail-facility-icon" aria-hidden="true">
                <Icon name={chip.icon} size={28} />
              </span>
              <span className="place-detail-facility-label">
                {chip.id
                  ? t(`place.detail.facility.${chip.id}`, { defaultValue: chip.label })
                  : chip.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      {section.details.length > 0 && (
        <ul className="place-detail-facility-details">
          {section.details.map((row) => (
            <li key={row.key} className="place-detail-facility-detail">
              {row.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryRow({
  icon,
  children,
  copyText,
  copyLabel,
}: {
  icon: 'clock' | 'globe' | 'mapPin' | 'phone';
  children: ReactNode;
  copyText?: string;
  copyLabel?: string;
}) {
  const { t } = useTranslation('planner');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="place-detail-summary-row">
      <span className="place-detail-summary-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="place-detail-summary-main">{children}</div>
      {copyText && (
        <button
          type="button"
          className="place-detail-copy-btn"
          onClick={() => void handleCopy()}
          aria-label={t('place.detail.copyAria', {
            label: copyLabel ?? t('place.detail.tabs.info'),
          })}
        >
          {copied ? t('place.detail.copied') : t('place.detail.copy')}
        </button>
      )}
    </div>
  );
}

function resolveBusinessStatus(
  headline: { code?: string; displayText: string; displayTextInfo?: string } | undefined,
  place?: Place | null
): BusinessOpenStatus | null {
  const fromHours = getBusinessOpenStatus(headline);
  if (fromHours) return fromHours;
  if (place?.openingStatus === 'open' || place?.isOpenNow === true) return 'open';
  if (place?.openingStatus === 'scheduled') return 'scheduled';
  if (place?.openingStatus === 'closed') return 'closed';
  if (place?.openingStatus === 'offday') return 'offday';
  return null;
}

function getOpenHoursBlock(panel: Record<string, unknown> | null): {
  headline: { code?: string; displayText: string; displayTextInfo?: string };
  rawHeadline?: Record<string, unknown>;
  headline_addition?: Record<string, unknown>;
} | null {
  const summary = getPanelSummary(panel);
  const raw = (panel?.open_hours ?? summary?.open_hours) as
    | Record<string, unknown>
    | undefined;
  if (!raw) return null;
  const headline = raw.headline as Record<string, unknown> | undefined;
  if (!headline?.display_text) return null;
  return {
    headline: {
      code: pickStr(headline, 'code'),
      displayText: String(headline.display_text),
      displayTextInfo: headline.display_text_info
        ? String(headline.display_text_info)
        : undefined,
    },
    rawHeadline: headline,
    headline_addition: raw.headline_addition as Record<string, unknown> | undefined,
  };
}

function formatKakaoAddress(
  summary: Record<string, unknown> | undefined
): string | undefined {
  const addr = summary?.address as Record<string, unknown> | undefined;
  if (!addr) return undefined;
  const base =
    pickStr(addr, 'disp') ?? pickStr(addr, 'road') ?? pickStr(addr, 'jibun');
  if (!base) return undefined;
  const zone = pickStr(addr, 'base_zone_no');
  return zone ? `${base} (우)${zone}` : base;
}

function collectPhones(
  summary: Record<string, unknown> | undefined,
  place?: Place | null
): string[] {
  const fromPanel = (
    (summary?.phone_numbers as Array<{ tel?: string }> | undefined) ?? []
  )
    .map((p) => p.tel?.trim())
    .filter((t): t is string => Boolean(t));
  if (fromPanel.length > 0) return [...new Set(fromPanel)];
  if (place?.phone?.trim()) return [place.phone.trim()];
  return [];
}

function collectHomepageLinks(
  summary: Record<string, unknown> | undefined
): Array<{ url: string; label: string }> {
  const links: Array<{ url: string; label: string }> = [];
  const related = summary?.related_links as Record<string, unknown> | undefined;
  const primary = (related?.primary_links as Array<Record<string, unknown>>) ?? [];
  for (const item of primary) {
    const url = pickStr(item, 'url');
    if (!url) continue;
    links.push({
      url,
      label: pickStr(item, 'display_text') ?? url,
    });
  }
  const homepages = (summary?.homepages as string[] | undefined) ?? [];
  for (const url of homepages) {
    if (!url?.trim()) continue;
    if (links.some((l) => l.url === url)) continue;
    links.push({ url, label: url });
  }
  return links;
}

function HomeTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const summary = panel?.summary as Record<string, unknown> | undefined;
  if (!summary) return <EmptyTab message={t('place.detail.empty.home')} />;

  const displayInfo = summary.display_info as Record<string, unknown> | undefined;
  const name = pickStr(displayInfo, 'display_name1') ?? pickStr(summary, 'name');
  const category = summary.category as Record<string, unknown> | undefined;
  const catPath = [category?.name1, category?.name2, category?.name3, category?.name4]
    .filter(Boolean)
    .join(' > ');
  const address = (summary.address as Record<string, unknown> | undefined)?.disp as
    | string
    | undefined;
  const phones = summary.phone_numbers as Array<{ tel?: string }> | undefined;
  const hours = summary.open_hours as Record<string, unknown> | undefined;
  const headline = hours?.headline as Record<string, unknown> | undefined;
  const homepages = summary.homepages as string[] | undefined;
  const addInfo = panel?.place_add_info as Record<string, unknown> | undefined;
  const tags = (addInfo?.tags as string[]) ?? [];

  return (
    <div className="place-detail-home">
      {name && <h3 className="place-detail-home-name">{name}</h3>}
      {catPath && <p className="place-detail-meta">{catPath}</p>}
      {headline?.display_text != null && (
        <p className="place-detail-hours">
          <Icon name="clock" />
          {String(headline.display_text)}
          {headline.display_text_info != null
            ? ` · ${String(headline.display_text_info)}`
            : ''}
        </p>
      )}
      {address && (
        <p className="place-detail-row">
          <Icon name="mapPin" />
          {address}
        </p>
      )}
      {phones?.[0]?.tel && (
        <p className="place-detail-row">
          <Icon name="phone" />
          {phones[0].tel}
        </p>
      )}
      {homepages?.[0] && (
        <p className="place-detail-row">
          <Icon name="globe" />
          <a href={homepages[0]} target="_blank" rel="noopener noreferrer">
            {homepages[0]}
          </a>
        </p>
      )}
      {tags.length > 0 && (
        <div className="place-detail-tags">
          {tags.map((t) => (
            <span key={t} className="place-detail-tag">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  if (!hasMenu(panel)) return <EmptyTab message={t('place.detail.empty.menu')} />;

  const menu = panel!.menu as Record<string, unknown>;
  const items =
    ((menu.menus as Record<string, unknown>)?.items as Array<Record<string, unknown>>) ??
    [];
  const locale = normalizeLocale(i18n.language);
  const showGloss = shouldShowMenuGloss(locale);

  return (
    <ul className="place-detail-menu-list">
      {items.map((item) => {
        const photo = item.photo_url as string | undefined;
        const proxied = photo ? proxiedThumbnailUrl(photo) ?? photo : undefined;
        const name = String(item.name ?? '');
        const gloss = showGloss ? glossKoreanMenuName(name) : null;
        return (
          <li key={String(item.product_id ?? item.name)} className="place-detail-menu-item">
            {proxied && (
              <img src={proxied} alt="" className="place-detail-menu-img" />
            )}
            <div className="place-detail-menu-text">
              <span className="place-detail-menu-name">{name}</span>
              {gloss && (
                <span className="place-detail-menu-gloss" lang="en">
                  {gloss}
                </span>
              )}
              {item.desc != null && String(item.desc).length > 0 && (
                <span className="place-detail-menu-desc">{String(item.desc)}</span>
              )}
              {item.price !== undefined && (
                <span className="place-detail-menu-price">
                  {locale === 'ko'
                    ? `${Number(item.price).toLocaleString()}원`
                    : `₩${Number(item.price).toLocaleString()}`}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function KakaoReviewTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const block = panel?.kakaomap_review as Record<string, unknown> | undefined;
  const score = block?.score_set as Record<string, unknown> | undefined;
  const reviews = (block?.reviews as Array<Record<string, unknown>>) ?? [];

  if (reviews.length === 0 && !score?.average_score) {
    return <EmptyTab message={t('place.detail.empty.kakaoReviews')} />;
  }

  return (
    <div className="place-detail-reviews">
      {score?.average_score !== undefined && (
        <p className="place-detail-score">
          <Icon name="star" />
          {Number(score.average_score).toFixed(1)}
          {score.review_count !== undefined && (
            <span> · {t('place.detail.kakaoReviewCount', { count: Number(score.review_count) })}</span>
          )}
        </p>
      )}
      <ul className="place-detail-review-list">
        {reviews.map((r) => (
          <li key={String(r.review_id)} className="place-detail-review-item">
            <div className="place-detail-review-head">
              <span className="place-detail-review-author">
                {(r.meta as Record<string, unknown>)?.owner
                  ? String(
                      (
                        (r.meta as Record<string, unknown>).owner as Record<
                          string,
                          unknown
                        >
                      ).nickname ?? t('place.detail.anonymous')
                    )
                  : t('place.detail.anonymous')}
              </span>
              {r.star_rating !== undefined && (
                <span className="place-detail-review-stars">
                  <Icon name="star" />
                  {Number(r.star_rating)}
                </span>
              )}
            </div>
            {r.contents != null && (
              <p className="place-detail-review-body">{String(r.contents)}</p>
            )}
            {r.registered_at != null && (
              <time className="place-detail-review-date">{String(r.registered_at)}</time>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlogReviewTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const block = panel?.blog_review as Record<string, unknown> | undefined;
  const reviews = (block?.reviews as Array<Record<string, unknown>>) ?? [];

  if (reviews.length === 0) {
    return <EmptyTab message={t('place.detail.empty.blog')} />;
  }

  return (
    <ul className="place-detail-blog-list">
      {reviews.map((r) => (
        <li key={String(r.review_id)} className="place-detail-blog-item">
          {r.origin_url ? (
            <a href={String(r.origin_url)} target="_blank" rel="noopener noreferrer">
              <span className="place-detail-blog-title">
                {String(r.title ?? t('place.detail.blogPost'))}
              </span>
            </a>
          ) : (
            <span className="place-detail-blog-title">
              {String(r.title ?? t('place.detail.blogPost'))}
            </span>
          )}
          {r.author != null && (
            <span className="place-detail-blog-author">{String(r.author)}</span>
          )}
          {r.contents != null && (
            <p className="place-detail-blog-excerpt">{String(r.contents).slice(0, 120)}…</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function BookingTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const notice = panel?.my_store_notice as Record<string, unknown> | undefined;
  if (!notice) return <EmptyTab message={t('place.detail.empty.booking')} />;

  const available = notice.is_available_booking === true;
  return (
    <div className="place-detail-booking">
      <p className={available ? 'place-detail-ok' : 'place-detail-muted'}>
        {available
          ? t('place.detail.bookingAvailable')
          : t('place.detail.bookingUnknown')}
      </p>
      {notice.notice_count !== undefined && (
        <p className="place-detail-meta">
          {t('place.detail.storeNewsCount', { count: Number(notice.notice_count) })}
        </p>
      )}
    </div>
  );
}

function NewsTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const notice = panel?.my_store_notice as Record<string, unknown> | undefined;
  const channel = panel?.talk_channel as Record<string, unknown> | undefined;

  if (!notice && !channel) return <EmptyTab message={t('place.detail.empty.news')} />;

  return (
    <div className="place-detail-news">
      {notice?.status != null && (
        <p className="place-detail-meta">
          {t('place.detail.storeStatus', { status: String(notice.status) })}
        </p>
      )}
      {channel?.name != null && (
        <p className="place-detail-row">
          <Icon name="bell" />
          {String(channel.name)}
        </p>
      )}
      <p className="place-detail-muted">{t('place.detail.newsSeeKakao')}</p>
    </div>
  );
}

function SpecialTab({ panel }: TabProps) {
  const { t } = useTranslation('planner');
  const events = panel?.events as Record<string, unknown> | unknown[] | undefined;
  const list = Array.isArray(events)
    ? events
    : Array.isArray((events as Record<string, unknown>)?.items)
      ? ((events as Record<string, unknown>).items as unknown[])
      : [];

  if (list.length === 0) return <EmptyTab message={t('place.detail.empty.special')} />;

  return (
    <ul className="place-detail-special-list">
      {list.map((ev, i) => {
        const item = ev as Record<string, unknown>;
        return (
          <li key={String(item.id ?? i)} className="place-detail-special-item">
            {item.title ? String(item.title) : t('place.detail.specialN', { n: i + 1 })}
          </li>
        );
      })}
    </ul>
  );
}

function RankingTab({ place }: TabProps) {
  const { t } = useTranslation('planner');
  const [result, setResult] = useState<NearbyRankingResult | null | 'loading'>(
    'loading'
  );

  useEffect(() => {
    if (!place) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setResult('loading');
    computeNearbyRanking(place).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [place]);

  if (result === 'loading') {
    return <p className="place-detail-status">{t('place.detail.rankingLoading')}</p>;
  }
  if (!result || !place) {
    return <EmptyTab message={t('place.detail.empty.ranking')} />;
  }

  const top = result.entries.slice(0, 5);

  return (
    <div className="place-detail-ranking">
      <p className="place-detail-muted place-detail-ranking-disclaimer">
        {t('place.detail.rankingDisclaimer')}
      </p>
      {result.currentRank && (
        <p className="place-detail-ok">
          <Icon name="trophy" />{' '}
          {t('place.detail.rankingMyRank', {
            rank: result.currentRank,
            total: result.entries.length,
          })}
        </p>
      )}
      <ol className="place-detail-ranking-list">
        {top.map((p, i) => (
          <li
            key={p.id}
            className={`place-detail-ranking-item ${p.id === place.id ? 'current' : ''}`}
          >
            <span className="place-detail-ranking-rank">{i + 1}</span>
            <span className="place-detail-ranking-name">{p.name}</span>
            <span className="place-detail-ranking-stat">
              ★{p.rating.toFixed(1)} · {t('place.detail.rankingReviews', { count: p.reviewCount })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function pickStr(obj: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** 구글 가격대(0~4). 0·1은 말이라 번역하고, 2~4는 금액 범위라 언어와 무관하다. */
function googlePriceLevelLabel(
  level: number,
  t: ReturnType<typeof useTranslation>['t']
): string | undefined {
  if (level < 0) return undefined;
  if (level === 0) return t('place.detail.priceFree');
  if (level === 1) return t('place.detail.priceUnder', { amount: '₩10,000' });
  return ['₩10,000–20,000', '₩20,000–30,000', '₩30,000+'][Math.min(level, 4) - 2];
}
