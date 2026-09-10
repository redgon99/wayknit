import type { LandingPromoImage, LandingVideoKind } from './landingPromo';
import { youtubeEmbedUrl } from './landingPromo';

export type LandingNodeType = 'group' | 'notice' | 'copy' | 'video' | 'images' | 'text';

export const LANDING_NODE_TYPES: LandingNodeType[] = [
  'group',
  'notice',
  'copy',
  'video',
  'images',
  'text',
];

export const LANDING_NODE_TYPE_LABEL: Record<LandingNodeType, string> = {
  group: '그룹 (드롭다운)',
  notice: '공지띠',
  copy: '홍보문구',
  video: '홍보동영상',
  images: '홍보이미지',
  text: '본문',
};

export interface LandingMenuNode {
  id: string;
  title: string;
  type: LandingNodeType;
  enabled: boolean;
  children: LandingMenuNode[];
  noticeText: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroNote: string;
  videoKind: LandingVideoKind;
  youtubeUrl: string;
  videoPath: string | null;
  videoUrl: string | null;
  images: LandingPromoImage[];
  body: string;
}

function blankContent(): Omit<LandingMenuNode, 'id' | 'title' | 'type' | 'enabled' | 'children'> {
  return {
    noticeText: '',
    heroEyebrow: '',
    heroTitle: '',
    heroSubtitle: '',
    heroNote: '',
    videoKind: 'youtube',
    youtubeUrl: '',
    videoPath: null,
    videoUrl: null,
    images: [],
    body: '',
  };
}

export function createLandingNode(type: LandingNodeType, title?: string): LandingMenuNode {
  return {
    id: crypto.randomUUID(),
    title: title?.trim() || LANDING_NODE_TYPE_LABEL[type],
    type,
    enabled: type !== 'video',
    children: [],
    ...blankContent(),
  };
}

export interface LandingMenuSeed {
  noticeText?: string;
  noticeEnabled?: boolean;
  heroEyebrow?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroNote?: string;
  copyEnabled?: boolean;
  videoKind?: LandingVideoKind;
  youtubeUrl?: string;
  videoPath?: string | null;
  videoUrl?: string | null;
  videoEnabled?: boolean;
  images?: LandingPromoImage[];
  imagesEnabled?: boolean;
}

export function defaultLandingMenu(promo?: LandingMenuSeed | null): LandingMenuNode[] {
  const notice = createLandingNode('notice', '공지띠');
  notice.noticeText = promo?.noticeText ?? '';
  notice.enabled = promo?.noticeEnabled ?? true;

  const copy = createLandingNode('copy', '홍보문구');
  copy.heroEyebrow = promo?.heroEyebrow ?? '';
  copy.heroTitle = promo?.heroTitle ?? '';
  copy.heroSubtitle = promo?.heroSubtitle ?? '';
  copy.heroNote = promo?.heroNote ?? '';
  copy.enabled = promo?.copyEnabled ?? true;

  const video = createLandingNode('video', '홍보동영상 1');
  video.videoKind = promo?.videoKind ?? 'youtube';
  video.youtubeUrl = promo?.youtubeUrl ?? '';
  video.videoPath = promo?.videoPath ?? null;
  video.videoUrl = promo?.videoUrl ?? null;
  video.enabled = promo?.videoEnabled ?? false;

  const images = createLandingNode('images', '홍보이미지');
  images.images = promo?.images ?? [];
  images.enabled = promo?.imagesEnabled ?? true;

  return [notice, copy, video, images];
}

function parseNode(raw: unknown): LandingMenuNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const type = LANDING_NODE_TYPES.includes(rec.type as LandingNodeType)
    ? (rec.type as LandingNodeType)
    : 'text';
  const children = Array.isArray(rec.children)
    ? rec.children.map(parseNode).filter((n): n is LandingMenuNode => !!n)
    : [];
  const images = Array.isArray(rec.images)
    ? rec.images.filter((item): item is LandingPromoImage => {
        if (!item || typeof item !== 'object') return false;
        return typeof (item as LandingPromoImage).url === 'string';
      })
    : [];
  return {
    id: typeof rec.id === 'string' && rec.id ? rec.id : crypto.randomUUID(),
    title: typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : LANDING_NODE_TYPE_LABEL[type],
    type,
    enabled: rec.enabled !== false,
    children,
    noticeText: typeof rec.noticeText === 'string' ? rec.noticeText : '',
    heroEyebrow: typeof rec.heroEyebrow === 'string' ? rec.heroEyebrow : '',
    heroTitle: typeof rec.heroTitle === 'string' ? rec.heroTitle : '',
    heroSubtitle: typeof rec.heroSubtitle === 'string' ? rec.heroSubtitle : '',
    heroNote: typeof rec.heroNote === 'string' ? rec.heroNote : '',
    videoKind: rec.videoKind === 'file' ? 'file' : 'youtube',
    youtubeUrl: typeof rec.youtubeUrl === 'string' ? rec.youtubeUrl : '',
    videoPath: typeof rec.videoPath === 'string' ? rec.videoPath : null,
    videoUrl: typeof rec.videoUrl === 'string' ? rec.videoUrl : null,
    images,
    body: typeof rec.body === 'string' ? rec.body : '',
  };
}

export function parseLandingMenu(raw: unknown, fallback?: LandingMenuSeed | null): LandingMenuNode[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(parseNode).filter((n): n is LandingMenuNode => !!n);
  }
  return defaultLandingMenu(fallback);
}

export function cloneMenu(tree: LandingMenuNode[]): LandingMenuNode[] {
  return tree.map((n) => ({ ...n, children: cloneMenu(n.children), images: [...n.images] }));
}

export function findNode(tree: LandingMenuNode[], id: string): LandingMenuNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

export function findFirstOfType(tree: LandingMenuNode[], type: LandingNodeType): LandingMenuNode | null {
  for (const n of tree) {
    if (n.type === type) return n;
    const found = findFirstOfType(n.children, type);
    if (found) return found;
  }
  return null;
}

export function findFirstEnabledOfType(
  tree: LandingMenuNode[],
  type: LandingNodeType
): LandingMenuNode | null {
  for (const n of tree) {
    if (!n.enabled) continue;
    if (n.type === type) return n;
    const found = findFirstEnabledOfType(n.children, type);
    if (found) return found;
  }
  return null;
}

function mapForest(
  tree: LandingMenuNode[],
  fn: (node: LandingMenuNode, siblings: LandingMenuNode[]) => LandingMenuNode | LandingMenuNode[] | null
): LandingMenuNode[] {
  const out: LandingMenuNode[] = [];
  for (const node of tree) {
    const next: LandingMenuNode = { ...node, children: mapForest(node.children, fn) };
    const result = fn(next, tree);
    if (result == null) continue;
    if (Array.isArray(result)) out.push(...result);
    else out.push(result);
  }
  return out;
}

export function updateNode(
  tree: LandingMenuNode[],
  id: string,
  patch: Partial<LandingMenuNode>
): LandingMenuNode[] {
  return mapForest(tree, (node) => (node.id === id ? { ...node, ...patch, id: node.id, children: node.children } : node));
}

export function addChild(tree: LandingMenuNode[], parentId: string | null, node: LandingMenuNode): LandingMenuNode[] {
  if (!parentId) return [...tree, node];
  return mapForest(tree, (n) => (n.id === parentId ? { ...n, children: [...n.children, node] } : n));
}

export function removeNode(tree: LandingMenuNode[], id: string): LandingMenuNode[] {
  return mapForest(tree, (n) => (n.id === id ? null : n));
}

export function moveSibling(tree: LandingMenuNode[], id: string, dir: -1 | 1): LandingMenuNode[] {
  const shift = (list: LandingMenuNode[]): LandingMenuNode[] => {
    const idx = list.findIndex((n) => n.id === id);
    if (idx !== -1) {
      const to = idx + dir;
      if (to < 0 || to >= list.length) return list.map((n) => ({ ...n, children: shift(n.children) }));
      const next = [...list];
      const [item] = next.splice(idx, 1);
      next.splice(to, 0, item);
      return next.map((n) => ({ ...n, children: shift(n.children) }));
    }
    return list.map((n) => ({ ...n, children: shift(n.children) }));
  };
  return shift(tree);
}

export function parentIdOf(tree: LandingMenuNode[], id: string): string | null {
  const walk = (nodes: LandingMenuNode[], parent: string | null): string | null | false => {
    for (const n of nodes) {
      if (n.id === id) return parent;
      const inner = walk(n.children, n.id);
      if (inner !== false) return inner;
    }
    return false;
  };
  const found = walk(tree, null);
  return found === false ? null : found;
}

export function walkEnabled(tree: LandingMenuNode[]): LandingMenuNode[] {
  const out: LandingMenuNode[] = [];
  for (const n of tree) {
    if (!n.enabled) continue;
    out.push({ ...n, children: walkEnabled(n.children) });
  }
  return out;
}

export function landingAnchor(id: string): string {
  return `landing-${id}`;
}

/**
 * F05(모바일 감사 보고서, 2026-09-10) — 관리자가 섹션을 만들어만 두고 내용을
 * 안 채우면 제목이 유형 기본값("본문"/"홍보문구")인 빈 구간이 그대로
 * 퍼블릭 화면·내비 메뉴에 나갔다. `LandingCms.tsx`의 `video` 타입엔 이미
 * "내용 없으면 자기 섹션은 안 그리고 자식만 그린다"는 가드가 있었는데
 * copy/text/기본 타입엔 빠져 있었다 — 그 가드를 판정하는 공용 함수.
 *
 * `images`는 일부러 뺐다 — 비어 있어도 폴백 이미지를 보여주게 설계돼 있어
 * (`FALLBACK_IMAGES`) 실제로 "빈 섹션"이 되는 일이 없다.
 */
export function nodeHasContent(n: LandingMenuNode): boolean {
  switch (n.type) {
    case 'notice':
      return n.noticeText.trim().length > 0;
    case 'copy':
      return !!(
        n.heroTitle.trim() ||
        n.heroSubtitle.trim() ||
        n.heroEyebrow.trim() ||
        n.heroNote.trim()
      );
    case 'video':
      return !!(
        (n.videoKind === 'youtube' && youtubeEmbedUrl(n.youtubeUrl)) ||
        (n.videoKind === 'file' && n.videoUrl)
      );
    case 'images':
      return true;
    case 'text':
      return n.body.trim().length > 0;
    case 'group':
      return n.children.some((c) => c.enabled && nodeHasContent(c));
    default:
      return n.body.trim().length > 0;
  }
}
