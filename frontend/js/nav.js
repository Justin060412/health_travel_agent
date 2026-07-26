/**
 * AI 康养旅居 — Navigation
 * Apple 风格滚动毛玻璃效果
 *
 * 监听页面滚动，切换 .nav-scrolled class
 * 使用 rAF 节流，确保 60fps 性能
 */

(function () {
  'use strict';

  var nav = document.querySelector('.nav');
  if (!nav) return;

  var SCROLL_THRESHOLD = 60; // 滚动超过此值触发毛玻璃
  var ticking = false;

  /**
   * 更新导航栏状态
   */
  function updateNav() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollY > SCROLL_THRESHOLD) {
      nav.classList.add('nav-scrolled');
    } else {
      nav.classList.remove('nav-scrolled');
    }

    ticking = false;
  }

  /**
   * rAF 节流的滚动处理
   */
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }

  var hasHero = !!document.querySelector('.hero');

  /**
   * 初始化：检查页面加载时的滚动位置
   */
  function init() {
    // 如果页面没有 Hero（questionnaire.html / results.html），导航始终为 scrolled
    if (!hasHero) {
      nav.classList.add('nav-scrolled');
      return;
    }

    // 立即检查当前滚动位置（处理浏览器恢复滚动位置的情况）
    updateNav();

    // 监听滚动
    window.addEventListener('scroll', onScroll, { passive: true });

    // 监听页面显示（处理浏览器前进后退时的缓存恢复）
    window.addEventListener('pageshow', function () {
      updateNav();
    });

    // 监听 prefers-reduced-motion 变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function () {
        updateNav();
      });
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
