# -*- coding: utf-8 -*-
import json, os

BASE = os.path.dirname(__file__)
ICONS = json.load(open(os.path.join(BASE, 'icons.json'), encoding='utf-8'))


def icon(name, size=20, color='currentColor', stroke=1.75, extra=''):
    ds = ICONS[name]
    paths = ''.join(f'<path d="{d}"/>' for d in ds)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{stroke}" '
            f'stroke-linecap="round" stroke-linejoin="round" '
            f'style="display:block;flex-shrink:0;{extra}">{paths}</svg>')


def icon_car(size=16, color='#64748b'):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M5 17h-2v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2"/><circle cx="7" cy="17" r="2"/>'
            f'<circle cx="17" cy="17" r="2"/><path d="M9 17h6"/></svg>')


TOKENS_CSS = """
  --c-primary:#0f172a; --c-primary-soft:#fef9c3; --c-accent:#facc15; --c-accent-hover:#eab308;
  --c-amber:#a16207; --c-link:#ca8a04; --c-text:#0f172a; --c-text2:#475569; --c-muted:#64748b;
  --c-tertiary:#94a3b8; --c-border:rgba(15,23,42,.08); --c-border-strong:rgba(15,23,42,.14);
  --c-bg:#fafaf8; --c-bg2:#f1f5f9; --c-surface:#fff;
  --r-sm:8px; --r-md:12px; --r-lg:14px; --r-xl:18px; --r-panel:20px; --r-pill:99px;
  --sh-sm:0 1px 3px rgba(15,23,42,.1); --sh-panel:0 8px 32px rgba(15,23,42,.12);
  --sh-dock:0 12px 40px rgba(15,23,42,.16);
"""

BASE_CSS = """
* { box-sizing: border-box; }
body { margin:0; font-family:'Instrument Sans','Noto Sans KR',system-ui,sans-serif; }
.phone { position:relative; width:390px; height:844px; overflow:hidden; background:var(--c-bg); }
.map-bg { position:absolute; inset:0;
  background:
    radial-gradient(ellipse 500px 380px at 72% 30%, rgba(196,225,214,.9), transparent 60%),
    radial-gradient(ellipse 420px 340px at 20% 68%, rgba(206,232,221,.85), transparent 55%),
    linear-gradient(160deg,#e3efe8 0%,#dcebe3 40%,#d7e7de 100%);
}
.map-road { position:absolute; stroke:#eef5f0; stroke-width:9; fill:none; stroke-linecap:round; opacity:.9; }
.map-road2 { position:absolute; stroke:#f6b13b; stroke-width:4; fill:none; stroke-linecap:round; opacity:.85; }
.map-label { position:absolute; font-size:10px; color:#7c9a8c; font-weight:600; white-space:nowrap; }
.map-poi { position:absolute; width:7px; height:7px; border-radius:50%; background:#c3d9cd; box-shadow:0 0 0 2px #fff; }
.icon-btn { display:flex; align-items:center; justify-content:center; border:1px solid var(--c-border);
  background:#fff; box-shadow:var(--sh-panel); color:var(--c-text2); flex-shrink:0; cursor:pointer; }
.presence { display:inline-flex; align-items:center; }
.presence-av { width:24px; height:24px; margin-left:-6px; border:2px solid #fff; border-radius:50%;
  color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; }
.presence-av:first-child { margin-left:0; }
.daytab { border:none; border-radius:var(--r-pill); padding:7px 14px; font-size:12.5px; font-weight:600;
  background:rgba(255,255,255,.94); color:var(--c-muted); box-shadow:var(--sh-sm); white-space:nowrap; font-family:inherit; }
.daytab.active { background:var(--c-primary); color:#fff; }
.sheet { position:absolute; left:0; right:0; bottom:58px; background:#fff; border-radius:22px 22px 0 0;
  border:1px solid var(--c-border); box-shadow:0 -8px 32px rgba(15,23,42,.12); display:flex; flex-direction:column; overflow:hidden; }
.sheet-handle { display:flex; justify-content:center; padding:9px 0 5px; flex-shrink:0; }
.sheet-handle-bar { width:40px; height:4px; border-radius:99px; background:#e2e8f0; }
.sheet-head { display:flex; align-items:center; gap:8px; padding:0 16px 10px; flex-shrink:0; }
.sheet-title { font-size:15px; font-weight:700; color:var(--c-text); }
.sheet-sub { margin-left:auto; font-size:12px; color:var(--c-tertiary); font-weight:600; }
.sheet-tabs { display:flex; margin:0 16px 10px; background:var(--c-bg2); border-radius:12px; padding:3px; flex-shrink:0; }
.sheet-tab { flex:1; border:none; background:transparent; border-radius:10px; padding:8px 0; font-size:13px;
  font-weight:600; color:var(--c-muted); font-family:inherit; }
.sheet-tab.active { background:#fff; color:var(--c-text); font-weight:700; box-shadow:var(--sh-sm); }
.sheet-body { padding:0 16px 12px; overflow:hidden; flex:1; }
.pin-row { display:flex; align-items:center; gap:10px; padding:11px 4px; border-bottom:1px solid var(--c-border); }
.pin-num { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:12px; font-weight:700; flex-shrink:0; }
.pin-name { font-size:13.5px; font-weight:600; color:var(--c-text); overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.pin-meta { display:flex; align-items:center; gap:3px; font-size:11px; font-weight:700; margin-top:2px; }
.pin-actions { display:flex; align-items:center; gap:10px; margin-left:auto; color:var(--c-tertiary); flex-shrink:0; }
.tabbar { position:absolute; left:0; right:0; bottom:0; height:58px; display:flex; background:#fff;
  border-top:1px solid var(--c-border); box-shadow:0 -4px 14px rgba(15,23,42,.06); padding:6px 6px; }
.tabbar-btn { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
  color:var(--c-text2); font-size:10.5px; font-weight:600; }
.tabbar-btn.active { color:var(--c-amber); }
.badge-note { position:absolute; font-size:9.5px; font-weight:800; letter-spacing:.02em; text-transform:uppercase;
  padding:3px 7px; border-radius:99px; color:#fff; }
"""


def map_bg():
    return '''<div class="map-bg">
    <svg class="map-road" style="left:0;top:0" width="390" height="844" viewBox="0 0 390 844">
      <path d="M 260 0 C 240 90, 300 140, 270 220 C 245 290, 180 320, 190 400 C 200 480, 260 500, 240 580"/>
      <path d="M 0 520 C 60 500, 90 540, 150 530 C 210 520, 230 480, 300 500"/>
    </svg>
    <svg class="map-road2" style="left:0;top:0" width="390" height="844" viewBox="0 0 390 844">
      <path d="M 40 60 C 90 120, 70 180, 130 210 C 190 240, 220 200, 270 240"/>
    </svg>
    <div class="map-label" style="left:44px;top:52px">춘천철거리</div>
    <div class="map-label" style="left:250px;top:36px">강원특별자치도청</div>
    <div class="map-label" style="left:150px;top:170px">춘천시청</div>
    <div class="map-label" style="left:210px;top:230px">약사천</div>
    <div class="map-label" style="left:60px;top:320px">중앙시장</div>
    <div class="map-poi" style="left:266px;top:44px"></div>
    <div class="map-poi" style="left:158px;top:178px"></div>
    <div class="map-poi" style="left:220px;top:236px"></div>
  </div>'''


def presence(items):
    avs = ''.join(f'<span class="presence-av" style="background:{c}">{i}</span>' for i, c in items)
    return f'<span class="presence">{avs}</span>'


def pin_row(num, color, name, meta_html='', locked=False, show_route_handle=False):
    lock_html = icon('lock', 13, '#94a3b8') if locked else ''
    handle = icon('grip', 15, '#cbd5e1') if show_route_handle else ''
    return f'''<div class="pin-row">
      {handle}
      <span class="pin-num" style="background:{color}">{num}</span>
      {icon('flag', 13, '#f59e0b')}
      <div style="min-width:0;flex:1">
        <div class="pin-name">{name}</div>
        {meta_html}
      </div>
      <div class="pin-actions">{lock_html}{icon_car(15)}{icon('close', 15)}</div>
    </div>'''


def wrap(body_html, extra_css=''):
    return f'''<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
:root {{{TOKENS_CSS}}}
{BASE_CSS}
{extra_css}
</style>
</helmet>
{body_html}
</x-dc>
</body>
</html>'''


print('module ok, icons:', len(ICONS))
