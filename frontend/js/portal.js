/**
 * AI 康养旅居 — Portal System
 * Sprint 7 Act 2 Phase 4: 探索入口交互
 *
 * 职责：
 *   - Portal 点击 Ripple 光波纹
 *   - Portal 点击导航跳转
 *   - Portal 键盘 Focus 管理
 *
 * 注意：磁吸检测在 explore-mouse.js 中统一管理（性能更好）
 *
 * 依赖：无
 */

(function () {
  'use strict';

  /**
   * 初始化所有 Portal
   */
  function init() {
    var portalElements = document.querySelectorAll('.explore-portal');
    portalElements.forEach(function (portal) {
      portal.addEventListener('click', onClick);
      portal.addEventListener('keydown', onKeyDown);
    });
  }

  /**
   * 点击 Portal：Ripple + 导航
   */
  function onClick(e) {
    var portal = e.currentTarget;

    // 1. 创建 Ripple
    createRipple(portal, e.clientX, e.clientY);

    // 2. 延迟导航（让 Ripple 动画先展开）
    var link = portal.getAttribute('data-link');
    var chapter = portal.getAttribute('data-chapter');

    if (link) {
      setTimeout(function () {
        window.location.href = link;
      }, 300);
    } else if (chapter) {
      setTimeout(function () {
        var target = parseInt(chapter, 10);
        if (window.ChapterManager && !isNaN(target)) {
          window.ChapterManager.navigateTo(target);
        }
      }, 300);
    }
  }

  /**
   * 键盘 Enter/Space 触发点击
   */
  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  }

  /**
   * 创建 Ripple 光波纹
   */
  function createRipple(portal, clientX, clientY) {
    var rect = portal.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2;

    var ripple = document.createElement('div');
    ripple.className = 'portal-ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (clientY - rect.top - size / 2) + 'px';

    portal.appendChild(ripple);

    // 动画结束后清理
    ripple.addEventListener('animationend', function () {
      ripple.remove();
    });
  }

  // ── 公共 API ────────────────────────────────────────────────
  window.PortalSystem = {
    init: init,
  };

})();
