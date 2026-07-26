/**
 * AI 康养旅居 — Explore Space
 * Sprint 7 Act 2 Phase 1: 空间初始化
 *
 * 职责：
 *   - 创建环境光元素
 *   - 生成浮尘粒子
 *   - 暴露 Space API 供其他模块使用
 *
 * 依赖：无（独立模块，操作 DOM）
 */

(function () {
  'use strict';

  var particles = [];
  var particleContainer = null;
  var spaceRoot = null;

  /**
   * 初始化探索空间
   * 在 Chapter 切换时由 main.js 调用
   */
  function init() {
    spaceRoot = document.querySelector('.explore-stage');
    if (!spaceRoot) return;

    createParticles();
  }

  /**
   * 创建浮尘粒子（30 个金色微粒，3 层深度）
   */
  function createParticles() {
    // 移除旧粒子
    if (particleContainer) {
      particleContainer.remove();
    }

    particleContainer = document.createElement('div');
    particleContainer.className = 'explore-particles';
    particleContainer.setAttribute('aria-hidden', 'true');
    spaceRoot.appendChild(particleContainer);

    particles = [];

    var layers = [
      { count: 10, speed: 0.015, size: 1.5, opacity: 0.15 },  // 远层
      { count: 12, speed: 0.03,  size: 2,   opacity: 0.25 },  // 中层
      { count: 8,  speed: 0.05,  size: 2.5, opacity: 0.35 },  // 近层
    ];

    layers.forEach(function (layer) {
      for (var i = 0; i < layer.count; i++) {
        var el = document.createElement('div');
        el.className = 'explore-particle';
        el.style.width = layer.size + 'px';
        el.style.height = layer.size + 'px';
        el.style.opacity = layer.opacity;

        // 随机初始位置
        var x = Math.random() * 100;
        var y = Math.random() * 100;
        el.style.left = x + '%';
        el.style.top = y + '%';

        particleContainer.appendChild(el);

        particles.push({
          el: el,
          x: x,
          y: y,
          originX: x,
          originY: y,
          speed: layer.speed,
          depth: layer.size,
        });
      }
    });
  }

  /**
   * 更新粒子位置（由 explore-mouse.js 的 rAF 循环调用）
   * @param {number} mouseNormX - 鼠标归一化 X (-1 to 1)
   * @param {number} mouseNormY - 鼠标归一化 Y (-1 to 1)
   */
  function updateParticles(mouseNormX, mouseNormY) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // 粒子跟随鼠标，不同深度有不同速度（parallax）
      p.x += (p.originX + mouseNormX * 8 * p.speed * 10 - p.x) * p.speed;
      p.y += (p.originY + mouseNormY * 8 * p.speed * 10 - p.y) * p.speed;

      // 微小随机漂移
      p.x += (Math.random() - 0.5) * 0.02;
      p.y += (Math.random() - 0.5) * 0.02;

      // 保持在 0-100% 范围内
      p.x = Math.max(-5, Math.min(105, p.x));
      p.y = Math.max(-5, Math.min(105, p.y));

      p.el.style.left = p.x + '%';
      p.el.style.top = p.y + '%';
    }
  }

  /**
   * 销毁空间（Chapter 离开时清理，可选）
   */
  function destroy() {
    if (particleContainer) {
      particleContainer.remove();
      particleContainer = null;
    }
    particles = [];
    spaceRoot = null;
  }

  // ── 公共 API ────────────────────────────────────────────────
  window.ExploreSpace = {
    init: init,
    updateParticles: updateParticles,
    destroy: destroy,
  };

})();
