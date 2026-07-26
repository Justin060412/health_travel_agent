/**
 * AI 康养旅居 — World Layer
 * Sprint 7 Act 2 Phase 5: 12 目的地光点标记
 *
 * 职责：
 *   - 在 globe.gl 上渲染 12 个目的地金色光点
 *   - 使用 htmlElementsData API 叠加 HTML Marker
 *   - 呼吸动画（错开相位）
 *   - Hover 名称浮现
 *
 * 依赖：
 *   - GlobeCore（globe 实例）
 *   - world.css（Marker 样式）
 */

(function () {
  'use strict';

  // 12 个康养目的地经纬度（与 seed_data.py 一致）
  var DESTINATIONS = [
    { id: 1,  name: '苏马荡',     lat: 30.48, lng: 108.72,  province: '湖北恩施' },
    { id: 2,  name: '巴马',       lat: 24.14, lng: 107.25,  province: '广西河池' },
    { id: 3,  name: '三亚海棠湾',  lat: 18.25, lng: 109.75,  province: '海南' },
    { id: 4,  name: '西双版纳',    lat: 21.98, lng: 100.80,  province: '云南景洪' },
    { id: 5,  name: '大理古城',    lat: 25.68, lng: 100.16,  province: '云南大理' },
    { id: 6,  name: '桂林阳朔',    lat: 24.78, lng: 110.49,  province: '广西桂林' },
    { id: 7,  name: '庐山牯岭镇',  lat: 29.57, lng: 115.99,  province: '江西九江' },
    { id: 8,  name: '黄山汤口',    lat: 30.07, lng: 118.18,  province: '安徽黄山' },
    { id: 9,  name: '武夷山',     lat: 27.69, lng: 117.98,  province: '福建南平' },
    { id: 10, name: '青城山',     lat: 30.90, lng: 103.57,  province: '四川都江堰' },
    { id: 11, name: '莫干山',     lat: 30.60, lng: 119.90,  province: '浙江德清' },
    { id: 12, name: '峨眉山',     lat: 29.60, lng: 103.48,  province: '四川乐山' }
  ];

  var markerElements = [];

  /**
   * 在 globe 上放置 12 个目的地 HTML Marker
   */
  function init() {
    var globe = window.GlobeCore && window.GlobeCore.getGlobe();
    if (!globe) {
      console.warn('WorldLayer: GlobeCore not ready');
      return;
    }

    // 构建 Marker 数据（含 HTML element）
    var markersData = DESTINATIONS.map(function (dest, index) {
      var el = createMarkerElement(dest, index);
      markerElements.push(el);

      return {
        lat: dest.lat,
        lng: dest.lng,
        size: 0.01,     // globe.gl 用 size 控制海拔
        el: el,
        data: dest,
      };
    });

    // 使用 htmlElementsData 放置自定义 HTML Marker
    globe.htmlElementsData(markersData)
      .htmlElement(function (d) {
        return d.el;
      })
      .htmlAltitude(function () {
        return 0.02; // 略高于球面
      });
  }

  /**
   * 创建单个 Marker HTML 元素
   */
  function createMarkerElement(dest, index) {
    var wrapper = document.createElement('div');
    wrapper.className = 'world-marker world-marker-breathing';
    wrapper.setAttribute('data-dest-id', dest.id);
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('aria-label', dest.name + ' — ' + dest.province);
    wrapper.setAttribute('tabindex', '0');

    // 错开呼吸相位
    var phase = (index / DESTINATIONS.length) * 4;
    wrapper.style.animationDelay = '-' + phase + 's';

    // 光点
    var dot = document.createElement('div');
    dot.className = 'world-marker-dot';
    wrapper.appendChild(dot);

    // 名称标签（hover 时显示）
    var label = document.createElement('span');
    label.className = 'world-marker-label';
    label.textContent = dest.name;
    wrapper.appendChild(label);

    // Hover 交互（预留 Act 3 点击飞入）
    wrapper.addEventListener('mouseenter', function () {
      // Act 3 将在此触发高亮
    });

    wrapper.addEventListener('click', function () {
      // Act 3: flyTo(dest.lat, dest.lng)
      console.log('Destination clicked:', dest.name);
    });

    return wrapper;
  }

  /**
   * 销毁所有 Marker
   */
  function destroy() {
    markerElements.forEach(function (el) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    markerElements = [];

    // 清除 globe 上的 htmlElements
    var globe = window.GlobeCore && window.GlobeCore.getGlobe();
    if (globe) {
      globe.htmlElementsData([]);
    }
  }

  // ── 公共 API ────────────────────────────────────────────────
  window.WorldLayer = {
    init: init,
    destroy: destroy,
    destinations: DESTINATIONS,
  };

})();
