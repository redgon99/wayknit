import type { GuideCoursePin } from '../types/guides';
import { GuideCourseExplorer } from './GuideCourseExplorer';

type Props = {
  pins: GuideCoursePin[];
  className?: string;
};

/** 추천 코스 가이드용 읽기 전용 핀 지도 (OSM Explorer) */
export function GuideCourseMap({ pins, className }: Props) {
  return <GuideCourseExplorer pins={pins} className={className} />;
}
