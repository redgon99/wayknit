import { Icon } from '../Icon';
import { SearchPanel } from '../SearchPanel';
import type { ComponentProps } from 'react';

type SearchPanelProps = ComponentProps<typeof SearchPanel>;

interface Props extends SearchPanelProps {
  open: boolean;
  onClose: () => void;
}

/** 모바일 전체화면 검색 (시안: top search → fullscreen overlay) */
export function MobileSearchSheet({ open, onClose, ...searchProps }: Props) {
  if (!open) return null;

  return (
    <div className="mobile-search-fullscreen" role="dialog" aria-modal="true" aria-label="검색">
      <header className="mobile-search-fullscreen-head">
        <button type="button" className="mobile-search-back" onClick={onClose} aria-label="닫기">
          <Icon name="chevronLeft" size={20} />
        </button>
        <span className="mobile-search-fullscreen-title">Search · 검색</span>
      </header>
      <div className="mobile-search-fullscreen-body">
        <SearchPanel {...searchProps} variant="compact" autoSearch />
      </div>
    </div>
  );
}
