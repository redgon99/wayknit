import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AdminHeader } from '../components/AdminHeader';
import {
  addInsightKeyword,
  deleteInsightKeyword,
  deleteInsightRawItem,
  listInsightCategoryCounts,
  listInsightCollectionRuns,
  listInsightItems,
  listInsightKeywords,
  setInsightKeywordActive,
  triggerInsightAnalysis,
  triggerInsightCollection,
  triggerInsightPlaceMatch,
  updateInsightAnalysisCategory,
  type InsightCollector,
} from '../lib/adminInsights';
import {
  describeInsightCollectPeriod,
  loadInsightCollectPeriod,
  saveInsightCollectPeriod,
  type InsightCollectPeriod,
  type InsightPeriodPreset,
} from '../lib/insightCollectPeriod';
import { triggerGuideDraftFromTips } from '../lib/guides';
import { isCurrentUserAdmin } from '../lib/admin';
import type {
  InsightCategory,
  InsightCategoryCount,
  InsightCollectionRun,
  InsightItemWithAnalysis,
  InsightKeyword,
  InsightSource,
} from '../types/insights';
import '../styles/app.css';

const SOURCE_LABEL: Record<InsightSource, string> = {
  youtube: 'YouTube',
  naver_blog: '네이버 블로그',
  naver_kin: '네이버 지식인',
  reddit: 'Reddit',
};

const CATEGORY_LABEL: Record<InsightCategory, string> = {
  pain_point: '불편함',
  feature_request: '기능요청',
  praise: '칭찬',
  competitor_mention: '경쟁서비스 언급',
  useful_tip: '유용한정보',
  other: '기타',
};

const COLLECTORS: Array<{ id: InsightCollector; label: string; keywordSources: InsightSource[] }> = [
  { id: 'youtube', label: 'YouTube 수집', keywordSources: ['youtube'] },
  { id: 'naver', label: '네이버 수집', keywordSources: ['naver_blog', 'naver_kin'] },
  { id: 'reddit', label: 'Reddit 수집', keywordSources: ['reddit'] },
];

function truncate(text: string | null, max: number): string {
  if (!text) return '';
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function AdminInsightsPage() {
  const { configured, loading, user } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [runningCollector, setRunningCollector] = useState<
    InsightCollector | 'analyze' | 'place_match' | null
  >(null);
  const [placeMatchResult, setPlaceMatchResult] = useState<string | null>(null);
  const [draftingGuides, setDraftingGuides] = useState(false);
  const [draftingAnalysisId, setDraftingAnalysisId] = useState<string | null>(null);
  const [deletingRawItemId, setDeletingRawItemId] = useState<string | null>(null);
  const [recategorizingId, setRecategorizingId] = useState<string | null>(null);
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<Set<string>>(new Set());

  const [keywords, setKeywords] = useState<InsightKeyword[]>([]);
  const [runs, setRuns] = useState<InsightCollectionRun[]>([]);
  const [counts, setCounts] = useState<InsightCategoryCount[]>([]);
  const [items, setItems] = useState<InsightItemWithAnalysis[]>([]);

  const [newSource, setNewSource] = useState<InsightSource>('youtube');
  const [newKeyword, setNewKeyword] = useState('');

  const [filterSource, setFilterSource] = useState<InsightSource | ''>('');
  const [filterCategory, setFilterCategory] = useState<InsightCategory | ''>('');
  const [expandedCategory, setExpandedCategory] = useState<InsightCategory | null>(null);
  const [activeTab, setActiveTab] = useState<'collect' | 'keywords' | 'dashboard'>('dashboard');
  const [collectPeriod, setCollectPeriod] = useState<InsightCollectPeriod>(() =>
    loadInsightCollectPeriod()
  );
  const [periodPreset, setPeriodPreset] = useState<InsightPeriodPreset>(() => {
    const saved = loadInsightCollectPeriod();
    if (saved.from || saved.to) return 'custom';
    if (saved.periodDays === 7 || saved.periodDays === 30 || saved.periodDays === 90) {
      return saved.periodDays;
    }
    if (saved.periodDays === 0) return 0;
    return 30;
  });

  const applyPeriodPreset = (preset: InsightPeriodPreset) => {
    setPeriodPreset(preset);
    let next: InsightCollectPeriod;
    if (preset === 'custom') {
      next = {
        from: collectPeriod.from,
        to: collectPeriod.to,
      };
    } else if (preset === 0) {
      next = { periodDays: 0 };
    } else {
      next = { periodDays: preset };
    }
    setCollectPeriod(next);
    saveInsightCollectPeriod(next);
  };

  const updateCustomDates = (patch: { from?: string; to?: string }) => {
    setPeriodPreset('custom');
    const next: InsightCollectPeriod = {
      from: patch.from !== undefined ? patch.from : collectPeriod.from,
      to: patch.to !== undefined ? patch.to : collectPeriod.to,
    };
    setCollectPeriod(next);
    saveInsightCollectPeriod(next);
  };

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [keywordRows, runRows, countRows] = await Promise.all([
        listInsightKeywords(),
        listInsightCollectionRuns(),
        listInsightCategoryCounts(),
      ]);
      setKeywords(keywordRows);
      setRuns(runRows);
      setCounts(countRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '인사이트 데이터를 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const rows = await listInsightItems({
        source: filterSource || undefined,
        category: filterCategory || undefined,
        limit: 100,
      });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수집 항목을 불러오지 못했습니다.');
    }
  }, [filterSource, filterCategory]);

  useEffect(() => {
    if (!configured || loading || !user) {
      setCheckingAdmin(false);
      return;
    }
    let alive = true;
    (async () => {
      setCheckingAdmin(true);
      try {
        const ok = await isCurrentUserAdmin();
        if (!alive) return;
        setIsAdmin(ok);
        if (ok) {
          await loadAll();
          await loadItems();
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '관리자 확인 실패');
      } finally {
        if (alive) setCheckingAdmin(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loading, user, loadAll]);

  useEffect(() => {
    if (isAdmin) void loadItems();
  }, [isAdmin, loadItems]);

  const keywordsBySource = useMemo(() => {
    const map = new Map<InsightSource, InsightKeyword[]>();
    for (const kw of keywords) {
      const list = map.get(kw.source) ?? [];
      list.push(kw);
      map.set(kw.source, list);
    }
    return map;
  }, [keywords]);

  const latestRunBySource = useMemo(() => {
    const map = new Map<string, InsightCollectionRun>();
    for (const run of runs) {
      if (!map.has(run.source)) map.set(run.source, run);
    }
    return map;
  }, [runs]);

  const categoryRollup = useMemo(() => {
    if (!expandedCategory) return null;
    const rows = items.filter((item) => item.analysis?.category === expandedCategory);
    const summaries: string[] = [];
    const seenSummary = new Set<string>();
    const serviceCounts = new Map<string, number>();
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };

    for (const item of rows) {
      const analysis = item.analysis;
      if (!analysis) continue;
      if (analysis.sentiment) sentimentCounts[analysis.sentiment] += 1;
      for (const svc of analysis.mentionedServices ?? []) {
        const key = svc.trim();
        if (!key) continue;
        serviceCounts.set(key, (serviceCounts.get(key) ?? 0) + 1);
      }
      const summary = (analysis.summary ?? '').trim();
      if (!summary) continue;
      const dedupeKey = summary.toLowerCase();
      if (seenSummary.has(dedupeKey)) continue;
      seenSummary.add(dedupeKey);
      summaries.push(summary);
    }

    const topServices = [...serviceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      category: expandedCategory,
      total: counts.find((c) => c.category === expandedCategory)?.count ?? rows.length,
      shown: rows.length,
      summaries: summaries.slice(0, 12),
      topServices,
      sentimentCounts,
      samples: rows.slice(0, 8),
    };
  }, [expandedCategory, items, counts]);

  const handleToggleCategoryCard = (category: InsightCategory) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(category);
    setFilterCategory(category);
  };
  if (!configured) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>시장 인사이트</h1>
          <p>Supabase가 설정된 환경에서만 사용할 수 있습니다.</p>
          <Link to="/admin" className="admin-link-btn">
            관리자 페이지로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (checkingAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>시장 인사이트</h1>
          <p>권한 확인 중...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">
          <h1>시장 인사이트</h1>
          <p>접근 권한이 없습니다.</p>
          <Link to="/admin" className="admin-link-btn">
            관리자 페이지로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      setError('키워드(또는 reddit의 경우 서브레딧 이름)를 입력해 주세요.');
      return;
    }
    try {
      await addInsightKeyword({ source: newSource, keyword: newKeyword });
      setNewKeyword('');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '키워드 추가 실패');
    }
  };

  const handleToggleKeyword = async (kw: InsightKeyword) => {
    try {
      await setInsightKeywordActive(kw.id, !kw.isActive);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '키워드 상태 변경 실패');
    }
  };

  const handleDeleteKeyword = async (kw: InsightKeyword) => {
    const ok = window.confirm(`키워드 "${kw.keyword}"를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteInsightKeyword(kw.id);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '키워드 삭제 실패');
    }
  };

  const handleCollect = async (collector: InsightCollector) => {
    setRunningCollector(collector);
    setError(null);
    try {
      const result = await triggerInsightCollection(collector, collectPeriod);
      await loadAll();
      await loadItems();
      if (result.period) {
        /* period applied server-side; keep UI as-is */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '수집 실행 실패');
    } finally {
      setRunningCollector(null);
    }
  };

  const handleAnalyze = async () => {
    setRunningCollector('analyze');
    setError(null);
    try {
      await triggerInsightAnalysis();
      await loadAll();
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실행 실패');
    } finally {
      setRunningCollector(null);
    }
  };

  const handlePlaceMatch = async () => {
    setRunningCollector('place_match');
    setError(null);
    setPlaceMatchResult(null);
    try {
      const result = await triggerInsightPlaceMatch();
      setPlaceMatchResult(
        `게시물 ${result.itemsProcessed}건에서 장소 언급 ${result.mentionsAdded}건 추출 · 장소 ${result.placesTouched}곳 집계 갱신`
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '장소 매칭 실행 실패');
    } finally {
      setRunningCollector(null);
    }
  };

  const handleDraftGuides = async (analysisIds?: string[]) => {
    setDraftingGuides(true);
    setError(null);
    try {
      const result = await triggerGuideDraftFromTips(
        analysisIds && analysisIds.length > 0 ? { analysisIds } : undefined
      );
      if (result.created === 0) {
        setError(
          analysisIds && analysisIds.length > 0
            ? '선택한 항목으로 초안을 만들지 못했습니다. 내용이 충분한지 확인 후 다시 시도해 주세요.'
            : 'useful_tip 분석이 없거나 초안을 만들지 못했습니다. AI 분석 후 다시 시도해 주세요.'
        );
      } else {
        setSelectedAnalysisIds(new Set());
        window.location.href = '/admin/guides';
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '가이드 초안 생성 실패');
    } finally {
      setDraftingGuides(false);
      setDraftingAnalysisId(null);
    }
  };

  const handleDraftOne = async (analysisId: string) => {
    setDraftingAnalysisId(analysisId);
    await handleDraftGuides([analysisId]);
  };

  const handleDeleteRawItem = async (item: InsightItemWithAnalysis) => {
    if (!window.confirm('이 원문을 삭제할까요? 연결된 분석·장소 언급도 함께 지워집니다.')) {
      return;
    }
    setDeletingRawItemId(item.id);
    try {
      await deleteInsightRawItem(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingRawItemId(null);
    }
  };

  const handleRecategorize = async (item: InsightItemWithAnalysis, category: InsightCategory) => {
    const analysisId = item.analysis?.id;
    if (!analysisId || category === item.analysis?.category) return;
    setRecategorizingId(analysisId);
    try {
      await updateInsightAnalysisCategory(analysisId, category);
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id && row.analysis ? { ...row, analysis: { ...row.analysis, category } } : row
        )
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '분류 변경에 실패했습니다.');
    } finally {
      setRecategorizingId(null);
    }
  };

  const selectableItems = items.filter((item) => item.analysis != null);
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedAnalysisIds.has(item.analysis!.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedAnalysisIds(new Set());
      return;
    }
    setSelectedAnalysisIds(new Set(selectableItems.map((item) => item.analysis!.id)));
  };

  const toggleSelectOne = (analysisId: string) => {
    setSelectedAnalysisIds((prev) => {
      const next = new Set(prev);
      if (next.has(analysisId)) next.delete(analysisId);
      else next.add(analysisId);
      return next;
    });
  };

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <AdminHeader
          title="시장 인사이트"
          subtitle="한국여행 계획자·경험자의 니즈/불편함을 외부 플랫폼에서 수집·분석 (관리자 전용)"
          current="insights"
          refreshing={refreshing}
          onRefresh={() => void loadAll()}
        />

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-tab-bar" role="tablist" aria-label="인사이트 설정 영역">
          {(
            [
              { id: 'dashboard' as const, label: '인사이트 대시보드' },
              { id: 'collect' as const, label: '수집 실행 현황' },
              { id: 'keywords' as const, label: '키워드 관리' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'collect' && (
        <section className="admin-section">
          <h2>수집 실행 현황</h2>
          <div className="admin-collect-period">
            <div className="admin-collect-period-label">
              수집 대상 기간
              <span className="admin-cell-sub"> · {describeInsightCollectPeriod(collectPeriod)}</span>
            </div>
            <div className="admin-collect-period-presets" role="group" aria-label="수집 기간">
              {(
                [
                  { id: 7 as const, label: '최근 7일' },
                  { id: 30 as const, label: '최근 30일' },
                  { id: 90 as const, label: '최근 90일' },
                  { id: 0 as const, label: '전체' },
                  { id: 'custom' as const, label: '직접 지정' },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  className={`admin-period-chip ${periodPreset === opt.id ? 'selected' : ''}`}
                  onClick={() => applyPeriodPreset(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
              {periodPreset === 'custom' && (
                <div className="admin-collect-period-custom">
                  <label>
                    시작
                    <input
                      type="date"
                      value={collectPeriod.from ?? ''}
                      onChange={(e) => updateCustomDates({ from: e.currentTarget.value })}
                    />
                  </label>
                  <label>
                    종료
                    <input
                      type="date"
                      value={collectPeriod.to ?? ''}
                      onChange={(e) => updateCustomDates({ to: e.currentTarget.value })}
                    />
                  </label>
                </div>
              )}
            </div>
            <p className="admin-cell-sub" style={{ marginTop: 6 }}>
              YouTube·네이버 블로그·Reddit 게시일 기준. 기간이 있으면 날짜 없는 항목(지식인 등)은 제외됩니다.
            </p>
          </div>
          <div className="admin-action-row">
            {COLLECTORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="admin-create-btn"
                disabled={runningCollector !== null}
                onClick={() => void handleCollect(c.id)}
              >
                {runningCollector === c.id ? '실행 중...' : c.label}
              </button>
            ))}
            <button
              type="button"
              className="admin-create-btn"
              disabled={runningCollector !== null}
              onClick={() => void handleAnalyze()}
            >
              {runningCollector === 'analyze' ? '분석 중...' : 'AI 분석 실행'}
            </button>
            <button
              type="button"
              className="admin-create-btn"
              disabled={runningCollector !== null}
              onClick={() => void handlePlaceMatch()}
              title="분석된 게시물에서 장소 언급을 뽑아 장소 카드 배지에 반영합니다"
            >
              {runningCollector === 'place_match' ? '매칭 중...' : '장소 매칭 실행'}
            </button>
          </div>
          {placeMatchResult && <p className="admin-cell-sub">{placeMatchResult}</p>}

          <div className="admin-table-wrap" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>소스</th>
                  <th>마지막 실행</th>
                  <th>상태</th>
                  <th>수집/분석 건수</th>
                  <th>오류</th>
                </tr>
              </thead>
              <tbody>
                {['youtube', 'naver_blog', 'reddit', 'analyze', 'place_match'].map((source) => {
                  const run = latestRunBySource.get(source);
                  const label =
                    source === 'analyze'
                      ? 'AI 분석'
                      : source === 'place_match'
                        ? '장소 매칭'
                        : (SOURCE_LABEL[source as InsightSource] ?? source);
                  return (
                    <tr key={source}>
                      <td>{label}</td>
                      <td>{run ? formatDateTime(run.startedAt) : '실행 이력 없음'}</td>
                      <td>
                        {run && (
                          <span className={`admin-pill ${run.status === 'success' ? 'ok' : ''}`}>
                            {run.status}
                          </span>
                        )}
                      </td>
                      <td>{run?.itemsCollected ?? '-'}</td>
                      <td className="admin-cell-sub">{run?.errorMessage ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {activeTab === 'keywords' && (
        <section className="admin-section">
          <h2>키워드 관리</h2>
          <div className="admin-notice-form-row" style={{ marginBottom: 12 }}>
            <select value={newSource} onChange={(e) => setNewSource(e.currentTarget.value as InsightSource)}>
              {(Object.keys(SOURCE_LABEL) as InsightSource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
            <input
              className="admin-notice-title"
              style={{ flex: 1 }}
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.currentTarget.value)}
              placeholder={newSource === 'reddit' ? '서브레딧 이름 (예: koreatravel)' : '검색 키워드'}
            />
            <button type="button" className="admin-create-btn" onClick={() => void handleAddKeyword()}>
              추가
            </button>
          </div>

          {(Object.keys(SOURCE_LABEL) as InsightSource[]).map((source) => (
            <div key={source} style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>{SOURCE_LABEL[source]}</strong>
              <div style={{ marginTop: 4 }}>
                {(keywordsBySource.get(source) ?? []).map((kw) => (
                  <span key={kw.id} className={`admin-pill ${kw.isActive ? 'ok' : ''}`}>
                    {kw.keyword}
                    <button
                      type="button"
                      onClick={() => void handleToggleKeyword(kw)}
                      style={{ marginLeft: 6, border: 'none', background: 'none', cursor: 'pointer' }}
                      title={kw.isActive ? '비활성화' : '활성화'}
                    >
                      {kw.isActive ? '⏸' : '▶'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteKeyword(kw)}
                      style={{ marginLeft: 4, border: 'none', background: 'none', cursor: 'pointer' }}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {(keywordsBySource.get(source) ?? []).length === 0 && (
                  <span className="admin-cell-sub">등록된 키워드 없음</span>
                )}
              </div>
            </div>
          ))}
        </section>
        )}

        {activeTab === 'dashboard' && (
        <section className="admin-section">
          <h2>인사이트 대시보드</h2>
          <p className="admin-cell-sub" style={{ marginBottom: 10 }}>
            카테고리를 누르면 아래에 AI 요약·언급 서비스·샘플 원문이 표시됩니다.
          </p>
          <div className="admin-insight-cat-list" role="tablist" aria-label="인사이트 카테고리">
            {(Object.keys(CATEGORY_LABEL) as InsightCategory[]).map((category) => {
              const count = counts.find((c) => c.category === category)?.count ?? 0;
              const selected = expandedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`admin-insight-cat-btn ${selected ? 'selected' : ''}`}
                  disabled={count === 0}
                  onClick={() => handleToggleCategoryCard(category)}
                >
                  <span className="admin-insight-cat-label">{CATEGORY_LABEL[category]}</span>
                  <strong className="admin-insight-cat-count">{count}</strong>
                </button>
              );
            })}
          </div>

          {categoryRollup && (
            <div className="admin-insight-rollup" aria-live="polite">
              <div className="admin-insight-rollup-head">
                <h3>
                  {CATEGORY_LABEL[categoryRollup.category]} 요약
                  <span className="admin-cell-sub">
                    {' '}
                    (전체 {categoryRollup.total}건 · 목록 표시 {categoryRollup.shown}건)
                  </span>
                </h3>
                <div className="admin-insight-rollup-actions">
                  {categoryRollup.category === 'useful_tip' && (
                    <button
                      type="button"
                      className="admin-create-btn"
                      disabled={draftingGuides || categoryRollup.shown === 0}
                      onClick={() => void handleDraftGuides()}
                    >
                      {draftingGuides ? '초안 생성 중…' : '가이드 초안 생성'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-link-btn"
                    onClick={() => setExpandedCategory(null)}
                  >
                    닫기
                  </button>
                </div>
              </div>

              <div className="admin-insight-rollup-meta">
                <span>
                  감정 · 긍정 {categoryRollup.sentimentCounts.positive} · 중립{' '}
                  {categoryRollup.sentimentCounts.neutral} · 부정{' '}
                  {categoryRollup.sentimentCounts.negative}
                </span>
                {categoryRollup.topServices.length > 0 && (
                  <span>
                    자주 언급 서비스 ·{' '}
                    {categoryRollup.topServices.map(([name, n]) => `${name}(${n})`).join(', ')}
                  </span>
                )}
              </div>

              {categoryRollup.summaries.length > 0 ? (
                <ul className="admin-insight-rollup-list">
                  {categoryRollup.summaries.map((summary) => (
                    <li key={summary}>{summary}</li>
                  ))}
                </ul>
              ) : (
                <p className="admin-cell-sub">
                  이 카테고리에 AI 요약이 없습니다. 「AI 분석 실행」 후 다시 열어 보세요.
                </p>
              )}

              {categoryRollup.samples.length > 0 && (
                <div className="admin-insight-rollup-samples">
                  <strong>샘플 원문</strong>
                  <ul>
                    {categoryRollup.samples.map((item) => (
                      <li key={item.id}>
                        <span className="admin-pill">{SOURCE_LABEL[item.source]}</span>{' '}
                        {item.analysis?.summary || item.title || truncate(item.content, 80) || '(내용 없음)'}
                        {item.url && (
                          <>
                            {' '}
                            <a href={item.url} target="_blank" rel="noreferrer">
                              원문
                            </a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="admin-notice-form-row" style={{ margin: '12px 0' }}>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.currentTarget.value as InsightSource | '')}
            >
              <option value="">전체 소스</option>
              {(Object.keys(SOURCE_LABEL) as InsightSource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => {
                const next = e.currentTarget.value as InsightCategory | '';
                setFilterCategory(next);
                setExpandedCategory(next || null);
              }}
            >
              <option value="">전체 카테고리</option>
              {(Object.keys(CATEGORY_LABEL) as InsightCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="admin-create-btn"
              disabled={draftingGuides || selectedAnalysisIds.size === 0}
              onClick={() => void handleDraftGuides([...selectedAnalysisIds])}
            >
              {draftingGuides && !draftingAnalysisId
                ? '초안 생성 중…'
                : `선택 ${selectedAnalysisIds.size}건 → 가이드카드`}
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={selectableItems.length === 0 || draftingGuides}
                      aria-label="분석된 항목 전체 선택"
                    />
                  </th>
                  <th>소스</th>
                  <th>제목/요약</th>
                  <th>카테고리</th>
                  <th>언급 서비스</th>
                  <th>수집시각</th>
                  <th>원문</th>
                  <th>가이드</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const analysisId = item.analysis?.id;
                  const canDraft = Boolean(analysisId);
                  const isRowDrafting = draftingAnalysisId === analysisId;
                  const isDeleting = deletingRawItemId === item.id;
                  return (
                    <tr key={item.id}>
                      <td>
                        {analysisId ? (
                          <input
                            type="checkbox"
                            checked={selectedAnalysisIds.has(analysisId)}
                            onChange={() => toggleSelectOne(analysisId)}
                            disabled={draftingGuides}
                            aria-label={`${item.title || '항목'} 선택`}
                          />
                        ) : (
                          <span className="admin-cell-sub">—</span>
                        )}
                      </td>
                      <td>
                        <span className="admin-pill">{SOURCE_LABEL[item.source]}</span>
                      </td>
                      <td>
                        <div>{item.title || '(제목 없음)'}</div>
                        <div className="admin-cell-sub">
                          {item.analysis?.summary || truncate(item.content, 90) || '-'}
                        </div>
                      </td>
                      <td>
                        {item.analysis ? (
                          <select
                            className="admin-inline-select"
                            value={item.analysis.category}
                            disabled={recategorizingId === item.analysis.id}
                            onChange={(e) =>
                              void handleRecategorize(item, e.target.value as InsightCategory)
                            }
                            title="AI 분류가 틀렸으면 여기서 고칩니다"
                          >
                            {(Object.keys(CATEGORY_LABEL) as InsightCategory[]).map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_LABEL[c]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="admin-cell-sub">미분석</span>
                        )}
                      </td>
                      <td>{item.analysis?.mentionedServices?.join(', ') || '-'}</td>
                      <td>{formatDateTime(item.collectedAt)}</td>
                      <td>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noreferrer">
                            링크
                          </a>
                        )}
                      </td>
                      <td>
                        {canDraft ? (
                          <button
                            type="button"
                            className="admin-link-btn"
                            disabled={draftingGuides}
                            title="검토한 내용을 유용한 정보로 표시하고 가이드 초안을 만듭니다"
                            onClick={() => void handleDraftOne(analysisId!)}
                          >
                            {isRowDrafting ? '생성 중…' : '가이드카드'}
                          </button>
                        ) : (
                          <span className="admin-cell-sub">분석 필요</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-link-btn admin-link-btn-danger"
                          disabled={isDeleting}
                          title="잘못 수집된 원문을 지웁니다"
                          onClick={() => void handleDeleteRawItem(item)}
                        >
                          {isDeleting ? '삭제 중…' : '삭제'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9}>표시할 항목이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </main>
  );
}
