import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Icon, type IconName } from './Icon';
import { normalizeLocale } from '../lib/locale';
import { CATEGORY_MAP } from '../lib/categories';
import type { Place, PinnedPlace } from '../types';
import { applyImportRows, type PinImportResult } from '../lib/importPins';
import { listPublishedScenarios, listPublishedScenarioCounts } from '../lib/scenarioCatalog';
import { SCENARIO_THEMES, applyScenarioToTrip, scenarioStopToPlace, type ScenarioTheme, type TourScenario } from '../lib/tourScenario';
import {
  isTripIntentConfigured,
  parseTripIntent,
  canGenerateAiTripPlan,
  recordAiTripPlanGeneration,
  FREE_DAILY_AI_TRIP_PLANS,
  DestinationMissingError,
  type TripIntent,
} from '../lib/tripIntent';
import { searchTripCandidates } from '../lib/tripCandidates';
import { generateTripPlan, type GeneratedTripPlan } from '../lib/tripPlanner';

const THEME_ICON: Record<ScenarioTheme, IconName> = {
  meditation: 'catCulture',
  wellbeing: 'sparkles',
  shopping: 'catShop',
  family: 'facilityGroup',
  honeymoon: 'star',
  night: 'photo',
  hallyu: 'trophy',
  camping: 'flag',
  walking: 'transportWalk',
  marine: 'navigate',
};

interface ScenarioOption {
  id: string;
  days: number;
  scenario: TourScenario;
}

interface Props {
  currentDay: number;
  totalDays: number;
  pinnedByDay: Record<number, PinnedPlace[]>;
  onApply: (result: PinImportResult) => void;
  onSelectPlace?: (place: Place) => void;
  /**
   * U13(모바일 UX 리포트 2026-09-13) — 고른 테마에 준비된 시나리오가
   * 없을 때 "다음 행동"으로 검색 탭/시트로 보낸다. 안 넘기면 버튼 자체가
   * 안 뜬다(호출부가 검색 이동 수단이 없는 맥락일 수 있어서).
   */
  onGoToSearch?: () => void;
}

export function ThemeScenarioPanel({
  currentDay,
  totalDays,
  pinnedByDay,
  onApply,
  onSelectPlace,
  onGoToSearch,
}: Props) {
  const { t, i18n } = useTranslation('planner');
  const { isAdmin } = useAuth();
  const [theme, setTheme] = useState<ScenarioTheme | null>(null);
  const [options, setOptions] = useState<ScenarioOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [scenario, setScenario] = useState<TourScenario | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const [themeCounts, setThemeCounts] = useState<Partial<Record<ScenarioTheme, number>> | null>(null);
  const optionsRequestRef = useRef<ScenarioTheme | null>(null);

  // AI 일정 생성(§31-22 Step 5) — 기존 테마 카탈로그 흐름과 별개 모드, 같은 onApply/onSelectPlace를 재사용
  const [mode, setMode] = useState<'theme' | 'ai'>('theme');
  const [aiText, setAiText] = useState('');
  const [aiStage, setAiStage] = useState<'idle' | 'intent' | 'candidates' | 'plan'>('idle');
  const [aiIntent, setAiIntent] = useState<TripIntent | null>(null);
  const [aiPlan, setAiPlan] = useState<GeneratedTripPlan | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAppliedCount, setAiAppliedCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void listPublishedScenarioCounts().then((counts) => {
      if (alive) setThemeCounts(counts);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleSelectTheme = (id: ScenarioTheme) => {
    setTheme(id);
    setOptions([]);
    setLoadingOptions(true);
    optionsRequestRef.current = id;
    void listPublishedScenarios(id, normalizeLocale(i18n.language)).then((rows) => {
      // 사용자가 이후 다른 테마를 눌렀다면 이 응답은 무시(경쟁 상태 방지)
      if (optionsRequestRef.current !== id) return;
      setOptions(rows);
      setLoadingOptions(false);
    });
  };

  const handlePickOption = (option: ScenarioOption) => {
    setScenario(option.scenario);
    setAppliedCount(null);
  };

  const handleApply = () => {
    if (!scenario) return;
    const result = applyScenarioToTrip(scenario, { currentDay, totalDays, existingByDay: pinnedByDay });
    onApply(result);
    setAppliedCount(result.importedCount);
  };

  const handleReset = () => {
    setScenario(null);
    setAppliedCount(null);
  };

  const handleGenerateAi = async () => {
    const text = aiText.trim();
    if (!text) return;
    setAiError(null);
    setAiPlan(null);
    setAiAppliedCount(null);
    try {
      // §31-22 Step 6 — Claude+TourAPI 호출 전에 하루 캡을 먼저 확인한다(실제 방어선은 서버 RPC)
      const allowed = await canGenerateAiTripPlan();
      if (!allowed) {
        setAiError(t('scenario.ai.dailyCapReached', { max: FREE_DAILY_AI_TRIP_PLANS }));
        return;
      }
      void recordAiTripPlanGeneration();

      setAiStage('intent');
      const intent = await parseTripIntent(text);
      setAiIntent(intent);

      setAiStage('candidates');
      const { candidates } = await searchTripCandidates(intent);
      if (candidates.length === 0) {
        setAiError(t('scenario.ai.noCandidates'));
        setAiStage('idle');
        return;
      }

      setAiStage('plan');
      const plan = generateTripPlan(intent, candidates);
      setAiPlan(plan);
      setAiStage('idle');
    } catch (e) {
      setAiError(e instanceof DestinationMissingError ? t('scenario.ai.errorDestinationMissing') : t('scenario.ai.errorGeneric'));
      setAiStage('idle');
    }
  };

  const handleApplyAiPlan = () => {
    if (!aiPlan) return;
    const result = applyImportRows(aiPlan.rows, {
      currentDay,
      totalDays,
      existingByDay: pinnedByDay,
      scope: 'all',
      mode: 'merge',
    });
    onApply(result);
    setAiAppliedCount(result.importedCount);
  };

  const handleResetAi = () => {
    setAiText('');
    setAiIntent(null);
    setAiPlan(null);
    setAiError(null);
    setAiAppliedCount(null);
    setAiStage('idle');
  };

  const aiPlanByDay = aiPlan
    ? aiPlan.rows.reduce<Record<number, typeof aiPlan.rows>>((acc, row) => {
        (acc[row.day] ??= []).push(row);
        return acc;
      }, {})
    : {};

  return (
    <div className="theme-scenario-panel">
      {/*
        §31-22 Step 6(사용량 캡) 전까지 임시로 관리자 전용 — 캡 없이 배포하면
        로그인 사용자 누구나 Claude+TourAPI를 무제한 호출할 수 있어서다.
        Step 6 완료 후 이 isAdmin 조건을 지운다.
      */}
      {isTripIntentConfigured() && isAdmin && (
        <div className="theme-scenario-mode-toggle" role="group">
          <button
            type="button"
            className={`theme-scenario-mode-btn ${mode === 'theme' ? 'active' : ''}`}
            aria-pressed={mode === 'theme'}
            onClick={() => setMode('theme')}
          >
            {t('scenario.ai.themeModeLabel')}
          </button>
          <button
            type="button"
            className={`theme-scenario-mode-btn ${mode === 'ai' ? 'active' : ''}`}
            aria-pressed={mode === 'ai'}
            onClick={() => setMode('ai')}
          >
            <Icon name="sparkles" size={14} />
            {t('scenario.ai.modeLabel')}
          </button>
        </div>
      )}

      {mode === 'theme' && (
      <>
      {!scenario && (
        <>
          <p className="theme-scenario-subtitle">{t('scenario.subtitle')}</p>

          <div className="theme-scenario-field">
            <span className="theme-scenario-field-label">{t('scenario.themeLabel')}</span>
            <div className="theme-scenario-theme-grid" role="group">
              {SCENARIO_THEMES.map((id) => {
                const count = themeCounts?.[id] ?? 0;
                return (
                <button
                  key={id}
                  type="button"
                  className={`theme-scenario-theme-card theme-scenario-theme-card--${id} ${theme === id ? 'active' : ''} ${themeCounts && count === 0 ? 'is-empty' : ''}`}
                  aria-pressed={theme === id}
                  title={t(`scenario.themeDesc.${id}`)}
                  onClick={() => handleSelectTheme(id)}
                >
                  <span className="theme-scenario-theme-icon">
                    <Icon name={THEME_ICON[id]} size={18} />
                  </span>
                  <span className="theme-scenario-theme-name">{t(`scenario.theme.${id}`)}</span>
                  {/*
                    U13(모바일 UX 리포트 2026-09-13) — 테마를 눌러야만
                    시나리오 유무를 알 수 있었다. 개수를 미리 보여준다.
                  */}
                  {themeCounts && (
                    <span className="theme-scenario-theme-count">
                      {count > 0 ? t('scenario.courseCount', { count }) : t('scenario.courseCountZero')}
                    </span>
                  )}
                  <span className="theme-scenario-theme-check" aria-hidden>
                    <Icon name="check" size={12} />
                  </span>
                </button>
                );
              })}
            </div>
            {theme && (
              <p className="theme-scenario-theme-desc-active">{t(`scenario.themeDesc.${theme}`)}</p>
            )}
          </div>

          {theme && (
            <div className="theme-scenario-field">
              <span className="theme-scenario-field-label">{t('scenario.pickPrompt')}</span>
              {loadingOptions && (
                <p className="theme-scenario-days-hint">{t('scenario.catalogLoading')}</p>
              )}
              {!loadingOptions && options.length === 0 && (
                <div className="theme-scenario-empty">
                  <p className="theme-scenario-error">{t('scenario.catalogEmpty')}</p>
                  {/*
                    U13(모바일 UX 리포트 2026-09-13) — "완료 기준: 결과가
                    없을 때 유효한 다음 행동을 제공한다". 다른 테마로 바로
                    넘어가거나 직접 장소를 검색하는 두 경로를 준다.
                  */}
                  {SCENARIO_THEMES.filter(
                    (id) => id !== theme && (themeCounts?.[id] ?? 0) > 0
                  ).length > 0 && (
                    <div className="theme-scenario-empty-alt">
                      <span className="theme-scenario-empty-alt-label">
                        {t('scenario.tryOtherTheme')}
                      </span>
                      <div className="theme-scenario-empty-alt-chips">
                        {SCENARIO_THEMES.filter(
                          (id) => id !== theme && (themeCounts?.[id] ?? 0) > 0
                        ).map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="theme-scenario-empty-alt-chip"
                            onClick={() => handleSelectTheme(id)}
                          >
                            <Icon name={THEME_ICON[id]} size={14} />
                            {t(`scenario.theme.${id}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {onGoToSearch && (
                    <button
                      type="button"
                      className="theme-scenario-empty-search-btn"
                      onClick={onGoToSearch}
                    >
                      <Icon name="search" size={15} />
                      {t('scenario.goToSearch')}
                    </button>
                  )}
                </div>
              )}
              {!loadingOptions && options.length > 0 && (
                <div className="theme-scenario-option-list">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="theme-scenario-option-card"
                      onClick={() => handlePickOption(option)}
                    >
                      <span className="theme-scenario-option-days">
                        {t('scenario.dayCount', { count: option.days })}
                      </span>
                      <span className="theme-scenario-option-info">
                        <span className="theme-scenario-option-title">{option.scenario.title}</span>
                        <span className="theme-scenario-option-region">
                          {option.scenario.regionLabel || option.scenario.region}
                        </span>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {scenario && (
        <div className="theme-scenario-result">
          <div className="theme-scenario-region-badge">
            {t('scenario.regionBadge', { region: scenario.regionLabel || scenario.region })}
          </div>
          <h3 className="theme-scenario-result-title">{scenario.title}</h3>
          <p className="theme-scenario-result-intro">{scenario.intro}</p>

          {scenario.days.map((day) => (
            <div key={day.day} className="theme-scenario-day-block">
              <h4 className="theme-scenario-day-title">
                {t('scenario.dayTitle', { day: day.day })}
                {day.dayTitle ? ` · ${day.dayTitle}` : ''}
              </h4>
              <div className="theme-scenario-stop-list">
                {day.stops.map((stop) => {
                  const place = scenarioStopToPlace(stop);
                  return (
                    <button
                      key={stop.placeId}
                      type="button"
                      className="theme-scenario-stop-card"
                      onClick={() => onSelectPlace?.(place)}
                    >
                      {stop.thumbnailUrl ? (
                        <img
                          src={stop.thumbnailUrl}
                          alt=""
                          className="theme-scenario-stop-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <span className="theme-scenario-stop-thumb-placeholder" aria-hidden>
                          <Icon name={CATEGORY_MAP[place.categoryCode].icon} size={20} />
                        </span>
                      )}
                      <span className="theme-scenario-stop-info">
                        <span className="theme-scenario-stop-name">{stop.title}</span>
                        {stop.titleKo && stop.titleKo !== stop.title && (
                          <span className="theme-scenario-stop-name-ko">{stop.titleKo}</span>
                        )}
                        {(stop.petFriendly || stop.accessible) && (
                          <span className="theme-scenario-stop-badges">
                            {stop.petFriendly && (
                              <span className="theme-scenario-stop-badge">{t('scenario.badges.petFriendly')}</span>
                            )}
                            {stop.accessible && (
                              <span className="theme-scenario-stop-badge">{t('scenario.badges.accessible')}</span>
                            )}
                          </span>
                        )}
                        {stop.reason && (
                          <span className="theme-scenario-stop-reason">
                            <Icon name="sparkles" size={12} />
                            {stop.reason}
                          </span>
                        )}
                        <span className="theme-scenario-stop-note">{stop.note}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {appliedCount === null ? (
            <div className="theme-scenario-result-actions">
              <button type="button" className="theme-scenario-apply-btn" onClick={handleApply}>
                {t('scenario.apply')}
              </button>
              <button type="button" className="theme-scenario-reset-btn" onClick={handleReset}>
                {t('scenario.newSearch')}
              </button>
            </div>
          ) : (
            <div className="theme-scenario-applied-block">
              <p className="theme-scenario-applied-msg">
                {t('scenario.applied', { count: appliedCount })}
              </p>
              <button type="button" className="theme-scenario-reset-btn" onClick={handleReset}>
                {t('scenario.newSearch')}
              </button>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {mode === 'ai' && (
        <div className="theme-scenario-ai">
          {!aiPlan && (
            <>
              <p className="theme-scenario-subtitle">{t('scenario.ai.subtitle')}</p>
              <textarea
                className="theme-scenario-ai-textarea"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder={t('scenario.ai.placeholder')}
                maxLength={500}
                rows={3}
                disabled={aiStage !== 'idle'}
              />
              {aiError && <p className="theme-scenario-error">{aiError}</p>}
              <button
                type="button"
                className="theme-scenario-apply-btn"
                onClick={() => void handleGenerateAi()}
                disabled={aiStage !== 'idle' || !aiText.trim()}
              >
                {aiStage === 'idle' && t('scenario.ai.generateBtn')}
                {aiStage === 'intent' && t('scenario.ai.stageIntent')}
                {aiStage === 'candidates' && t('scenario.ai.stageCandidates')}
                {aiStage === 'plan' && t('scenario.ai.stagePlan')}
              </button>
            </>
          )}

          {aiPlan && (
            <div className="theme-scenario-result">
              {aiIntent && (
                <div className="theme-scenario-region-badge">
                  {t('scenario.ai.intentSummary', { destination: aiIntent.destination, days: aiIntent.days })}
                </div>
              )}
              <h3 className="theme-scenario-result-title">{aiPlan.title}</h3>
              <p className="theme-scenario-result-intro">{aiPlan.intro}</p>
              <p className="theme-scenario-ai-distance-note">{t('scenario.ai.distanceNote')}</p>

              {Array.from({ length: aiIntent?.days ?? 0 }, (_, i) => i + 1).map((day) => (
                <div key={day} className="theme-scenario-day-block">
                  <h4 className="theme-scenario-day-title">{t('scenario.dayTitle', { day })}</h4>
                  {aiPlanByDay[day]?.length ? (
                    <div className="theme-scenario-stop-list">
                      {aiPlanByDay[day].map((row) => (
                        <button
                          key={`${row.day}-${row.order}-${row.name}`}
                          type="button"
                          className="theme-scenario-stop-card"
                          onClick={() =>
                            onSelectPlace?.({
                              id: `${row.lat},${row.lng}`,
                              name: row.name,
                              category: 'tour',
                              categoryCode: 'AT4',
                              categoryLabel: row.categoryLabel,
                              address: row.address,
                              lat: row.lat,
                              lng: row.lng,
                            })
                          }
                        >
                          <span className="theme-scenario-stop-thumb-placeholder" aria-hidden>
                            <Icon name="mapPin" size={20} />
                          </span>
                          <span className="theme-scenario-stop-info">
                            <span className="theme-scenario-stop-name">{row.name}</span>
                            <span className="theme-scenario-stop-note">{row.note}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="theme-scenario-error">{t('scenario.ai.emptyDaysWarning', { days: t('scenario.dayTitle', { day }) })}</p>
                  )}
                </div>
              ))}

              {aiAppliedCount === null ? (
                <div className="theme-scenario-result-actions">
                  <button type="button" className="theme-scenario-apply-btn" onClick={handleApplyAiPlan}>
                    {t('scenario.apply')}
                  </button>
                  <button type="button" className="theme-scenario-reset-btn" onClick={handleResetAi}>
                    {t('scenario.ai.newAttempt')}
                  </button>
                </div>
              ) : (
                <div className="theme-scenario-applied-block">
                  <p className="theme-scenario-applied-msg">
                    {t('scenario.applied', { count: aiAppliedCount })}
                  </p>
                  <button type="button" className="theme-scenario-reset-btn" onClick={handleResetAi}>
                    {t('scenario.ai.newAttempt')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
