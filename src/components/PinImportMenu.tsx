import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PinnedPlace } from '../types';
import {
  type PinImportMode,
  type PinImportResult,
  type PinImportScope,
  PinImportError,
  parseImportFile,
} from '../lib/importPins';

interface Props {
  currentDay: number;
  totalDays: number;
  pinnedByDay: Record<number, PinnedPlace[]>;
  onImport: (result: PinImportResult) => void;
  onNotify?: (message: string) => void;
  label?: string;
}

type PendingImport = {
  scope: PinImportScope;
  mode: PinImportMode;
};

export function PinImportMenu({
  currentDay,
  totalDays,
  pinnedByDay,
  onImport,
  onNotify,
  label,
}: Props) {
  const { t } = useTranslation('planner');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showAllScope = totalDays > 1;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!pending) return;
    inputRef.current?.click();
  }, [pending]);

  function startImport(scope: PinImportScope, mode: PinImportMode) {
    setPending({ scope, mode });
    setOpen(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const choice = pending;
    setPending(null);
    e.target.value = '';
    if (!file || !choice) return;

    try {
      const content = await file.text();
      const result = parseImportFile(content, file.name, {
        currentDay,
        totalDays,
        existingByDay: pinnedByDay,
        scope: choice.scope,
        mode: choice.mode,
      });
      onImport(result);
      const doneKey = `import.${choice.mode === 'merge' ? 'doneMerge' : 'doneReplace'}${
        choice.scope === 'all' ? 'All' : 'Day'
      }`;
      onNotify?.(t(doneKey, { day: currentDay, count: result.importedCount }));
    } catch (err) {
      onNotify?.(
        err instanceof PinImportError ? t(`import.${err.code}`) : t('import.readFailed')
      );
    }
  }

  return (
    <div className="pin-import-menu" ref={rootRef}>
      <input
        ref={inputRef}
        type="file"
        className="pin-import-file-input"
        accept=".json,.csv,.txt,application/json,text/csv,text/plain"
        onChange={(e) => void handleFileChange(e)}
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        className={`pin-import-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon name="upload" />
        {label ?? t('import.label')}
      </button>

      {open && (
        <div className="pin-import-dropdown" role="menu">
          <div className="pin-import-section">
            <span className="pin-import-section-label">
              {t('export.dayHeading', { day: currentDay })}
            </span>
            <button
              type="button"
              role="menuitem"
              onClick={() => startImport('current', 'replace')}
            >
              {t('import.replaceCurrent')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => startImport('current', 'merge')}
            >
              {t('import.mergeCurrent')}
            </button>
          </div>

          {showAllScope && (
            <div className="pin-import-section">
              <span className="pin-import-section-label">{t('import.scopeAll')}</span>
              <button
                type="button"
                role="menuitem"
                onClick={() => startImport('all', 'replace')}
              >
                {t('import.replaceAll')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => startImport('all', 'merge')}
              >
                {t('import.mergeAll')}
              </button>
            </div>
          )}

          <p className="pin-import-hint">{t('import.hint')}</p>
        </div>
      )}
    </div>
  );
}
