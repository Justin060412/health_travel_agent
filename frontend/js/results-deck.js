/**
 * M3 — PPT-style AI wellness destination report.
 * Keeps one OpenLayers map instance and moves it with the active recommendation.
 */
(function () {
  'use strict';

  var RESULTS_KEY = 'ht_recommend_results';
  var DESTINATIONS_KEY = 'ht_destinations';
  var REQUEST_KEY = 'ht_analysis_request';
  var ROUTE_CONTEXT_KEY = 'ht_route_context';
  var DETAILS_URL = 'data/destination-details.json';
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = {
    index: 0,
    items: [],
    slides: [],
    results: null,
    analysisRequest: null,
    map: null,
    mapView: null,
    markerSource: null,
    markerFeature: null,
  };

  var elements = {};

  function byId(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function readSession(key) {
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('[M3] 无法读取缓存：' + key, error.message);
      return null;
    }
  }

  function writeSession(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn('[M3] 无法写入缓存：' + key, error.message); }
  }

  function setScreenState(nextState) {
    var isLoading = nextState === 'loading';
    var isEmpty = nextState === 'empty';
    var isReport = nextState === 'report';
    elements.loading.hidden = !isLoading;
    elements.empty.hidden = !isEmpty;
    elements.report.hidden = !isReport;
    document.body.dataset.resultsState = nextState;
  }

  async function loadJson(url, fallback) {
    try {
      var response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      console.warn('[M3] 数据加载降级：' + url, error.message);
      return fallback;
    }
  }

  function metricText(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback || '待核验';
    return String(value);
  }

  function formatBudget(destination) {
    var budget = destination.monthly_budget || {};
    var low = budget.low != null ? Number(budget.low) : Number(destination.monthly_cost_low);
    var high = budget.high != null ? Number(budget.high) : Number(destination.monthly_cost_high);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return '¥' + low.toLocaleString('zh-CN') + '–' + high.toLocaleString('zh-CN') + '/月';
    }
    return destination.budget_level || '待核验';
  }

  function formatTemperature(destination) {
    var temperature = destination.temperature || {};
    return metricText(temperature.average || destination.average_temperature, '待核验');
  }

  function formatAir(destination) {
    var air = destination.air_quality || {};
    if (typeof air === 'string') return air;
    if (air.index != null) return (air.level ? air.level + ' · ' : '') + 'AQI ' + air.index;
    return air.level || destination.air_quality_level || '待核验';
  }

  function detailFact(detail, key) {
    return detail && detail.facts && detail.facts[key] ? detail.facts[key] : null;
  }

  function findDestination(rec, destinations) {
    var nameMatch = destinations.find(function (item) { return item && item.name === rec.name; });
    if (nameMatch) return nameMatch;
    return destinations.find(function (item) {
      return item && String(item.id) === String(rec.destination_id) && (!rec.name || item.name === rec.name);
    }) || {
      id: rec.destination_id,
      name: rec.name,
      province: rec.province,
      latitude: null,
      longitude: null,
      health_tags: [],
      suitable_for: [],
      monthly_budget: { low: null, high: null },
      temperature: {},
      air_quality: {},
    };
  }

  function findDetail(destination, details) {
    return details.find(function (detail) {
      return detail && detail.name === destination.name;
    }) || null;
  }

  function verificationLabel(detail) {
    var status = detail && detail.verification ? detail.verification.status : 'reference_only';
    var labels = {
      verified: '数据已核验',
      verified_with_gaps: '已核验 · 仍有缺口',
      reference_only: '参考资料 · 需行前复核',
      pending: '内容待核验',
      unknown: '数据不足',
    };
    return labels[status] || '资料状态已标注';
  }

  function latestVerification(detail, datasetUpdatedAt) {
    var dates = [];
    if (detail && detail.verification && detail.verification.verified_at) dates.push(detail.verification.verified_at);
    (detail && detail.sources || []).forEach(function (source) {
      if (source.verified_at) dates.push(source.verified_at);
    });
    dates.sort();
    return dates.length ? dates[dates.length - 1] : (datasetUpdatedAt || '待核验');
  }

  function buildMetrics(item) {
    var destination = item.destination;
    var detail = item.detail;
    var altitudeFact = detailFact(detail, 'altitude');
    var medicalFact = detailFact(detail, 'medical_access');
    var forestFact = detailFact(detail, 'forest_coverage');
    var altitude = destination.altitude != null ? destination.altitude : altitudeFact && altitudeFact.value;
    var medical = destination.medical_level || (medicalFact && medicalFact.value) || '待逐院核验';
    var ecology = destination.forest_coverage || (forestFact && forestFact.value != null
      ? String(forestFact.value) + metricText(forestFact.unit, '') : '待核验');

    return [
      { label: '气候背景', value: destination.climate || formatTemperature(destination), note: '年均温 ' + formatTemperature(destination) },
      { label: '空气与生态', value: formatAir(destination), note: ecology !== '待核验' ? '生态参考 ' + ecology : '需结合实时监测' },
      { label: '医疗可达', value: medical, note: '科室、车程与急诊状态需按住址复核' },
      { label: '预算参考', value: formatBudget(destination), note: '季节、房型与停留方式会改变费用' },
      { label: '海拔环境', value: altitude != null ? altitude + ' m' : '待核验', note: altitude >= 1500 ? '建议先短住观察个人适应' : '用于活动强度与体感判断' },
      { label: '适合季节', value: destination.best_season || '待核验', note: '出发前仍需查询实时天气与客流' },
    ];
  }

  function buildCautions(item) {
    var destination = item.destination;
    var detail = item.detail;
    var notes = detail && Array.isArray(detail.caution_notes) ? detail.caution_notes.slice(0, 3) : [];
    if (!notes.length && Number(destination.altitude) >= 1500) notes.push('目的地海拔较高，建议先短住并观察个人适应情况。');
    if (!notes.length) notes.push('季节客流、实时天气和住宿价格可能改变实际旅居体验。');
    if (!detail || !detail.medical_access || !detail.medical_access.items || !detail.medical_access.items.length) {
      notes.push('医疗资源尚未完成逐院核验，有连续用药或专科需求时应先确认。');
    }
    return notes.slice(0, 3);
  }

  function buildProfileChips(request) {
    var profile = request && request.profile || {};
    var chips = [];
    if (profile.age) chips.push(profile.age + '岁');
    if (profile.monthly_budget) chips.push('预算 ¥' + Number(profile.monthly_budget).toLocaleString('zh-CN') + '/月');
    if (profile.climate_preference) chips.push('偏好 ' + profile.climate_preference);
    if (profile.health_status) chips.push(profile.health_status);
    return chips;
  }

  function makeRouteUrl(item) {
    var destination = item.destination;
    var params = new URLSearchParams({
      destination_id: destination.id == null ? item.recommendation.destination_id : destination.id,
      destination_name: destination.name,
      source: 'm3_results_deck',
    });
    if(item.detail&&item.detail.destination_key)params.set('destination_key',item.detail.destination_key);
    return 'route-planner.html?' + params.toString();
  }

  function destinationSlide(item, profileChips, focusedName) {
    var rec = item.recommendation;
    var destination = item.destination;
    var detail = item.detail;
    var metrics = buildMetrics(item);
    var cautions = buildCautions(item);
    var tags = (destination.health_tags || []).slice(0, 4);
    var isFocused = focusedName && destination.name === focusedName;
    var sourceCount = detail && detail.sources ? detail.sources.length : (destination.text_sources || []).length;
    var verifiedAt = latestVerification(detail, '2026-08-19');
    var rankLabel = item.rank === 0 ? '最佳匹配' : '第 ' + (item.rank + 1) + ' 推荐';
    var tagline = destination.tagline || (detail && detail.hero && detail.hero.summary) || '在真实数据边界内理解这段旅居是否适合您。';

    return '<section class="deck-slide" data-slide-index="' + item.rank + '" aria-label="' + escapeHtml(rankLabel + ' ' + destination.name) + '">' +
      '<div class="deck-slide-main">' +
        '<div class="deck-rankline"><span>' + escapeHtml(rankLabel) + '</span><span class="deck-match-score">匹配分 ' + escapeHtml(Math.round(Number(rec.score || 0) * (Number(rec.score || 0) <= 5 ? 20 : 1))) + '</span></div>' +
        '<h1 class="deck-title">' + escapeHtml(destination.name) + '</h1>' +
        '<p class="deck-location">' + escapeHtml([destination.city, destination.province || rec.province].filter(Boolean).join(' · ')) + '</p>' +
        '<p class="deck-tagline">' + escapeHtml(tagline) + '</p>' +
        '<p class="deck-reason">' + escapeHtml(rec.reason || '该目的地在当前问卷条件下具有较高综合适配度。') + '</p>' +
        '<div class="deck-context-strip">' +
          (isFocused ? '<span class="deck-chip is-context">您从 Act2 关注的地点</span>' : '') +
          profileChips.map(function (chip) { return '<span class="deck-chip">' + escapeHtml(chip) + '</span>'; }).join('') +
          tags.map(function (tag) { return '<span class="deck-chip">' + escapeHtml(tag) + '</span>'; }).join('') +
        '</div>' +
        '<div class="deck-metrics">' + metrics.map(function (metric) {
          return '<article class="deck-metric"><span>' + escapeHtml(metric.label) + '</span><strong>' + escapeHtml(metric.value) + '</strong><small>' + escapeHtml(metric.note) + '</small></article>';
        }).join('') + '</div>' +
        '<div class="deck-caution"><strong>需要注意</strong><p>' + cautions.map(escapeHtml).join(' · ') + '</p></div>' +
        '<div class="deck-source-row"><span class="deck-source-status">' + escapeHtml(verificationLabel(detail)) + '</span><span>' + sourceCount + ' 个来源</span><span>最近核验 ' + escapeHtml(verifiedAt) + '</span></div>' +
        '<div class="deck-actions">' +
          '<a class="deck-route-link" data-route-link="true" href="' + escapeHtml(makeRouteUrl(item)) + '">查看该目的地康养线路图 →</a>' +
          '<button class="deck-evidence-link" type="button" data-evidence-index="' + item.rank + '">查看可信依据</button>' +
          '<a class="deck-detail-link" href="destination.html?destination_id=' + encodeURIComponent(destination.id) + '&destination_name=' + encodeURIComponent(destination.name) + '">查看目的地深度体验</a>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function summarySlide(items, results) {
    var rows = items.map(function (item) {
      var destination = item.destination;
      return '<div class="deck-comparison-row">' +
        '<strong>' + String(item.rank + 1).padStart(2, '0') + '</strong>' +
        '<strong>' + escapeHtml(destination.name) + '</strong>' +
        '<span>' + escapeHtml(item.recommendation.match_level || '一般') + '</span>' +
        '<small>' + escapeHtml(destination.best_season || destination.climate || '季节信息待核验') + '</small>' +
        '<button data-jump-index="' + item.rank + '">查看</button>' +
      '</div>';
    }).join('');
    var mode = results.engine_mode === 'llm' ? '大语言模型分析' : '规则降级匹配';
    var gapText = '实时天气、动态价格、具体住址到医院的车程和个人医疗适配仍需在决策前核验。';

    return '<section class="deck-slide deck-summary-slide" data-slide-index="summary" aria-label="推荐总结">' +
      '<div class="deck-summary">' +
        '<div class="deck-rankline"><span>Decision summary</span></div>' +
        '<h2>五个选择，<br>一个更清楚的决定</h2>' +
        '<p class="deck-summary-intro">' + escapeHtml(results.summary || '建议先从最佳匹配目的地开始试住，再根据身体感受、生活便利与真实费用逐步缩小选择范围。') + '</p>' +
        '<div class="deck-comparison">' + rows + '</div>' +
        '<div class="deck-summary-foot">' +
          '<article class="deck-summary-card"><strong>分析方式</strong><p>' + escapeHtml(mode) + (results.degraded_reason ? '；降级原因：' + escapeHtml(results.degraded_reason) : '') + '</p></article>' +
          '<article class="deck-summary-card"><strong>仍需补充的数据</strong><p>' + escapeHtml(gapText) + '</p></article>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function bindRouteLinks() {
    elements.slides.querySelectorAll('[data-route-link]').forEach(function (link) {
      link.addEventListener('click', function () {
        var slide = link.closest('.deck-slide');
        var index = Number(slide && slide.dataset.slideIndex);
        var item = state.items[index];
        if (!item) return;
        writeSession(ROUTE_CONTEXT_KEY, {
          destination: item.destination,
          recommendation: item.recommendation,
          analysis_context: state.analysisRequest,
          created_at: new Date().toISOString(),
        });
      });
    });
  }

  function initMap() {
    if (!window.ol || !elements.map) {
      elements.mapNote.textContent = 'OpenLayers 未加载，地点文字与坐标仍可继续查看。';
      return;
    }
    state.markerSource = new ol.source.Vector();
    var markerLayer = new ol.layer.Vector({ source: state.markerSource });
    var tileLayer = new ol.layer.Tile({
      source: new ol.source.OSM({ crossOrigin: 'anonymous' }),
      opacity: .68,
    });
    state.mapView = new ol.View({
      center: ol.proj.fromLonLat([104.19, 35.86]),
      zoom: 4.5,
      minZoom: 3,
      maxZoom: 16,
    });
    state.map = new ol.Map({
      target: elements.map,
      layers: [tileLayer, markerLayer],
      view: state.mapView,
      controls: ol.control.defaults.defaults({ rotate: false }).extend([
        new ol.control.ScaleLine({ units: 'metric' }),
      ]),
    });
    state.map.once('rendercomplete', function () {
      elements.mapNote.textContent = '目的地位置 · OpenLayers 常驻地图';
    });
  }

  function markerStyle(item) {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: item.rank === 0 ? 10 : 8,
        fill: new ol.style.Fill({ color: item.rank === 0 ? '#ddbe7d' : '#89bfa4' }),
        stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,.94)', width: 2 }),
      }),
      text: new ol.style.Text({
        text: String(item.rank + 1),
        font: '700 10px sans-serif',
        fill: new ol.style.Fill({ color: '#102521' }),
        offsetY: 1,
      }),
    });
  }

  function updateMap(item) {
    if (!item) return;
    var destination = item.destination;
    elements.mapPlace.textContent = destination.name;
    if (!state.map || !Number.isFinite(Number(destination.longitude)) || !Number.isFinite(Number(destination.latitude))) {
      elements.mapNote.textContent = '当前目的地坐标待核验，地图暂不移动。';
      return;
    }
    var center = ol.proj.fromLonLat([Number(destination.longitude), Number(destination.latitude)]);
    if (!state.markerFeature) {
      state.markerFeature = new ol.Feature({ geometry: new ol.geom.Point(center) });
      state.markerSource.addFeature(state.markerFeature);
    } else {
      state.markerFeature.getGeometry().setCoordinates(center);
    }
    state.markerFeature.setStyle(markerStyle(item));
    if (reducedMotion) state.mapView.setCenter(center);
    else state.mapView.animate({ center: center, zoom: 8.5, duration: 900 });
    setTimeout(function () { state.map.updateSize(); }, 60);
  }

  function updateProgress() {
    var isSummary = state.index >= state.items.length;
    if (isSummary) {
      elements.progressValue.textContent = '总结';
      elements.progressLabel.textContent = '比较与下一步';
      elements.progressBar.style.width = '100%';
    } else {
      elements.progressValue.textContent = String(state.index + 1).padStart(2, '0') + ' / ' + String(state.items.length).padStart(2, '0');
      elements.progressLabel.textContent = state.index === 0 ? '最佳匹配' : state.items[state.index].destination.name;
      elements.progressBar.style.width = ((state.index + 1) / state.items.length * 100) + '%';
    }
    elements.prev.disabled = state.index === 0;
    elements.next.disabled = state.index === state.slides.length - 1;
    elements.mapShell.classList.toggle('is-summary', isSummary);
  }

  function goTo(nextIndex) {
    var safeIndex = Math.max(0, Math.min(state.slides.length - 1, nextIndex));
    state.index = safeIndex;
    state.slides.forEach(function (slide, index) {
      slide.classList.toggle('is-active', index === safeIndex);
      slide.classList.toggle('is-before', index < safeIndex);
      slide.setAttribute('aria-hidden', index === safeIndex ? 'false' : 'true');
    });
    if (safeIndex < state.items.length) updateMap(state.items[safeIndex]);
    updateProgress();
  }

  function bindNavigation() {
    elements.prev.addEventListener('click', function () { goTo(state.index - 1); });
    elements.next.addEventListener('click', function () { goTo(state.index + 1); });
    elements.slides.addEventListener('click', function (event) {
      var jump = event.target.closest('[data-jump-index]');
      if (jump) goTo(Number(jump.dataset.jumpIndex));
    });
    document.addEventListener('keydown', function (event) {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') goTo(state.index + 1);
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') goTo(state.index - 1);
      if (event.key === 'Home') goTo(0);
      if (event.key === 'End') goTo(state.slides.length - 1);
    });

    var touchStart = null;
    elements.report.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1 || event.target.closest('a,button,.deck-map')) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    elements.report.addEventListener('touchend', function (event) {
      if (!touchStart || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - touchStart.x;
      var dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      goTo(state.index + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  function bindEvidenceDrawer() {
    if (!elements.evidenceDrawer || !elements.evidenceForm) return;
    elements.slides.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-evidence-index]');
      if (trigger) openEvidenceDrawer(Number(trigger.dataset.evidenceIndex));
    });
    elements.evidenceClose.addEventListener('click', closeEvidenceDrawer);
    elements.evidenceBackdrop.addEventListener('click', closeEvidenceDrawer);
    elements.evidenceForm.addEventListener('submit', function (event) {
      event.preventDefault();
      askDeckEvidence();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !elements.evidenceDrawer.hidden) closeEvidenceDrawer();
    });
  }

  function openEvidenceDrawer(index) {
    var item = state.items[index];
    if (!item) return;
    state.evidenceItem = item;
    elements.evidenceTitle.textContent = item.destination.name + ' · 可信依据';
    elements.evidenceIntro.textContent = '只检索与' + item.destination.name + '匹配、仍在有效期内的政府或机构资料。';
    elements.evidenceQuestion.value = item.destination.name + '有哪些可信的环境与医疗依据？';
    elements.evidenceAnswer.innerHTML = '<p>点击“查找依据”，查看当前语料能支持的结论；没有资料时会明确拒答。</p>';
    elements.evidenceBackdrop.hidden = false;
    elements.evidenceDrawer.hidden = false;
    elements.evidenceDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-evidence-open');
    elements.evidenceQuestion.focus();
  }

  function closeEvidenceDrawer() {
    elements.evidenceBackdrop.hidden = true;
    elements.evidenceDrawer.hidden = true;
    elements.evidenceDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-evidence-open');
  }

  function askDeckEvidence() {
    var item = state.evidenceItem;
    var question = String(elements.evidenceQuestion.value || '').trim();
    var destinationKey = item && item.detail && item.detail.destination_key;
    if (!item || question.length < 2) return;
    if (!destinationKey || !window.HealthTravelAPI || !window.HealthTravelAPI.answerEvidence) {
      elements.evidenceAnswer.innerHTML = '<p class="is-error">当前目的地尚未建立可查询的证据索引。</p>';
      return;
    }
    elements.evidenceAnswer.setAttribute('aria-busy', 'true');
    elements.evidenceAnswer.innerHTML = '<p>正在检索已授权资料…</p>';
    window.HealthTravelAPI.answerEvidence({ query: question, destination_key: destinationKey, limit: 4 })
      .then(function (result) { renderDeckEvidence(result); })
      .catch(function (error) {
        elements.evidenceAnswer.innerHTML = '<p class="is-error">证据服务暂时无法响应：' + escapeHtml(error.message || '请稍后重试') + '</p>';
      }).finally(function () {
        elements.evidenceAnswer.removeAttribute('aria-busy');
      });
  }

  function renderDeckEvidence(result) {
    var citations = result && result.status === 'grounded' && Array.isArray(result.citations) ? result.citations : [];
    if (!citations.length) {
      var gaps = result && result.retrieval && result.retrieval.meta && result.retrieval.meta.missing_data || [];
      elements.evidenceAnswer.innerHTML = '<span class="deck-evidence-state">证据不足</span><h3>当前资料不能可靠回答</h3><p>'
        + escapeHtml(gaps[0] || '没有找到符合当前目的地和有效期要求的证据。') + '</p>';
      return;
    }
    elements.evidenceAnswer.innerHTML = '<span class="deck-evidence-state is-grounded">有依据的回答</span><p class="deck-evidence-text">'
      + escapeHtml(result.answer) + '</p><div class="deck-evidence-citations">' + citations.map(function (citation) {
        var meta = [citation.publisher, citation.verified_at ? '核验于 ' + citation.verified_at : ''].filter(Boolean).join(' · ');
        return '<article><strong>' + escapeHtml(citation.citation_id + ' · ' + citation.heading) + '</strong><p>'
          + escapeHtml(citation.content) + '</p><small>' + escapeHtml(meta) + '</small><a href="'
          + escapeAttribute(citation.url) + '" target="_blank" rel="noopener noreferrer">原始来源 ↗</a></article>';
      }).join('') + '</div>';
  }

  function setupFocusedJump(focusedName) {
    if (!focusedName) return;
    var index = state.items.findIndex(function (item) { return item.destination.name === focusedName; });
    if (index < 0) {
      elements.contextJump.hidden = false;
      elements.contextJump.textContent = '您关注的「' + focusedName + '」未进入前五';
      elements.contextJump.disabled = true;
      return;
    }
    if (index === 0) return;
    elements.contextJump.hidden = false;
    elements.contextJump.textContent = '查看您从 Act2 关注的「' + focusedName + '」· 第 ' + (index + 1) + ' 名';
    elements.contextJump.addEventListener('click', function () { goTo(index); });
  }

  function engineLabel(results) {
    var label = results.engine_mode === 'llm'
      ? (results.provider || 'AI') + (results.model ? ' · ' + results.model : '')
      : '规则匹配' + (results.degraded_reason ? ' · 已说明降级原因' : '');
    if (results.analysis_time) {
      var analyzedAt = new Date(results.analysis_time);
      var timeText = Number.isNaN(analyzedAt.getTime())
        ? results.analysis_time
        : analyzedAt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      label += ' · 分析于 ' + timeText;
    }
    return label;
  }

  async function resolveDestinations() {
    var cached = readSession(DESTINATIONS_KEY) || [];
    try {
      if (window.HealthTravelAPI && window.HealthTravelAPI.getDestinations) {
        return await window.HealthTravelAPI.getDestinations();
      }
    } catch (error) {
      console.warn('[M3] 统一目的地接口加载失败，使用问卷缓存', error.message);
    }
    if (window.HealthTravelAPI && window.HealthTravelAPI.normalizeDestinations) {
      return window.HealthTravelAPI.normalizeDestinations(cached);
    }
    return cached;
  }

  async function boot() {
    elements.loading = byId('deck-loading');
    elements.empty = byId('deck-empty');
    elements.report = byId('deck-report');
    elements.slides = byId('deck-slides');
    elements.prev = byId('deck-prev');
    elements.next = byId('deck-next');
    elements.progressValue = byId('deck-progress-value');
    elements.progressLabel = byId('deck-progress-label');
    elements.progressBar = byId('deck-progress-bar');
    elements.map = byId('results-map');
    elements.mapShell = byId('deck-map-shell');
    elements.mapPlace = byId('deck-map-place');
    elements.mapNote = byId('deck-map-note');
    elements.contextJump = byId('deck-context-jump');
    elements.evidenceBackdrop = byId('deck-evidence-backdrop');
    elements.evidenceDrawer = byId('deck-evidence-drawer');
    elements.evidenceClose = byId('deck-evidence-close');
    elements.evidenceTitle = byId('deck-evidence-title');
    elements.evidenceIntro = byId('deck-evidence-intro');
    elements.evidenceForm = byId('deck-evidence-form');
    elements.evidenceQuestion = byId('deck-evidence-question');
    elements.evidenceAnswer = byId('deck-evidence-answer');
    setScreenState('loading');

    var results = readSession(RESULTS_KEY);
    if (!results || !Array.isArray(results.recommendations) || !results.recommendations.length) {
      setScreenState('empty');
      return;
    }

    state.results = results;
    state.analysisRequest = results.analysis_context || readSession(REQUEST_KEY) || null;
    var data = await Promise.all([
      resolveDestinations(),
      loadJson(DETAILS_URL, { destinations: [], updated_at: null }),
    ]);
    var destinations = data[0] || [];
    var detailsDataset = data[1] || { destinations: [] };
    var details = detailsDataset.destinations || [];
    var profileChips = buildProfileChips(state.analysisRequest);
    var focusedName = state.analysisRequest && state.analysisRequest.mode === 'destination' && state.analysisRequest.destination
      ? state.analysisRequest.destination.name : '';

    state.items = results.recommendations.slice(0, 5).map(function (rec, index) {
      var destination = findDestination(rec, destinations);
      return { recommendation: rec, destination: destination, detail: findDetail(destination, details), rank: index };
    });

    elements.slides.innerHTML = state.items.map(function (item) {
      return destinationSlide(item, profileChips, focusedName);
    }).join('') + summarySlide(state.items, results);
    state.slides = Array.from(elements.slides.querySelectorAll('.deck-slide'));

    byId('deck-engine-status').textContent = engineLabel(results);
    setScreenState('report');

    bindRouteLinks();
    bindNavigation();
    bindEvidenceDrawer();
    initMap();
    setupFocusedJump(focusedName);
    goTo(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
