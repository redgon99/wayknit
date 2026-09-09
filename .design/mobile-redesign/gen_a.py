# -*- coding: utf-8 -*-
import sys, os, io
sys.path.insert(0, os.path.dirname(__file__))
from build import icon, icon_car, map_bg, presence, pin_row, wrap

body = f'''<div class="phone">
  {map_bg()}

  <!-- 상단: 한 줄 — 검색 아이콘 · 여행/일차 칩(펼치면 일차 전환) · 지도 도구 · presence -->
  <div style="position:absolute;left:14px;right:14px;top:14px;display:flex;gap:6px;align-items:center;z-index:5">
    <button class="icon-btn" style="width:40px;height:40px;border-radius:13px">{icon('search', 18)}</button>
    <button style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--c-border);
      border-radius:var(--r-pill);padding:9px 14px;box-shadow:var(--sh-panel);font-family:inherit;
      font-size:13px;font-weight:700;color:var(--c-text)">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">춘천여행 · 1일차</span>
      {icon('chevronDown', 14, 'var(--c-tertiary)')}
    </button>
    <button class="icon-btn" style="width:36px;height:36px;border-radius:12px">{icon('layers', 16)}</button>
    <button class="icon-btn" style="width:36px;height:36px;border-radius:12px;color:#fff;background:var(--c-primary)">{icon('pinPlus', 16, '#fff')}</button>
    {presence([('U', '#ea580c'), ('U', '#7c3aed')])}
  </div>

  <!-- 하단 시트: 탐색 / 일정 2탭. 일정 = 핀+동선 통합 -->
  <div class="sheet" style="top:360px">
    <div class="sheet-handle"><span class="sheet-handle-bar"></span></div>
    <div class="sheet-head">
      <span class="sheet-title">춘천여행</span>
      <span class="sheet-sub">일정 · 1일차</span>
    </div>
    <div class="sheet-tabs">
      <button class="sheet-tab">탐색</button>
      <button class="sheet-tab active">일정 16</button>
    </div>
    <div class="sheet-body" style="display:flex;flex-direction:column">

      <!-- 동선 요약 카드 — 이전엔 "동선" 탭 + 별도 플로팅 카드로 나뉘어 있던 것을 하나로 -->
      <div style="display:flex;align-items:center;gap:10px;background:var(--c-accent-soft);
        border:1px solid #fde68a;border-radius:14px;padding:11px 13px;margin-bottom:12px">
        {icon('route', 18, 'var(--c-amber)')}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c-text)">오늘 동선 · 4.2km · 48분</div>
          <div style="font-size:11px;color:var(--c-text2);margin-top:1px">세븐일레브 → 온의칼국수</div>
        </div>
        <button style="border:none;background:#fff;border-radius:99px;padding:7px 12px;font-size:11.5px;
          font-weight:700;color:var(--c-amber);font-family:inherit;box-shadow:var(--sh-sm)">다시 짜기</button>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--c-tertiary);margin-bottom:2px">순서대로 · 끌어서 변경</div>
      {pin_row(1, '#ec4899', '향토숯불닭갈비집', locked=True, show_route_handle=True)}
      {pin_row(3, '#f97316', '온의칼국수', meta_html='<div class="pin-meta" style="color:var(--c-amber)">★ 5.0</div>', show_route_handle=True)}
    </div>
  </div>

  <!-- 하단 내비 — 메뉴 하나로 통일(공유·협업·표보기·설정·도움말이 전부 여기 안으로) -->
  <div class="tabbar">
    <div class="tabbar-btn active">{icon('mapPin',20,'var(--c-amber)')}지도</div>
    <div class="tabbar-btn">{icon('folder',20)}자료</div>
    <div class="tabbar-btn">{icon('sparkles',20)}시나리오</div>
    <div class="tabbar-btn" style="position:relative">
      {icon('menu',20)}메뉴
      <span style="position:absolute;top:0;right:22px;width:6px;height:6px;border-radius:50%;background:var(--c-accent-hover)"></span>
    </div>
  </div>
</div>'''

out = wrap(body)
io.open(os.path.join(os.path.dirname(__file__), 'Main.dc.html'), 'w', encoding='utf-8').write(out)
print('wrote Main.dc.html', len(out), 'bytes')
