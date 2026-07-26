/**
 * AI 康养旅居 — Explore Mouse
 * Sprint 7 Act 2: 鼠标物理引擎
 *
 * 职责：
 *   - 全局鼠标追踪（lerp 惯性）
 *   - 地球旋转 + 倾斜偏移
 *   - 环境光跟随
 *   - 粒子 parallax
 *   - Portal 磁吸检测
 *
 * 物理参数：
 *   - lerp factor: 0.06 (~150ms)
 *   - 地球旋转 ±3°/s, 倾斜 ±5°
 *   - Portal 双阈值：near(200px) / close(80px)
 */

(function () {
  'use strict';

  var mouse = { x: 0, y: 0, rawX: 0, rawY: 0 };
  var viewW = 0, viewH = 0;
  var active = false;
  var animId = null;
  var lastTime = 0;
  var portals = [];

  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    viewW = window.innerWidth;
    viewH = window.innerHeight;

    portals = Array.from(document.querySelectorAll('.explore-portal'));

    document.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    active = true;
    lastTime = performance.now();
    animate();
  }

  function onMove(e) {
    mouse.rawX = (e.clientX / viewW) * 2 - 1;
    mouse.rawY = (e.clientY / viewH) * 2 - 1;
  }

  function onResize() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
  }

  function animate(time) {
    if (!active) return;

    var dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // Lerp 平滑惯性
    var factor = 0.06;
    mouse.x += (mouse.rawX - mouse.x) * factor;
    mouse.y += (mouse.rawY - mouse.y) * factor;

    // 1. 地球旋转
    if (window.GlobeCore) {
      window.GlobeCore.setMouseRotation(mouse.x * 3);   // ±3°/s
      window.GlobeCore.setMouseTilt(mouse.y * 5);       // ±5°
    }

    // 2. 粒子
    if (window.ExploreLayers) {
      window.ExploreLayers.updateParticles(mouse.x, mouse.y);
    }

    // 3. 环境光
    updateAmbient(mouse.x, mouse.y);

    // 4. Portal 磁吸
    updatePortals(mouse.rawX, mouse.rawY);

    animId = requestAnimationFrame(animate);
  }

  function updateAmbient(nx, ny) {
    var el = document.querySelector('.explore-atmosphere');
    if (el) {
      el.style.transform = 'translate(' + (nx * 2) + 'px, ' + (ny * 2) + 'px)';
    }
  }

  function updatePortals(rawX, rawY) {
    if (portals.length === 0) return;

    var msx = ((rawX + 1) / 2) * viewW;
    var msy = ((rawY + 1) / 2) * viewH;
    var nearThreshold = 200;
    var closeThreshold = 80;

    portals.forEach(function (p) {
      var r = p.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dist = Math.sqrt((msx - cx) ** 2 + (msy - cy) ** 2);

      // 移除旧状态
      p.classList.remove('portal-near', 'portal-close');

      if (dist < closeThreshold) {
        p.classList.add('portal-close');
        // 磁吸：向鼠标微偏移
        var strength = (1 - dist / closeThreshold) * 6;
        var dx = (msx - cx) / dist * strength;
        var dy = (msy - cy) / dist * strength;
        p.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
      } else if (dist < nearThreshold) {
        p.classList.add('portal-near');
        var s = (1 - dist / nearThreshold) * 3;
        var ddx = (msx - cx) / dist * s;
        var ddy = (msy - cy) / dist * s;
        p.style.transform = 'translate(' + ddx.toFixed(1) + 'px, ' + ddy.toFixed(1) + 'px)';
      } else {
        p.style.transform = '';
      }
    });
  }

  function destroy() {
    active = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('resize', onResize);
    portals.forEach(function (p) {
      p.classList.remove('portal-near', 'portal-close');
      p.style.transform = '';
    });
    portals = [];
    if (window.GlobeCore) {
      window.GlobeCore.setMouseRotation(0);
      window.GlobeCore.setMouseTilt(0);
    }
  }

  window.ExploreMouse = {
    init: init,
    destroy: destroy,
    getMouse: function () { return { x: mouse.x, y: mouse.y }; },
  };

})();
