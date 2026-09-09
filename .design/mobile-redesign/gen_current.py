# -*- coding: utf-8 -*-
import sys, os, io
sys.path.insert(0, os.path.dirname(__file__))
from build import icon, icon_car, map_bg, presence, pin_row, wrap

body = f'''<div class="phone">
  {map_bg()}

  <!-- 상단: 검색 알약 + 자료 + presence + 더보기 (지금 모습) -->
  <div style="position:absolute;left:14px;right:14px;top:14px;display:flex;gap:8px;align-items:center;z-index:5">
    <div style="flex:1;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--c-border);
      border-radius:var(--r-pill);padding:12px 16px;box-shadow:var(--sh-panel);font-size:14px;font-weight:600;color:var(--c-tertiary)">
      {icon('search', 18, 'var(--c-tertiary)')} 장소 검색
    </div>
    <button class="icon-btn" style="width:44px;height:44px;border-radius:14px">{icon('folder', 19)}</button>
    {presence([('U', '#ea580c'), ('U', '#7c3aed')])}
    <button class="icon-btn" style="width:44px;height:44px;border-radius:14px">{icon('more', 20)}</button>
  </div>

  <!-- 일차 탭 줄 (검색줄과 별도 행) -->
  <div style="position:absolute;left:14px;right:80px;top:66px;display:flex;gap:6px;z-index:5;overflow:hidden">
    <button class="daytab active">1일차·16</button>
    <button class="daytab">+ 일차</button>
  </div>

  <!-- 지도 위 플로팅 도구 — 오른쪽 세로줄에 두 개가 따로 떠 있다 -->
  <button class="icon-btn" style="position:absolute;right:16px;top:108px;width:40px;height:40px;border-radius:14px;z-index:6">
    {icon('layers', 18)}
  </button>
  <button class="icon-btn" style="position:absolute;right:16px;top:156px;width:40px;height:40px;border-radius:14px;z-index:6;color:#fff;background:var(--c-primary)">
    {icon('pinPlus', 18, '#fff')}
  </button>

  <!-- 하단 시트: 검색 / 핀 16 / 동선 3탭, 핀 탭 활성 -->
  <div class="sheet" style="top:392px">
    <div class="sheet-handle"><span class="sheet-handle-bar"></span></div>
    <div class="sheet-head">
      <span class="sheet-title">춘천여행</span>
      <span class="sheet-sub">핀16 · 1일차</span>
    </div>
    <div class="sheet-tabs">
      <button class="sheet-tab">검색</button>
      <button class="sheet-tab active">핀 16</button>
      <button class="sheet-tab">동선</button>
    </div>
    <div class="sheet-body" style="display:flex;flex-direction:column">
      <div style="display:flex;gap:8px;padding:2px 0 10px;font-size:11.5px;color:var(--c-text2);font-weight:600">
        <span style="display:flex;align-items:center;gap:4px">{icon('download',13)} 읽어오기</span>
        <span style="display:flex;align-items:center;gap:4px">{icon('share',13)} 보내기</span>
        <span style="display:flex;align-items:center;gap:4px;color:var(--c-amber)">{icon('flag',13,'var(--c-amber)')} 필수만</span>
        <span style="margin-left:auto;color:var(--c-tertiary)">전체 해제</span>
      </div>
      {pin_row(1, '#ec4899', '향토숯불닭갈비집', locked=True)}
      {pin_row(3, '#f97316', '온의칼국수', meta_html='<div class="pin-meta" style="color:var(--c-amber)">★ 5.0</div>')}
      <button style="margin-top:14px;width:100%;background:var(--c-accent);border:none;border-radius:14px;
        padding:14px;font-size:14.5px;font-weight:800;color:#1f2937;font-family:inherit">
        Set up route · 동선 만들기 →
      </button>
      <div style="flex:1;min-height:120px"></div>
    </div>
  </div>

  <!-- 하단 내비: 내 여행 / 시나리오 / 계정 -->
  <div class="tabbar">
    <div class="tabbar-btn">{icon('folder',20)}내 여행</div>
    <div class="tabbar-btn">{icon('sparkles',20)}시나리오</div>
    <div class="tabbar-btn">
      <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px;background:var(--c-bg2);color:var(--c-tertiary)">Free</span>
      계정
    </div>
  </div>
</div>'''

out = wrap(body)
io.open(os.path.join(os.path.dirname(__file__), 'Current.dc.html'), 'w', encoding='utf-8').write(out)
print('wrote Current.dc.html', len(out), 'bytes')
