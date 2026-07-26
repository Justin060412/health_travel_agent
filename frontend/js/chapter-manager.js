/**
 * AI 康养旅居 — Chapter Manager
 * Sprint 7: 章节式体验管理器
 *
 * 职责：
 *   - 管理章节状态（当前活跃章节索引）
 *   - 处理章节入场/退场动画
 *   - 协调 Nav 状态（Hero 透明 vs scrolled 毛玻璃）
 *   - 暴露 navigateTo() API 供所有按钮调用
 *
 * 用法：
 *   ChapterManager.navigateTo(1);  // 跳转到第 2 章
 *   ChapterManager.next();         // 下一章
 *   ChapterManager.prev();         // 上一章
 *
 * 依赖：无（独立模块）
 */

(function () {
  'use strict';

  var TRANSITION_DURATION = 800;   // 入场动画时长 (ms)
  var EXIT_DURATION = 500;         // 退场动画时长 (ms)
  var TOTAL_TRANSITION = TRANSITION_DURATION; // 总过渡时间

  var chapters = [];
  var currentIndex = 0;
  var isTransitioning = false;

  /**
   * 初始化章节管理器
   */
  function init() {
    // 收集所有章节
    var chapterElements = document.querySelectorAll('.chapter');
    chapters = Array.from(chapterElements);

    if (chapters.length === 0) {
      console.warn('ChapterManager: No .chapter elements found');
      return;
    }

    // 找到初始活跃章节
    chapters.forEach(function (ch, i) {
      if (ch.classList.contains('active')) {
        currentIndex = i;
      }
    });

    // 确保只有当前章节可见
    refreshChapterVisibility();

    // 监听 Nav 状态
    updateNavState();

    // 绑定键盘导航
    document.addEventListener('keydown', handleKeyboard);
  }

  /**
   * 导航到指定章节
   * @param {number} targetIndex - 目标章节索引 (0-based)
   * @param {string} [direction='forward'] - 'forward' | 'backward'
   */
  function navigateTo(targetIndex, direction) {
    direction = direction || (targetIndex > currentIndex ? 'forward' : 'backward');

    // 边界检查
    if (targetIndex < 0 || targetIndex >= chapters.length) return;
    if (isTransitioning) return;
    if (targetIndex === currentIndex) return;

    isTransitioning = true;

    var currentChapter = chapters[currentIndex];
    var targetChapter = chapters[targetIndex];

    // 触发自定义事件（其他模块可监听）
    var eventDetail = {
      from: currentIndex,
      to: targetIndex,
      fromId: currentChapter.id,
      toId: targetChapter.id,
      direction: direction
    };

    // 1. 当前章节退场
    currentChapter.classList.add('exiting');
    currentChapter.classList.remove('active');

    // 2. 退场动画结束后，切换章节
    setTimeout(function () {
      currentChapter.classList.remove('exiting');

      // 3. 目标章节入场
      targetChapter.classList.add('active', 'entering');

      // 强制回流以触发动画
      void targetChapter.offsetWidth;

      // 4. 滚动到章节顶部
      window.scrollTo({ top: 0, behavior: 'instant' });

      // 5. 更新状态
      currentIndex = targetIndex;
      updateNavState();
      dispatchChapterChange(eventDetail);

      // 6. 清理入场动画 class
      setTimeout(function () {
        targetChapter.classList.remove('entering');
        isTransitioning = false;
        dispatchChapterReady({ index: targetIndex, id: targetChapter.id });
      }, TRANSITION_DURATION);

    }, EXIT_DURATION);
  }

  /**
   * 下一章
   */
  function next() {
    navigateTo(currentIndex + 1, 'forward');
  }

  /**
   * 上一章
   */
  function prev() {
    navigateTo(currentIndex - 1, 'backward');
  }

  /**
   * 确保只有当前章节可见
   */
  function refreshChapterVisibility() {
    chapters.forEach(function (ch, i) {
      if (i === currentIndex) {
        ch.classList.add('active');
        ch.classList.remove('exiting', 'entering');
      } else {
        ch.classList.remove('active', 'exiting', 'entering');
      }
    });
  }

  /**
   * 更新 Nav 状态
   * Chapter 0 (Hero): 透明 nav
   * Chapter 1+: scrolled 毛玻璃 nav
   */
  function updateNavState() {
    var nav = document.querySelector('.nav');
    if (!nav) return;

    if (currentIndex === 0) {
      // Hero 章节：透明导航
      nav.classList.remove('nav-scrolled');
    } else {
      // 非 Hero 章节：毛玻璃导航
      nav.classList.add('nav-scrolled');
    }
  }

  /**
   * 触发章节切换事件
   */
  function dispatchChapterChange(detail) {
    var event = new CustomEvent('chapterchange', { detail: detail });
    document.dispatchEvent(event);
  }

  /**
   * 触发章节就绪事件
   */
  function dispatchChapterReady(detail) {
    var event = new CustomEvent('chapterready', { detail: detail });
    document.dispatchEvent(event);
  }

  /**
   * 键盘导航
   */
  function handleKeyboard(e) {
    // 仅当没有输入框聚焦时
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      prev();
    }
  }

  /**
   * 获取当前章节信息
   */
  function getCurrent() {
    return {
      index: currentIndex,
      id: chapters[currentIndex] ? chapters[currentIndex].id : null,
      element: chapters[currentIndex] || null
    };
  }

  /**
   * 获取章节总数
   */
  function getCount() {
    return chapters.length;
  }

  // ── 公共 API ────────────────────────────────────────────────
  window.ChapterManager = {
    init: init,
    navigateTo: navigateTo,
    next: next,
    prev: prev,
    getCurrent: getCurrent,
    getCount: getCount,
    get isTransitioning() { return isTransitioning; },
    get currentIndex() { return currentIndex; }
  };

  // 自动初始化（DOM 就绪时）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
