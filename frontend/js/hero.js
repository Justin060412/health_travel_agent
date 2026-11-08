/**
 * AI 康养旅居 — Hero
 * 入场动画 + 玻璃数据面板 + Mouse Parallax
 *
 * 数据全部来自统一数据层 window.HealthTravelAPI.getDestinationsSnapshot()，
 * 不在本文件内发起请求，也不硬编码任何指标数值。
 * 读取标准化结构：air_quality.index / temperature.average /
 * forest_coverage / medical_level / province。
 *
 * 数据来源如实展示：
 *   api         — 目的地数据库 · 静态汇总，非实时监测
 *   api+geojson — 数据库 + 本地静态资料补充 · 内容待统一核验
 *   geojson     — 本地静态目的地资料 · 后端暂不可用
 *
 * 数字使用计数动画（count-up），仅在数值有效时执行。
 *
 * Sprint 6 Phase 3: 新增 Mouse Parallax 空间深度效果
 *   背景 ±15px | 面板反向 ±5px | 标题 ±3px | 标签 ±2px
 *   全部 rAF 驱动，will-change GPU 加速，60fps
 */

(function () {
  'use strict';

  // ── 面板文案 ───────────────────────────────────────────
  var PENDING_TEXT = '载入中';
  var MISSING_TEXT = '待核验';

  // 数据来源文案：按实际数据源说明，不把静态数据描述成实时监测或已核验内容
  var SOURCE_LINES = {
    'api': '数据来源：目的地数据库 · 静态汇总，非实时监测',
    'api+geojson': '数据来源：目的地数据库 + 本地静态资料补充 · 非实时监测 · 内容待统一核验',
    'geojson': '数据来源：本地静态目的地资料 · 后端暂不可用 · 非实时监测',
    'github-pages-static': '数据来源：本地静态目的地资料 · GitHub Pages 预览 · 非实时监测',
  };

  // ── Parallax 元素引用 ──────────────────────────────────
  var heroEl = null;
  var bgEl = null;
  var panelEl = null;
  var titleEl = null;
  var eyebrowEl = null;
  var parallaxActive = false;

  /**
   * 数字计数动画
   * @param {HTMLElement} el - 目标元素
   * @param {number} target - 目标数值
   * @param {number} duration - 动画时长 (ms)
   * @param {boolean} isFloat - 是否为浮点数
   */
  function countUp(el, target, duration, isFloat) {
    if (target == null || isNaN(target)) {
      el.textContent = '--';
      return;
    }

    // 支持 prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = isFloat ? target.toFixed(1) : Math.round(target);
      return;
    }

    var startTime = null;
    var startValue = 0;
    var decimals = isFloat ? 1 : 0;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / (duration || 1000), 1);
      // easeOutExpo
      var eased = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 4);
      var current = startValue + (target - startValue) * eased;

      el.textContent = current.toFixed(decimals);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  /**
   * 安全解析字符串数字（如 "78.4%"、"20.5℃"）。
   * 对 null、空字符串、"待核验"/"暂无" 等无数字内容返回 null。
   * @param {*} text - 待解析的原始值
   * @returns {number|null}
   */
  function parseNumeric(text) {
    if (text === undefined || text === null) return null;
    var str = String(text).trim();
    if (!str || str === '--' || str === '-' || /待核验|暂无|未知/.test(str)) return null;
    var match = str.match(/-?\d+(?:\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

  /**
   * 更新 Hero 玻璃面板数据
   * @param {Array} destinations - 标准化目的地数组（HealthTravelAPI 统一结构）
   * @param {Object} meta - 数据快照元信息（source / database_snapshot_updated_at / verification_status）
   */
  function updateHeroPanel(destinations, meta) {
    var elAqi = document.getElementById('hero-aqi');
    var elForest = document.getElementById('hero-forest');
    var elProvince = document.getElementById('hero-provinces');
    var elMedical = document.getElementById('hero-medical');
    var elAqiLabel = document.getElementById('hero-aqi-label');

    if (!destinations || !destinations.length) {
      // 数据确实缺失：明确标注待核验，不伪装成 0 或一直停在 --
      if (elAqi) elAqi.textContent = MISSING_TEXT;
      if (elForest) elForest.textContent = MISSING_TEXT;
      if (elProvince) elProvince.textContent = MISSING_TEXT;
      if (elMedical) elMedical.textContent = MISSING_TEXT;
      if (elAqiLabel) elAqiLabel.textContent = MISSING_TEXT;
      updateSourceLine(meta);
      return;
    }

    var aqiValues = [];
    var forestValues = [];
    var tempValues = [];
    var provinces = new Set();
    var medicalLevels = {};

    destinations.forEach(function (d) {
      if (d.province && String(d.province).trim()) provinces.add(String(d.province).trim());

      // 标准化结构：air_quality.index / temperature.average / forest_coverage / medical_level
      var aqi = d.air_quality ? d.air_quality.index : null;
      if (typeof aqi === 'number' && isFinite(aqi)) aqiValues.push(aqi);

      var forest = parseNumeric(d.forest_coverage);
      if (forest !== null) forestValues.push(forest);

      var temp = d.temperature ? parseNumeric(d.temperature.average) : null;
      if (temp !== null) tempValues.push(temp);

      var medical = d.medical_level ? String(d.medical_level).trim() : '';
      if (medical && medical !== MISSING_TEXT) {
        medicalLevels[medical] = (medicalLevels[medical] || 0) + 1;
      }
    });

    // 计算平均值（全部基于数据计算，不硬编码任何指标数值）
    var avgAqi = aqiValues.length
      ? Math.round(aqiValues.reduce(function (a, b) { return a + b; }, 0) / aqiValues.length)
      : null;
    var avgForest = forestValues.length
      ? forestValues.reduce(function (a, b) { return a + b; }, 0) / forestValues.length
      : null;
    var avgTemp = tempValues.length
      ? tempValues.reduce(function (a, b) { return a + b; }, 0) / tempValues.length
      : null;

    // 最主流医疗等级
    var topMedical = MISSING_TEXT;
    var maxCount = 0;
    Object.keys(medicalLevels).forEach(function (level) {
      if (medicalLevels[level] > maxCount) {
        maxCount = medicalLevels[level];
        topMedical = level;
      }
    });

    // 空气质量描述
    var aqiLabel = MISSING_TEXT;
    if (avgAqi !== null) {
      if (avgAqi <= 50) aqiLabel = '优质';
      else if (avgAqi <= 100) aqiLabel = '良好';
      else aqiLabel = '一般';
    }

    // 更新 DOM（仅在元素存在时）——只有数值有效时才执行 countUp
    if (elAqi) {
      if (avgAqi !== null) countUp(elAqi, avgAqi, 1200, false);
      else elAqi.textContent = MISSING_TEXT;
    }
    if (elForest) {
      if (avgForest !== null) countUp(elForest, avgForest, 1200, true);
      else elForest.textContent = MISSING_TEXT;
    }
    if (elProvince) {
      if (provinces.size > 0) countUp(elProvince, provinces.size, 1000, false);
      else elProvince.textContent = MISSING_TEXT;
    }
    if (elMedical) {
      elMedical.textContent = topMedical;
    }
    if (elAqiLabel) {
      elAqiLabel.textContent = aqiLabel;
    }

    // 更新 Hero 统计数字行（向后兼容；当前首页无此元素）
    var elStats = document.getElementById('hero-stats');
    if (elStats) {
      elStats.innerHTML =
        '<span>覆盖 <strong>' + provinces.size + '</strong> 个省份</span>' +
        '<span>平均 AQI <strong>' + (avgAqi !== null ? avgAqi : MISSING_TEXT) + '</strong></span>' +
        '<span>森林覆盖 <strong>' + (avgForest !== null ? avgForest.toFixed(1) + '%' : MISSING_TEXT) + '</strong></span>' +
        '<span>年均气温 <strong>' + (avgTemp !== null ? avgTemp.toFixed(1) + '℃' : MISSING_TEXT) + '</strong></span>';
    }

    updateSourceLine(meta);
  }

  /**
   * 按实际数据源更新来源说明。
   * 静态数据不得被描述成实时监测或已核验内容；
   * 数据库快照时间仅表示文件更新时间，不是内容核验时间。
   * @param {Object} meta - 数据快照元信息
   */
  function updateSourceLine(meta) {
    var sourceEl = document.getElementById('hero-data-source');
    if (!sourceEl) return;

    var source = meta && meta.source ? meta.source : 'geojson';
    var line = SOURCE_LINES[source] || SOURCE_LINES.geojson;

    var snapshotAt = meta && meta.database_snapshot_updated_at;
    if ((source === 'api' || source === 'api+geojson') && snapshotAt) {
      var snapshotDate = new Date(snapshotAt);
      if (!isNaN(snapshotDate.getTime())) {
        line += ' · 数据库快照更新于 ' + snapshotDate.toLocaleDateString('zh-CN');
      }
    }

    sourceEl.textContent = line;
  }

  /**
   * 请求期间显示载入中，避免占位符 -- 一直留在页面上
   */
  function showLoadingState() {
    var ids = ['hero-aqi', 'hero-forest', 'hero-provinces', 'hero-medical', 'hero-aqi-label'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = PENDING_TEXT;
    });
    var sourceEl = document.getElementById('hero-data-source');
    if (sourceEl) sourceEl.textContent = '数据来源：正在载入…';
  }

  /**
   * 通过统一数据层 HealthTravelAPI 加载目的地快照并更新面板
   */
  async function loadHeroData() {
    showLoadingState();

    var api = window.HealthTravelAPI;
    if (!api || typeof api.getDestinationsSnapshot !== 'function') {
      console.warn('[Hero] 统一数据层不可用');
      updateHeroPanel([], null);
      return [];
    }

    try {
      var snapshot = await api.getDestinationsSnapshot();
      updateHeroPanel(snapshot.results || [], snapshot.meta || {});
      return snapshot.results || [];
    } catch (error) {
      console.warn('[Hero] 目的地数据加载失败:', error.message);
      updateHeroPanel([], null);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Mouse Parallax — 空间深度
  // ═══════════════════════════════════════════════════════

  var mouseX = 0;
  var mouseY = 0;
  var targetX = 0;
  var targetY = 0;
  var ticking = false;

  /**
   * 计算鼠标相对于视口中心的位置（-1 到 1）
   */
  function onMouseMove(e) {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;  // -1 ~ 1
    targetY = (e.clientY / window.innerHeight - 0.5) * 2; // -1 ~ 1
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  /**
   * 应用 Parallax 变换（rAF 驱动，60fps）
   */
  function updateParallax() {
    // 平滑插值（降低灵敏度，产生惯性）
    mouseX += (targetX - mouseX) * 0.08;
    mouseY += (targetY - mouseY) * 0.08;

    if (!parallaxActive) {
      ticking = false;
      return;
    }

    // 背景：±15px（与鼠标反向，产生景深感）
    // CSS 动画 heroBgReveal 在 1.6s 已完成，此时覆写 transform 安全
    if (bgEl) {
      var bgX = -mouseX * 15;
      var bgY = -mouseY * 15;
      bgEl.style.transform = 'scale(1.06) translate(' + bgX.toFixed(2) + 'px, ' + bgY.toFixed(2) + 'px)';
    }

    // 玻璃面板：反向 ±5px（靠近用户侧）
    if (panelEl) {
      var panelX = mouseX * 5;
      var panelY = mouseY * 5;
      panelEl.style.transform = 'translate(' + panelX.toFixed(2) + 'px, ' + panelY.toFixed(2) + 'px)';
    }

    // 标题：±3px
    if (titleEl) {
      var titleX = mouseX * 3;
      var titleY = mouseY * 3;
      titleEl.style.transform = 'translate(' + titleX.toFixed(2) + 'px, ' + titleY.toFixed(2) + 'px)';
    }

    // 标签：±2px
    if (eyebrowEl) {
      var ebX = mouseX * 2;
      var ebY = mouseY * 2;
      eyebrowEl.style.transform = 'translate(' + ebX.toFixed(2) + 'px, ' + ebY.toFixed(2) + 'px)';
    }

    ticking = false;
  }

  /**
   * 初始化 Parallax
   */
  function initParallax() {
    heroEl = document.querySelector('.hero');
    if (!heroEl) return;

    bgEl = heroEl.querySelector('.hero-bg-image');
    panelEl = heroEl.querySelector('.hero-panel');
    titleEl = heroEl.querySelector('.hero-title');
    eyebrowEl = heroEl.querySelector('.hero-eyebrow');

    if (!bgEl && !panelEl) return; // 无 parallax 目标

    // 添加 class 标记
    if (bgEl) bgEl.classList.add('hero-parallax-bg');
    if (panelEl) panelEl.classList.add('hero-parallax-panel');
    if (titleEl) titleEl.classList.add('hero-parallax-title');
    if (eyebrowEl) eyebrowEl.classList.add('hero-parallax-eyebrow');

    // 检查 reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return; // 尊重用户偏好
    }

    parallaxActive = true;
    document.addEventListener('mousemove', onMouseMove, { passive: true });

    // 鼠标离开 Hero 区域时缓慢归位
    heroEl.addEventListener('mouseleave', function () {
      targetX = 0;
      targetY = 0;
    });
  }

  /**
   * 销毁 Parallax（清理事件监听）
   */
  function destroyParallax() {
    parallaxActive = false;
    document.removeEventListener('mousemove', onMouseMove);
    if (bgEl) { bgEl.style.transform = ''; bgEl.classList.remove('hero-parallax-bg'); }
    if (panelEl) { panelEl.style.transform = ''; panelEl.classList.remove('hero-parallax-panel'); }
    if (titleEl) { titleEl.style.transform = ''; titleEl.classList.remove('hero-parallax-title'); }
    if (eyebrowEl) { eyebrowEl.style.transform = ''; eyebrowEl.classList.remove('hero-parallax-eyebrow'); }
  }

  /**
   * 初始化 Hero
   */
  function init() {
    // 数据加载（不阻塞入场动画）
    loadHeroData();

    // 初始化 Parallax（延迟确保 CSS 入场动画先完成）
    // CSS 动画 heroBgReveal 在 1.6s 完成，parallax 在 1.7s 启动
    setTimeout(function () {
      initParallax();
    }, 1700);

    // 在动画全部完成后标记为已加载
    var hero = document.querySelector('.hero');
    if (hero) {
      setTimeout(function () {
        hero.classList.add('hero-loaded');
      }, 1600);
    }
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 挂载到全局（供外部使用 parallax 控制）
  window.HealthTravelHero = {
    initParallax: initParallax,
    destroyParallax: destroyParallax,
    countUp: countUp,
    updateHeroPanel: updateHeroPanel,
    parseNumeric: parseNumeric,
  };
})();
