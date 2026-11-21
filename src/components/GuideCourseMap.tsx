import type { GuideCoursePin } from '../types/guides';
import { GuideCourseExplorer } from './GuideCourseExplorer';

type Props = {
  pins: GuideCoursePin[];
  className?: string;
  addPinHref?: (order: number) => string;
  onAddPin?: (order: number) => void;
};

/** 추천 코스 가이드용 읽기 전용 핀 지도 (OSM Explorer) */
export function GuideCourseMap({ pins, className, addPinHref, onAddPin }: Props) {
  return <GuideCourseExplorer pins={pins} className={className} addPinHref={addPinHref} onAddPin={onAddPin} />;
}
