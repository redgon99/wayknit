import { landingAnchor, nodeHasContent, walkEnabled, type LandingMenuNode } from '../lib/landingMenu';
import { youtubeEmbedUrl } from '../lib/landingPromo';

const FALLBACK_IMAGES = [
  { url: '/landing/hero.png', alt: 'Wayknit map' },
  { url: '/landing/screen-search.png', alt: 'Search' },
  { url: '/landing/screen-route.png', alt: 'Route' },
];

export function collectNoticeTexts(tree: LandingMenuNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: LandingMenuNode[]) => {
    for (const n of nodes) {
      if (!n.enabled) continue;
      if (n.type === 'notice' && n.noticeText.trim()) out.push(n.noticeText.trim());
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export function landingNavItems(tree: LandingMenuNode[], skipId?: string): LandingMenuNode[] {
  return walkEnabled(tree)
    .filter((n) => n.type !== 'notice' && n.id !== skipId && nodeHasContent(n))
    .map((n) => ({ ...n, children: landingNavItems(n.children, skipId) }));
}

function NavItem({ item }: { item: LandingMenuNode }) {
  const href = `#${landingAnchor(item.id)}`;
  if (item.children.length === 0) {
    return <a href={href}>{item.title}</a>;
  }
  return (
    <div className="landing-nav-drop">
      <a href={href}>
        {item.title}
        <span aria-hidden> ▾</span>
      </a>
      <div className="landing-nav-drop-menu">
        {item.children.map((child) => (
          <NavItem key={child.id} item={child} />
        ))}
      </div>
    </div>
  );
}

export function LandingCmsNav({ items }: { items: LandingMenuNode[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item) => (
        <NavItem key={item.id} item={item} />
      ))}
    </>
  );
}

export function LandingCmsSections({
  tree,
  skipId,
}: {
  tree: LandingMenuNode[];
  skipId?: string;
}) {
  return (
    <>
      {walkEnabled(tree).map((node) => (
        <CmsNode key={node.id} node={node} skipId={skipId} />
      ))}
    </>
  );
}

function CmsNode({
  node,
  skipId,
}: {
  node: LandingMenuNode;
  skipId?: string;
}) {
  const kids = walkEnabled(node.children).map((child) => (
    <CmsNode key={child.id} node={child} skipId={skipId} />
  ));

  if (node.id === skipId) return <>{kids}</>;
  if (node.type === 'notice') return null;

  if (node.type === 'copy') {
    if (!nodeHasContent(node)) return <>{kids}</>;
    return (
      <>
        <section className="landing-section" id={landingAnchor(node.id)}>
          <div className="landing-section-header">
            <h2>{node.heroTitle.trim() || node.title}</h2>
            {node.heroSubtitle.trim() ? <p>{node.heroSubtitle}</p> : null}
          </div>
        </section>
        {kids}
      </>
    );
  }
  if (node.type === 'video') {
    const embed = node.videoKind === 'youtube' ? youtubeEmbedUrl(node.youtubeUrl) : null;
    const file = node.videoKind === 'file' ? node.videoUrl : null;
    if (!embed && !file) return <>{kids}</>;
    return (
      <>
        <section className="landing-section landing-promo-video" id={landingAnchor(node.id)} aria-label={node.title}>
          <div className="landing-promo-video-frame">
            {embed ? (
              <iframe
                title={node.title}
                src={embed}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video src={file ?? undefined} controls playsInline />
            )}
          </div>
        </section>
        {kids}
      </>
    );
  }
  if (node.type === 'images') {
    const items = node.images.length > 0 ? node.images : FALLBACK_IMAGES;
    return (
      <>
        <section className="landing-section" id={landingAnchor(node.id)} aria-labelledby={`${landingAnchor(node.id)}-title`}>
          <div className="landing-section-header">
            <h2 id={`${landingAnchor(node.id)}-title`}>{node.title}</h2>
          </div>
          <div className="landing-gallery">
            {items.map((item, i) => (
              <div key={`${item.url}-${i}`} className="landing-gallery-item">
                <img src={item.url} alt={item.alt || `${node.title} ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
        </section>
        {kids}
      </>
    );
  }
  if (node.type === 'text') {
    if (!nodeHasContent(node)) return <>{kids}</>;
    return (
      <>
        <section className="landing-section" id={landingAnchor(node.id)}>
          <div className="landing-section-header">
            <h2>{node.title}</h2>
            {node.body.trim() ? <p style={{ whiteSpace: 'pre-wrap' }}>{node.body}</p> : null}
          </div>
        </section>
        {kids}
      </>
    );
  }
  // group 등 나머지 타입 — group 자체는 콘텐츠가 없고 자식으로만 존재한다.
  // kids.length는 "활성화된 자식 수"일 뿐 "실제로 뭔가 그려지는 자식 수"가
  // 아니다(빈 자식도 각자 자기 카드를 건너뛰고 빈 프래그먼트를 반환할 뿐
  // 배열엔 그대로 남는다) — 그래서 얕은 길이 대신 nodeHasContent로 자손까지
  // 재귀 확인한다. 콘텐츠가 하나도 없으면 제목만 남은 빈 섹션이 되므로 건너뛴다.
  if (!nodeHasContent(node)) return null;
  return (
    <section className="landing-section" id={landingAnchor(node.id)}>
      <div className="landing-section-header">
        <h2>{node.title}</h2>
        {node.body.trim() ? <p>{node.body}</p> : null}
      </div>
      {kids}
    </section>
  );
}
