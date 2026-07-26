/**
 * AI 康养旅居 — Globe Core
 * Sprint 7 Act 2 Phase 2: 地球引擎
 *
 * 特性：
 *   - globe.gl 渲染
 *   - 暗色 canvas 地表纹理
 *   - 简化中国边界多边形（金色描边）
 *   - 扫描光环（Three.js Torus）
 *   - 12 个目的地金色光点 Marker
 *   - 自动旋转 + 鼠标偏移
 *
 * 依赖：globe.gl CDN → window.Globe
 */

(function () {
  'use strict';

  var globe = null;
  var container = null;
  var scanRing = null;
  var animId = null;
  var lastTime = 0;

  // 旋转状态
  var rotationSpeed = 0.12;
  var mouseRotOffset = 0;
  var mouseTiltOffset = 0;
  var currentLng = 105;   // 初始：中国中心
  var currentLat = 30;
  var autoRotate = true;

  /* ═══════════════════════════════════════════════════
     中国简化边界（GeoJSON Polygon）
     ═══════════════════════════════════════════════════ */
  var chinaBoundary = {
    type: 'Polygon',
    coordinates: [[
      [122.0, 53.5], [127.5, 50.0], [130.5, 48.5], [134.0, 46.5],
      [131.0, 43.0], [128.5, 41.5], [124.5, 40.0], [121.5, 38.5],
      [119.5, 40.0], [117.5, 37.5], [114.0, 35.0], [111.0, 32.0],
      [108.5, 30.0], [106.0, 28.0], [104.0, 27.0], [102.5, 24.5],
      [101.5, 22.0], [102.5, 21.5], [107.0, 21.0], [108.0, 21.5],
      [109.5, 22.0], [110.0, 22.5], [110.0, 25.0], [111.0, 27.0],
      [113.0, 28.5], [115.0, 31.0], [117.5, 32.5], [120.0, 34.5],
      [121.5, 36.5], [122.0, 38.5], [121.0, 40.0], [120.0, 41.0],
      [118.5, 43.0], [117.5, 45.0], [118.5, 46.5], [120.0, 48.0],
      [119.5, 50.0], [118.0, 52.0], [119.0, 53.0], [122.0, 53.5],
    ]]
  };

  /* ═══════════════════════════════════════════════════
     初始化
     ═══════════════════════════════════════════════════ */

  function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return console.warn('GlobeCore: container not found');

    if (typeof Globe === 'undefined') {
      console.warn('GlobeCore: globe.gl CDN not loaded');
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="width:60%;height:60%;border-radius:50%;background:radial-gradient(circle,rgba(20,50,40,0.3),transparent 70%);"></div></div>';
      return;
    }

    var size = Math.min(container.clientWidth, container.clientHeight);
    if (size < 10) size = 400; // fallback

    globe = Globe()
      .container(container)
      .width(size)
      .height(size)
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl(createTexture())
      .bumpImageUrl(null)
      // 大气
      .atmosphereColor('rgba(80, 150, 130, 0.07)')
      .atmosphereAltitude(0.12)
      // 中国边界
      .polygonsData([{
        geometry: chinaBoundary,
        label: '',
      }])
      .polygonCapColor(function () { return 'rgba(180, 150, 100, 0.04)'; })
      .polygonSideColor(function () { return 'rgba(0,0,0,0)'; })
      .polygonStrokeColor(function () { return 'rgba(180, 150, 100, 0.2)'; })
      .polygonAltitude(0.003)
      // 地表随机点
      .pointsData(generateTerrainDots())
      .pointColor(function () { return 'rgba(40, 90, 70, 0.2)'; })
      .pointAltitude(0.004)
      .pointRadius(0.25)
      // 无手动拖拽
      .enablePointerInteraction(false)
      // 初始视角
      .pointOfView({ lat: 30, lng: 105, altitude: 2.0 }, 0);

    // 透明背景
    if (globe.renderer) {
      globe.renderer().setClearColor(0x000000, 0);
    }

    // 扫描光环（Three.js Torus）
    createScanRing();

    lastTime = performance.now();
    animate();

    window.addEventListener('resize', onResize);
  }

  /* ═══════════════════════════════════════════════════
     Canvas 暗色地表纹理
     ═══════════════════════════════════════════════════ */

  function createTexture() {
    var c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    var ctx = c.getContext('2d');

    // 深色海洋
    ctx.fillStyle = '#070c09';
    ctx.fillRect(0, 0, 2048, 1024);

    // 大陆椭圆暗示
    var continents = [
      { cx: 0.52, cy: 0.50, rx: 0.08, ry: 0.26, o: 0.14 },  // 非洲
      { cx: 0.62, cy: 0.28, rx: 0.20, ry: 0.22, o: 0.12 },  // 欧亚
      { cx: 0.74, cy: 0.30, rx: 0.07, ry: 0.13, o: 0.18 },  // 东亚（亮）
      { cx: 0.74, cy: 0.50, rx: 0.05, ry: 0.09, o: 0.11 },  // 东南亚
      { cx: 0.18, cy: 0.22, rx: 0.10, ry: 0.18, o: 0.11 },  // 北美
      { cx: 0.22, cy: 0.60, rx: 0.04, ry: 0.13, o: 0.12 },  // 南美
      { cx: 0.78, cy: 0.66, rx: 0.04, ry: 0.06, o: 0.10 },  // 澳
    ];

    continents.forEach(function (cnt) {
      var grad = ctx.createRadialGradient(
        cnt.cx * 2048, cnt.cy * 1024, 0,
        cnt.cx * 2048, cnt.cy * 1024, Math.max(cnt.rx * 2048, cnt.ry * 1024)
      );
      grad.addColorStop(0, 'rgba(25, 65, 50, ' + cnt.o + ')');
      grad.addColorStop(0.4, 'rgba(20, 50, 40, ' + (cnt.o * 0.6) + ')');
      grad.addColorStop(0.7, 'rgba(10, 30, 25, ' + (cnt.o * 0.25) + ')');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2048, 1024);
    });

    // 随机微点增加质感
    ctx.fillStyle = 'rgba(35, 80, 65, 0.12)';
    for (var i = 0; i < 2500; i++) {
      ctx.fillRect(Math.random() * 2048, Math.random() * 1024, Math.random() * 2.2, Math.random() * 2.2);
    }

    return c.toDataURL('image/jpeg', 0.55);
  }

  /* ═══════════════════════════════════════════════════
     地表点
     ═══════════════════════════════════════════════════ */

  var terrainDots = null;
  function generateTerrainDots() {
    if (terrainDots) return terrainDots;
    terrainDots = [];
    for (var i = 0; i < 500; i++) {
      terrainDots.push({
        lat: Math.asin(2 * Math.random() - 1) * (180 / Math.PI),
        lng: Math.random() * 360 - 180,
        size: Math.random() * 0.4 + 0.15,
      });
    }
    return terrainDots;
  }

  /* ═══════════════════════════════════════════════════
     扫描光环（Three.js Torus）
     ═══════════════════════════════════════════════════ */

  function createScanRing() {
    if (!globe || !globe.scene) return;
    try {
      var scene = globe.scene();
      if (!scene) return;

      var THREE = window.THREE || (globe.renderer && globe.renderer().constructor.prototype.hasOwnProperty
        ? null : null);

      // 尝试从 globe 获取 THREE（globe.gl 内嵌 Three.js）
      // globe.gl 在 UMD 构建中内嵌 Three.js，但不暴露到全局
      // 尝试通过 globe 内部引用获取
      if (!THREE && globe.renderer) {
        // fallback: 使用 CSS 扫描环（explore-scan 元素已有 CSS 动画）
        return;
      }

      if (!THREE) return;

      var ringGeo = new THREE.TorusGeometry(1.04, 0.002, 8, 80);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0xd4b896,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
      scanRing = new THREE.Mesh(ringGeo, ringMat);
      scanRing.rotation.x = Math.PI * 0.35;
      scanRing.rotation.y = Math.PI * 0.15;
      scene.add(scanRing);
    } catch (e) {
      // CSS fallback already in place
    }
  }

  /* ═══════════════════════════════════════════════════
     动画循环
     ═══════════════════════════════════════════════════ */

  function animate(time) {
    if (!globe) return;

    var dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (autoRotate) {
      currentLng += (rotationSpeed + mouseRotOffset) * dt;
      if (currentLng > 360) currentLng -= 360;
      if (currentLng < -360) currentLng += 360;
      var targetLat = 30 + mouseTiltOffset;
      currentLat += (targetLat - currentLat) * 0.03;

      globe.pointOfView({ lat: currentLat, lng: currentLng, altitude: 2.0 }, 0);
    }

    // 扫描光环旋转
    if (scanRing) {
      scanRing.rotation.z += 0.003;
    }

    animId = requestAnimationFrame(animate);
  }

  /* ═══════════════════════════════════════════════════
     API
     ═══════════════════════════════════════════════════ */

  function setMouseRotation(v) { mouseRotOffset = v; }
  function setMouseTilt(v) { mouseTiltOffset = v; }
  function setAutoRotate(v) { autoRotate = v; }
  function getGlobe() { return globe; }

  function onResize() {
    if (!globe || !container) return;
    var s = Math.min(container.clientWidth, container.clientHeight);
    if (s > 10) { globe.width(s).height(s); }
  }

  function destroy() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (globe && container) { container.innerHTML = ''; }
    globe = null; container = null; scanRing = null;
    window.removeEventListener('resize', onResize);
  }

  // ── API ─────────────────────────────────────────────────
  window.GlobeCore = {
    init: init,
    setMouseRotation: setMouseRotation,
    setMouseTilt: setMouseTilt,
    setAutoRotate: setAutoRotate,
    getGlobe: getGlobe,
    destroy: destroy,
  };

})();
