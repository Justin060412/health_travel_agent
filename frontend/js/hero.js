/**
 * AI 康养旅居 — Hero
 * 入场动画 + 玻璃数据面板实时更新 + Mouse Parallax
 *
 * 数据全部来自 API，不硬编码
 * 数字使用计数动画（count-up）
 *
 * Sprint 6 Phase 3: 新增 Mouse Parallax 空间深度效果
 *   背景 ±15px | 面板反向 ±5px | 标题 ±3px | 标签 ±2px
 *   全部 rAF 驱动，will-change GPU 加速，60fps
 */

(function () {
  'use strict';

  var API_BASE = 'http://127.0.0.1:8000';

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
   * 更新 Hero 玻璃面板数据
   * @param {Array} destinations - 目的地数据数组
   */
  function updateHeroPanel(destinations) {
    if (!destinations || !destinations.length) return;

    var count = destinations.length;
    var aqiValues = [];
    var forestValues = [];
    var tempValues = [];
    var provinces = new Set();
    var medicalLevels = {};

    destinations.forEach(function (d) {
      if (d.province) provinces.add(d.province);
      if (d.air_quality_index != null) aqiValues.push(d.air_quality_index);
      if (d.forest_coverage) {
        var fp = parseFloat(String(d.forest_coverage).replace(/[^\d.]/g, ''));
        if (!isNaN(fp)) forestValues.push(fp);
      }
      if (d.average_temperature) {
        var tp = parseFloat(String(d.average_temperature).replace(/[^\d.]/g, ''));
        if (!isNaN(tp)) tempValues.push(tp);
      }
      if (d.medical_level) {
        medicalLevels[d.medical_level] = (medicalLevels[d.medical_level] || 0) + 1;
      }
    });

    // 计算平均值
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
    var topMedical = '--';
    var maxCount = 0;
    Object.keys(medicalLevels).forEach(function (level) {
      if (medicalLevels[level] > maxCount) {
        maxCount = medicalLevels[level];
        topMedical = level;
      }
    });

    // 空气质量描述
    var aqiLabel = '--';
    if (avgAqi !== null) {
      if (avgAqi <= 50) aqiLabel = '优质';
      else if (avgAqi <= 100) aqiLabel = '良好';
      else aqiLabel = '一般';
    }

    // 更新 DOM（仅在元素存在时）
    var elAqi = document.getElementById('hero-aqi');
    var elForest = document.getElementById('hero-forest');
    var elProvince = document.getElementById('hero-provinces');
    var elMedical = document.getElementById('hero-medical');

    if (elAqi && avgAqi !== null) {
      countUp(elAqi, avgAqi, 1200, false);
    }
    if (elForest && avgForest !== null) {
      countUp(elForest, avgForest, 1200, true);
    }
    if (elProvince) {
      countUp(elProvince, provinces.size, 1000, false);
    }
    if (elMedical) {
      elMedical.textContent = topMedical;
    }

    // 空气质量标签
    var elAqiLabel = document.getElementById('hero-aqi-label');
    if (elAqiLabel) {
      elAqiLabel.textContent = aqiLabel;
    }

    // 更新 Hero 统计数字行（向后兼容）
    var elStats = document.getElementById('hero-stats');
    if (elStats) {
      elStats.innerHTML =
        '<span>覆盖 <strong>' + provinces.size + '</strong> 个省份</span>' +
        '<span>平均 AQI <strong>' + (avgAqi !== null ? avgAqi : '--') + '</strong></span>' +
        '<span>森林覆盖 <strong>' + (avgForest !== null ? avgForest.toFixed(1) + '%' : '--') + '</strong></span>' +
        '<span>年均气温 <strong>' + (avgTemp !== null ? avgTemp.toFixed(1) + '℃' : '--') + '</strong></span>';
    }
  }

  /**
   * 从 API 加载数据并更新面板
   */
  async function loadHeroData() {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 8000);

    try {
      var resp = await fetch(API_BASE + '/api/destinations', { signal: ctrl.signal });
      clearTimeout(tid);
      if (resp.ok) {
        var data = await resp.json();
        var destinations = data.results || [];
        updateHeroPanel(destinations);
        return destinations;
      }
    } catch (e) {
      console.warn('[Hero] API 数据加载失败:', e.message);
    }
    clearTimeout(tid);
    return [];
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
  };
})();
