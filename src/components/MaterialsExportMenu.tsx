import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { TripMaterial } from '../types';
import {
  copyMaterialsToClipboard,
  exportMaterials,
  type MaterialsExportFormat,
} from '../lib/exportMaterials';

interface Props {
  tripTitle: string;
  materials: TripMaterial[];
  onNotify?: (message: string) => void;
  label?: string;
  /** 아이콘만 보여준다 — 좁은 패널 헤더용. 라벨은 aria-label 로 남는다. */
  iconOnly?: boolean;
}

export function MaterialsExportMenu({
  tripTitle,
  materials,
  onNotify,
  label = '보내기',
  iconOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const ctx = { tripTitle, materials };

  async function runExport(format: MaterialsExportFormat) {
    const title = tripTitle.trim() || '여행';
    if (format === 'text') {
      const copied = await copyMaterialsToClipboard(ctx);
      if (copied) {
        onNotify?.(`「${title}」 자료를 복사했습니다`);
      } else {
        exportMaterials(ctx, 'text');
        onNotify?.(`「${title}」 자료 텍스트 파일을 저장했습니다`);
      }
    } else {
      exportMaterials(ctx, format);
      const formatLabel = format === 'csv' ? 'CSV' : 'JSON';
      onNotify?.(`「${title}」 자료 ${formatLabel} 파일을 저장했습니다`);
    }
    setOpen(false);
  }

  return (
    <div className="materials-export-menu" ref={rootRef}>
      <button
        type="button"
        className={`materials-export-btn${iconOnly ? ' icon-only' : ''} ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        <Icon name="download" size={iconOnly ? 17 : 20} />
        {!iconOnly && label}
      </button>

      {open && (
        <div className="materials-export-dropdown" role="menu">
          <p className="materials-export-trip">{tripTitle.trim() || '여행'}</p>
          <button type="button" role="menuitem" onClick={() => void runExport('text')}>
            텍스트 복사 / 저장
          </button>
          <button type="button" role="menuitem" onClick={() => runExport('csv')}>
            CSV 저장
          </button>
          <button type="button" role="menuitem" onClick={() => runExport('json')}>
            JSON 저장
          </button>
        </div>
      )}
    </div>
  );
}
