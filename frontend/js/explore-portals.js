/**
 * AI 康养旅居 — Explore Portals
 * Sprint 7 Act 2: 轨道入口系统
 *
 * 职责：
 *   - 计算 Portal 轨道位置（环绕地球）
 *   - Ripple 能量波纹（点击）
 *   - 导航跳转
 *   - 键盘 Focus
 *
 * Portal 定位策略：
 *   桌面端：absolute 定位在 explore-portals 容器四角（轨道）
 *   移动端：flex column 堆叠
 */

(function () {
  'use strict';

  function init() {
    positionPortals();
    bindPortals();
    window.addEventListener('resize', positionPortals);
  }

  /* ═══════════════════════════════════════════════════
     Portal 轨道定位
     ═══════════════════════════════════════════════════ */

  function positionPortals() {
    var isMobile = window.innerWidth <= 768;
    var els = document.querySelectorAll('.explore-portal');

    els.forEach(function (p) {
      if (isMobile) {
        // 移动端：清除 absolute 定位
        p.style.left = '';
        p.style.top = '';
        p.style.transform = '';
        return;
      }

      var portal = p.getAttribute('data-portal');
      var container = p.parentElement; // .explore-portals
      if (!container) return;

      var cw = container.clientWidth;
      var ch = container.clientHeight;

      // Portal 位置映射（在容器四角内侧）
      var positions = {
        recommend:    { left: '6%',  top: '15%' },  // 左上
        explore:      { left: 'auto', right: '6%', top: '15%' },  // 右上
        environment:  { left: '6%',  top: 'auto', bottom: '15%' },  // 左下
        daily:        { left: 'auto', right: '6%', top: 'auto', bottom: '15%' },  // 右下
      };

      var pos = positions[portal];
      if (!pos) return;

      Object.keys(pos).forEach(function (key) {
        p.style[key] = pos[key];
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     点击 + Ripple
     ═══════════════════════════════════════════════════ */

  function bindPortals() {
    var els = document.querySelectorAll('.explore-portal');
    els.forEach(function (p) {
      p.addEventListener('click', onClick);
      p.addEventListener('keydown', onKey);
    });
  }

  function onClick(e) {
    var portal = e.currentTarget;
    createRipple(portal);
    navigateAfterRipple(portal);
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  }

  function createRipple(portal) {
    var ripple = document.createElement('div');
    ripple.className = 'portal-ripple';
    portal.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  }

  function navigateAfterRipple(portal) {
    var link = portal.getAttribute('data-link');
    var chapter = portal.getAttribute('data-chapter');

    setTimeout(function () {
      if (link) {
        window.location.href = link;
      } else if (chapter) {
        var target = parseInt(chapter, 10);
        if (window.ChapterManager && !isNaN(target)) {
          window.ChapterManager.navigateTo(target);
        }
      }
    }, 280);
  }

  function destroy() {
    window.removeEventListener('resize', positionPortals);
  }

  window.ExplorePortals = {
    init: init,
    destroy: destroy,
    position: positionPortals,
  };

})();
