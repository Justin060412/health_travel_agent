/**
 * AI 康养旅居 — SVG Icon System
 * Sprint 6 Phase 3: 替代全部 Emoji
 *
 * Lucide 风格 · 16px viewBox · stroke-width 1.5
 * 颜色跟随 --color-text-secondary
 * 统一使用 inline SVG，无外部请求
 */

(function () {
  'use strict';

  /**
   * 创建 SVG icon 字符串
   * @param {string} paths - SVG path d 属性
   * @param {string} size - 尺寸 (默认 16px)
   * @returns {string} SVG HTML 字符串
   */
  function iconSvg(paths, size) {
    size = size || 16;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" ' +
      'style="display:inline-block;vertical-align:middle;flex-shrink:0;" ' +
      'aria-hidden="true">' + paths + '</svg>';
  }

  // ═══════════════════════════════════════════════════════
  //  Icon Definitions
  // ═══════════════════════════════════════════════════════

  var icons = {
    /** 山 / 海拔 */
    mountain: '<path d="M12 3L20 21H4L12 3Z"/><path d="M12 9L16 17H8L12 9Z"/>',

    /** 温度计 */
    thermometer: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',

    /** 风 / 空气质量 */
    wind: '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>',

    /** 树木 / 森林覆盖 */
    tree: '<path d="M12 22v-7"/><path d="M8 15c-3-1-6-3-5-7 0-2 1.5-3 3-3 2 0 3 2 4 4.5C10.5 7 12 4 15 3c2 0 3.5 1 3.5 3 1 4-1.5 6-5 7"/>',

    /** 医疗 / 十字 */
    medical: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="6" width="18" height="16" rx="2"/><path d="M12 11v6"/><path d="M9 14h6"/>',

    /** 货币 / 预算 */
    currency: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-4a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4H8"/><path d="M12 18V6"/>',

    /** 地图标记 / 位置 */
    mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',

    /** 地图 / 图层 */
    map: '<polygon points="3 6 12 3 21 6 12 9 3 6"/><polyline points="3 18 12 21 21 18"/><polyline points="3 12 12 15 21 12"/>',

    /** 圆圈对勾 / 数据质量 */
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',

    /** 信息 */
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',

    /** 箭头右 */
    arrowRight: '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',

    /** 搜索 */
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',

    /** 星星 */
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',

    /** 叶子 */
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 22c1.5-2 1.5-4 1.5-6"/>',
  };

  // ═══════════════════════════════════════════════════════
  //  Convenience Functions
  // ═══════════════════════════════════════════════════════

  /** 创建带 class 的 icon（用于 CSS 控制颜色/大小） */
  function icon(name, cssClass) {
    var svg = iconSvg(icons[name] || '', 16);
    if (cssClass) {
      svg = svg.replace('<svg ', '<svg class="' + cssClass + '" ');
    }
    return svg;
  }

  /** 创建指定尺寸的 icon */
  function iconSize(name, size) {
    return iconSvg(icons[name] || '', size);
  }

  // ═══════════════════════════════════════════════════════
  //  Exports
  // ═══════════════════════════════════════════════════════
  window.HealthTravelIcons = {
    icon: icon,
    iconSize: iconSize,
    iconSvg: iconSvg,
    definitions: icons,
  };
})();
