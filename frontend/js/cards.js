/**
 * AI 康养旅居 — Destination Cards
 * 精选目的地卡片渲染
 */

(function () {
  'use strict';

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
   * 解析 features 字段
   */
  function parseFeatures(dest) {
    if (!dest.features) return [];
    if (Array.isArray(dest.features)) return dest.features;
    try { return JSON.parse(dest.features); } catch (e) { return []; }
  }

  /**
   * 生成 SVG 占位图
   */
  function placeholderImg(idx, name) {
    var hue = (idx * 47 + 160) % 360;
    var c1 = 'hsl(' + hue + ', 40%, 38%)';
    var c2 = 'hsl(' + ((hue + 30) % 360) + ', 50%, 28%)';
    var initial = name ? name.charAt(0) : '?';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">' +
      '<defs><linearGradient id="g' + idx + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" style="stop-color:' + c1 + '"/>' +
      '<stop offset="100%" style="stop-color:' + c2 + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="400" height="240" fill="url(#g' + idx + ')"/>' +
      '<text x="200" y="135" text-anchor="middle" fill="rgba(255,255,255,.80)" ' +
      'font-family="\'PingFang SC\',\'Microsoft YaHei\',sans-serif" font-size="72" font-weight="600">' +
      escapeHtml(initial) + '</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /**
   * 渲染目的地卡片
   * @param {Array} destinations - 目的地数组
   * @param {string} containerId - 容器元素 ID
   */
  function renderCards(destinations, containerId) {
    var grid = document.getElementById(containerId || 'showcase-grid');
    if (!grid) return;

    if (!destinations || !destinations.length) {
      grid.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);grid-column:1/-1;padding:var(--space-10);">目的地数据加载中…</p>';
      return;
    }

    // 按评分排序，取前 4 个
    var showcase = destinations.slice()
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); })
      .slice(0, 4);

    grid.innerHTML = showcase.map(function (d, idx) {
      var imgUrl = d.image_url || placeholderImg(idx, d.name);
      var fallback = placeholderImg(idx, d.name);
      var features = parseFeatures(d);
      var tagHtml = features.length
        ? features.slice(0, 3).map(function (f) {
            return '<span class="tag" style="display:inline-block;padding:3px 10px;background:var(--color-gray-100);color:var(--color-gray-600);font-size:var(--text-xs);font-weight:500;border-radius:999px;margin-right:4px;">' + escapeHtml(f) + '</span>';
          }).join('')
        : '';

      // 构建 overlay tags（最多 3 个数据指标）
      var overlayTags = [];
      if (d.altitude != null) overlayTags.push(d.altitude + 'm');
      if (d.forest_coverage) overlayTags.push(escapeHtml(String(d.forest_coverage)));
      if (d.air_quality_index != null) overlayTags.push('AQI ' + d.air_quality_index);
      var overlayTagsHtml = overlayTags.length
        ? '<div class="showcase-card-overlay-tags">' +
          overlayTags.map(function (t) { return '<span class="overlay-tag">' + t + '</span>'; }).join('') +
          '</div>'
        : '';

      return '<div class="showcase-card" onclick="location.href=\'questionnaire.html\'">' +
        '<div class="showcase-card-img-wrap">' +
        '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(d.name) + '" ' +
        'loading="lazy" class="showcase-card-img" ' +
        'onerror="if(this.src!==\'' + escapeHtml(fallback) + '\'){this.src=\'' + escapeHtml(fallback) + '\';}">' +
        '<div class="showcase-card-overlay">' +
        '<div class="showcase-card-overlay-name">' + escapeHtml(d.name) + '</div>' +
        '<div class="showcase-card-overlay-loc">' + escapeHtml(d.province || '') + (d.city ? ' · ' + escapeHtml(d.city) : '') + '</div>' +
        overlayTagsHtml +
        '</div>' +
        '</div>' +
        '<div class="showcase-card-body">' +
        '<h4>' + escapeHtml(d.name) + '</h4>' +
        '<div class="showcase-card-loc">' + escapeHtml(d.province || '') + (d.city ? ' · ' + escapeHtml(d.city) : '') + '</div>' +
        '<div class="showcase-stats">' +
        (d.altitude != null ? '<div class="ss-item"><span class="ss-icon">' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('mountain', 'icon-sm') : '🏔') + '</span> ' + d.altitude + ' 米</div>' : '') +
        (d.average_temperature ? '<div class="ss-item"><span class="ss-icon">' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('thermometer', 'icon-sm') : '🌡') + '</span> ' + escapeHtml(d.average_temperature) + '</div>' : '') +
        (d.air_quality ? '<div class="ss-item"><span class="ss-icon">' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('wind', 'icon-sm') : '🌬') + '</span> ' + escapeHtml(d.air_quality) + '</div>' : '') +
        (d.forest_coverage ? '<div class="ss-item"><span class="ss-icon">' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('tree', 'icon-sm') : '🌲') + '</span> ' + escapeHtml(d.forest_coverage) + '</div>' : '') +
        (d.medical_level ? '<div class="ss-item"><span class="ss-icon">' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('medical', 'icon-sm') : '🏥') + '</span> ' + escapeHtml(d.medical_level) + '</div>' : '') +
        (d.budget_level ? '<div class="ss-item"><span class="ss-icon">' + (window.HealthTravelIcons ? window.HealthTravelIcons.icon('currency', 'icon-sm') : '💰') + '</span> ' + escapeHtml(d.budget_level) + '</div>' : '') +
        '</div>' +
        (tagHtml ? '<div style="margin-top:10px;">' + tagHtml + '</div>' : '') +
        '<div class="showcase-budget">¥' + ((d.monthly_cost_low || 0)).toLocaleString() +
        ' – ¥' + ((d.monthly_cost_high || 0)).toLocaleString() + '/月</div>' +
        '</div></div>';
    }).join('');
  }

  // 挂载到全局
  window.HealthTravelCards = {
    renderCards: renderCards,
    escapeHtml: escapeHtml,
    placeholderImg: placeholderImg,
    parseFeatures: parseFeatures,
  };
})();
