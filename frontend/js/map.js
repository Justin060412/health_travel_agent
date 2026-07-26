/**
 * AI 康养旅居 — Map (Leaflet)
 * 首页预览地图 + 结果页地图
 *
 * Sprint 6 Phase 3: 品牌化 Map Marker
 *   自定义 SVG 圆形 Marker（森林绿渐变 + 顶部高光 + 阴影 + 编号）
 *   Glass Popup（毛玻璃背景 + 圆角）
 *   Hover: scale(1.25) + glow
 */

(function () {
  'use strict';

  var CHINA_CENTER = [35.86, 104.19];
  var CHINA_ZOOM = 5;
  var homeMap = null;

  /**
   * HTML 转义
   */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 海拔分层颜色
   */
  function altitudeColor(alt) {
    if (alt >= 1500) return '#1f7544';
    if (alt >= 800)  return '#33915d';
    if (alt >= 300)  return '#52ad7a';
    return '#84c6a0';
  }

  /**
   * 创建品牌 SVG Marker（圆形 + 顶部高光 + 阴影 + 编号）
   * @param {string} color - 森林绿色值
   * @param {number|string} label - 编号或文字
   * @param {number} size - 标记尺寸 px
   * @returns {L.divIcon}
   */
  function createBrandMarker(color, label, size) {
    size = size || 32;
    var fontSize = size < 28 ? '0.65rem' : '0.75rem';
    var shadowSize = size * 0.25;

    var html = '<div class="brand-marker" style="' +
      'width:' + size + 'px;' +
      'height:' + size + 'px;' +
      'background:' + color + ';' +
      'border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;' +
      'color:#fff;font-weight:700;font-size:' + fontSize + ';' +
      'font-family:var(--font-numeric),Inter,-apple-system,sans-serif;' +
      'box-shadow:' +
        '0 ' + shadowSize + 'px ' + (shadowSize * 2) + 'px rgba(0,0,0,0.22),' +
        '0 ' + (shadowSize * 0.5) + 'px ' + shadowSize + 'px rgba(0,0,0,0.14),' +
        'inset 0 1px 0 rgba(255,255,255,0.3),' +
        'inset 0 -1px 0 rgba(0,0,0,0.06);' +
      'border:2px solid #fff;' +
      'cursor:pointer;' +
      'transition:transform 0.2s var(--ease-out),box-shadow 0.2s var(--ease-out);' +
      '">' +
      '<span style="text-shadow:0 1px 2px rgba(0,0,0,0.15);line-height:1;">' + label + '</span>' +
      '</div>';

    return L.divIcon({
      html: html,
      className: 'brand-marker-container', // 覆盖 Leaflet 默认样式
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }

  /**
   * 构建 Glass Popup HTML
   * @param {Object} d - 目的地数据
   * @returns {string}
   */
  function buildPopupHtml(d) {
    var imgTag = '';
    if (d.image_url) {
      imgTag = '<img src="' + escapeHtml(d.image_url) + '" alt="" ' +
        'style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" ' +
        'loading="lazy" ' +
        'onerror="this.style.display=\'none\'">';
    }

    return '<div class="map-popup">' +
      imgTag +
      '<h4>' + escapeHtml(d.name) + '</h4>' +
      '<div class="popup-info">' +
      '<div style="color:var(--color-text-muted);font-size:0.78rem;margin-bottom:4px;">' +
        escapeHtml(d.province) + (d.city ? ' · ' + escapeHtml(d.city) : '') +
      '</div>' +
      '<div class="popup-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:0.78rem;line-height:1.8;">' +
        (d.altitude != null ? '<span>' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('mountain', 'icon-xs') : '🏔') + ' 海拔 ' + d.altitude + ' 米</span>' : '') +
        (d.average_temperature ? '<span>' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('thermometer', 'icon-xs') : '🌡') + ' ' + escapeHtml(d.average_temperature) + '</span>' : '') +
        (d.forest_coverage ? '<span>' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('tree', 'icon-xs') : '🌲') + ' ' + escapeHtml(d.forest_coverage) + '</span>' : '') +
        (d.air_quality ? '<span>' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('wind', 'icon-xs') : '🌬') + ' ' + escapeHtml(d.air_quality) + '</span>' : '') +
      '</div></div>' +
      '<a href="questionnaire.html" style="display:inline-block;margin-top:8px;font-size:0.8rem;' +
        'color:var(--color-forest-600);text-decoration:none;font-weight:600;">AI 分析 →</a>' +
      '</div>';
  }

  /**
   * 初始化首页地图
   * @param {Array} destinations - 目的地数据
   */
  function initHomeMap(destinations) {
    if (homeMap) return;
    if (!destinations || !destinations.length) return;

    var mapEl = document.getElementById('home-map');
    if (!mapEl) return;

    if (typeof L === 'undefined') {
      console.warn('[Map] Leaflet 尚未加载');
      return;
    }

    homeMap = L.map('home-map', {
      center: CHINA_CENTER,
      zoom: CHINA_ZOOM,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(homeMap);

    var bounds = [];
    var idx = 0;

    destinations.forEach(function (d) {
      if (d.latitude == null || d.longitude == null) return;
      idx++;
      var lat = d.latitude;
      var lng = d.longitude;
      var color = altitudeColor(d.altitude || 0);

      var marker = L.marker([lat, lng], {
        icon: createBrandMarker(color, idx, 30),
      }).addTo(homeMap);

      // Hover: scale marker
      marker.on('mouseover', function () {
        var el = this.getElement();
        if (el) {
          var inner = el.querySelector('.brand-marker');
          if (inner) {
            inner.style.transform = 'scale(1.25)';
            inner.style.boxShadow =
              '0 4px 16px rgba(0,0,0,0.28),' +
              '0 1px 4px rgba(0,0,0,0.16),' +
              'inset 0 1px 0 rgba(255,255,255,0.35),' +
              'inset 0 -1px 0 rgba(0,0,0,0.06),' +
              '0 0 0 4px rgba(31,117,68,0.12)';
            inner.style.zIndex = '1000';
          }
        }
      });

      marker.on('mouseout', function () {
        var el = this.getElement();
        if (el) {
          var inner = el.querySelector('.brand-marker');
          if (inner) {
            inner.style.transform = '';
            inner.style.boxShadow =
              '0 4px 8px rgba(0,0,0,0.22),' +
              '0 1px 4px rgba(0,0,0,0.14),' +
              'inset 0 1px 0 rgba(255,255,255,0.3),' +
              'inset 0 -1px 0 rgba(0,0,0,0.06)';
            inner.style.zIndex = '';
          }
        }
      });

      marker.bindPopup(buildPopupHtml(d), {
        maxWidth: 280,
        closeButton: true,
        className: 'brand-popup',
      });

      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      homeMap.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 8 });
    }

    // 延迟刷新地图尺寸（解决 Flex/Grid 布局中 Leaflet 渲染问题）
    setTimeout(function () {
      if (homeMap) homeMap.invalidateSize();
    }, 600);
  }

  // ── 挂载到全局 ──────────────────────────────────────
  window.HealthTravelMap = {
    initHomeMap: initHomeMap,
    createBrandMarker: createBrandMarker,
    buildPopupHtml: buildPopupHtml,
    altitudeColor: altitudeColor,
  };
})();
