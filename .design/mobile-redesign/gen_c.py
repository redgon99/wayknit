# -*- coding: utf-8 -*-
import sys, os, io
sys.path.insert(0, os.path.dirname(__file__))
from build import icon, icon_car, map_bg, presence, pin_row, wrap

body = f'''<div class="phone">
  {map_bg()}

  <!-- 상단: 정말로 한 줄 — 여행칩(일차 포함) · 검색 · 지도 도구 · presence. 일차 탭 줄 자체가 없다 -->
  <div style="position:absolute;left:14px;right:14px;top:14px;display:flex;gap:6px;align-items:center;z-index:5">
    <button style="display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--c-border);
      border-radius:var(--r-pill);padding:9px 12px;box-shadow:var(--sh-panel);font-family:inherit;
      font-size:12.5px;font-weight:700;color:var(--c-text);flex-shrink:0;max-width:150px">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">춘천여행 · 1일차</span>
      {icon('chevronDown', 13, 'var(--c-tertiary)')}
    </button>
    <div style="flex:1"></div>
    <button class="icon-btn" style="width:36px;height:36px;border-radius:12px">{icon('search', 16)}</button>
    <button class="icon-btn" style="width:36px;height:36px;border-radius:12px">{icon('layers', 16)}</button>
    <button class="icon-btn" style="width:36px;height:36px;border-radius:12px;color:#fff;background:var(--c-primary)">{icon('pinPlus', 16, '#fff')}</button>
    {presence([('U', '#ea580c'), ('U', '#7c3aed')])}
  </div>

  <!-- 하단 시트: 검색 / 핀·동선 2탭. 핀·동선 안에서 보기 모드를 전환한다 -->
  <div class="sheet" style="top:330px">
    <div class="sheet-handle"><span class="sheet-handle-bar"></span></div>
    <div class="sheet-head">
      <span class="sheet-title">춘천여행</span>
      <span class="sheet-sub">핀 16 · 1일차</span>
    </div>
    <div class="sheet-tabs">
      <button class="sheet-tab">검색</button>
      <button class="sheet-tab active">핀 · 동선</button>
    </div>
    <div class="sheet-body" style="display:flex;flex-direction:column">

      <!-- 뷰 모드 전환 — 같은 데이터를 목록으로 볼지 동선으로 볼지 -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="display:flex;background:var(--c-bg2);border-radius:10px;padding:3px;flex:1">
          <button style="flex:1;border:none;background:transparent;border-radius:8px;padding:6px 0;
            font-size:12px;font-weight:600;color:var(--c-muted);font-family:inherit">목록으로 보기</button>
          <button style="flex:1;border:none;background:#fff;border-radius:8px;padding:6px 0;font-size:12px;
            font-weight:700;color:var(--c-text);font-family:inherit;box-shadow:var(--sh-sm)">동선으로 보기</button>
        </div>
        <button style="border:none;background:var(--c-accent-soft);border-radius:99px;padding:7px 12px;
          font-size:11.5px;font-weight:700;color:var(--c-amber);font-family:inherit;white-space:nowrap">다시 짜기</button>
      </div>

      <!-- 동선 보기 — 정류장 사이 이동시간이 있는 타임라인 -->
      <div style="display:flex;gap:10px">
        <span class="pin-num" style="background:#ec4899;flex-shrink:0">1</span>
        <div style="flex:1;min-width:0;padding-bottom:2px">
          <div style="font-size:13.5px;font-weight:700;color:var(--c-text)">향토숯불닭갈비집</div>
          <div style="font-size:11px;color:var(--c-text2);margin-top:1px">09:12 도착 · 약 30분</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 12px">
        <div style="width:2px;height:16px;background:var(--c-border-strong);margin-left:1px"></div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--c-tertiary);font-weight:700">
          {icon_car(13, '#94a3b8')} 12분 이동
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <span class="pin-num" style="background:#f97316;flex-shrink:0">3</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:var(--c-text)">온의칼국수</div>
          <div class="pin-meta" style="color:var(--c-amber);margin-top:1px">★ 5.0</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 하단 내비 — 동일한 통일안 -->
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
io.open(os.path.join(os.path.dirname(__file__), 'OptionC.dc.html'), 'w', encoding='utf-8').write(out)
print('wrote OptionC.dc.html', len(out), 'bytes')
