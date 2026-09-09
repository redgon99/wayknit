import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AdminHeader } from '../components/AdminHeader';
import { Icon } from '../components/Icon';
import { SortableContainer, SortableItem } from '../components/Sortable';
import { isCurrentUserAdmin } from '../lib/admin';
import {
  addChild,
  createLandingNode,
  findNode,
  LANDING_NODE_TYPE_LABEL,
  LANDING_NODE_TYPES,
  landingAnchor,
  moveSibling,
  parentIdOf,
  removeNode,
  updateNode,
  walkEnabled,
  type LandingMenuNode,
  type LandingNodeType,
} from '../lib/landingMenu';
import {
  emptyLandingPromo,
  fetchLandingPromo,
  landingImageKey,
  MAX_LANDING_IMAGES,
  moveIndex,
  parseYoutubeId,
  removeLandingAsset,
  saveLandingPromo,
  uploadLandingAsset,
  youtubeEmbedUrl,
  type LandingPromo,
} from '../lib/landingPromo';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type AppLocale } from '../lib/locale';
import '../styles/app.css';

const DEFAULT_GALLERY = [
  { src: '/landing/hero.png', alt: '히어로' },
  { src: '/landing/screen-search.png', alt: '검색' },
  { src: '/landing/screen-route.png', alt: '동선' },
];

export default function AdminLandingPage() {
  const { configured, loading, user } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<AppLocale>('ko');
  const [promo, setPromo] = useState<LandingPromo>(() => emptyLandingPromo('ko'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addType, setAddType] = useState<LandingNodeType>('text');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (nextLocale: AppLocale) => {
    setRefreshing(true);
    setError(null);
    try {
      const row = await fetchLandingPromo(nextLocale);
      const next = row ?? emptyLandingPromo(nextLocale);
      setPromo(next);
      setSelectedId((cur) => {
        if (cur && findNode(next.menu, cur)) return cur;
        return next.menu[0]?.id ?? null;
      });
      setExpanded((prev) => {
        const nextExp = { ...prev };
        const walk = (nodes: LandingMenuNode[]) => {
          for (const n of nodes) {
            if (n.children.length && nextExp[n.id] === undefined) nextExp[n.id] = true;
            walk(n.children);
          }
        };
        walk(next.menu);
        return nextExp;
      });
    } catch (e) {
      const fallback = emptyLandingPromo(nextLocale);
      setPromo(fallback);
      setSelectedId(fallback.menu[0]?.id ?? null);
      setError(e instanceof Error ? e.message : '랜딩 설정을 불러오지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  }, []);

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
        if (ok) await load(locale);
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
  }, [configured, loading, user, load, locale]);

  const selected = selectedId ? findNode(promo.menu, selectedId) : null;

  const setMenu = (menu: LandingMenuNode[]) => setPromo((p) => ({ ...p, menu }));

  const patchSelected = (patch: Partial<LandingMenuNode>) => {
    if (!selectedId) return;
    setMenu(updateNode(promo.menu, selectedId, patch));
  };

  const persist = async (next: LandingPromo) => {
    const videoNodes: LandingMenuNode[] = [];
    const collect = (nodes: LandingMenuNode[]) => {
      for (const n of nodes) {
        if (n.type === 'video') videoNodes.push(n);
        collect(n.children);
      }
    };
    collect(next.menu);
    if (
      videoNodes.some(
        (n) => n.enabled && n.videoKind === 'youtube' && n.youtubeUrl.trim() && !parseYoutubeId(n.youtubeUrl)
      )
    ) {
      setError('유튜브 주소가 올바르지 않습니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveLandingPromo(next);
      setPromo(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다. 마이그레이션 적용 여부를 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (asChild: boolean) => {
    const node = createLandingNode(addType);
    const parentId = asChild ? selectedId : selectedId ? parentIdOf(promo.menu, selectedId) : null;
    const next = addChild(promo.menu, parentId, node);
    setMenu(next);
    setSelectedId(node.id);
    if (asChild && selectedId) setExpanded((e) => ({ ...e, [selectedId]: true }));
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (promo.menu.length === 1 && promo.menu[0].id === selectedId) return;
    if (!window.confirm('이 메뉴와 하위 항목을 삭제할까요?')) return;
    const parent = parentIdOf(promo.menu, selectedId);
    const next = removeNode(promo.menu, selectedId);
    setMenu(next);
    setSelectedId(parent && findNode(next, parent) ? parent : next[0]?.id ?? null);
  };

  const handleAddImages = async (files: FileList | null) => {
    if (!files?.length || !selected || selected.type !== 'images') return;
    setUploading(true);
    setError(null);
    try {
      const room = MAX_LANDING_IMAGES - selected.images.length;
      const uploaded = [];
      for (const file of Array.from(files).slice(0, room)) {
        uploaded.push(await uploadLandingAsset(locale, file, 'image'));
      }
      patchSelected({
        images: [
          ...selected.images,
          ...uploaded.map((u) => ({ id: crypto.randomUUID(), url: u.url, path: u.path })),
        ].slice(0, MAX_LANDING_IMAGES),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleReplaceImage = async (index: number, file: File | undefined) => {
    if (!file || !selected) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadLandingAsset(locale, file, 'image');
      const prev = selected.images[index];
      if (prev?.path) await removeLandingAsset(prev.path).catch(() => undefined);
      const images = [...selected.images];
      images[index] = { id: prev?.id || crypto.randomUUID(), url: uploaded.url, path: uploaded.path, alt: prev?.alt };
      patchSelected({ images });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 교체 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    if (!selected) return;
    const prev = selected.images[index];
    if (prev?.path) await removeLandingAsset(prev.path).catch(() => undefined);
    patchSelected({ images: selected.images.filter((_, i) => i !== index) });
  };

  const handleVideoFile = async (file: File | undefined) => {
    if (!file || !selected) return;
    setUploading(true);
    setError(null);
    try {
      if (selected.videoPath) await removeLandingAsset(selected.videoPath).catch(() => undefined);
      const uploaded = await uploadLandingAsset(locale, file, 'video');
      patchSelected({ videoKind: 'file', videoPath: uploaded.path, videoUrl: uploaded.url, enabled: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '영상 업로드 실패');
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  if (!configured) return <Navigate to="/" replace />;
  if (loading || checkingAdmin) {
    return (
      <main className="admin-page">
        <div className="admin-shell">관리자 확인 중...</div>
      </main>
    );
  }
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const visible = walkEnabled(promo.menu);

  return (
    <main className="admin-page">
      <div className="admin-shell admin-shell-wide">
        <AdminHeader
          subtitle="왼쪽 트리에서 메뉴를 추가하고, 가운데에서 내용을 편집합니다. 오른쪽이 랜딩 미리보기입니다."
          current="landing"
          refreshing={refreshing}
          onRefresh={() => void load(locale)}
          extraActions={
            <Link to="/" className="admin-link-btn">
              랜딩 보기
            </Link>
          }
        />

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-landing-toolbar">
          <div className="admin-landing-locales" role="tablist" aria-label="언어">
            {SUPPORTED_LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={locale === code}
                className={`admin-tab-btn${locale === code ? ' active' : ''}`}
                onClick={() => setLocale(code)}
              >
                {LOCALE_LABELS[code]}
              </button>
            ))}
          </div>
          <div className="admin-landing-actions">
            <span className={`admin-pill${promo.isPublished ? ' ok' : ''}`}>
              {promo.isPublished ? '게시됨' : '초안'}
            </span>
            <button type="button" disabled={saving || uploading} onClick={() => void persist(promo)}>
              {saving ? '저장 중…' : '초안 저장'}
            </button>
            <button
              type="button"
              className="admin-create-btn"
              disabled={saving || uploading}
              onClick={() => void persist({ ...promo, isPublished: true })}
            >
              게시
            </button>
          </div>
        </div>

        <div className="admin-landing-triple">
          <aside className="admin-section admin-landing-tree">
            <h2>메뉴</h2>
            <div className="admin-landing-tree-list">
              {promo.menu.map((node) => (
                <TreeRows
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expanded={expanded}
                  onSelect={setSelectedId}
                  onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
                />
              ))}
            </div>
            <div className="admin-landing-tree-add">
              <select value={addType} onChange={(e) => setAddType(e.target.value as LandingNodeType)}>
                {LANDING_NODE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LANDING_NODE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => handleAdd(false)}>
                + 메뉴
              </button>
              <button type="button" disabled={!selectedId} onClick={() => handleAdd(true)}>
                + 하위
              </button>
            </div>
            <div className="admin-landing-order-btns">
              <button type="button" disabled={!selectedId} onClick={() => selectedId && setMenu(moveSibling(promo.menu, selectedId, -1))}>
                위로
              </button>
              <button type="button" disabled={!selectedId} onClick={() => selectedId && setMenu(moveSibling(promo.menu, selectedId, 1))}>
                아래로
              </button>
              <button
                type="button"
                className="danger"
                disabled={!selectedId || (promo.menu.length === 1 && promo.menu[0].id === selectedId)}
                onClick={handleDelete}
              >
                삭제
              </button>
            </div>
          </aside>

          <div className="admin-landing-editor">
            {!selected ? (
              <section className="admin-section">
                <p className="admin-landing-hint">왼쪽에서 메뉴를 고르거나 추가하세요.</p>
              </section>
            ) : (
              <section className="admin-section">
                <div className="admin-landing-block-head">
                  <h2>{LANDING_NODE_TYPE_LABEL[selected.type]}</h2>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.enabled}
                      onChange={(e) => patchSelected({ enabled: e.target.checked })}
                    />
                    표시
                  </label>
                </div>
                <div className="admin-landing-fields">
                  <label>
                    메뉴 이름
                    <input
                      className="admin-notice-title"
                      value={selected.title}
                      onChange={(e) => patchSelected({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    유형
                    <select
                      value={selected.type}
                      onChange={(e) => patchSelected({ type: e.target.value as LandingNodeType })}
                    >
                      {LANDING_NODE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {LANDING_NODE_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected.type === 'notice' && (
                    <label>
                      공지 내용
                      <textarea
                        className="admin-notice-body"
                        value={selected.noticeText}
                        onChange={(e) => patchSelected({ noticeText: e.target.value })}
                      />
                    </label>
                  )}
                  {selected.type === 'copy' && (
                    <>
                      <label>
                        작은 제목
                        <input className="admin-notice-title" value={selected.heroEyebrow} onChange={(e) => patchSelected({ heroEyebrow: e.target.value })} />
                      </label>
                      <label>
                        히어로 제목
                        <textarea className="admin-notice-body" value={selected.heroTitle} onChange={(e) => patchSelected({ heroTitle: e.target.value })} />
                      </label>
                      <label>
                        설명
                        <textarea className="admin-notice-body" value={selected.heroSubtitle} onChange={(e) => patchSelected({ heroSubtitle: e.target.value })} />
                      </label>
                      <label>
                        보조 문구
                        <input className="admin-notice-title" value={selected.heroNote} onChange={(e) => patchSelected({ heroNote: e.target.value })} />
                      </label>
                    </>
                  )}
                  {selected.type === 'text' && (
                    <label>
                      본문
                      <textarea className="admin-notice-body" value={selected.body} onChange={(e) => patchSelected({ body: e.target.value })} rows={8} />
                    </label>
                  )}
                  {selected.type === 'group' && (
                    <label>
                      그룹 설명 (선택)
                      <textarea className="admin-notice-body" value={selected.body} onChange={(e) => patchSelected({ body: e.target.value })} />
                    </label>
                  )}
                  {selected.type === 'video' && (
                    <>
                      <div className="admin-notice-form-row">
                        <label>
                          <input type="radio" checked={selected.videoKind === 'youtube'} onChange={() => patchSelected({ videoKind: 'youtube' })} />
                          유튜브
                        </label>
                        <label>
                          <input type="radio" checked={selected.videoKind === 'file'} onChange={() => patchSelected({ videoKind: 'file' })} />
                          파일
                        </label>
                      </div>
                      {selected.videoKind === 'youtube' ? (
                        <input className="admin-notice-title" value={selected.youtubeUrl} onChange={(e) => patchSelected({ youtubeUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
                      ) : (
                        <div className="admin-landing-upload">
                          <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => void handleVideoFile(e.target.files?.[0])} />
                          <button type="button" disabled={uploading} onClick={() => videoInputRef.current?.click()}>
                            {uploading ? '올리는 중…' : selected.videoUrl ? '영상 교체' : 'mp4 / webm 업로드'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {selected.type === 'images' && (
                    <>
                      <p className="admin-landing-hint">드래그 또는 위/아래로 순서를 바꿉니다. 최대 {MAX_LANDING_IMAGES}장.</p>
                      <SortableContainer
                        ids={selected.images.map((img, i) => landingImageKey(img, i))}
                        onReorder={(ids) => {
                          const next = ids
                            .map((id) => selected.images.find((img, i) => landingImageKey(img, i) === id))
                            .filter((v): v is NonNullable<typeof v> => !!v);
                          if (next.length === selected.images.length) patchSelected({ images: next });
                        }}
                      >
                        {selected.images.map((img, i) => (
                          <SortableItem key={landingImageKey(img, i)} id={landingImageKey(img, i)}>
                            {({ listeners, setActivatorNodeRef }) => (
                              <div className="admin-landing-image-row">
                                <button type="button" className="admin-landing-grip" ref={setActivatorNodeRef} {...listeners}>
                                  ::
                                </button>
                                <img src={img.url} alt={img.alt || `이미지 ${i + 1}`} />
                                <div className="admin-landing-image-meta">
                                  <strong>{img.alt || `홍보이미지 ${i + 1}`}</strong>
                                  <div className="admin-action-row">
                                    <button type="button" disabled={i === 0} onClick={() => patchSelected({ images: moveIndex(selected.images, i, i - 1) })}>
                                      위로
                                    </button>
                                    <button type="button" disabled={i === selected.images.length - 1} onClick={() => patchSelected({ images: moveIndex(selected.images, i, i + 1) })}>
                                      아래로
                                    </button>
                                    <label className="admin-landing-file-btn">
                                      교체
                                      <input type="file" accept="image/*" hidden onChange={(e) => void handleReplaceImage(i, e.target.files?.[0])} />
                                    </label>
                                    <button type="button" className="danger" onClick={() => void handleRemoveImage(i)}>
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </SortableItem>
                        ))}
                      </SortableContainer>
                      {selected.images.length < MAX_LANDING_IMAGES && (
                        <button type="button" className="admin-landing-image-add-row" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
                          + 이미지 추가
                        </button>
                      )}
                      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => void handleAddImages(e.target.files)} />
                    </>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="admin-section admin-landing-preview-pane">
            <div className="admin-landing-preview-head">
              <h2>랜딩 미리보기</h2>
              <div className="admin-landing-preview-head-right">
                <div className="admin-landing-preview-toggle">
                  <button
                    type="button"
                    className={previewWidth === 'desktop' ? 'active' : ''}
                    onClick={() => setPreviewWidth('desktop')}
                  >
                    데스크톱
                  </button>
                  <button
                    type="button"
                    className={previewWidth === 'mobile' ? 'active' : ''}
                    onClick={() => setPreviewWidth('mobile')}
                  >
                    모바일
                  </button>
                </div>
                <span>켜 둔 메뉴만</span>
              </div>
            </div>
            {/*
              실제 페이지를 그대로 렌더링하는 게 아니라 무엇이 켜져 있는지 보여주는
              별도 요약 마크업이라(PreviewForest), 뷰포트 기준 미디어쿼리를 그대로
              흉내 낼 수는 없다. 폭만 폰 크기로 좁혀 이미지 그리드·CTA 줄바꿈처럼
              flex/grid로 반응하는 부분만이라도 미리 보이게 한다 — 정확한 복제가
              아니라 "폭이 좁아지면 이렇게 흐른다" 정도의 근사치임을 라벨로 밝힌다.
            */}
            <div
              className={`admin-landing-preview-frame ${
                previewWidth === 'mobile' ? 'is-mobile' : ''
              }`}
            >
              <PreviewForest nodes={visible} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function TreeRows({
  node,
  depth,
  selectedId,
  expanded,
  onSelect,
  onToggle,
}: {
  node: LandingMenuNode;
  depth: number;
  selectedId: string | null;
  expanded: Record<string, boolean>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const open = expanded[node.id] !== false;
  const hasKids = node.children.length > 0 || node.type === 'group';
  return (
    <>
      <button
        type="button"
        className={`admin-landing-tree-item${selectedId === node.id ? ' active' : ''}${node.enabled ? '' : ' off'}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.id)}
      >
        {hasKids ? (
          <span
            className="admin-landing-tree-caret"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          </span>
        ) : (
          <span className="admin-landing-tree-caret" />
        )}
        <span className="admin-landing-tree-title">{node.title}</span>
        <span className="admin-landing-tree-type">{LANDING_NODE_TYPE_LABEL[node.type]}</span>
      </button>
      {open &&
        node.children.map((child) => (
          <TreeRows
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

function PreviewForest({ nodes }: { nodes: LandingMenuNode[] }) {
  return (
    <>
      {nodes.map((n) => (
        <PreviewNode key={n.id} node={n} />
      ))}
    </>
  );
}

function PreviewNode({ node }: { node: LandingMenuNode }) {
  const kids = node.children.length > 0 ? <PreviewForest nodes={node.children} /> : null;
  if (node.type === 'notice') {
    return (
      <>
        <div className="admin-landing-preview-notice">{node.noticeText.trim() || node.title}</div>
        {kids}
      </>
    );
  }
  if (node.type === 'copy') {
    return (
      <>
        <div className="admin-landing-preview-hero" id={landingAnchor(node.id)}>
          {node.heroEyebrow.trim() ? <p className="admin-landing-preview-eye">{node.heroEyebrow}</p> : null}
          <strong>{node.heroTitle.trim() || node.title}</strong>
          {node.heroSubtitle.trim() ? <p>{node.heroSubtitle}</p> : null}
          <div className="admin-landing-preview-ctas">
            <span className="on">무료로 시작하기</span>
            <span>공유마당 둘러보기</span>
          </div>
        </div>
        {kids}
      </>
    );
  }
  if (node.type === 'video') {
    const embed = youtubeEmbedUrl(node.youtubeUrl);
    return (
      <>
        <div className="admin-landing-preview-media" id={landingAnchor(node.id)}>
          {node.videoKind === 'youtube' && embed ? (
            <iframe title={node.title} src={embed} allowFullScreen />
          ) : node.videoKind === 'file' && node.videoUrl ? (
            <video src={node.videoUrl} controls playsInline />
          ) : (
            <p className="admin-landing-hint">동영상을 넣으면 여기에 보입니다.</p>
          )}
          <span className="admin-landing-preview-cap">{node.title}</span>
        </div>
        {kids}
      </>
    );
  }
  if (node.type === 'images') {
    const imgs = node.images.length > 0 ? node.images : DEFAULT_GALLERY.map((g) => ({ url: g.src, alt: g.alt }));
    return (
      <>
        <div className="admin-landing-preview-grid" id={landingAnchor(node.id)}>
          {imgs.map((img, i) => (
            <figure key={`${img.url}-${i}`}>
              <img src={img.url} alt={img.alt || `${node.title} ${i + 1}`} />
              <figcaption>
                {node.title} {i + 1}
              </figcaption>
            </figure>
          ))}
        </div>
        {kids}
      </>
    );
  }
  if (node.type === 'text') {
    return (
      <>
        <div className="admin-landing-preview-hero" id={landingAnchor(node.id)}>
          <strong>{node.title}</strong>
          {node.body.trim() ? <p style={{ whiteSpace: 'pre-wrap' }}>{node.body}</p> : null}
        </div>
        {kids}
      </>
    );
  }
  return (
    <div className="admin-landing-preview-group" id={landingAnchor(node.id)}>
      <p className="admin-landing-preview-eye">{node.title}</p>
      {node.body.trim() ? <p className="admin-landing-hint">{node.body}</p> : null}
      {kids}
    </div>
  );
}
