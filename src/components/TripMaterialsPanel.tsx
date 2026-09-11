import { Icon } from './Icon';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { PinnedPlace, TripMaterial, TripMaterialKind } from '../types';
import {
  createMaterialId,
  formatByteSize,
  getMaterialSignedUrl,
  inferMaterialKindFromFile,
  removeMaterialFile,
  uploadMaterialFile,
  validateMaterialFile,
} from '../lib/tripMaterialsStorage';
import { MaterialsExportMenu } from './MaterialsExportMenu';
import { presenceColor, presenceInitial } from '../lib/tripPresence';
import { MaterialsPhotoGallery } from './MaterialsPhotoGallery';
import {
  albumDisplayTitle,
  buildMaterialDisplayItems,
  type MaterialDisplayItem,
} from '../lib/materialAlbums';
import i18n from '../lib/i18n';

type KindFilter = 'all' | TripMaterialKind;
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'wayknit:materials-view-v1';

interface PinOption {
  id: string;
  label: string;
  day: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  materials: TripMaterial[];
  onChange: (next: TripMaterial[]) => void;
  tripId: string;
  tripTitle: string;
  totalDays: number;
  currentDay: number;
  pinnedByDay: Record<number, PinnedPlace[]>;
  userId: string | null;
  authConfigured: boolean;
  onNotify: (message: string) => void;
  /**
   * 자료 id → 올린 사람 이메일. 공유받은 자료에 작성자 배지를 달 때만 쓴다.
   * 볼 자격이 없는 화면(공개 여행 열람)에서는 넘기지 않는다 — §14-2 와 같은 판단.
   */
  materialAuthors?: Record<string, string | null>;
  /** 내가 올린 것에는 배지를 달지 않으려고 비교한다. */
  currentUserEmail?: string | null;
}

function sortMaterials(list: TripMaterial[]): TripMaterial[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function writeViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function TripMaterialsPanel({
  open,
  onClose,
  materials,
  onChange,
  tripId,
  tripTitle,
  totalDays,
  currentDay,
  pinnedByDay,
  userId,
  authConfigured,
  onNotify,
  materialAuthors,
  currentUserEmail,
}: Props) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [placeFilter, setPlaceFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [composingNote, setComposingNote] = useState(false);
  const [gallery, setGallery] = useState<{ ids: string[]; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const pinOptions = useMemo((): PinOption[] => {
    const out: PinOption[] = [];
    for (let d = 1; d <= totalDays; d++) {
      for (const p of pinnedByDay[d] ?? []) {
        out.push({ id: p.id, label: t('materials.pinOptionLabel', { day: d, name: p.name }), day: d });
      }
    }
    return out;
  }, [pinnedByDay, totalDays, t]);

  const filtered = useMemo(() => {
    return sortMaterials(materials).filter((m) => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false;
      if (dayFilter != null && m.day !== dayFilter) return false;
      if (placeFilter != null && m.pinnedPlaceId !== placeFilter) return false;
      return true;
    });
  }, [materials, kindFilter, dayFilter, placeFilter]);

  const displayItems = useMemo(
    () => buildMaterialDisplayItems(filtered),
    [filtered]
  );

  const galleryMaterials = useMemo(() => {
    if (!gallery) return [];
    return gallery.ids
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is TripMaterial => !!m);
  }, [gallery, materials]);

  /**
   * 남이 올린 자료면 그 이메일. 내 것이거나 작성자를 모르면 null 이라 배지가 안 붙는다.
   * §19 이전 payload 에서 옮겨 온 자료는 작성자가 비어 있다 — 모르는 사람의 이니셜을
   * 지어내는 것보다 배지를 안 다는 편이 낫다.
   */
  const authorOf = useCallback(
    (m: TripMaterial): string | null => {
      const email = materialAuthors?.[m.id] ?? null;
      if (!email) return null;
      return email === (currentUserEmail ?? '') ? null : email;
    },
    [materialAuthors, currentUserEmail]
  );

  const openGallery = useCallback((ids: string[], startIndex = 0) => {
    setGallery({ ids, index: Math.max(0, Math.min(startIndex, ids.length - 1)) });
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const paths = materials
      .filter((m) => m.storagePath && (m.kind === 'image' || m.kind === 'file'))
      .map((m) => ({ id: m.id, path: m.storagePath! }));

    (async () => {
      const next: Record<string, string> = {};
      for (const { id, path } of paths) {
        const url = await getMaterialSignedUrl(path);
        if (url) next[id] = url;
      }
      if (!cancelled) setSignedUrls((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, materials]);


  const patchOne = useCallback(
    (id: string, patch: Partial<TripMaterial>) => {
      onChange(
        materials.map((m) =>
          m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m
        )
      );
    },
    [materials, onChange]
  );

  const requireAuthForUpload = useCallback((): boolean => {
    if (userId) return true;
    if (authConfigured) {
      onNotify(t('materials.uploadNeedsLogin'));
    } else {
      onNotify(t('materials.uploadNeedsSupabase'));
    }
    return false;
  }, [userId, authConfigured, onNotify, t]);

  const handleUploadFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files?.length) return;
      if (!requireAuthForUpload() || !userId) return;

      setUploading(true);
      let added = 0;
      let imageAdded = 0;
      try {
        const fileArr = Array.from(files);
        const batchAlbumId =
          fileArr.filter((f) => inferMaterialKindFromFile(f) === 'image').length >= 2
            ? createMaterialId()
            : undefined;
        const next = [...materials];
        for (const file of fileArr) {
          const validation = validateMaterialFile(file);
          if (validation) {
            onNotify(validation);
            continue;
          }
          const kind = inferMaterialKindFromFile(file);
          const id = createMaterialId();
          const storagePath = await uploadMaterialFile(userId, tripId, id, file);
          const now = Date.now();
          next.push({
            id,
            kind,
            title: file.name,
            storagePath,
            mimeType: file.type || undefined,
            fileName: file.name,
            byteSize: file.size,
            day: currentDay,
            albumId: kind === 'image' ? batchAlbumId : undefined,
            createdAt: now,
            updatedAt: now,
          });
          added++;
          if (kind === 'image') imageAdded++;
        }
        if (added > 0) {
          onChange(sortMaterials(next));
          const albumMsg =
            batchAlbumId && imageAdded > 0
              ? t('materials.albumGroupedSuffix', { count: imageAdded })
              : '';
          onNotify(`${t('materials.filesAdded', { count: added })}${albumMsg}`);
        }
      } catch (e) {
        onNotify((e as Error).message || t('materials.uploadFailed'));
      } finally {
        setUploading(false);
      }
    },
    [materials, onChange, tripId, userId, currentDay, requireAuthForUpload, onNotify, t]
  );

  const handleSaveText = useCallback(() => {
    const body = draftText.trim();
    if (!body) {
      onNotify(t('materials.noteEmpty'));
      return;
    }
    const firstLine = body.split('\n').find((l) => l.trim())?.trim() ?? '';
    const now = Date.now();
    const item: TripMaterial = {
      id: createMaterialId(),
      kind: 'text',
      title: firstLine.slice(0, 48) || t('materials.noteDefaultTitle'),
      body,
      day: currentDay,
      createdAt: now,
      updatedAt: now,
    };
    onChange(sortMaterials([item, ...materials]));
    setDraftText('');
    onNotify(t('materials.textSaved'));
  }, [draftText, materials, onChange, currentDay, onNotify, t]);

  const handleDelete = useCallback(
    async (item: TripMaterial) => {
      if (item.storagePath && userId) {
        try {
          await removeMaterialFile(item.storagePath);
        } catch {
          onNotify(t('materials.deleteStorageFailed'));
        }
      }
      onChange(materials.filter((m) => m.id !== item.id));
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (gallery?.ids.includes(item.id)) setGallery(null);
      onNotify(t('materials.deleted'));
    },
    [materials, onChange, userId, gallery, onNotify, t]
  );

  const handleDeleteMany = useCallback(
    async (items: TripMaterial[]) => {
      if (items.length === 0) return;
      for (const item of items) {
        if (item.storagePath && userId) {
          try {
            await removeMaterialFile(item.storagePath);
          } catch {
            /* continue */
          }
        }
      }
      const ids = new Set(items.map((m) => m.id));
      onChange(materials.filter((m) => !ids.has(m.id)));
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      if (gallery?.ids.some((id) => ids.has(id))) setGallery(null);
      onNotify(t('materials.deletedMany', { count: items.length }));
    },
    [materials, onChange, userId, gallery, onNotify, t]
  );

  const patchAlbum = useCallback(
    (albumId: string, patch: Partial<TripMaterial>) => {
      onChange(
        materials.map((m) =>
          m.albumId === albumId ? { ...m, ...patch, updatedAt: Date.now() } : m
        )
      );
    },
    [materials, onChange]
  );

  const handlePlaceLinkAlbum = useCallback(
    (albumId: string, placeId: string) => {
      const pin = pinOptions.find((p) => p.id === placeId);
      if (!placeId) {
        patchAlbum(albumId, {
          pinnedPlaceId: undefined,
          pinnedPlaceName: undefined,
        });
        return;
      }
      patchAlbum(albumId, {
        pinnedPlaceId: placeId,
        pinnedPlaceName: pin?.label.split(' · ').pop(),
        day: pin?.day ?? undefined,
      });
    },
    [patchAlbum, pinOptions]
  );

  const handlePlaceLink = useCallback(
    (materialId: string, placeId: string) => {
      const pin = pinOptions.find((p) => p.id === placeId);
      if (!placeId) {
        patchOne(materialId, {
          pinnedPlaceId: undefined,
          pinnedPlaceName: undefined,
        });
        return;
      }
      patchOne(materialId, {
        pinnedPlaceId: placeId,
        pinnedPlaceName: pin?.label.split(' · ').pop(),
        day: pin?.day ?? undefined,
      });
    },
    [patchOne, pinOptions]
  );

  const setViewModePersist = (mode: ViewMode) => {
    setViewMode(mode);
    writeViewMode(mode);
  };

  const onDropZoneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  };

  const onDropZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragOver(false);
    }
  };

  const onDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragOver(false);
    void handleUploadFiles(e.dataTransfer.files);
  };

  if (!open) return null;

  const uploadHint = userId
    ? t('materials.dropHint')
    : authConfigured
      ? t('materials.dropHintNeedLogin')
      : t('materials.dropHintNeedSupabase');

  return (
    <>
      <aside
        className="materials-panel open"
        aria-label={t('materials.panelTitle')}
        /* 드롭 영역이 패널 전체다 — 전용 드롭존 상자를 없앤 자리를 대신한다.
           끄는 동안에만 오버레이가 떠서, 평소에는 목록이 그 공간을 쓴다. */
        onDragEnter={onDropZoneDragEnter}
        onDragLeave={onDropZoneDragLeave}
        onDragOver={onDropZoneDragOver}
        onDrop={onDropZoneDrop}
      >
        <header className="materials-head">
          <div className="materials-head-text">
            <div className="materials-head-title">{t('materials.panelTitle')}</div>
            <div className="materials-head-sub">
              {tripTitle} · {t('materials.countSuffix', { count: materials.length })}
            </div>
          </div>
          <div className="materials-head-actions">
            <button
              type="button"
              className="materials-head-btn"
              onClick={() => setViewModePersist(viewMode === 'grid' ? 'list' : 'grid')}
              aria-label={viewMode === 'grid' ? t('materials.viewList') : t('materials.viewGrid')}
              title={viewMode === 'grid' ? t('materials.viewList') : t('materials.viewGrid')}
            >
              <Icon name={viewMode === 'grid' ? 'layoutList' : 'layoutGrid'} size={17} />
            </button>
            <MaterialsExportMenu
              tripTitle={tripTitle}
              materials={materials}
              onNotify={onNotify}
              iconOnly
            />
            <button
              type="button"
              className="materials-head-btn"
              onClick={onClose}
              aria-label={t('materials.closePanel')}
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        </header>

        {/* 드롭존·메모창·저장 3층을 한 줄로. 메모는 누를 때만 펼친다. */}
        <div className="materials-add-row">
          <button
            type="button"
            className="materials-add-btn"
            disabled={uploading}
            onClick={() => {
              if (requireAuthForUpload()) fileInputRef.current?.click();
            }}
          >
            {uploading ? <Icon name="loader" size={15} spin /> : <Icon name="upload" size={15} />}
            {uploading ? t('materials.uploading') : t('materials.addPhotoFile')}
          </button>
          <button
            type="button"
            className={`materials-add-btn${composingNote ? ' active' : ''}`}
            onClick={() => setComposingNote((v) => !v)}
            aria-expanded={composingNote}
          >
            <Icon name="pencil" size={15} />
            {t('materials.writeNote')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="materials-file-input"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.hwp"
          multiple
          onChange={(e) => {
            void handleUploadFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {composingNote && (
          <div className="materials-note-compose">
            <textarea
              className="materials-draft-text"
              value={draftText}
              autoFocus
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={t('materials.notePlaceholder')}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setComposingNote(false);
                  return;
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSaveText();
                  setComposingNote(false);
                }
              }}
            />
            <div className="materials-note-compose-actions">
              <button
                type="button"
                className="materials-note-cancel"
                onClick={() => {
                  setDraftText('');
                  setComposingNote(false);
                }}
              >
                {tc('cancel')}
              </button>
              <button
                type="button"
                className="materials-note-save"
                disabled={!draftText.trim()}
                title={t('materials.saveShortcutHint')}
                onClick={() => {
                  handleSaveText();
                  setComposingNote(false);
                }}
              >
                {tc('save')}
              </button>
            </div>
          </div>
        )}

        {dragOver && (
          <div className="materials-drop-overlay" aria-hidden>
            <Icon name="upload" size={26} />
            <span>{uploadHint}</span>
          </div>
        )}

        {/* 칩 8개가 두 줄로 접히던 자리 — 세그먼트 하나와 메뉴 둘로 줄였다.
            일차는 여행 길이만큼 늘어나므로 칩으로 두면 언제든 다시 넘친다. */}
        <div className="materials-filterbar">
          <div className="materials-seg" role="group" aria-label={t('materials.kindFilterAria')}>
            {(
              [
                ['all', t('materials.kindAll')],
                ['image', t('materials.kindImage')],
                ['text', t('materials.kindNote')],
                ['file', t('materials.kindFile')],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`materials-seg-btn${kindFilter === k ? ' active' : ''}`}
                aria-pressed={kindFilter === k}
                onClick={() => setKindFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="materials-filter-menus">
            <FilterMenu
              label={t('materials.dayFilterLabel')}
              activeLabel={dayFilter != null ? t('table.dayLabel', { day: dayFilter }) : null}
              options={[
                { value: '', label: t('materials.allDays') },
                ...Array.from({ length: totalDays }, (_, i) => ({
                  value: String(i + 1),
                  label: t('table.dayLabel', { day: i + 1 }),
                })),
              ]}
              value={dayFilter != null ? String(dayFilter) : ''}
              onSelect={(v) => setDayFilter(v ? Number(v) : null)}
            />
            {pinOptions.length > 0 && (
              <FilterMenu
                label={t('materials.placeFilterLabel')}
                activeLabel={
                  placeFilter
                    ? (pinOptions.find((p) => p.id === placeFilter)?.label.split(' · ').pop() ??
                      t('materials.place'))
                    : null
                }
                options={[
                  { value: '', label: t('materials.allPlaces') },
                  ...pinOptions.map((p) => ({ value: p.id, label: p.label })),
                ]}
                value={placeFilter ?? ''}
                onSelect={(v) => setPlaceFilter(v || null)}
              />
            )}
          </div>
        </div>

        <div className="materials-panel-body">
          {displayItems.length === 0 ? (
            <p className="materials-empty">
              {materials.length === 0
                ? t('materials.emptyNoMaterials')
                : t('materials.emptyFiltered')}
            </p>
          ) : viewMode === 'grid' ? (
            <div className="materials-grid materials-grid--large" role="list">
              {displayItems.map((item) => (
                <DisplayGridItem
                  key={item.type === 'album' ? `album-${item.albumId}` : item.material.id}
                  item={item}
                  signedUrls={signedUrls}
                  totalDays={totalDays}
                  pinOptions={pinOptions}
                  onPatch={patchOne}
                  onPatchAlbum={patchAlbum}
                  onPlaceLink={handlePlaceLink}
                  onPlaceLinkAlbum={handlePlaceLinkAlbum}
                  onDelete={(m) => void handleDelete(m)}
                  onDeleteAlbum={(ms) => void handleDeleteMany(ms)}
                  onOpenGallery={openGallery}
                  authorOf={authorOf}
                />
              ))}
            </div>
          ) : (
            <div className="materials-list" role="list">
              {displayItems.map((item) => (
                <DisplayListItem
                  key={item.type === 'album' ? `album-${item.albumId}` : item.material.id}
                  item={item}
                  signedUrls={signedUrls}
                  totalDays={totalDays}
                  pinOptions={pinOptions}
                  onPatch={patchOne}
                  onPatchAlbum={patchAlbum}
                  onPlaceLink={handlePlaceLink}
                  onPlaceLinkAlbum={handlePlaceLinkAlbum}
                  onDelete={(m) => void handleDelete(m)}
                  onDeleteAlbum={(ms) => void handleDeleteMany(ms)}
                  onOpenGallery={openGallery}
                  authorOf={authorOf}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {gallery && galleryMaterials.length > 0 && (
        <MaterialsPhotoGallery
          materials={galleryMaterials}
          index={gallery.index}
          signedUrls={signedUrls}
          onClose={() => setGallery(null)}
          onIndexChange={(index) => setGallery((g) => (g ? { ...g, index } : null))}
        />
      )}
    </>
  );
}

interface DisplayItemProps {
  item: MaterialDisplayItem;
  signedUrls: Record<string, string>;
  totalDays: number;
  pinOptions: PinOption[];
  onPatch: (id: string, patch: Partial<TripMaterial>) => void;
  onPatchAlbum: (albumId: string, patch: Partial<TripMaterial>) => void;
  onPlaceLink: (materialId: string, placeId: string) => void;
  onPlaceLinkAlbum: (albumId: string, placeId: string) => void;
  onDelete: (m: TripMaterial) => void;
  onDeleteAlbum: (materials: TripMaterial[]) => void;
  onOpenGallery: (ids: string[], startIndex?: number) => void;
  /** 남이 올린 자료면 그 이메일, 내 것이거나 모르면 null */
  authorOf: (m: TripMaterial) => string | null;
}

function DisplayGridItem({
  item,
  signedUrls,
  totalDays,
  pinOptions,
  onPatch,
  onPatchAlbum,
  onPlaceLink,
  onPlaceLinkAlbum,
  onDelete,
  onDeleteAlbum,
  onOpenGallery,
  authorOf,
}: DisplayItemProps) {
  if (item.type === 'album') {
    const rep = item.materials[0]!;
    return (
      <div className="materials-card materials-card--album" role="listitem">
        <ImageAlbumStack
          materials={item.materials}
          signedUrls={signedUrls}
          variant="grid"
          onOpen={() =>
            onOpenGallery(
              item.materials.map((m) => m.id),
              0
            )
          }
        />
        {authorOf(rep) && <MaterialAuthorBadge email={authorOf(rep)!} />}
        <MaterialMetaMenu
          material={rep}
          totalDays={totalDays}
          pinOptions={pinOptions}
          onPatch={(patch: Partial<TripMaterial>) => onPatchAlbum(item.albumId, patch)}
          onPlaceLink={(pid: string) => onPlaceLinkAlbum(item.albumId, pid)}
          onDelete={() => onDeleteAlbum(item.materials)}
        />
        <div className="materials-card-caption" title={albumDisplayTitle(item.materials)}>
          {albumDisplayTitle(item.materials)}
        </div>
        <div className="materials-card-meta">{materialMetaLabel(rep)}</div>
      </div>
    );
  }

  return (
    <MaterialGridCard
      material={item.material}
      signedUrl={signedUrls[item.material.id]}
      totalDays={totalDays}
      pinOptions={pinOptions}
      authorEmail={authorOf(item.material)}
      onPatch={(patch) => onPatch(item.material.id, patch)}
      onPlaceLink={(pid) => onPlaceLink(item.material.id, pid)}
      onDelete={() => onDelete(item.material)}
      onImageOpen={() =>
        item.material.kind === 'image' &&
        onOpenGallery([item.material.id], 0)
      }
    />
  );
}

function DisplayListItem(props: DisplayItemProps) {
  const { item, signedUrls, totalDays, pinOptions, onPatch, onPatchAlbum, onPlaceLink, onPlaceLinkAlbum, onDelete, onDeleteAlbum, onOpenGallery, authorOf } = props;
  const { t } = useTranslation('planner');

  if (item.type === 'album') {
    const rep = item.materials[0]!;
    return (
      <article className="materials-list-row materials-list-row--album" role="listitem">
        <div className="materials-list-main">
          <ImageAlbumStack
            materials={item.materials}
            signedUrls={signedUrls}
            variant="list"
            onOpen={() =>
              onOpenGallery(
                item.materials.map((m) => m.id),
                0
              )
            }
          />
          <div className="materials-list-body">
            <div className="materials-list-title-static">{albumDisplayTitle(item.materials)}</div>
            <div className="materials-card-meta">
              {materialMetaLabel(rep)} · {t('materials.tapToViewAll')}
            </div>
          </div>
          {authorOf(rep) && <MaterialAuthorBadge email={authorOf(rep)!} />}
          <MaterialMetaMenu
            material={rep}
            totalDays={totalDays}
            pinOptions={pinOptions}
            onPatch={(patch: Partial<TripMaterial>) => onPatchAlbum(item.albumId, patch)}
            onPlaceLink={(pid: string) => onPlaceLinkAlbum(item.albumId, pid)}
            onDelete={() => onDeleteAlbum(item.materials)}
          />
        </div>
      </article>
    );
  }

  return (
    <MaterialListRow
      material={item.material}
      signedUrl={signedUrls[item.material.id]}
      totalDays={totalDays}
      pinOptions={pinOptions}
      authorEmail={authorOf(item.material)}
      onPatch={(patch) => onPatch(item.material.id, patch)}
      onPlaceLink={(pid) => onPlaceLink(item.material.id, pid)}
      onDelete={() => onDelete(item.material)}
      onImageOpen={() =>
        item.material.kind === 'image' &&
        onOpenGallery([item.material.id], 0)
      }
    />
  );
}

function ImageAlbumStack({
  materials,
  signedUrls,
  variant,
  onOpen,
}: {
  materials: TripMaterial[];
  signedUrls: Record<string, string>;
  variant: 'grid' | 'list';
  onOpen: () => void;
}) {
  const { t } = useTranslation('planner');
  const layers = materials.slice(0, 3);
  const stackLayers = [...layers].reverse();

  return (
    <button
      type="button"
      className={`materials-album-stack materials-album-stack--${variant}`}
      onClick={onOpen}
      aria-label={t('materials.viewPhotosAria', { count: materials.length })}
    >
      <span className="materials-album-stack-inner">
        {stackLayers.map((m, i) => (
          <span
            key={m.id}
            className="materials-album-layer"
            style={{ '--stack-i': i } as CSSProperties}
          >
            {signedUrls[m.id] ? (
              <img src={signedUrls[m.id]} alt="" />
            ) : (
              <span className="materials-thumb-placeholder">
                <Icon name="photo" />
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="materials-album-folder-badge" aria-hidden>
        <Icon name="folder" />
      </span>
      <span className="materials-album-count">{materials.length}</span>
    </button>
  );
}

/**
 * 필터 메뉴 — 칩이 늘어나는 자리를 대신한다.
 *
 * OS 기본 `<select>` 를 쓰지 않는다. 패널 안의 다른 컨트롤과 유일하게 생김새가
 * 달라서 "장소" 필터만 튀어 보였다.
 */
function FilterMenu({
  label,
  activeLabel,
  options,
  value,
  onSelect,
}: {
  label: string;
  activeLabel: string | null;
  options: Array<{ value: string; label: string }>;
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="materials-filter-menu" ref={ref}>
      <button
        type="button"
        className={`materials-filter-menu-btn${activeLabel ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {activeLabel ?? label}
        <Icon name="chevronDown" size={11} />
      </button>
      {open && (
        <div className="materials-filter-menu-pop" role="menu">
          {options.map((o) => (
            <button
              key={o.value || '__all'}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className={o.value === value ? 'active' : ''}
              onClick={() => {
                onSelect(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 공유받은 자료 배지 — 남이 올린 것에만 붙는다(§22).
 * 색·이니셜 규칙은 핀 작성자 배지·presence 아바타와 같다.
 */
function MaterialAuthorBadge({ email }: { email: string }) {
  const { t } = useTranslation('planner');
  const label = t('materials.uploadedBy', { email });
  return (
    <span
      className="material-author-badge"
      style={{ background: presenceColor(email) }}
      title={label}
      aria-label={label}
    >
      {presenceInitial(email)}
    </span>
  );
}

function materialMetaLabel(material: TripMaterial): string {
  const day = material.day
    ? i18n.t('table.dayLabel', { ns: 'planner', day: material.day })
    : i18n.t('materials.noDay', { ns: 'planner' });
  return `${day} · ${material.pinnedPlaceName ?? i18n.t('materials.noPlace', { ns: 'planner' })}`;
}

/**
 * 카드 위 "더보기" — 일차·장소 셀렉트와 삭제를 여기로 넣었다.
 *
 * 전에는 카드마다 셀렉트 2개와 휴지통이 그대로 놓여 있어 조작 3개가 사진보다
 * 눈에 띄었다. 기능은 그대로 두고 자리만 옮긴다.
 */
function MaterialMetaMenu({
  material,
  totalDays,
  pinOptions,
  onPatch,
  onPlaceLink,
  onDelete,
}: {
  material: TripMaterial;
  totalDays: number;
  pinOptions: PinOption[];
  onPatch: (patch: Partial<TripMaterial>) => void;
  onPlaceLink: (placeId: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('planner');
  const { t: tc } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="materials-card-menu" ref={ref}>
      <button
        type="button"
        className="materials-card-menu-btn"
        aria-label={t('materials.settingsAria')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="more" size={15} />
      </button>
      {open && (
        <div className="materials-card-menu-pop" onClick={(e) => e.stopPropagation()}>
          <label className="materials-card-menu-field">
            <span>{t('materials.dayFilterLabel')}</span>
            <select
              value={material.day ?? ''}
              onChange={(e) =>
                onPatch({ day: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">{t('materials.noDay')}</option>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {t('table.dayLabel', { day: d })}
                </option>
              ))}
            </select>
          </label>
          <label className="materials-card-menu-field">
            <span>{t('materials.placeFilterLabel')}</span>
            <select
              value={material.pinnedPlaceId ?? ''}
              onChange={(e) => onPlaceLink(e.target.value)}
            >
              <option value="">{t('materials.noPlace')}</option>
              {pinOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="materials-card-menu-delete"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Icon name="trash" size={14} />
            {tc('delete')}
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialGridCard({
  material,
  signedUrl,
  totalDays,
  pinOptions,
  authorEmail,
  onPatch,
  onPlaceLink,
  onDelete,
  onImageOpen,
}: {
  material: TripMaterial;
  signedUrl?: string;
  totalDays: number;
  pinOptions: PinOption[];
  authorEmail: string | null;
  onPatch: (patch: Partial<TripMaterial>) => void;
  onPlaceLink: (placeId: string) => void;
  onDelete: () => void;
  onImageOpen: () => void;
}) {
  const { t } = useTranslation('planner');
  const overlay = (
    <>
      {authorEmail && <MaterialAuthorBadge email={authorEmail} />}
      <MaterialMetaMenu
        material={material}
        totalDays={totalDays}
        pinOptions={pinOptions}
        onPatch={onPatch}
        onPlaceLink={onPlaceLink}
        onDelete={onDelete}
      />
    </>
  );

  if (material.kind === 'text') {
    return (
      <article className="materials-card materials-card--text" role="listitem">
        {overlay}
        <input
          className="materials-text-title"
          value={material.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label={t('materials.titleAria')}
        />
        <textarea
          className="materials-text-body materials-text-body--compact"
          value={material.body ?? ''}
          rows={3}
          onChange={(e) => onPatch({ body: e.target.value })}
          aria-label={t('materials.bodyAria')}
        />
        <div className="materials-card-meta">{materialMetaLabel(material)}</div>
      </article>
    );
  }

  if (material.kind === 'image') {
    return (
      <div className="materials-card materials-card--image" role="listitem">
        <button
          type="button"
          className="materials-thumb-btn materials-thumb-btn--large"
          onClick={onImageOpen}
        >
          {signedUrl ? (
            <img src={signedUrl} alt={material.title} />
          ) : (
            <span className="materials-thumb-placeholder">
              <Icon name="photo" />
            </span>
          )}
        </button>
        {overlay}
        <div className="materials-card-caption" title={material.title}>
          {material.title}
        </div>
        <div className="materials-card-meta">{materialMetaLabel(material)}</div>
      </div>
    );
  }

  return (
    <div className="materials-card materials-card--file" role="listitem">
      <div className="materials-grid-file-icon">
        <Icon name="file" />
        {material.byteSize != null && (
          <span className="materials-file-size">{formatByteSize(material.byteSize)}</span>
        )}
      </div>
      {overlay}
      <div className="materials-card-caption" title={material.fileName ?? material.title}>
        {material.fileName ?? material.title}
      </div>
      <div className="materials-card-meta">
        {materialMetaLabel(material)}
        {signedUrl && (
          <>
            {' · '}
            <a
              className="materials-file-download"
              href={signedUrl}
              download={material.fileName ?? material.title}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t('materials.download')}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function MaterialListRow({
  material,
  signedUrl,
  totalDays,
  pinOptions,
  authorEmail,
  onPatch,
  onPlaceLink,
  onDelete,
  onImageOpen,
}: {
  material: TripMaterial;
  signedUrl?: string;
  totalDays: number;
  pinOptions: PinOption[];
  authorEmail: string | null;
  onPatch: (patch: Partial<TripMaterial>) => void;
  onPlaceLink: (placeId: string) => void;
  onDelete: () => void;
  onImageOpen: () => void;
}) {
  const { t } = useTranslation('planner');
  const kindIcon =
    material.kind === 'image' ? 'photo' : material.kind === 'file' ? 'file' : 'note';

  return (
    <article className="materials-list-row" role="listitem">
      <div className="materials-list-main">
        <div className="materials-list-lead">
          {material.kind === 'image' ? (
            <button type="button" className="materials-list-thumb" onClick={onImageOpen}>
              {signedUrl ? <img src={signedUrl} alt="" /> : <Icon name="photo" />}
            </button>
          ) : (
            <div className="materials-list-kind-icon" aria-hidden>
              <Icon name={kindIcon} />
            </div>
          )}
          {authorEmail && <MaterialAuthorBadge email={authorEmail} />}
        </div>
        <div className="materials-list-body">
          {material.kind === 'text' ? (
            <>
              <input
                className="materials-list-title"
                value={material.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                aria-label={t('materials.titleAria')}
              />
              <textarea
                className="materials-text-body materials-text-body--compact"
                value={material.body ?? ''}
                rows={2}
                onChange={(e) => onPatch({ body: e.target.value })}
                aria-label={t('materials.bodyAria')}
              />
            </>
          ) : (
            <div className="materials-list-title-static">
              {material.fileName ?? material.title}
            </div>
          )}
          <div className="materials-card-meta">
            {materialMetaLabel(material)}
            {material.byteSize != null && ` · ${formatByteSize(material.byteSize)}`}
            {material.kind === 'file' && signedUrl && (
              <>
                {' · '}
                <a
                  className="materials-file-download"
                  href={signedUrl}
                  download={material.fileName ?? material.title}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('materials.download')}
                </a>
              </>
            )}
          </div>
        </div>
        <MaterialMetaMenu
          material={material}
          totalDays={totalDays}
          pinOptions={pinOptions}
          onPatch={onPatch}
          onPlaceLink={onPlaceLink}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}
