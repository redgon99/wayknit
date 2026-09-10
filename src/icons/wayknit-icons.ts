/**
 * Wayknit 아이콘 세트 — 여행·지도·핀·동선·자료함 UI용
 * 24×24, stroke 1.75, currentColor (앱 accent·텍스트와 조화)
 */

export type IconName =
  | 'search'
  | 'close'
  | 'menu'
  | 'help'
  | 'layoutGrid'
  | 'layoutList'
  | 'refresh'
  | 'location'
  | 'star'
  | 'roadview'
  | 'layers'
  | 'check'
  | 'pin'
  | 'pushpin'
  | 'mapPin'
  | 'pinPlus'
  | 'pinSelect'
  | 'route'
  | 'navigate'
  | 'share'
  | 'save'
  | 'upload'
  | 'download'
  | 'install'
  | 'loader'
  | 'folder'
  | 'note'
  | 'photo'
  | 'attach'
  | 'file'
  | 'trash'
  | 'plus'
  | 'more'
  | 'pencil'
  | 'grip'
  | 'flag'
  | 'lock'
  | 'target'
  | 'crosshair'
  | 'cloud'
  | 'cloudOk'
  | 'mailOk'
  | 'clock'
  | 'phone'
  | 'globe'
  | 'bell'
  | 'trophy'
  | 'sparkles'
  | 'wand'
  | 'zoomIn'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'externalLink'
  | 'calendar'
  | 'message'
  | 'presentation'
  | 'minimize'
  | 'catTour'
  | 'catFood'
  | 'catCafe'
  | 'catStay'
  | 'catCulture'
  | 'catShop'
  | 'catCart'
  | 'catParking'
  | 'catAll'
  | 'transportCar'
  | 'transportWalk'
  | 'transportBus'
  | 'transportBike'
  | 'facilityGroup'
  | 'facilityBabyChair'
  | 'facilityKidsMenu'
  | 'facilityTerrace'
  | 'facilityTakeout'
  | 'facilityPet'
  | 'facilityRestroom'
  | 'facilityBarTable'
  | 'facilityBreakfast'
  | 'facilityReservation'
  | 'facilityPayment'
  | 'facilityWifi'
  | 'facilitySmoking'
  | 'facilityInfo'
  | 'filter';

export interface IconPath {
  d: string;
  /** true면 면 채움 (별점 등) */
  fill?: boolean;
  /** fill과 함께 쓰면 안쪽 서브패스를 구멍으로 뚫음 */
  evenodd?: boolean;
}

export const WAYKNIT_ICONS: Record<IconName, IconPath[]> = {
  search: [
    { d: 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0' },
    { d: 'M21 21L16.65 16.65' },
  ],
  close: [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }],
  menu: [{ d: 'M4 5h16' }, { d: 'M4 12h16' }, { d: 'M4 19h16' }],
  help: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' },
    { d: 'M12 17h.01' },
  ],
  layoutGrid: [
    { d: 'M3 3h18v18h-18z' },
    { d: 'M3 9h18' },
    { d: 'M3 15h18' },
    { d: 'M9 3v18' },
    { d: 'M15 3v18' },
  ],
  layoutList: [
    { d: 'M3 5h.01' },
    { d: 'M3 12h.01' },
    { d: 'M3 19h.01' },
    { d: 'M8 5h13' },
    { d: 'M8 12h13' },
    { d: 'M8 19h13' },
  ],
  refresh: [
    { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' },
    { d: 'M21 3v5h-5' },
    { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' },
    { d: 'M8 16H3v5' },
  ],
  location: [
    { d: 'M2 12L5 12' },
    { d: 'M19 12L22 12' },
    { d: 'M12 2L12 5' },
    { d: 'M12 19L12 22' },
    { d: 'M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0' },
    { d: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
  ],
  star: [
    { d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z', fill: true },
  ],
  roadview: [
    { d: 'M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z' },
    { d: 'M9 10h6M12 7v6' },
    { d: 'M8 16l2-2M16 16l-2-2' },
  ],
  /** 지도유형(일반/위성) 전환 버튼 */
  layers: [
    { d: 'M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z' },
    { d: 'm20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845' },
  ],
  check: [
    { d: 'M20 6 9 17l-5-5' },
  ],
  pin: [
    { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' },
    { d: 'M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
  ],
  /** 핀업 액션 — 압정(thumbtack). 위치 마커(pin)와 구분 */
  pushpin: [
    { d: 'M12 17v5' },
    { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z' },
  ],
  mapPin: [
    { d: 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
  ],
  pinPlus: [
    { d: 'M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738' },
    { d: 'M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
    { d: 'M16 18h6' },
    { d: 'M19 15v6' },
  ],
  pinSelect: [
    { d: 'M12 21V12.5' },
    { d: 'M8.5 12.5 12 9l3.5 3.5' },
    { d: 'M5 5h2M17 5h2M5 19h2M19 19h2' },
  ],
  route: [
    { d: 'M3 19a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
    { d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' },
    { d: 'M15 5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
  ],
  navigate: [
    { d: 'M3 11L22 2L13 21L11 13L3 11Z' },
  ],
  share: [
    { d: 'M15 5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
    { d: 'M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
    { d: 'M15 19a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
    { d: 'M8.59 13.51L15.42 17.49' },
    { d: 'M15.41 6.51L8.59 10.49' },
  ],
  save: [
    { d: 'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' },
    { d: 'M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7' },
    { d: 'M7 3v4a1 1 0 0 0 1 1h7' },
  ],
  upload: [
    { d: 'M12 3v12' },
    { d: 'm17 8-5-5-5 5' },
    { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
  ],
  download: [
    { d: 'M12 15V3' },
    { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
    { d: 'm7 10 5 5 5-5' },
  ],
  install: [
    { d: 'M12 13V7' },
    { d: 'm15 10-3 3-3-3' },
    { d: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z' },
    { d: 'M12 17v4' },
    { d: 'M8 21h8' },
  ],
  loader: [
    { d: 'M21 12a9 9 0 1 1-6.219-8.56' },
  ],
  folder: [
    { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' },
  ],
  note: [
    { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' },
    { d: 'M14 2v5a1 1 0 0 0 1 1h5' },
    { d: 'M10 9H8' },
    { d: 'M16 13H8' },
    { d: 'M16 17H8' },
  ],
  photo: [
    { d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z' },
    { d: 'M7 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' },
  ],
  attach: [
    { d: 'm16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551' },
  ],
  file: [
    { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' },
    { d: 'M14 2v5a1 1 0 0 0 1 1h5' },
  ],
  trash: [
    { d: 'M10 11v6' },
    { d: 'M14 11v6' },
    { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
    { d: 'M3 6h18' },
    { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  ],
  plus: [{ d: 'M5 12h14' }, { d: 'M12 5v14' }],
  // 가로 점 셋 — 카드 위 "더보기". grip(세로 2열)과 달리 한 줄이라 좁은 자리에 맞는다.
  more: [
    { d: 'M5 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M17 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
  ],
  pencil: [{ d: 'M4 20h4l10.5-10.5a2.83 2.83 0 0 0-4-4L4 16z' }, { d: 'M13.5 6.5l4 4' }],
  grip: [
    { d: 'M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
  ],
  flag: [
    { d: 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528' },
  ],
  lock: [
    { d: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2z' },
    { d: 'M7 11V7a5 5 0 0 1 10 0v4' },
  ],
  target: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0' },
    { d: 'M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
  ],
  crosshair: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M22 12L18 12' },
    { d: 'M6 12L2 12' },
    { d: 'M12 6L12 2' },
    { d: 'M12 22L12 18' },
  ],
  cloud: [
    { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' },
  ],
  cloudOk: [
    { d: 'm17 15-5.5 5.5L9 18' },
    { d: 'M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327' },
  ],
  mailOk: [
    { d: 'M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8' },
    { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' },
    { d: 'm16 19 2 2 4-4' },
  ],
  clock: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M12 6v6l4 2' },
  ],
  phone: [
    { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' },
  ],
  globe: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' },
    { d: 'M2 12h20' },
  ],
  bell: [
    { d: 'M10.268 21a2 2 0 0 0 3.464 0' },
    { d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326' },
  ],
  trophy: [
    { d: 'M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2' },
    { d: 'M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2' },
    { d: 'M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3' },
    { d: 'M4 22h16' },
    { d: 'M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z' },
    { d: 'M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3' },
  ],
  sparkles: [
    { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' },
    { d: 'M20 2v4' },
    { d: 'M22 4h-4' },
    { d: 'M2 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
  ],
  wand: [
    { d: 'm21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72' },
    { d: 'm14 7 3 3' },
    { d: 'M5 6v4' },
    { d: 'M19 14v4' },
    { d: 'M10 2v2' },
    { d: 'M7 8H3' },
    { d: 'M21 16h-4' },
    { d: 'M11 3H9' },
  ],
  zoomIn: [
    { d: 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0' },
    { d: 'M21 21L16.65 16.65' },
    { d: 'M11 8L11 14' },
    { d: 'M8 11L14 11' },
  ],
  chevronLeft: [
    { d: 'm15 18-6-6 6-6' },
  ],
  chevronRight: [
    { d: 'm9 18 6-6-6-6' },
  ],
  chevronDown: [{ d: 'm6 9 6 6 6-6' }],
  externalLink: [
    { d: 'M15 3h6v6' },
    { d: 'M10 14 21 3' },
    { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
  ],
  calendar: [
    { d: 'M8 2v3' },
    { d: 'M16 2v3' },
    { d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z' },
    { d: 'M3 9h18' },
  ],
  message: [
    { d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' },
  ],
  presentation: [
    { d: 'M2 3h20' },
    { d: 'M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3' },
    { d: 'm7 21 5-5 5 5' },
  ],
  minimize: [
    { d: 'm14 10 7-7' },
    { d: 'M20 10h-6V4' },
    { d: 'm3 21 7-7' },
    { d: 'M4 14h6v6' },
  ],
  catTour: [
    { d: 'M10 18v-7' },
    { d: 'M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z' },
    { d: 'M14 18v-7' },
    { d: 'M18 18v-7' },
    { d: 'M3 22h18' },
    { d: 'M6 18v-7' },
  ],
  catFood: [
    { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' },
    { d: 'M7 2v20' },
    { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' },
  ],
  catCafe: [
    { d: 'M10 2v2' },
    { d: 'M14 2v2' },
    { d: 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1' },
    { d: 'M6 2v2' },
  ],
  catStay: [
    { d: 'M2 4v16' },
    { d: 'M2 8h18a2 2 0 0 1 2 2v10' },
    { d: 'M2 17h20' },
    { d: 'M6 8v9' },
  ],
  catCulture: [
    { d: 'M10 11h.01' },
    { d: 'M14 6h.01' },
    { d: 'M18 6h.01' },
    { d: 'M6.5 13.1h.01' },
    { d: 'M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3' },
    { d: 'M17.4 9.9c-.8.8-2 .8-2.8 0' },
    { d: 'M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7' },
    { d: 'M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4' },
  ],
  catShop: [
    { d: 'M16 10a4 4 0 0 1-8 0' },
    { d: 'M3.103 6.034h17.794' },
    { d: 'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z' },
  ],
  catCart: [
    { d: 'm2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18' },
    { d: 'M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25' },
    { d: 'M16 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'M6 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
  ],
  catParking: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M9 17V7h4a3 3 0 0 1 0 6H9' },
  ],
  catAll: [
    { d: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z' },
    { d: 'M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z' },
    { d: 'M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z' },
    { d: 'M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z' },
  ],
  transportCar: [
    { d: 'm21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8' },
    { d: 'M7 14h.01' },
    { d: 'M17 14h.01' },
    { d: 'M5 10h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z' },
    { d: 'M5 18v2' },
    { d: 'M19 18v2' },
  ],
  transportWalk: [
    { d: 'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z' },
    { d: 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z' },
    { d: 'M16 17h4' },
    { d: 'M4 13h4' },
  ],
  transportBus: [
    { d: 'M4 6 2 7' },
    { d: 'M10 6h4' },
    { d: 'm22 7-2-1' },
    { d: 'M6 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z' },
    { d: 'M4 11h16' },
    { d: 'M8 15h.01' },
    { d: 'M16 15h.01' },
    { d: 'M6 19v2' },
    { d: 'M18 21v-2' },
  ],
  transportBike: [
    { d: 'M15 17.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0' },
    { d: 'M2 17.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0' },
    { d: 'M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
    { d: 'M12 17.5V14l-3-3 4-3 2 3h2' },
  ],
  facilityGroup: [
    { d: 'M18 21a8 8 0 0 0-16 0' },
    { d: 'M5 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0' },
    { d: 'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3' },
  ],
  facilityBabyChair: [
    { d: 'M8 6h8v12H8V6z' },
    { d: 'M10 6V4a2 2 0 0 1 4 0v2' },
    { d: 'M9 14h6' },
  ],
  facilityKidsMenu: [
    { d: 'M7 5h10v14H7V5z' },
    { d: 'M9 9h6M9 13h4' },
    { d: 'M10 16a1 1 0 0 0 2 0' },
  ],
  facilityTerrace: [
    { d: 'M12 4v3M8 7h8' },
    { d: 'M6 20h12M8 20v-5h8v5' },
    { d: 'M10 15h4' },
  ],
  facilityTakeout: [
    { d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z' },
    { d: 'M12 22V12' },
    { d: 'M3.29 7L12 12L20.71 7' },
    { d: 'm7.5 4.27 9 5.15' },
  ],
  facilityPet: [
    { d: 'M9 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'M16 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'M18 16a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z' },
  ],
  facilityRestroom: [
    { d: 'M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18' },
    { d: 'M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8' },
  ],
  facilityBarTable: [
    { d: 'M6 18h12M12 6v12' },
    { d: 'M8 6h8' },
  ],
  facilityBreakfast: [
    { d: 'M8 12.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0' },
    { d: 'M3 8c0-3.5 2.5-6 6.5-6 5 0 4.83 3 7.5 5s5 2 5 6c0 4.5-2.5 6.5-7 6.5-2.5 0-2.5 2.5-6 2.5s-7-2-7-5.5c0-3 1.5-3 1.5-5C3.5 10 3 9 3 8Z' },
  ],
  facilityReservation: [
    { d: 'M8 2v3' },
    { d: 'M16 2v3' },
    { d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z' },
    { d: 'M3 9h18' },
    { d: 'm9 15 2 2 4-4' },
  ],
  facilityPayment: [
    { d: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z' },
    { d: 'M2 10L22 10' },
  ],
  facilityWifi: [
    { d: 'M12 20h.01' },
    { d: 'M2 8.82a15 15 0 0 1 20 0' },
    { d: 'M5 12.859a10 10 0 0 1 14 0' },
    { d: 'M8.5 16.429a5 5 0 0 1 7 0' },
  ],
  facilitySmoking: [
    { d: 'M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14' },
    { d: 'M18 8c0-2.5-2-2.5-2-5' },
    { d: 'M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1' },
    { d: 'M22 8c0-2.5-2-2.5-2-5' },
    { d: 'M7 12v4' },
  ],
  facilityInfo: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
    { d: 'M12 16v-4' },
    { d: 'M12 8h.01' },
  ],
  filter: [
    { d: 'M4 6h16' },
    { d: 'M6 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'M4 12h16' },
    { d: 'M12 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
    { d: 'M4 18h16' },
    { d: 'M8 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
  ],
};

/** Tabler 클래스명 → Wayknit 아이콘 (마이그레이션·문서용) */
export const TABLER_TO_WAYKNIT: Record<string, IconName> = {
  'ti-search': 'search',
  'ti-x': 'close',
  'ti-refresh': 'refresh',
  'ti-current-location': 'location',
  'ti-star-filled': 'star',
  'ti-view-360': 'roadview',
  'ti-check': 'check',
  'ti-pin': 'pin',
  'ti-pinned': 'pushpin',
  'ti-map-pin': 'mapPin',
  'ti-map-pin-plus': 'pinPlus',
  'ti-map-pin-pin': 'pinSelect',
  'ti-route': 'route',
  'ti-navigation': 'navigate',
  'ti-share': 'share',
  'ti-device-floppy': 'save',
  'ti-upload': 'upload',
  'ti-download': 'download',
  'ti-loader-2': 'loader',
  'ti-folder': 'folder',
  'ti-note': 'note',
  'ti-photo': 'photo',
  'ti-paperclip': 'attach',
  'ti-file': 'file',
  'ti-trash': 'trash',
  'ti-plus': 'plus',
  'ti-grip-vertical': 'grip',
  'ti-flag-3': 'flag',
  'ti-target': 'target',
  'ti-cloud': 'cloud',
  'ti-cloud-check': 'cloudOk',
  'ti-mail-check': 'mailOk',
  'ti-clock': 'clock',
  'ti-phone': 'phone',
  'ti-world': 'globe',
  'ti-bell': 'bell',
  'ti-trophy': 'trophy',
  'ti-sparkles': 'sparkles',
  'ti-wand': 'wand',
  'ti-zoom-in': 'zoomIn',
  'ti-chevron-left': 'chevronLeft',
  'ti-chevron-right': 'chevronRight',
  'ti-chevron-down': 'chevronDown',
  'ti-external-link': 'externalLink',
};

export function iconSvgMarkup(
  name: IconName,
  options?: { size?: number; className?: string; color?: string }
): string {
  const size = options?.size ?? 20;
  const cls = options?.className ? ` class="${options.className} wm-icon"` : ' class="wm-icon"';
  const style = options?.color ? ` style="color:${options.color}"` : '';
  const paths = WAYKNIT_ICONS[name]
    .map((p) =>
      p.fill
        ? `<path fill="currentColor" stroke="none"${p.evenodd ? ' fill-rule="evenodd"' : ''} d="${p.d}"/>`
        : `<path d="${p.d}"/>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${cls}${style} aria-hidden="true">${paths}</svg>`;
}
