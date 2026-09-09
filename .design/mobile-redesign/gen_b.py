# -*- coding: utf-8 -*-
import sys, os, io
sys.path.insert(0, os.path.dirname(__file__))
from build import icon, icon_car, map_bg, presence, pin_row, wrap

body = f'''<div class="phone">
  {map_bg()}

  <!-- 상단: 지도 위엔 최소한만 — presence·더보기 뿐. 검색은 시트 안으로 옮겼다 -->
  <div style="position:absolute;left:14px;right:14px;top:14px;display:flex;justify-content:flex-end;gap:8px;align-items:center;z-index:5">
    {presence([('U', '#ea580c'), ('U', '#7c3aed')])}
    <button class="icon-btn" style="width:40px;height:40px;border-radius:14px">{icon('more', 19)}</button>
  </div>

  <div style="position:absolute;left:14px;right:14px;top:64px;display:flex;gap:6px;z-index:5">
    <button class="daytab active">1일차·16</button>
    <button class="daytab">+ 일차</button>
  </div>

  <!-- 지도 도구는 지도 소관으로 남겨 오른쪽 가장자리에 그대로 둔다 -->
  <button class="icon-btn" style="position:absolute;right:16px;top:108px;width:38px;height:38px;border-radius:13px;z-index:6">
    {icon('layers', 17)}
  </button>
  <button class="icon-btn" style="position:absolute;right:16px;top:152px;width:38px;height:38px;border-radius:13px;z-index:6;color:#fff;background:var(--c-primary)">
    {icon('pinPlus', 17, '#fff')}
  </button>

  <!-- 하단 시트: 탭 자체가 없다. 검색이 시트의 첫 줄이고, 그 아래로 핀·동선이 이어진다 -->
  <div class="sheet" style="top:326px">
    <div class="sheet-handle"><span class="sheet-handle-bar"></span></div>
    <div class="sheet-body" style="display:flex;flex-direction:column;padding-top:2px">

      <div style="display:flex;align-items:center;gap:10px;background:var(--c-bg2);border-radius:99px;
        padding:11px 16px;margin-bottom:14px">
        {icon('search', 17, 'var(--c-tertiary)')}
        <span style="font-size:13.5px;font-weight:600;color:var(--c-tertiary);flex:1">어디로 가시나요?</span>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13.5px;font-weight:700;color:var(--c-text)">춘천여행 · 핀 16개</span>
        <span style="font-size:11.5px;font-weight:700;color:var(--c-tertiary)">1일차</span>
      </div>

      <div style="display:flex;align-items:center;gap:10px;background:var(--c-accent-soft);
        border:1px solid #fde68a;border-radius:14px;padding:11px 13px;margin-bottom:12px">
        {icon('route', 18, 'var(--c-amber)')}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c-text)">오늘 동선 · 4.2km · 48분</div>
        </div>
        <button style="border:none;background:#fff;border-radius:99px;padding:7px 12px;font-size:11.5px;
          font-weight:700;color:var(--c-amber);font-family:inherit;box-shadow:var(--sh-sm)">다시 짜기</button>
      </div>

      {pin_row(1, '#ec4899', '향토숯불닭갈비집', locked=True)}
      {pin_row(3, '#f97316', '온의칼국수', meta_html='<div class="pin-meta" style="color:var(--c-amber)">★ 5.0</div>')}
    </div>
  </div>

  <!-- 하단 내비 — A안과 같은 통일안: 메뉴 하나로 -->
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
io.open(os.path.join(os.path.dirname(__file__), 'OptionB.dc.html'), 'w', encoding='utf-8').write(out)
print('wrote OptionB.dc.html', len(out), 'bytes')
