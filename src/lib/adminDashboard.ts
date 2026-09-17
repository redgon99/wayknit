/**
 * 통합 대시보드 데이터.
 *
 * 관리자 정보가 8개 페이지에 흩어져 있어 "지금 뭘 봐야 하는지" 알려면 전부
 * 눌러봐야 했다. `admin_dashboard_summary` RPC가 한 번에 전 영역 카운트를
 * 돌려주고, 여기서 그중 "조치가 필요한 것"을 뽑아낸다.
 */
import { getSupabase, isSupabaseConfigured } from './supabase';

export interface DashboardSummary {
  users: { total: number; test: number };
  trips: { total: number; public: number; listed: number; owners: number; created_7d: number };
  reports: { open: number; total: number };
  guides: { published: number; draft: number; total: number };
  scenarios: { published: number; draft: number; themes_covered: number; regions_covered: number };
  insights: {
    raw_items: number;
    keywords: number;
    place_mentions: number;
    last_run_at: string | null;
  };
  distribution: { accounts: number; posted: number; failed: number; draft: number };
  notices: { published: number; total: number };
  admins: number;
  audit: { total: number; today: number };
}

export type AlertLevel = 'warn' | 'info';

export interface DashboardAlert {
  id: string;
  level: AlertLevel;
  message: string;
  /** 바로 처리하러 갈 화면 */
  to: string;
  actionLabel: string;
}

/** 시나리오 테마는 10개 고정 (lib/tourScenario.ts의 SCENARIO_THEMES와 같은 수) */
const TOTAL_SCENARIO_THEMES = 10;
/** 수집이 이 기간 넘게 없으면 멈춘 것으로 본다 */
const INSIGHT_STALE_DAYS = 14;

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 설정되어야 대시보드를 볼 수 있습니다.');
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
  const { data, error } = await sb.rpc('admin_dashboard_summary');
  if (error) throw error;
  return data as DashboardSummary;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * 숫자를 늘어놓기만 하면 결국 8개 페이지를 돌아보는 것과 같다.
 * 사람이 지금 손대야 할 것만 뽑아 위에 올린다.
 */
export function deriveAlerts(s: DashboardSummary): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (s.reports.open > 0) {
    alerts.push({
      id: 'reports-open',
      level: 'warn',
      message: `미처리 신고 ${s.reports.open}건`,
      to: '/admin/reports',
      actionLabel: '검수하기',
    });
  }

  if (s.distribution.failed > 0) {
    alerts.push({
      id: 'distribution-failed',
      level: 'warn',
      message: `게시 실패한 배포 ${s.distribution.failed}건`,
      to: '/admin/distribution',
      actionLabel: '확인하기',
    });
  }

  if (s.distribution.draft > 0 && s.distribution.accounts === 0) {
    alerts.push({
      id: 'distribution-no-account',
      level: 'warn',
      message: `배포 초안 ${s.distribution.draft}건이 있지만 연결된 계정이 없어 게시할 수 없습니다`,
      /* N2(관리자 검토 2026-09-16) — "계정 연결"을 눌러도 큐 탭(기본값)
         으로만 갔다. AdminDistributionPage.tsx가 ?tab=accounts를 읽어
         계정 탭으로 바로 연다. */
      to: '/admin/distribution?tab=accounts',
      actionLabel: '계정 연결',
    });
  }

  const stale = daysSince(s.insights.last_run_at);
  if (stale === null) {
    alerts.push({
      id: 'insight-never',
      level: 'info',
      message: '트렌드 수집을 한 번도 실행하지 않았습니다',
      to: '/admin/insights',
      actionLabel: '수집 실행',
    });
  } else if (stale >= INSIGHT_STALE_DAYS) {
    alerts.push({
      id: 'insight-stale',
      level: 'warn',
      message: `트렌드 수집이 ${stale}일째 멈춰 있습니다`,
      to: '/admin/insights',
      actionLabel: '수집 실행',
    });
  }

  // 원문은 쌓였는데 장소로 연결된 게 없으면 분석 파이프라인이 끊긴 것이다.
  if (s.insights.raw_items > 0 && s.insights.place_mentions === 0) {
    alerts.push({
      id: 'insight-unlinked',
      level: 'warn',
      message: `수집한 원문 ${s.insights.raw_items}건이 장소와 연결되지 않았습니다`,
      to: '/admin/insights',
      actionLabel: '분석 확인',
    });
  }

  if (s.scenarios.themes_covered < TOTAL_SCENARIO_THEMES) {
    alerts.push({
      id: 'scenario-coverage',
      level: 'info',
      message: `시나리오가 없는 테마 ${TOTAL_SCENARIO_THEMES - s.scenarios.themes_covered}개 (게시 ${s.scenarios.themes_covered}/${TOTAL_SCENARIO_THEMES})`,
      to: '/admin/scenarios',
      actionLabel: '생성하기',
    });
  }

  if (s.scenarios.draft > 0) {
    alerts.push({
      id: 'scenario-draft',
      level: 'info',
      message: `검토 대기 중인 시나리오 초안 ${s.scenarios.draft}건`,
      to: '/admin/scenarios',
      actionLabel: '검토하기',
    });
  }

  if (s.guides.draft > 0) {
    alerts.push({
      id: 'guide-draft',
      level: 'info',
      message: `게시되지 않은 가이드 ${s.guides.draft}건`,
      to: '/admin/guides',
      actionLabel: '검토하기',
    });
  }

  if (s.admins <= 1) {
    alerts.push({
      id: 'single-admin',
      level: 'info',
      message: '관리자가 1명뿐입니다 — 계정을 잃으면 콘솔에 들어올 수 없습니다',
      to: '/admin',
      actionLabel: '관리자 추가',
    });
  }

  return alerts;
}
