import { Icon } from './Icon';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { MaterialsPhotoGallery } from './MaterialsPhotoGallery';
import {
  albumDisplayTitle,
  buildMaterialDisplayItems,
  type MaterialDisplayItem,
} from '../lib/materialAlbums';

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
}: Props) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [placeFilter, setPlaceFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [gallery, setGallery] = useState<{ ids: string[]; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const pinOptions = useMemo((): PinOption[] => {
    const out: PinOption[] = [];
    for (let d = 1; d <= totalDays; d++) {
      for (const p of pinnedByDay[d] ?? []) {
        out.push({ id: p.id, label: `${d}일 · ${p.name}`, day: d });
      }
    }
    return out;
  }, [pinnedByDay, totalDays]);

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
      onNotify('사진·파일은 클라우드 로그인 후 업로드할 수 있습니다.');
    } else {
      onNotify('사진·파일 업로드는 Supabase 설정이 필요합니다.');
    }
    return false;
  }, [userId, authConfigured, onNotify]);

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
              ? ` (사진 ${imageAdded}장을 한 묶음으로 표시)`
              : '';
          onNotify(`${added}개 파일을 추가했습니다.${albumMsg}`);
        }
      } catch (e) {
        onNotify((e as Error).message || '업로드에 실패했습니다.');
      } finally {
        setUploading(false);
      }
    },
    [materials, onChange, tripId, userId, currentDay, requireAuthForUpload, onNotify]
  );

  const handleSaveText = useCallback(() => {
    const body = draftText.trim();
    if (!body) {
      onNotify('저장할 내용을 입력해 주세요.');
      return;
    }
    const firstLine = body.split('\n').find((l) => l.trim())?.trim() ?? '';
    const now = Date.now();
    const item: TripMaterial = {
      id: createMaterialId(),
      kind: 'text',
      title: firstLine.slice(0, 48) || '메모',
      body,
      day: currentDay,
      createdAt: now,
      updatedAt: now,
    };
    onChange(sortMaterials([item, ...materials]));
    setDraftText('');
    onNotify('텍스트를 저장했습니다.');
  }, [draftText, materials, onChange, currentDay, onNotify]);

  const handleDelete = useCallback(
    async (item: TripMaterial) => {
      if (item.storagePath && userId) {
        try {
          await removeMaterialFile(item.storagePath);
        } catch {
          onNotify('저장소 파일 삭제에 실패했습니다. 목록만 제거합니다.');
        }
      }
      onChange(materials.filter((m) => m.id !== item.id));
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (gallery?.ids.includes(item.id)) setGallery(null);
      onNotify('자료를 삭제했습니다.');
    },
    [materials, onChange, userId, gallery, onNotify]
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
      onNotify(`${items.length}개 자료를 삭제했습니다.`);
    },
    [materials, onChange, userId, gallery, onNotify]
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
    ? '사진·문서 파일을 끌어다 놓거나 클릭하세요'
    : authConfigured
      ? '로그인 후 사진·파일을 끌어다 놓을 수 있습니다'
      : '클라우드 설정 후 사진·파일을 추가할 수 있습니다';

  return (
    <>
      <aside className="materials-panel open" aria-label="여행 자료">
        <header className="route-panel-header materials-panel-header">
          <div>
            <div className="panel-title">
              <Icon name="folder" />
              <span>여행 자료</span>
            </div>
            <div className="panel-subtitle">
              {tripTitle} · {materials.length}개
            </div>
          </div>
          <MaterialsExportMenu
            tripTitle={tripTitle}
            materials={materials}
            onNotify={onNotify}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="패널 닫기">
            <Icon name="close" />
          </button>
        </header>

        <div className="materials-compose">
          <div
            className={`materials-dropzone${dragOver ? ' drag-over' : ''}${uploading ? ' uploading' : ''}`}
            onDragEnter={onDropZoneDragEnter}
            onDragLeave={onDropZoneDragLeave}
            onDragOver={onDropZoneDragOver}
            onDrop={onDropZoneDrop}
            onClick={() => {
              if (requireAuthForUpload()) fileInputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (requireAuthForUpload()) fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="파일 추가"
          >
            <Icon name="upload" />
            <span className="materials-dropzone-label">
              {uploading ? '업로드 중…' : uploadHint}
            </span>
            {uploading && <Icon name="loader" spin />}
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

          <div className="materials-text-compose">
            <textarea
              className="materials-draft-text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="메모·일정 메모를 입력하고 저장하세요…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSaveText();
                }
              }}
            />
            <button
              type="button"
              className="materials-text-save-btn"
              disabled={!draftText.trim()}
              onClick={handleSaveText}
            >
              <Icon name="save" /> 저장
            </button>
          </div>
        </div>

        <div className="materials-filters" role="group" aria-label="자료 필터">
          <div className="materials-view-toggle" role="group" aria-label="보기 방식">
            <button
              type="button"
              className={`materials-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              title="큰 아이콘"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewModePersist('grid')}
            >
              <Icon name="layoutGrid" />
            </button>
            <button
              type="button"
              className={`materials-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="목록"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewModePersist('list')}
            >
              <Icon name="layoutList" />
            </button>
          </div>
          {(
            [
              ['all', '전체'],
              ['text', '텍스트'],
              ['image', '사진'],
              ['file', '파일'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`materials-filter-chip ${kindFilter === k ? 'active' : ''}`}
              onClick={() => setKindFilter(k)}
            >
              {label}
            </button>
          ))}
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
            <button
              key={`day-${d}`}
              type="button"
              className={`materials-filter-chip ${dayFilter === d ? 'active' : ''}`}
              onClick={() => setDayFilter(dayFilter === d ? null : d)}
            >
              {d}일차
            </button>
          ))}
          {pinOptions.length > 0 && (
            <select
              className="materials-place-filter"
              value={placeFilter ?? ''}
              onChange={(e) => setPlaceFilter(e.target.value || null)}
              aria-label="장소 필터"
            >
              <option value="">모든 장소</option>
              {pinOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="materials-panel-body">
          {displayItems.length === 0 ? (
            <p className="materials-empty">
              {materials.length === 0
                ? '위에서 파일을 끌어오거나 텍스트를 저장해 보세요.'
                : '필터에 맞는 자료가 없습니다.'}
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
}: DisplayItemProps) {
  if (item.type === 'album') {
    const rep = item.materials[0]!;
    return (
      <div className="materials-grid-card materials-grid-card--album" role="listitem">
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
        <div className="materials-grid-caption" title={albumDisplayTitle(item.materials)}>
          {albumDisplayTitle(item.materials)}
        </div>
        <MaterialMetaRow
          material={rep}
          totalDays={totalDays}
          pinOptions={pinOptions}
          onPatch={(patch) => onPatchAlbum(item.albumId, patch)}
          onPlaceLink={(pid) => onPlaceLinkAlbum(item.albumId, pid)}
          onDelete={() => onDeleteAlbum(item.materials)}
          compact
        />
      </div>
    );
  }

  return (
    <MaterialGridCard
      material={item.material}
      signedUrl={signedUrls[item.material.id]}
      totalDays={totalDays}
      pinOptions={pinOptions}
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
  const { item, signedUrls, totalDays, pinOptions, onPatch, onPatchAlbum, onPlaceLink, onPlaceLinkAlbum, onDelete, onDeleteAlbum, onOpenGallery } = props;

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
            <div className="materials-album-hint">탭하여 사진 모두 보기</div>
          </div>
        </div>
        <MaterialMetaRow
          material={rep}
          totalDays={totalDays}
          pinOptions={pinOptions}
          onPatch={(patch) => onPatchAlbum(item.albumId, patch)}
          onPlaceLink={(pid) => onPlaceLinkAlbum(item.albumId, pid)}
          onDelete={() => onDeleteAlbum(item.materials)}
          compact
        />
      </article>
    );
  }

  return (
    <MaterialListRow
      material={item.material}
      signedUrl={signedUrls[item.material.id]}
      totalDays={totalDays}
      pinOptions={pinOptions}
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
  const layers = materials.slice(0, 3);
  const stackLayers = [...layers].reverse();

  return (
    <button
      type="button"
      className={`materials-album-stack materials-album-stack--${variant}`}
      onClick={onOpen}
      aria-label={`${materials.length}장 사진 보기`}
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

function MaterialMetaRow({
  material,
  totalDays,
  pinOptions,
  onPatch,
  onPlaceLink,
  onDelete,
  compact,
}: {
  material: TripMaterial;
  totalDays: number;
  pinOptions: PinOption[];
  onPatch: (patch: Partial<TripMaterial>) => void;
  onPlaceLink: (placeId: string) => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`materials-meta${compact ? ' materials-meta--compact' : ''}`}>
      <select
        className="materials-meta-select"
        value={material.day ?? ''}
        onChange={(e) =>
          onPatch({
            day: e.target.value ? Number(e.target.value) : undefined,
          })
        }
        aria-label="일차"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">일차 없음</option>
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}일차
          </option>
        ))}
      </select>
      <select
        className="materials-meta-select"
        value={material.pinnedPlaceId ?? ''}
        onChange={(e) => onPlaceLink(e.target.value)}
        aria-label="연결 장소"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">장소 없음</option>
        {pinOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="materials-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="삭제"
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

function MaterialGridCard({
  material,
  signedUrl,
  totalDays,
  pinOptions,
  onPatch,
  onPlaceLink,
  onDelete,
  onImageOpen,
}: {
  material: TripMaterial;
  signedUrl?: string;
  totalDays: number;
  pinOptions: PinOption[];
  onPatch: (patch: Partial<TripMaterial>) => void;
  onPlaceLink: (placeId: string) => void;
  onDelete: () => void;
  onImageOpen: () => void;
}) {
  if (material.kind === 'text') {
    return (
      <article className="materials-grid-card materials-grid-card--text" role="listitem">
        <div className="materials-grid-text-icon">
          <Icon name="note" />
        </div>
        <input
          className="materials-text-title"
          value={material.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label="제목"
        />
        <textarea
          className="materials-text-body materials-text-body--compact"
          value={material.body ?? ''}
          rows={3}
          onChange={(e) => onPatch({ body: e.target.value })}
          aria-label="내용"
        />
        <MaterialMetaRow
          material={material}
          totalDays={totalDays}
          pinOptions={pinOptions}
          onPatch={onPatch}
          onPlaceLink={onPlaceLink}
          onDelete={onDelete}
          compact
        />
      </article>
    );
  }

  if (material.kind === 'image') {
    return (
      <div className="materials-grid-card materials-grid-card--image" role="listitem">
        <button type="button" className="materials-thumb-btn materials-thumb-btn--large" onClick={onImageOpen}>
          {signedUrl ? (
            <img src={signedUrl} alt={material.title} />
          ) : (
            <span className="materials-thumb-placeholder">
              <Icon name="photo" />
            </span>
          )}
        </button>
        <div className="materials-grid-caption" title={material.title}>
          {material.title}
        </div>
        <MaterialMetaRow
          material={material}
          totalDays={totalDays}
          pinOptions={pinOptions}
          onPatch={onPatch}
          onPlaceLink={onPlaceLink}
          onDelete={onDelete}
          compact
        />
      </div>
    );
  }

  return (
    <div className="materials-grid-card materials-grid-card--file" role="listitem">
      <div className="materials-grid-file-icon">
        <Icon name="file" />
      </div>
      <div className="materials-grid-caption" title={material.fileName ?? material.title}>
        {material.fileName ?? material.title}
      </div>
      {material.byteSize != null && (
        <div className="materials-file-size">{formatByteSize(material.byteSize)}</div>
      )}
      {signedUrl && (
        <a
          className="materials-file-download"
          href={signedUrl}
          download={material.fileName ?? material.title}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          다운로드
        </a>
      )}
      <MaterialMetaRow
        material={material}
        totalDays={totalDays}
        pinOptions={pinOptions}
        onPatch={onPatch}
        onPlaceLink={onPlaceLink}
        onDelete={onDelete}
        compact
      />
    </div>
  );
}

function MaterialListRow({
  material,
  signedUrl,
  totalDays,
  pinOptions,
  onPatch,
  onPlaceLink,
  onDelete,
  onImageOpen,
}: {
  material: TripMaterial;
  signedUrl?: string;
  totalDays: number;
  pinOptions: PinOption[];
  onPatch: (patch: Partial<TripMaterial>) => void;
  onPlaceLink: (placeId: string) => void;
  onDelete: () => void;
  onImageOpen: () => void;
}) {
  const kindIcon =
    material.kind === 'image' ? 'photo' : material.kind === 'file' ? 'file' : 'note';

  return (
    <article className="materials-list-row" role="listitem">
      <div className="materials-list-main">
        {material.kind === 'image' ? (
          <button type="button" className="materials-list-thumb" onClick={onImageOpen}>
            {signedUrl ? (
              <img src={signedUrl} alt="" />
            ) : (
              <Icon name="photo" />
            )}
          </button>
        ) : (
          <div className="materials-list-kind-icon" aria-hidden>
            <Icon name={kindIcon} />
          </div>
        )}
        <div className="materials-list-body">
          {material.kind === 'text' ? (
            <>
              <input
                className="materials-list-title"
                value={material.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                aria-label="제목"
              />
              <textarea
                className="materials-text-body materials-text-body--compact"
                value={material.body ?? ''}
                rows={2}
                onChange={(e) => onPatch({ body: e.target.value })}
                aria-label="내용"
              />
            </>
          ) : (
            <>
              <div className="materials-list-title-static">{material.fileName ?? material.title}</div>
              {material.byteSize != null && (
                <div className="materials-file-size">{formatByteSize(material.byteSize)}</div>
              )}
              {material.kind === 'file' && signedUrl && (
                <a
                  className="materials-file-download"
                  href={signedUrl}
                  download={material.fileName ?? material.title}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  다운로드
                </a>
              )}
            </>
          )}
        </div>
      </div>
      <MaterialMetaRow
        material={material}
        totalDays={totalDays}
        pinOptions={pinOptions}
        onPatch={onPatch}
        onPlaceLink={onPlaceLink}
        onDelete={onDelete}
        compact
      />
    </article>
  );
}
