import type { GeneratedRoute, PinnedPlace } from '../types';
import {
  type PinDayGroup,
  type PinExportContext,
  buildPinMapLink,
  getPinGroupsForScope,
  sanitizeExportFilename,
} from './exportPins';
import i18n from './i18n';

export type MapExportFormat = 'kml' | 'gpx';

export interface MapExportContext extends PinExportContext {
  /** 동선이 있으면 LineString / track으로 포함 */
  generatedRouteByDay?: Record<number, GeneratedRoute | null>;
}

function tExport(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(`export.${key}`, { ns: 'planner', ...opts });
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pinDescription(pin: PinnedPlace): string {
  const lines = [
    pin.categoryLabel,
    pin.roadAddress || pin.address,
    pin.phone ? `${tExport('phone')}: ${pin.phone}` : '',
    pin.stayMinutes
      ? `${tExport('stay')}: ${tExport('stayMinutes', { n: pin.stayMinutes })}`
      : '',
    pin.note ? `${tExport('note')}: ${pin.note}` : '',
    buildPinMapLink(pin),
  ].filter(Boolean);
  return lines.join('\n');
}

function routePathForDay(
  ctx: MapExportContext,
  day: number,
  pins: PinnedPlace[]
): Array<{ lat: number; lng: number }> {
  const route = ctx.generatedRouteByDay?.[day];
  if (route?.routePath && route.routePath.length >= 2) {
    return route.routePath.map((p) => ({ lat: p.lat, lng: p.lng }));
  }
  if (route?.stops && route.stops.length >= 2) {
    const pts: Array<{ lat: number; lng: number }> = [];
    if (route.origin?.lat != null && route.origin?.lng != null) {
      pts.push({ lat: route.origin.lat, lng: route.origin.lng });
    }
    for (const s of route.stops) pts.push({ lat: s.lat, lng: s.lng });
    return pts;
  }
  if (pins.length >= 2) {
    return pins.map((p) => ({ lat: p.lat, lng: p.lng }));
  }
  return [];
}

function buildMapExportFilename(ctx: MapExportContext, format: MapExportFormat): string {
  const base = sanitizeExportFilename(ctx.tripTitle);
  const scopeLabel =
    ctx.scope === 'all'
      ? tExport('scopeAll')
      : tExport('scopeDay', { day: ctx.currentDay });
  return `${base}_${scopeLabel}_map.${format}`;
}

/** Google My Maps / Earth, 카카오·네이버 일부 앱에서 사용 가능한 KML */
export function formatPinsAsKml(ctx: MapExportContext): string {
  const groups = getPinGroupsForScope(ctx);
  if (!groups.length) return '';

  const folders = groups.map((g) => kmlFolder(ctx, g)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(ctx.tripTitle)}</name>
    <description>${xmlEscape(
      `${ctx.tripTitle} · Wayknit export · ${new Date().toISOString()}`
    )}</description>
${folders}
  </Document>
</kml>
`;
}

function kmlFolder(ctx: MapExportContext, group: PinDayGroup): string {
  const dayName = tExport('dayHeading', { day: group.day });
  const placemarks = group.pins
    .map(
      (pin) => `      <Placemark>
        <name>${xmlEscape(pin.name)}</name>
        <description><![CDATA[${pinDescription(pin)}]]></description>
        <ExtendedData>
          <Data name="day"><value>${group.day}</value></Data>
          <Data name="order"><value>${pin.order}</value></Data>
          <Data name="category"><value>${xmlEscape(pin.categoryLabel)}</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>${pin.lng},${pin.lat},0</coordinates>
        </Point>
      </Placemark>`
    )
    .join('\n');

  const path = routePathForDay(ctx, group.day, group.pins);
  let line = '';
  if (path.length >= 2) {
    const coords = path.map((p) => `${p.lng},${p.lat},0`).join(' ');
    line = `
      <Placemark>
        <name>${xmlEscape(`${dayName} · ${tExport('routeLine')}`)}</name>
        <Style>
          <LineStyle>
            <color>ff1f2937</color>
            <width>4</width>
          </LineStyle>
        </Style>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coords}</coordinates>
        </LineString>
      </Placemark>`;
  }

  return `    <Folder>
      <name>${xmlEscape(dayName)}</name>
${placemarks}${line}
    </Folder>`;
}

/** GPX — Google Earth·각종 내비/트레킹 앱 호환 */
export function formatPinsAsGpx(ctx: MapExportContext): string {
  const groups = getPinGroupsForScope(ctx);
  if (!groups.length) return '';

  const wpts = groups
    .flatMap(({ day, pins }) =>
      pins.map((pin) => {
        const desc = xmlEscape(pinDescription(pin));
        return `  <wpt lat="${pin.lat}" lon="${pin.lng}">
    <name>${xmlEscape(pin.name)}</name>
    <desc>${desc}</desc>
    <type>${xmlEscape(pin.categoryLabel)}</type>
    <extensions>
      <wayknit:day>${day}</wayknit:day>
      <wayknit:order>${pin.order}</wayknit:order>
    </extensions>
  </wpt>`;
      })
    )
    .join('\n');

  const tracks = groups
    .map(({ day, pins }) => {
      const path = routePathForDay(ctx, day, pins);
      if (path.length < 2) return '';
      const pts = path
        .map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`)
        .join('\n');
      return `  <trk>
    <name>${xmlEscape(`${tExport('dayHeading', { day })} · ${tExport('routeLine')}`)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wayknit"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:wayknit="https://wayknit.app/ns/gpx">
  <metadata>
    <name>${xmlEscape(ctx.tripTitle)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}
${tracks}
</gpx>
`;
}

export function exportMapFormat(ctx: MapExportContext, format: MapExportFormat): boolean {
  const groups = getPinGroupsForScope(ctx);
  if (!groups.length) return false;

  const content = format === 'kml' ? formatPinsAsKml(ctx) : formatPinsAsGpx(ctx);
  if (!content) return false;

  const filename = buildMapExportFilename(ctx, format);
  const mime =
    format === 'kml'
      ? 'application/vnd.google-earth.kml+xml;charset=utf-8'
      : 'application/gpx+xml;charset=utf-8';

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
