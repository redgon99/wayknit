import type { AppLocale } from './locale';
import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  findFirstOfType,
  parseLandingMenu,
  type LandingMenuNode,
} from './landingMenu';

export const LANDING_PROMO_BUCKET = 'landing-promo';
export const MAX_LANDING_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_LANDING_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_LANDING_IMAGES = 6;

export type LandingVideoKind = 'youtube' | 'file';
export type LandingBlockId = 'notice' | 'copy' | 'video' | 'images';

export const DEFAULT_BLOCK_ORDER: LandingBlockId[] = ['notice', 'copy', 'video', 'images'];

export interface LandingPromoImage {
  id?: string;
  url: string;
  path?: string;
  alt?: string;
}

export interface LandingPromo {
  locale: AppLocale;
  noticeText: string;
  noticeEnabled: boolean;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroNote: string;
  copyEnabled: boolean;
  videoKind: LandingVideoKind;
  youtubeUrl: string;
  videoPath: string | null;
  videoUrl: string | null;
  videoEnabled: boolean;
  images: LandingPromoImage[];
  imagesEnabled: boolean;
  isPublished: boolean;
  blockOrder: LandingBlockId[];
  menu: LandingMenuNode[];
  updatedAt: string | null;
}

interface LandingPromoRow {
  locale: string;
  notice_text: string;
  notice_enabled: boolean;
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_note: string;
  copy_enabled: boolean;
  video_kind: string;
  youtube_url: string;
  video_path: string | null;
  video_enabled: boolean;
  images: unknown;
  images_enabled: boolean;
  is_published?: boolean;
  block_order?: unknown;
  menu_tree?: unknown;
  updated_at: string | null;
}

export function emptyLandingPromo(locale: AppLocale): LandingPromo {
  const base: LandingPromo = {
    locale,
    noticeText: '',
    noticeEnabled: true,
    heroEyebrow: '',
    heroTitle: '',
    heroSubtitle: '',
    heroNote: '',
    copyEnabled: true,
    videoKind: 'youtube',
    youtubeUrl: '',
    videoPath: null,
    videoUrl: null,
    videoEnabled: false,
    images: [],
    imagesEnabled: true,
    isPublished: false,
    blockOrder: [...DEFAULT_BLOCK_ORDER],
    menu: [],
    updatedAt: null,
  };
  return { ...base, menu: parseLandingMenu(null, base) };
}

export function normalizeBlockOrder(raw: unknown): LandingBlockId[] {
  const allowed = new Set<string>(DEFAULT_BLOCK_ORDER);
  const listed = Array.isArray(raw)
    ? raw.filter((v): v is LandingBlockId => typeof v === 'string' && allowed.has(v))
    : [];
  return [...listed, ...DEFAULT_BLOCK_ORDER.filter((id) => !listed.includes(id))];
}

export function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function landingImageKey(img: LandingPromoImage, index: number): string {
  return img.id || img.path || `${img.url}#${index}`;
}

export function parseYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = parseYoutubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = sb.storage.from(LANDING_PROMO_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

function parseImages(raw: unknown): LandingPromoImage[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingPromoImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === 'string' ? rec.url : '';
    if (!url) continue;
    const parsed: LandingPromoImage = { url };
    if (typeof rec.id === 'string') parsed.id = rec.id;
    if (typeof rec.path === 'string') parsed.path = rec.path;
    if (typeof rec.alt === 'string') parsed.alt = rec.alt;
    out.push(parsed);
  }
  return out;
}

function fromRow(row: LandingPromoRow): LandingPromo {
  const videoPath = row.video_path ?? null;
  const base: LandingPromo = {
    locale: row.locale as AppLocale,
    noticeText: row.notice_text ?? '',
    noticeEnabled: Boolean(row.notice_enabled),
    heroEyebrow: row.hero_eyebrow ?? '',
    heroTitle: row.hero_title ?? '',
    heroSubtitle: row.hero_subtitle ?? '',
    heroNote: row.hero_note ?? '',
    copyEnabled: Boolean(row.copy_enabled),
    videoKind: row.video_kind === 'file' ? 'file' : 'youtube',
    youtubeUrl: row.youtube_url ?? '',
    videoPath,
    videoUrl: publicUrl(videoPath),
    videoEnabled: Boolean(row.video_enabled),
    images: parseImages(row.images),
    imagesEnabled: Boolean(row.images_enabled),
    isPublished: Boolean(row.is_published),
    blockOrder: normalizeBlockOrder(row.block_order),
    menu: [],
    updatedAt: row.updated_at ?? null,
  };
  return { ...base, menu: hydrateMenuMedia(parseLandingMenu(row.menu_tree, base)) };
}

function hydrateMenuMedia(nodes: LandingMenuNode[]): LandingMenuNode[] {
  return nodes.map((n) => ({
    ...n,
    videoUrl: n.videoUrl || publicUrl(n.videoPath),
    children: hydrateMenuMedia(n.children),
  }));
}

const LANDING_PROMO_SELECT =
  'locale, notice_text, notice_enabled, hero_eyebrow, hero_title, hero_subtitle, hero_note, copy_enabled, video_kind, youtube_url, video_path, video_enabled, images, images_enabled, is_published, block_order, menu_tree, updated_at';

export async function fetchLandingPromo(
  locale: AppLocale,
  options?: { publishedOnly?: boolean }
): Promise<LandingPromo | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabase();
  if (!sb) return null;
  let query = sb.from('landing_promo').select(LANDING_PROMO_SELECT).eq('locale', locale);
  if (options?.publishedOnly) query = query.eq('is_published', true);
  const { data, error } = await query.maybeSingle();
  // 조회 실패 시 랜딩은 하드코딩 폴백으로 조용히 넘어간다. 스키마 불일치 같은 문제를
  // 알아채지 못하고 오래 방치되는 일이 있어 원인은 콘솔에 남긴다.
  if (error) {
    console.warn('[landingPromo] 랜딩 콘텐츠 조회 실패 — 기본 문구로 대체합니다.', error);
    return null;
  }
  if (!data) return null;
  return fromRow(data as LandingPromoRow);
}

export async function saveLandingPromo(promo: LandingPromo): Promise<LandingPromo> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError) throw userError;
  const updatedBy = userData.user?.id;
  if (!updatedBy) throw new Error('로그인이 필요합니다.');

  const notice = findFirstOfType(promo.menu, 'notice');
  const copy = findFirstOfType(promo.menu, 'copy');
  const video = findFirstOfType(promo.menu, 'video');
  const images = findFirstOfType(promo.menu, 'images');

  const payload = {
    locale: promo.locale,
    notice_text: (notice?.noticeText ?? promo.noticeText).trim(),
    notice_enabled: notice?.enabled ?? promo.noticeEnabled,
    hero_eyebrow: (copy?.heroEyebrow ?? promo.heroEyebrow).trim(),
    hero_title: (copy?.heroTitle ?? promo.heroTitle).trim(),
    hero_subtitle: (copy?.heroSubtitle ?? promo.heroSubtitle).trim(),
    hero_note: (copy?.heroNote ?? promo.heroNote).trim(),
    copy_enabled: copy?.enabled ?? promo.copyEnabled,
    video_kind: video?.videoKind ?? promo.videoKind,
    youtube_url: (video?.youtubeUrl ?? promo.youtubeUrl).trim(),
    video_path: video?.videoPath ?? promo.videoPath,
    video_enabled: video?.enabled ?? promo.videoEnabled,
    images: (images?.images ?? promo.images).slice(0, MAX_LANDING_IMAGES),
    images_enabled: images?.enabled ?? promo.imagesEnabled,
    is_published: promo.isPublished,
    block_order: normalizeBlockOrder(promo.blockOrder),
    menu_tree: promo.menu,
    updated_by: updatedBy,
  };

  const { data, error } = await sb
    .from('landing_promo')
    .upsert(payload, { onConflict: 'locale' })
    .select(LANDING_PROMO_SELECT)
    .single();
  if (error) throw error;
  return fromRow(data as LandingPromoRow);
}

function sanitizeFileName(name: string): string {
  const trimmed = name.replace(/[/\\]/g, '').trim();
  const dot = trimmed.lastIndexOf('.');
  let ext = '';
  if (dot > 0 && dot < trimmed.length - 1) {
    ext = trimmed
      .slice(dot)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    if (!/^\.[a-z0-9]{1,8}$/.test(ext)) ext = '';
  }
  return `file${ext || ''}`;
}

export async function uploadLandingAsset(
  locale: AppLocale,
  file: File,
  kind: 'image' | 'video'
): Promise<{ path: string; url: string }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase가 설정되지 않았습니다.');
  const max = kind === 'video' ? MAX_LANDING_VIDEO_BYTES : MAX_LANDING_IMAGE_BYTES;
  if (file.size > max) {
    throw new Error(kind === 'video' ? '영상은 50MB 이하여야 합니다.' : '이미지는 8MB 이하여야 합니다.');
  }
  if (kind === 'image' && !file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있습니다.');
  }
  if (kind === 'video' && !file.type.startsWith('video/')) {
    throw new Error('영상 파일만 올릴 수 있습니다.');
  }

  const path = `${locale}/${kind}-${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await sb.storage.from(LANDING_PROMO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const url = publicUrl(path);
  if (!url) throw new Error('업로드 URL을 만들지 못했습니다.');
  return { path, url };
}

export async function removeLandingAsset(path: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.storage.from(LANDING_PROMO_BUCKET).remove([path]);
  if (error) throw error;
}
