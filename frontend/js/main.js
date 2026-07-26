/**
 * AI 康养旅居 — Main Entry v2.2
 * 延迟信息卡揭示 · 地点层级 · NaN 防护 · 状态感知引导
 */

(function () {
  'use strict';

  var earthInitialized = false;
  var destinationsCache = null;

  async function init() {
    if (window.HealthTravelAPI) {
      destinationsCache = await window.HealthTravelAPI.fetchDestinations();
    }

    bindChapterButtons();
    bindHeroCTA();
    document.addEventListener('chapterready', function (e) { onChapterReady(e.detail); });

    if (destinationsCache && destinationsCache.length > 0) updateHUD(destinationsCache);
    bindInfoCardCTA();
  }

  function bindChapterButtons() {
    document.querySelectorAll('.js-chapter-next').forEach(function (btn) {
      btn.addEventListener('click', function () { if (window.ChapterManager) window.ChapterManager.next(); });
    });
    document.querySelectorAll('[data-chapter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = parseInt(btn.getAttribute('data-chapter'), 10);
        if (window.ChapterManager && !isNaN(t)) window.ChapterManager.navigateTo(t);
      });
    });
  }

  function bindHeroCTA() {
    document.querySelectorAll('.js-hero-explore').forEach(function (btn) {
      btn.addEventListener('click', function () { if (window.ChapterManager) window.ChapterManager.navigateTo(1); });
    });
  }

  function bindInfoCardCTA() {
    var btn = document.getElementById('info-cta-btn');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = window.EarthEngine ? window.EarthEngine.getSelectedIndex() : -1;
        if (idx >= 0) {
          var dests = window.EarthEngine.getDestinations();
          if (dests && dests[idx]) sessionStorage.setItem('ht_selected_dest', JSON.stringify(dests[idx]));
        }
        window.location.href = 'questionnaire.html';
      });
    }
  }

  function onChapterReady(detail) {
    if (detail.id === 'chapter-platform') initExploreChapter();
  }

  /* ═══════════════════════════════════════════════════════
     Earth Explorer Init
     ═══════════════════════════════════════════════════════ */

  function initExploreChapter() {
    if (earthInitialized) { if (window.EarthEngine) window.EarthEngine.startEntrance(); return; }
    if (!window.EarthEngine) { showExploreFallback(); return; }

    earthInitialized = true;

    window.EarthEngine.init('earth-stage', {
      onMarkerHover: handleMarkerHover,
      onMarkerSelect: handleMarkerSelect,
      onMarkerFocusDone: handleMarkerFocusDone,
      onMarkerDeselect: handleMarkerDeselect,
      onStateChange: handleStateChange,
    });

    setTimeout(function () { window.EarthEngine.startEntrance(); }, 400);
    startJourneyNarrative();
    initPortals();
    if (destinationsCache && destinationsCache.length > 0) updateHUD(destinationsCache);
  }

  function setJourneyStep(step) {
    document.querySelectorAll('[data-journey-step]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-journey-step') === step);
    });
    if (window.EarthEngine && window.EarthEngine.setJourneyStage) window.EarthEngine.setJourneyStage(step);
  }

  function startJourneyNarrative() {
    setJourneyStep('global');
    setTimeout(function () { setJourneyStep('country'); }, 2600);
    setTimeout(function () { setJourneyStep('city'); }, 4700);
  }

  /* ═══════════════════════════════════════════════════════
     State → Guidance
     ═══════════════════════════════════════════════════════ */

  function handleStateChange(newState, data) {
    var hint = document.getElementById('guidance-hint');
    if (!hint) return;
    hint.classList.remove('state-dragging', 'state-inertia', 'state-focused');

    switch (newState) {
      case 'idle':
        hint.textContent = '移动光标 · 发现康养目的地';
        break;
      case 'inertia':
        hint.textContent = '地球旋转中…';
        hint.classList.add('state-inertia');
        break;
      case 'focusing':
        hint.textContent = '正在定位目的地…';
        break;
      case 'focused':
        if (data && data.dest) {
          hint.textContent = '已到达 · ' + data.dest.city + '  |  移动光标继续探索';
        }
        hint.classList.add('state-focused');
        break;
    }
  }

  /* ═══════════════════════════════════════════════════════
     Marker Hover → 预览信息卡（不干扰聚焦状态）
     ═══════════════════════════════════════════════════════ */

  function handleMarkerHover(dest, idx) {
    var engState = window.EarthEngine ? window.EarthEngine.getState() : '';
    if (engState === 'focusing' || engState === 'focused') return;

    var emptyEl = document.getElementById('info-empty-state');
    var dataEl = document.getElementById('info-data-state');
    var card = document.getElementById('dest-info-card');

    if (!dest) {
      if (emptyEl) emptyEl.style.display = '';
      if (dataEl) { dataEl.style.display = 'none'; dataEl.classList.remove('revealed'); }
      if (card) card.classList.remove('has-data');
      return;
    }

    // Hover confirms that the marker is interactive; details are reserved for a click
    // so the side panel does not flicker while the user explores the globe.
    if (emptyEl) emptyEl.style.display = '';
    if (dataEl) { dataEl.style.display = 'none'; dataEl.classList.remove('revealed'); }
    if (card) card.classList.remove('has-data');
  }

  /* ═══════════════════════════════════════════════════════
     Marker Select → 聚焦开始（隐藏旧卡片，等待聚焦完成）
     ═══════════════════════════════════════════════════════ */

  function handleMarkerSelect(dest, idx) {
    // 聚焦开始时不立即显示卡片，等镜头到位后由 handleMarkerFocusDone 触发
    var dataEl = document.getElementById('info-data-state');
    if (dataEl) { dataEl.style.display = 'none'; dataEl.classList.remove('revealed'); }
  }

  /* ═══════════════════════════════════════════════════════
     Focus Done → 镜头就位，渐入信息卡
     ═══════════════════════════════════════════════════════ */

  function handleMarkerFocusDone(dest, idx) {
    setJourneyStep('city');
    populateInfoCard(dest);

    var emptyEl = document.getElementById('info-empty-state');
    var dataEl = document.getElementById('info-data-state');
    var card = document.getElementById('dest-info-card');

    if (emptyEl) emptyEl.style.display = 'none';
    if (dataEl) {
      dataEl.style.display = 'flex';
      dataEl.classList.add('revealed');
    }
    if (card) card.classList.add('has-data');
  }

  /* ═══════════════════════════════════════════════════════
     Deselect
     ═══════════════════════════════════════════════════════ */

  function handleMarkerDeselect() {
    var dataEl = document.getElementById('info-data-state');
    var emptyEl = document.getElementById('info-empty-state');
    var card = document.getElementById('dest-info-card');
    if (dataEl) { dataEl.style.display = 'none'; dataEl.classList.remove('revealed'); }
    if (emptyEl) emptyEl.style.display = '';
    if (card) card.classList.remove('has-data');
  }

  /* ═══════════════════════════════════════════════════════
     Populate Info Card — NaN safe, hierarchy display
     ═══════════════════════════════════════════════════════ */

  function populateInfoCard(dest) {
    if (!dest) return;

    // 名称
    setText('info-name', dest.name || '--');

    // 地点层级：县 → 市 → 省 → 国家
    var locationParts = [];
    if (dest.city) locationParts.push(dest.city);
    if (dest.prefecture) locationParts.push(dest.prefecture);
    if (dest.province) locationParts.push(dest.province);
    if (dest.country) locationParts.push(dest.country);
    setText('info-location', locationParts.length > 0 ? locationParts.join(' · ') : '--');

    // 气候标签
    setText('info-climate', dest.climate || '--');

    // 描述
    setText('info-desc', dest.desc || '暂无描述');

    // 统计数据 — 全部带 NaN 防护
    setStat('info-stat-temp', dest.temp, '°C');
    setStat('info-stat-altitude', dest.altitude, 'm');
    setStat('info-stat-aqi', dest.aqi, '');
    setStat('info-stat-humidity', dest.humidity, '%');
    setStat('info-stat-forest', dest.forest, '%');
    setStat('info-stat-medical', dest.medical, '级');

    // Hero 字符
    var heroChar = document.getElementById('info-hero-char');
    if (heroChar) heroChar.textContent = (dest.name || '山').charAt(0);

    // A real destination image makes the detail view feel like a place, not a data popup.
    var hero = document.getElementById('info-image-area');
    if (hero) {
      var imageById = {
        1: 'https://images.unsplash.com/photo-1518694348460-5c1b8ed2a5b3?auto=format&fit=crop&w=900&q=82',
        2: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=82',
        3: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=82'
      };
      hero.style.setProperty('--destination-image', 'url("' + (imageById[dest.id] || imageById[3]) + '")');
      hero.setAttribute('aria-label', (dest.name || '目的地') + '风景');
    }
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = (val != null) ? val : '--';
  }

  function setStat(id, val, unit) {
    var el = document.getElementById(id);
    if (!el) return;
    if (val == null || (typeof val === 'number' && isNaN(val))) {
      el.textContent = '--';
      return;
    }
    if (unit && id === 'info-stat-aqi') {
      el.textContent = 'AQI ' + val;
    } else if (unit) {
      el.textContent = val + unit;
    } else {
      el.textContent = val;
    }
  }

  /* ═══════════════════════════════════════════════════════
     Portals
     ═══════════════════════════════════════════════════════ */

  function initPortals() {
    positionPortals(); bindPortalClicks();
    window.addEventListener('resize', positionPortals);
  }

  function positionPortals() {
    var mobile = window.innerWidth <= 768;
    var portals = document.querySelectorAll('.explore-portal');
    if (mobile) { portals.forEach(function(p){p.style.left='';p.style.top='';p.style.right='';p.style.bottom='';}); return; }
    var pos = [{left:'10%',top:'20%'},{right:'10%',top:'20%'},{left:'10%',bottom:'20%'},{right:'10%',bottom:'20%'}];
    portals.forEach(function(p,i){if(pos[i])Object.keys(pos[i]).forEach(function(k){p.style[k]=pos[i][k];});});
  }

  function bindPortalClicks() {
    document.querySelectorAll('.explore-portal').forEach(function(p){
      p.addEventListener('click',function(e){
        var portal=e.currentTarget;
        var ripple=document.createElement('div');ripple.className='portal-ripple';portal.appendChild(ripple);
        ripple.addEventListener('animationend',function(){ripple.remove();});
        var link=portal.getAttribute('data-link'),chapter=portal.getAttribute('data-chapter');
        setTimeout(function(){if(link)window.location.href=link;else if(chapter){var t=parseInt(chapter,10);if(window.ChapterManager&&!isNaN(t))window.ChapterManager.navigateTo(t);}},320);
      });
      p.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click();}});
    });
  }

  /* ═══════════════════════════════════════════════════════
     HUD — 左侧聚合数据
     ═══════════════════════════════════════════════════════ */

  function updateHUD(destinations) {
    if (!destinations || destinations.length === 0) return;
    var tf = 0, ta = 0, tt = 0, cnt = destinations.length;
    var levels = {'A':3,'B':2,'C':1}, maxM = 'C', maxS = 0;
    destinations.forEach(function(d){
      tf += (d.forest_coverage || d.forest || 0);
      ta += (d.air_quality_index || d.aqi || 0);
      tt += (d.average_temperature || d.temp || 0);
      var ml = d.medical_level || d.medical || 'C';
      var s = levels[ml] || 0;
      if (s > maxS) { maxS = s; maxM = ml; }
    });
    setHUD('hud-temp', (tt/cnt).toFixed(1) + '°C');
    setHUD('hud-aqi', Math.round(ta/cnt));
    setHUD('hud-forest', Math.round(tf/cnt) + '%');
    setHUD('hud-medical', maxM + '级');
  }

  function setHUD(id, val) { var el = document.getElementById(id); if (el) el.textContent = (val != null) ? val : '--'; }

  function showExploreFallback() {
    var s = document.getElementById('earth-stage');
    if (s) s.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><div style="width:45vmin;height:45vmin;border-radius:50%;background:radial-gradient(circle,rgba(30,90,70,0.2),rgba(15,50,40,0.1) 40%,transparent);"></div></div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
