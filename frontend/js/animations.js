/**
 * AI 康养旅居 — Animations & Scroll Storytelling
 * Scroll Reveal · 数字计数 · 入场序列
 *
 * Sprint 6 Phase 3: Scroll Storytelling
 *   Hero → Overview 淡入 → Cards 错开飞入 → Map 浮现 → Footer
 *   使用 IntersectionObserver + CSS transform/opacity
 *   全部动画 600-900ms，ease-out-expo
 */

(function () {
  'use strict';

  /**
   * 数字计数动画
   * @param {HTMLElement} el
   * @param {number} target
   * @param {number} duration ms
   */
  function countUp(el, target, duration) {
    if (target == null || isNaN(target)) {
      el.textContent = '--';
      return;
    }

    // prefers-reduced-motion: 直接显示终值
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target % 1 !== 0 ? target.toFixed(1) : Math.round(target);
      return;
    }

    var startTime = null;
    var startValue = 0;
    var isFloat = target % 1 !== 0;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / (duration || 1000), 1);
      // easeOutExpo: 1 - (1-p)^4
      var eased = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 4);
      var current = startValue + (target - startValue) * eased;

      el.textContent = isFloat ? current.toFixed(1) : Math.round(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // ═══════════════════════════════════════════════════════
  //  Scroll Storytelling
  // ═══════════════════════════════════════════════════════

  /**
   * 检查是否支持 IntersectionObserver
   */
  function supportsIO() {
    return 'IntersectionObserver' in window &&
           !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * 通用 Scroll Reveal — 元素进入视口时添加 .revealed
   */
  function initScrollReveal() {
    var revealElements = document.querySelectorAll('[data-reveal]');
    if (!revealElements.length) return;

    if (!supportsIO()) {
      revealElements.forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );

    revealElements.forEach(function (el) { observer.observe(el); });
  }

  /**
   * Overview 磁贴错开入场
   */
  function initOverviewReveal() {
    var grid = document.getElementById('overview-grid');
    if (!grid) return;

    var tiles = grid.querySelectorAll('.overview-tile');
    if (!tiles.length) return;

    if (!supportsIO()) {
      tiles.forEach(function (t) { t.style.opacity = '1'; t.style.transform = 'none'; });
      return;
    }

    // 初始隐藏
    tiles.forEach(function (tile, i) {
      tile.style.opacity = '0';
      tile.style.transform = 'translateY(20px)';
      tile.style.transition =
        'opacity 0.5s ' + 'cubic-bezier(0.19,1,0.22,1) ' + (0.06 * i) + 's,' +
        'transform 0.5s ' + 'cubic-bezier(0.19,1,0.22,1) ' + (0.06 * i) + 's';
    });

    var observer = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          tiles.forEach(function (tile) {
            tile.style.opacity = '1';
            tile.style.transform = 'translateY(0)';
          });
          observer.disconnect();
        }
      },
      { threshold: 0.10 }
    );
    observer.observe(grid);
  }

  /**
   * 卡片飞入 — 依次从下方滑入
   */
  function initCardsReveal() {
    var grid = document.getElementById('showcase-grid');
    if (!grid) return;

    var cards = grid.querySelectorAll('.showcase-card');
    if (!cards.length) {
      // 如果卡片是 JS 动态渲染的，监听 DOM 变化后再初始化
      // 这里使用 MutationObserver 作为备选方案
      var mo = new MutationObserver(function () {
        var updatedCards = grid.querySelectorAll('.showcase-card');
        if (updatedCards.length) {
          animateCards(updatedCards);
          mo.disconnect();
        }
      });
      mo.observe(grid, { childList: true });
      return;
    }

    animateCards(cards);
  }

  function animateCards(cards) {
    if (!supportsIO()) {
      cards.forEach(function (c) { c.style.opacity = '1'; c.style.transform = 'none'; });
      return;
    }

    cards.forEach(function (card, i) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(40px)';
      card.style.transition =
        'opacity 0.6s cubic-bezier(0.19,1,0.22,1) ' + (0.10 * i) + 's,' +
        'transform 0.6s cubic-bezier(0.19,1,0.22,1) ' + (0.10 * i) + 's';
    });

    var container = cards[0].parentElement;
    var observer = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          cards.forEach(function (card) {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          });
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(container);
  }

  /**
   * 地图区块浮现 — 轻微缩放 + 淡入
   */
  function initMapReveal() {
    var mapWrap = document.querySelector('.home-map-wrap');
    if (!mapWrap) return;

    if (!supportsIO()) {
      mapWrap.style.opacity = '1';
      mapWrap.style.transform = 'none';
      return;
    }

    mapWrap.style.opacity = '0';
    mapWrap.style.transform = 'scale(0.97)';
    mapWrap.style.transition =
      'opacity 0.7s cubic-bezier(0.19,1,0.22,1),' +
      'transform 0.7s cubic-bezier(0.19,1,0.22,1)';

    var observer = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          mapWrap.style.opacity = '1';
          mapWrap.style.transform = 'scale(1)';
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(mapWrap);
  }

  /**
   * 初始化全部 Scroll Storytelling
   */
  function initScrollStorytelling() {
    initScrollReveal();
    initOverviewReveal();
    initCardsReveal();

    // 地图延迟初始化（等待 Leaflet 渲染完成）
    setTimeout(function () {
      initMapReveal();
    }, 800);
  }

  // ═══════════════════════════════════════════════════════
  //  Entrance Sequence
  // ═══════════════════════════════════════════════════════

  function initEntranceSequence() {
    // Hero 入场由 CSS 动画处理
    // 后续区块使用 Scroll Storytelling
    initScrollStorytelling();
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEntranceSequence);
  } else {
    initEntranceSequence();
  }

  // 挂载到全局
  window.HealthTravelAnimations = {
    initScrollReveal: initScrollReveal,
    initScrollStorytelling: initScrollStorytelling,
    countUp: countUp,
  };
})();
