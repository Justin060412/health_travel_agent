/**
 * AI 康养旅居 — Explore Layers
 * Sprint 7 Act 2: 空间层系统
 *
 * Layer 1 — 星空（100+ 星点 + 闪烁）
 * Layer 2 — 粒子（50 个金色微粒，3 层深度 parallax）
 */

(function () {
  'use strict';

  var starsCanvas = null;
  var starsCtx = null;
  var starData = [];
  var particles = [];
  var particleContainer = null;
  var stageEl = null;

  /**
   * 初始化所有空间层
   */
  function init() {
    stageEl = document.querySelector('.explore-stage');
    if (!stageEl) return;
    createStars();
    createParticles();
  }

  /* ═══════════════════════════════════════════════════
     Layer 1 — 星空
     ═══════════════════════════════════════════════════ */

  function createStars() {
    starsCanvas = document.createElement('canvas');
    starsCanvas.className = 'explore-stars';
    starsCanvas.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(starsCanvas);

    starsCtx = starsCanvas.getContext('2d');
    resizeStars();

    // 生成星点数据
    starData = [];
    var count = 120;
    for (var i = 0; i < count; i++) {
      starData.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.005 + 0.002,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    window.addEventListener('resize', resizeStars);
    animateStars();
  }

  function resizeStars() {
    if (!starsCanvas) return;
    starsCanvas.width = window.innerWidth;
    starsCanvas.height = window.innerHeight;
    drawStars(0);
  }

  function animateStars(time) {
    drawStars(time || 0);
    requestAnimationFrame(animateStars);
  }

  function drawStars(time) {
    if (!starsCtx) return;
    var w = starsCanvas.width;
    var h = starsCanvas.height;

    starsCtx.clearRect(0, 0, w, h);

    for (var i = 0; i < starData.length; i++) {
      var s = starData[i];
      // 微闪烁
      var twinkle = 0.6 + 0.4 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
      var alpha = s.opacity * twinkle;
      var sx = s.x * w;
      var sy = s.y * h;

      starsCtx.beginPath();
      starsCtx.arc(sx, sy, s.r, 0, Math.PI * 2);
      starsCtx.fillStyle = 'rgba(200, 190, 170, ' + alpha + ')';
      starsCtx.fill();
    }
  }

  /* ═══════════════════════════════════════════════════
     Layer 2 — 漂浮粒子
     ═══════════════════════════════════════════════════ */

  function createParticles() {
    particleContainer = document.createElement('div');
    particleContainer.className = 'explore-particles';
    particleContainer.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(particleContainer);

    // 3 层深度
    var layers = [
      { count: 20, speed: 0.01, size: 1,   opacity: 0.12 },  // 远
      { count: 20, speed: 0.025, size: 1.5, opacity: 0.2  },  // 中
      { count: 10, speed: 0.04, size: 2,   opacity: 0.28 },  // 近
    ];

    particles = [];

    layers.forEach(function (layer) {
      for (var i = 0; i < layer.count; i++) {
        var el = document.createElement('div');
        el.className = 'explore-particle';
        el.style.width = layer.size + 'px';
        el.style.height = layer.size + 'px';
        el.style.opacity = layer.opacity;

        var x = 10 + Math.random() * 80;
        var y = 10 + Math.random() * 80;
        el.style.left = x + '%';
        el.style.top = y + '%';

        particleContainer.appendChild(el);

        particles.push({
          el: el,
          x: x, y: y,
          originX: x, originY: y,
          speed: layer.speed,
        });
      }
    });
  }

  /**
   * 更新粒子（鼠标 parallax）
   */
  function updateParticles(mx, my) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += (p.originX + mx * 6 * p.speed * 10 - p.x) * p.speed;
      p.y += (p.originY + my * 6 * p.speed * 10 - p.y) * p.speed;
      p.x += (Math.random() - 0.5) * 0.015;
      p.y += (Math.random() - 0.5) * 0.015;
      p.el.style.left = p.x + '%';
      p.el.style.top = p.y + '%';
    }
  }

  /**
   * 清理
   */
  function destroy() {
    if (starsCanvas) { starsCanvas.remove(); starsCanvas = null; }
    if (particleContainer) { particleContainer.remove(); particleContainer = null; }
    particles = [];
    starData = [];
  }

  // ── API ─────────────────────────────────────────────────
  window.ExploreLayers = {
    init: init,
    updateParticles: updateParticles,
    destroy: destroy,
  };

})();
