import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { AdminHeader } from '../components/AdminHeader';
import {
  deleteScenarioCatalogEntry,
  generateScenarioCatalogEntry,
  listAdminScenarioCatalog,
  publishScenarioCatalogEntry,
  unpublishScenarioCatalogEntry,
} from '../lib/scenarioCatalog';
import { fetchScenarioAvailability, SCENARIO_THEMES, type ScenarioTheme } from '../lib/tourScenario';
import type { ScenarioCatalogEntry, ScenarioCatalogStatus } from '../types/scenarioCatalog';
import '../styles/app.css';

const THEME_LABEL: Record<ScenarioTheme, string> = {
  meditation: '명상관광',
  wellbeing: '웰빙관광',
  shopping: '쇼핑관광',
  family: '대가족관광',
  honeymoon: '허니문관광',
  night: '야간관광',
  hallyu: '한류관광',
  camping: '캠핑관광',
  walking: '걷기여행',
  marine: '해양관광',
};

const STATUS_LABEL: Record<ScenarioCatalogStatus, string> = {
  draft: '초안',
  published: '게시중',
  archived: '보관됨',
};

const PREVIEW_LOCALES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ru'] as const;
const LOCALE_LABEL: Record<(typeof PREVIEW_LOCALES)[number], string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function AdminScenariosPage() {
  const { configured } = useAuth();
  const access = useAdminAccess();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [entries, setEntries] = useState<ScenarioCatalogEntry[]>([]);
  const [themeFilter, setThemeFilter] = useState<ScenarioTheme | ''>('');
  const [statusFilter, setStatusFilter] = useState<ScenarioCatalogStatus | ''>('');

  const [genTheme, setGenTheme] = useState<ScenarioTheme | ''>('');
  const [genDays, setGenDays] = useState(2);
  const [genMaxDays, setGenMaxDays] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLocale, setPreviewLocale] = useState<(typeof PREVIEW_LOCALES)[number]>('ko');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ theme: ScenarioTheme; days: number; error?: string }>>([]);
  const bulkCancelRef = useRef(false);

  const loadEntries = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await listAdminScenarioCatalog({
        theme: themeFilter || undefined,
        status: statusFilter || undefined,
      });
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, [themeFilter, statusFilter]);

  useEffect(() => {
    if (access === 'ok') void loadEntries();
  }, [access, loadEntries]);

  const handleSelectGenTheme = (theme: ScenarioTheme) => {
    setGenTheme(theme);
    setGenMaxDays(null);
    setCheckingAvailability(true);
    void fetchScenarioAvailability(theme).then((avail) => {
      setGenMaxDays(avail.maxDays);
      setCheckingAvailability(false);
      setGenDays((d) => Math.min(d, avail.maxDays));
    });
  };

  const handleGenerate = async () => {
    if (!genTheme) return;
    setGenerating(true);
    setError(null);
    try {
      const entry = await generateScenarioCatalogEntry(genTheme, genDays);
      await loadEntries();
      setPreviewId(entry.id);
      setPreviewLocale('ko');
    } catch (e) {
      setError(e instanceof Error ? e.message : '시나리오 생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  const publishedCombos = useMemo(() => {
    const seen = new Set<string>();
    const combos: Array<{ theme: ScenarioTheme; days: number }> = [];
    for (const e of entries) {
      if (e.status !== 'published') continue;
      const key = `${e.theme}:${e.days}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combos.push({ theme: e.theme as ScenarioTheme, days: e.days });
    }
    return combos;
  }, [entries]);

  const handleBulkRegenerate = async () => {
    if (publishedCombos.length === 0) return;
    const ok = window.confirm(
      `현재 게시된 ${publishedCombos.length}개 조합(테마+일수)을 새로 재생성합니다. ` +
        `각 조합마다 AI 호출이 다시 일어나며 시간이 다소 걸립니다. 새로 만든 항목은 초안으로 저장되고, ` +
        `게시는 검토 후 직접 눌러야 합니다(기존 게시 항목은 그대로 유지됩니다). 진행할까요?`
    );
    if (!ok) return;

    bulkCancelRef.current = false;
    setBulkRunning(true);
    setBulkResults([]);
    setError(null);
    try {
      for (let i = 0; i < publishedCombos.length; i++) {
        if (bulkCancelRef.current) break;
        const { theme, days } = publishedCombos[i];
        setBulkProgress({ done: i, total: publishedCombos.length, label: `${THEME_LABEL[theme]} · ${days}일` });
        try {
          await generateScenarioCatalogEntry(theme, days);
          setBulkResults((prev) => [...prev, { theme, days }]);
        } catch (e) {
          setBulkResults((prev) => [
            ...prev,
            { theme, days, error: e instanceof Error ? e.message : '생성 실패' },
          ]);
        }
      }
    } finally {
      setBulkProgress(null);
      setBulkRunning(false);
      await loadEntries();
    }
  };

  const handlePublish = async (entry: ScenarioCatalogEntry) => {
    setBusyId(entry.id);
    try {
      await publishScenarioCatalogEntry(entry.id);
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 실패');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnpublish = async (entry: ScenarioCatalogEntry) => {
    setBusyId(entry.id);
    try {
      await unpublishScenarioCatalogEntry(entry.id);
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 중지 실패');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (entry: ScenarioCatalogEntry) => {
    const ok = window.confirm(`"${entry.content.ko?.title ?? entry.id}" 항목을 삭제할까요?`);
    if (!ok) return;
    setBusyId(entry.id);
    try {
      await deleteScenarioCatalogEntry(entry.id);
      if (previewId === entry.id) setPreviewId(null);
      await loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusyId(null);
    }
  };

  const previewEntry = useMemo(() => entries.find((e) => e.id === previewId) ?? null, [entries, previewId]);
  const previewContent = previewEntry?.content[previewLocale];

  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>시나리오 카탈로그</h1>
          <p>Supabase가 설정된 환경에서만 사용할 수 있습니다.</p>
        </div>
      </main>
    );
  }
  if (access === 'anon') return <Navigate to="/login" replace />;
  if (access === 'loading') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>시나리오 카탈로그</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }
  if (access === 'denied') {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>시나리오 카탈로그</h1>
          <p>접근 권한이 없습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <AdminHeader
          title="시나리오 카탈로그"
          subtitle="테마여행 시나리오를 미리 생성·게시해 플래너가 라이브 AI 호출 없이 바로 보여주게 합니다"
          current="scenarios"
          refreshing={refreshing}
          onRefresh={() => void loadEntries()}
        />

        {error && <div className="admin-error">{error}</div>}

        <section className="admin-section">
          <h2>새 시나리오 생성</h2>
          <p className="admin-cell-sub" style={{ marginBottom: 10 }}>
            선택한 테마+일수로 지역·스팟을 1회 선정한 뒤, 한국어/영어/일본어/중국어 4개 언어 서술문을 한 번에 만들어
            초안으로 저장합니다. 검토 후 「게시」해야 플래너에 노출됩니다.
          </p>
          <div className="admin-insight-cat-list" role="group" aria-label="테마 선택" style={{ marginBottom: 10 }}>
            {SCENARIO_THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                className={`admin-insight-cat-btn ${genTheme === theme ? 'selected' : ''}`}
                onClick={() => handleSelectGenTheme(theme)}
              >
                <span className="admin-insight-cat-label">{THEME_LABEL[theme]}</span>
              </button>
            ))}
          </div>
          {genTheme && (
            <div className="admin-notice-form-row" style={{ marginBottom: 12, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                일수
                <input
                  type="number"
                  min={1}
                  max={genMaxDays ?? 7}
                  value={genDays}
                  onChange={(e) => setGenDays(Math.max(1, Math.min(genMaxDays ?? 7, Number(e.currentTarget.value) || 1)))}
                  style={{ width: 60 }}
                />
              </label>
              <span className="admin-cell-sub">
                {checkingAvailability
                  ? '가능한 일수 확인 중…'
                  : genMaxDays !== null
                    ? `이 테마는 최대 ${genMaxDays}일까지 만들 수 있어요`
                    : ''}
              </span>
              <button
                type="button"
                className="admin-create-btn"
                disabled={generating || checkingAvailability}
                onClick={() => void handleGenerate()}
              >
                {generating ? '생성 중… (4개 언어, 다소 걸려요)' : 'AI 시나리오 생성'}
              </button>
            </div>
          )}
        </section>

        <section className="admin-section">
          <h2>기존 게시 항목 일괄 재생성</h2>
          <p className="admin-cell-sub" style={{ marginBottom: 10 }}>
            생성 로직이 개선됐을 때(예: 다국어 공식 주소 반영) 이미 게시된 항목에도 반영하려면 사용합니다. 현재
            게시된 테마+일수 조합을 하나씩 다시 생성합니다 — 결과는 새 초안으로 저장되고 기존 게시 항목은
            그대로 유지되니, 검토 후 직접 게시하고 예전 항목을 게시중지/삭제하세요.
          </p>
          <div className="admin-action-row">
            <button
              type="button"
              className="admin-create-btn"
              disabled={bulkRunning || publishedCombos.length === 0}
              onClick={() => void handleBulkRegenerate()}
            >
              {bulkRunning ? '재생성 중…' : `게시된 항목 전체 재생성 (${publishedCombos.length}개)`}
            </button>
            {bulkRunning && (
              <button
                type="button"
                onClick={() => {
                  bulkCancelRef.current = true;
                }}
              >
                중단
              </button>
            )}
          </div>
          {bulkProgress && (
            <p className="admin-cell-sub" style={{ marginTop: 8 }}>
              {bulkProgress.done + 1} / {bulkProgress.total} 진행 중 — {bulkProgress.label}
            </p>
          )}
          {!bulkRunning && bulkResults.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="admin-cell-sub">
                완료: 성공 {bulkResults.filter((r) => !r.error).length}개, 실패{' '}
                {bulkResults.filter((r) => r.error).length}개
              </p>
              {bulkResults.some((r) => r.error) && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {bulkResults
                    .filter((r) => r.error)
                    .map((r, i) => (
                      <li key={i} className="admin-cell-sub">
                        {THEME_LABEL[r.theme]} · {r.days}일 — {r.error}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="admin-section">
          <h2>카탈로그 목록</h2>
          <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
            <select value={themeFilter} onChange={(e) => setThemeFilter(e.currentTarget.value as ScenarioTheme | '')}>
              <option value="">전체 테마</option>
              {SCENARIO_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {THEME_LABEL[theme]}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.currentTarget.value as ScenarioCatalogStatus | '')}
            >
              <option value="">전체 상태</option>
              {(Object.keys(STATUS_LABEL) as ScenarioCatalogStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>테마</th>
                  <th>일수</th>
                  <th>지역</th>
                  <th>제목(ko)</th>
                  <th>상태</th>
                  <th>생성시각</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="admin-pill">{THEME_LABEL[entry.theme as ScenarioTheme] ?? entry.theme}</span>
                    </td>
                    <td>{entry.days}</td>
                    <td>{entry.region}</td>
                    <td>{entry.content.ko?.title ?? '-'}</td>
                    <td>
                      <span className={`admin-pill ${entry.status === 'published' ? 'ok' : ''}`}>
                        {STATUS_LABEL[entry.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewId(entry.id);
                            setPreviewLocale('ko');
                          }}
                        >
                          미리보기
                        </button>
                        {entry.status === 'published' ? (
                          <button type="button" disabled={busyId === entry.id} onClick={() => void handleUnpublish(entry)}>
                            게시중지
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-create-btn"
                            disabled={busyId === entry.id}
                            onClick={() => void handlePublish(entry)}
                          >
                            게시
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger"
                          disabled={busyId === entry.id}
                          onClick={() => void handleDelete(entry)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="admin-cell-sub">
                      표시할 항목이 없습니다. 위에서 시나리오를 생성해 보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {previewEntry && (
          <section className="admin-section admin-guide-editor">
            <h2>
              미리보기 — {THEME_LABEL[previewEntry.theme as ScenarioTheme] ?? previewEntry.theme} ·{' '}
              {previewEntry.days}일 · {previewEntry.region}
            </h2>
            <div className="admin-tab-bar" role="tablist" aria-label="미리보기 언어" style={{ marginBottom: 12 }}>
              {PREVIEW_LOCALES.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  role="tab"
                  aria-selected={previewLocale === locale}
                  className={`admin-tab-btn ${previewLocale === locale ? 'active' : ''}`}
                  onClick={() => setPreviewLocale(locale)}
                >
                  {LOCALE_LABEL[locale]}
                </button>
              ))}
            </div>
            {previewContent ? (
              <div>
                <h3 style={{ margin: '0 0 6px' }}>{previewContent.title}</h3>
                <p className="admin-cell-sub" style={{ marginBottom: 14 }}>
                  {previewContent.intro}
                </p>
                {previewContent.days.map((day) => (
                  <div key={day.day} style={{ marginBottom: 14 }}>
                    <strong style={{ fontSize: 13 }}>
                      {day.day}일차{day.dayTitle ? ` · ${day.dayTitle}` : ''}
                    </strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {day.stops.map((stop) => (
                        <li key={stop.placeId} style={{ marginBottom: 4 }}>
                          <span>{stop.title}</span>
                          {(stop.petFriendly || stop.accessible) && (
                            <span className="admin-cell-sub">
                              {' '}
                              {[stop.petFriendly && '반려동반', stop.accessible && '무장애']
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                          {stop.reason && (
                            <div className="admin-cell-sub" style={{ fontWeight: 700, color: '#b45309' }}>
                              {stop.reason}
                            </div>
                          )}
                          {stop.note && <div className="admin-cell-sub">{stop.note}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-cell-sub">이 언어의 콘텐츠가 없습니다.</p>
            )}
            <div className="admin-action-row">
              <button type="button" onClick={() => setPreviewId(null)}>
                닫기
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
