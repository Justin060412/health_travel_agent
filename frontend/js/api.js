/**
 * AI 康养旅居 — API Layer
 * 统一数据访问层，处理所有后端通信
 *
 * 数据优先级（三层）：
 * 1. 后端 API — 第一数据源，字段优先
 * 2. 本地 GeoJSON — 与 API 同时加载；按目的地名称补充 API 缺失字段，
 *    后端不可用时作为完整兜底
 * 3. destination-content.json — 负责图片、故事等内容字段
 *
 * 数据来源必须如实反映在 meta.source 中：
 *   "api"         — API 完整，GeoJSON 未参与
 *   "api+geojson" — API 缺失字段由 GeoJSON 按名称补充
 *   "geojson"     — 后端不可用，全部来自本地静态资料
 */

(function () {
  'use strict';

  var pageLocation = window.location || { hostname: 'localhost' };
  var IS_GITHUB_PAGES = /(^|\.)github\.io$/i.test(pageLocation.hostname || '');
  var API_BASE = window.HEALTH_TRAVEL_API_BASE ||
    (/^(localhost|127\.0\.0\.1)$/.test(pageLocation.hostname) ? 'http://127.0.0.1:8000' : pageLocation.origin);
  var DEFAULT_TIMEOUT = 8000;
  var DESTINATIONS_FALLBACK_URL = 'data/destinations.geojson';
  var DESTINATION_CONTENT_URL = 'data/destination-content.json';
  var destinationContentPromise = null;

  /** GitHub Pages 只托管静态文件；明确提示服务端功能不可用。 */
  function showStaticPreviewNotice() {
    if (!IS_GITHUB_PAGES || !document.body || document.getElementById('github-static-preview-notice')) return;

    var notice = document.createElement('aside');
    notice.id = 'github-static-preview-notice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:99999',
      'display:flex', 'align-items:flex-start', 'gap:12px',
      'width:min(520px,calc(100vw - 32px))', 'box-sizing:border-box',
      'padding:12px 14px', 'border:1px solid rgba(255,255,255,.18)',
      'border-radius:14px', 'background:rgba(12,40,39,.94)',
      'box-shadow:0 12px 36px rgba(0,0,0,.22)', 'color:#f4f1e8',
      'font:500 13px/1.55 system-ui,-apple-system,sans-serif',
    ].join(';');

    var message = document.createElement('span');
    message.textContent = 'GitHub 静态预览：可浏览目的地与页面。AI 分析、在线路线服务和保存功能需要后端。';
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭静态预览说明');
    close.textContent = '×';
    close.style.cssText = 'flex:0 0 auto;border:0;background:transparent;color:inherit;font:400 20px/1;cursor:pointer;padding:0 2px';
    close.addEventListener('click', function () { notice.remove(); });
    notice.appendChild(message);
    notice.appendChild(close);
    document.body.appendChild(notice);
  }

  if (IS_GITHUB_PAGES && document.addEventListener) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showStaticPreviewNotice, { once: true });
    } else {
      showStaticPreviewNotice();
    }
  }

  function firstValue() {
    for (var i = 0; i < arguments.length; i += 1) {
      var value = arguments[i];
      if (value === undefined || value === null || value === '') continue;
      if (typeof value === 'string' && /^(null|undefined|none)$/i.test(value.trim())) continue;
      return value;
    }
    return '';
  }

  function toFiniteNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function toStringList(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return String(item).trim(); }).filter(Boolean);
    }

    if (typeof value !== 'string' || !value.trim()) return [];

    try {
      var parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return toStringList(parsed);
    } catch (e) {
      // 数据库可能存放普通中文分隔文本，继续按分隔符处理。
    }

    return value.split(/[、,，;；]/).map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  function normalizeGallery(gallery, image) {
    var images = toStringList(gallery);
    if (image && images.indexOf(image) === -1) images.unshift(image);
    return images;
  }

  /**
   * 将 API 记录或 GeoJSON Feature 转换为 Act2 唯一的数据结构。
   * 复合指标保留原始信息，避免 UI 层再次猜测字段名称。
   */
  function normalizeDestination(record) {
    if (!record || typeof record !== 'object') return null;

    var isFeature = record.type === 'Feature';
    var source = isFeature ? (record.properties || {}) : record;
    var coordinates = isFeature && record.geometry && Array.isArray(record.geometry.coordinates)
      ? record.geometry.coordinates
      : [];

    var latitude = toFiniteNumber(firstValue(source.latitude, source.lat, coordinates[1]));
    var longitude = toFiniteNumber(firstValue(source.longitude, source.lng, source.lon, coordinates[0]));
    var name = firstValue(source.name, source.destination_name);

    if (!name || latitude === null || longitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

    var image = firstValue(source.image, source.image_url, '');
    var healthTags = toStringList(firstValue(source.health_tags, source.features, []));
    var suitableFor = toStringList(firstValue(source.suitable_for, source.suitable_people, []));

    return {
      id: firstValue(record.id, source.id, String(name) + '@' + latitude + ',' + longitude),
      name: String(name),
      province: String(firstValue(source.province, '')),
      city: String(firstValue(source.city, '')),
      latitude: latitude,
      longitude: longitude,

      image: String(image || ''),
      gallery: normalizeGallery(source.gallery, image),
      story: String(firstValue(source.story, source.description, '')),
      tagline: String(firstValue(source.tagline, '')),

      health_tags: healthTags,
      best_season: String(firstValue(source.best_season, '')),
      suitable_for: suitableFor,

      climate: String(firstValue(source.climate, '')),
      temperature: {
        average: String(firstValue(source.average_temperature, source.temperature, '')),
        summer: String(firstValue(source.temperature_summer, source.summer_temperature, '')),
        winter: String(firstValue(source.temperature_winter, source.winter_temperature, '')),
      },
      air_quality: {
        level: String(firstValue(source.air_quality_level, source.air_quality, '')),
        index: toFiniteNumber(firstValue(source.air_quality_index, source.aqi)),
      },
      forest_coverage: String(firstValue(source.forest_coverage, '')),
      medical_level: String(firstValue(source.medical_level, '')),
      budget_level: String(firstValue(source.budget_level, '')),
      monthly_budget: {
        low: toFiniteNumber(source.monthly_cost_low),
        high: toFiniteNumber(source.monthly_cost_high),
      },
      altitude: toFiniteNumber(source.altitude),
      score: toFiniteNumber(source.score),
    };
  }

  function normalizeDestinations(records) {
    if (!Array.isArray(records)) return [];

    var seen = Object.create(null);
    return records.map(normalizeDestination).filter(function (destination) {
      if (!destination) return false;
      var key = String(destination.id);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function loadDestinationContent() {
    if (!destinationContentPromise) {
      destinationContentPromise = fetchJson(DESTINATION_CONTENT_URL, DEFAULT_TIMEOUT)
        .then(function (data) {
          return data && Array.isArray(data.destinations) ? data.destinations : [];
        })
        .catch(function (error) {
          console.warn('[API] 目的地内容清单加载失败，继续使用基础数据:', error.message);
          return [];
        });
    }
    return destinationContentPromise;
  }

  function budgetSummary(destination) {
    var budget = destination.monthly_budget || {};
    if (budget.low !== null && budget.high !== null) {
      return '¥' + budget.low.toLocaleString('zh-CN') + '–' + budget.high.toLocaleString('zh-CN') + '/月';
    }
    return destination.budget_level || '待核验';
  }

  function buildWellnessSummary(destination) {
    var air = destination.air_quality || {};
    var aqi = air.index;
    var airDescription = '空气数据仍需结合季节与实时监测判断。';
    if (aqi !== null && aqi <= 50) airDescription = '适合重视日常户外活动与呼吸环境的人群。';
    else if (aqi !== null && aqi <= 100) airDescription = '多数时段适合户外活动，敏感人群仍需关注实时空气状况。';

    return {
      air_quality: {
        title: air.level ? '空气质量' + air.level : '空气质量待核验',
        value: aqi !== null ? 'AQI ' + aqi : '待核验',
        description: airDescription,
      },
      forest: {
        title: destination.forest_coverage ? '自然生态覆盖' : '自然生态待核验',
        value: destination.forest_coverage || '待核验',
        description: '用于理解目的地的日常自然接触条件，不代表医疗效果。',
      },
      medical: {
        title: '周边医疗资源',
        value: destination.medical_level || '待核验',
        description: '长住前仍需按个人健康需求核实医院距离、科室与急救条件。',
      },
      budget: {
        title: destination.budget_level ? destination.budget_level + '旅居预算' : '旅居预算待核验',
        value: budgetSummary(destination),
        description: '实际费用会随季节、房型与停留方式变化。',
      },
    };
  }

  function mergeDestinationContent(destinations, contentRecords) {
    var byId = Object.create(null);
    var byName = Object.create(null);

    (contentRecords || []).forEach(function (record) {
      if (!record || typeof record !== 'object') return;
      if (record.id !== undefined && record.id !== null) byId[String(record.id)] = record;
      if (record.name) byName[String(record.name)] = record;
    });

    return (destinations || []).map(function (destination) {
      var contentById = byId[String(destination.id)];
      var content = contentById && (!contentById.name || String(contentById.name) === destination.name)
        ? contentById
        : byName[destination.name];
      if (!content) {
        destination.wellness_summary = buildWellnessSummary(destination);
        return destination;
      }

      var image = firstValue(content.image, destination.image, '');
      var merged = Object.assign({}, destination, {
        image: String(image || ''),
        image_local: String(firstValue(content.image_local, destination.image_local, '')),
        gallery: normalizeGallery(firstValue(content.gallery, destination.gallery, []), image),
        story: String(firstValue(content.story, destination.story, '')),
        tagline: String(firstValue(content.tagline, destination.tagline, '')),
        health_tags: toStringList(firstValue(content.health_tags, destination.health_tags, [])),
        best_season: String(firstValue(content.best_season, destination.best_season, '')),
        suitable_for: toStringList(firstValue(content.suitable_for, destination.suitable_for, [])),
        asset_status: String(firstValue(content.asset_status, 'base_data')),
        image_attribution: String(firstValue(content.image_attribution, '')),
        image_license: String(firstValue(content.image_license, '')),
        image_source_url: String(firstValue(content.image_source_url, '')),
        text_sources: Array.isArray(content.text_sources) ? content.text_sources : [],
      });
      merged.wellness_summary = buildWellnessSummary(merged);
      return merged;
    });
  }

  async function fetchJson(url, timeout) {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, timeout || DEFAULT_TIMEOUT);

    try {
      var response = await fetch(url, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(tid);
    }
  }

  /**
   * 判断字段是否“缺失”（null / undefined / 空字符串 / 空数组）。
   * GeoJSON 补充只针对缺失字段，禁止覆盖 API 已有的有效值。
   */
  function hasValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  // 需要按字段补充的标量 / 列表 / 复合字段
  var SUPPLEMENT_SCALAR_FIELDS = [
    'province', 'city', 'climate', 'forest_coverage', 'medical_level',
    'budget_level', 'best_season', 'altitude', 'score',
  ];
  var SUPPLEMENT_LIST_FIELDS = ['health_tags', 'suitable_for'];
  var SUPPLEMENT_COMPOUND_FIELDS = {
    temperature: ['average', 'summer', 'winter'],
    air_quality: ['level', 'index'],
    monthly_budget: ['low', 'high'],
  };

  /**
   * 用 GeoJSON 记录补充 API 记录中缺失的字段（仅缺失字段，API 有效字段不被覆盖）。
   * @returns {{destination: Object, changed: boolean}}
   */
  function supplementDestination(destination, fallback) {
    if (!fallback) return { destination: destination, changed: false };

    var merged = Object.assign({}, destination);
    var changed = false;

    function fill(field) {
      if (!hasValue(merged[field]) && hasValue(fallback[field])) {
        merged[field] = fallback[field];
        changed = true;
      }
    }

    SUPPLEMENT_SCALAR_FIELDS.forEach(fill);

    Object.keys(SUPPLEMENT_COMPOUND_FIELDS).forEach(function (compound) {
      if (!merged[compound] || typeof merged[compound] !== 'object') return;
      var mergedCompound = Object.assign({}, merged[compound]);
      var fallbackCompound = fallback[compound] || {};
      SUPPLEMENT_COMPOUND_FIELDS[compound].forEach(function (field) {
        if (!hasValue(mergedCompound[field]) && hasValue(fallbackCompound[field])) {
          mergedCompound[field] = fallbackCompound[field];
          changed = true;
        }
      });
      merged[compound] = mergedCompound;
    });

    SUPPLEMENT_LIST_FIELDS.forEach(fill);

    return { destination: merged, changed: changed };
  }

  /**
   * 以目的地名称为稳定匹配键，把 GeoJSON 补充到 API 结果：
   * - API 记录优先，同名 GeoJSON 只补充 API 缺失字段；
   * - GeoJSON 独有的目的地追加到结果末尾。
   * @returns {{destinations: Array, supplemented: boolean}}
   */
  function mergeApiWithGeojson(apiDestinations, geojsonDestinations) {
    var byName = Object.create(null);
    (geojsonDestinations || []).forEach(function (geojsonDestination) {
      byName[String(geojsonDestination.name)] = geojsonDestination;
    });

    var apiNames = Object.create(null);
    var supplemented = false;
    var destinations = (apiDestinations || []).map(function (apiDestination) {
      apiNames[String(apiDestination.name)] = true;
      var merged = supplementDestination(apiDestination, byName[String(apiDestination.name)]);
      if (merged.changed) supplemented = true;
      return merged.destination;
    });

    (geojsonDestinations || []).forEach(function (geojsonDestination) {
      if (!apiNames[String(geojsonDestination.name)]) {
        destinations.push(geojsonDestination);
        supplemented = true;
      }
    });

    return { destinations: destinations, supplemented: supplemented };
  }

  var snapshotPromise = null;

  /**
   * 加载并合并全部数据源，产出 { results, meta } 快照。
   * API 与 GeoJSON 并行加载：API 失败不中断流程，GeoJSON 负责补充与兜底。
   */
  async function loadSnapshot() {
    var contentPromise = loadDestinationContent();

    var apiPayloadPromise = IS_GITHUB_PAGES
      ? Promise.resolve(null)
      : fetchJson(API_BASE + '/api/destinations', DEFAULT_TIMEOUT)
        .catch(function (error) {
          console.warn('[API] 后端目的地加载失败，将使用本地静态资料:', error.message);
          return null;
        });
    var geojsonPromise = fetchJson(DESTINATIONS_FALLBACK_URL, DEFAULT_TIMEOUT)
      .catch(function (error) {
        console.warn('[API] 本地 GeoJSON 加载失败:', error.message);
        return null;
      });

    var apiPayload = await apiPayloadPromise;
    var geojsonPayload = await geojsonPromise;

    var apiRecords = apiPayload ? (Array.isArray(apiPayload) ? apiPayload : apiPayload.results) : [];
    var apiDestinations = normalizeDestinations(apiRecords);
    var geojsonDestinations = normalizeDestinations(geojsonPayload && geojsonPayload.features);

    var results;
    var source;
    if (apiDestinations.length) {
      var merged = mergeApiWithGeojson(apiDestinations, geojsonDestinations);
      results = merged.destinations;
      source = merged.supplemented ? 'api+geojson' : 'api';
    } else {
      results = geojsonDestinations;
      source = IS_GITHUB_PAGES ? 'github-pages-static' : 'geojson';
    }

    var apiMeta = apiPayload && !Array.isArray(apiPayload) && apiPayload.meta ? apiPayload.meta : {};
    var contentRecords = await contentPromise;

    return {
      results: mergeDestinationContent(results, contentRecords),
      meta: {
        source: source,
        database_snapshot_updated_at: apiMeta.database_snapshot_updated_at || null,
        verification_status: apiMeta.verification_status || 'pending_data_contract',
      },
    };
  }

  /**
   * 获取目的地快照：标准化目的地数组 + 数据来源元信息。
   * meta.source 如实反映数据来源（api / api+geojson / geojson），
   * database_snapshot_updated_at 仅表示数据库文件更新时间，不是内容核验时间。
   * @returns {Promise<{results: Array, meta: Object}>}
   */
  function getDestinationsSnapshot() {
    if (!snapshotPromise) {
      snapshotPromise = loadSnapshot().catch(function (error) {
        snapshotPromise = null; // 失败后允许下次调用重试
        throw error;
      });
    }
    return snapshotPromise;
  }

  /**
   * 获取所有目的地并统一字段。
   * 兼容旧调用方：仍然只返回标准化目的地数组（Act2 地球等依赖此接口）。
   * @returns {Promise<Array>} 标准化目的地数组
   */
  async function getDestinations() {
    var snapshot = await getDestinationsSnapshot();
    return snapshot.results;
  }

  // 兼容旧调用方；返回值现在同样是统一后的目的地结构。
  var fetchDestinations = getDestinations;

  /**
   * 加载图片并自动降级：远程主图 → 本地降级图 → null。
   * 用于目的地主图等核心视觉，避免远程资源不可达时留下空白。
   * @param {string} remoteUrl - 首选远程图（授权照片）
   * @param {string} localUrl - 本地降级图（占位图或已本地化的照片）
   * @returns {Promise<string|null>} 最终成功加载的 URL；全部失败返回 null
   */
  function loadImageWithFallback(remoteUrl, localUrl) {
    var candidates = [remoteUrl, localUrl].filter(function (url) {
      return url && String(url).trim();
    });
    var tried = [];

    function tryNext() {
      if (!candidates.length) return Promise.resolve(null);
      var url = String(candidates.shift());
      if (tried.indexOf(url) !== -1) return tryNext();
      tried.push(url);
      return new Promise(function (resolve) {
        var image = new Image();
        image.onload = function () { resolve(url); };
        image.onerror = function () { resolve(tryNext()); };
        image.src = url;
      });
    }

    return tryNext();
  }

  /**
   * 提交推荐请求
   * @param {Object} profile - 用户问卷数据
   * @returns {Promise<Object>} 推荐结果
   */
  async function postRecommend(profile) {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 30000);

    try {
      var resp = await fetch(API_BASE + '/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (resp.ok) {
        return await resp.json();
      }
      throw new Error('HTTP ' + resp.status);
    } catch (e) {
      console.warn('[API] 推荐请求失败:', e.message);
      throw e;
    } finally {
      clearTimeout(tid);
    }
  }

  /**
   * 规划两个 WGS84 节点间的真实道路路线。
   * 高德密钥和 GCJ-02 转换均留在后端，前端只消费可渲染的 WGS84 几何。
   */
  async function planRoute(request) {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 30000);

    try {
      var resp = await fetch(API_BASE + '/api/routes/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        var message = 'HTTP ' + resp.status;
        try {
          var payload = await resp.json();
          message = payload.detail || message;
        } catch (ignore) {}
        throw new Error(message);
      }
      return await resp.json();
    } finally {
      clearTimeout(tid);
    }
  }

  /**
   * 获取目的地 POI 数据服务快照。调用方可以自行保留本地 JSON 降级，
   * 但不能把降级数据伪装成实时供应商结果。
   */
  async function getDestinationPois(destinationKey, options) {
    var query = new URLSearchParams();
    var filters = options || {};
    ['category', 'search', 'verification_status'].forEach(function (field) {
      if (filters[field]) query.set(field, filters[field]);
    });
    var suffix = query.toString() ? '?' + query.toString() : '';
    return fetchJson(
      API_BASE + '/api/destinations/' + encodeURIComponent(destinationKey) + '/pois' + suffix,
      5000
    );
  }

  async function postRouteAI(path, request) {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 45000);
    try {
      var resp = await fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        var message = 'HTTP ' + resp.status;
        try {
          var payload = await resp.json();
          message = payload.detail || message;
        } catch (ignore) {}
        throw new Error(message);
      }
      return await resp.json();
    } finally {
      clearTimeout(tid);
    }
  }

  function planAIRoute(request) {
    return postRouteAI('/api/routes/ai/plan', request);
  }

  function reviseAIRoute(request) {
    return postRouteAI('/api/routes/ai/revise', request);
  }

  async function requestStoredRoute(method, path, payload, accessToken) {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, 15000);
    var headers = { Accept: 'application/json' };
    if (payload) headers['Content-Type'] = 'application/json';
    if (accessToken) headers['X-Route-Token'] = accessToken;
    try {
      var resp = await fetch(API_BASE + path, {
        method: method,
        headers: headers,
        body: payload ? JSON.stringify(payload) : undefined,
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        var message = 'HTTP ' + resp.status;
        try {
          var errorPayload = await resp.json();
          message = errorPayload.detail || message;
        } catch (ignore) {}
        var error = new Error(message);
        error.status = resp.status;
        throw error;
      }
      return await resp.json();
    } finally {
      clearTimeout(tid);
    }
  }

  function createStoredRoute(request) {
    return requestStoredRoute('POST', '/api/routes', request, '');
  }

  function getStoredRoute(routeId, accessToken) {
    return requestStoredRoute('GET', '/api/routes/' + encodeURIComponent(routeId), null, accessToken);
  }

  function updateStoredRoute(routeId, accessToken, request) {
    return requestStoredRoute('PATCH', '/api/routes/' + encodeURIComponent(routeId), request, accessToken);
  }

  function getStoredRouteVersions(routeId, accessToken) {
    return requestStoredRoute('GET', '/api/routes/' + encodeURIComponent(routeId) + '/versions', null, accessToken);
  }

  async function requestEvidence(path, payload, timeout) {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, timeout || 30000);
    try {
      var options = {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      };
      if (payload) {
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }
      var resp = await fetch(API_BASE + path, options);
      if (!resp.ok) {
        var message = 'HTTP ' + resp.status;
        try {
          var errorPayload = await resp.json();
          message = errorPayload.detail || message;
        } catch (ignore) {}
        throw new Error(message);
      }
      return await resp.json();
    } finally {
      clearTimeout(tid);
    }
  }

  function getEvidenceStatus() {
    return requestEvidence('/api/evidence/status', null, 15000);
  }

  function searchEvidence(request) {
    return requestEvidence('/api/evidence/search', request, 30000);
  }

  function answerEvidence(request) {
    var payload = Object.assign({}, request || {}, { allow_external_ai: false });
    return requestEvidence('/api/evidence/answer', payload, 30000);
  }

  // 挂载到全局（兼容非模块化引用）
  window.HealthTravelAPI = {
    getDestinations: getDestinations,
    getDestinationsSnapshot: getDestinationsSnapshot,
    fetchDestinations: fetchDestinations,
    postRecommend: postRecommend,
    getDestinationPois: getDestinationPois,
    planRoute: planRoute,
    planAIRoute: planAIRoute,
    reviseAIRoute: reviseAIRoute,
    createStoredRoute: createStoredRoute,
    getStoredRoute: getStoredRoute,
    updateStoredRoute: updateStoredRoute,
    getStoredRouteVersions: getStoredRouteVersions,
    getEvidenceStatus: getEvidenceStatus,
    searchEvidence: searchEvidence,
    answerEvidence: answerEvidence,
    normalizeDestination: normalizeDestination,
    normalizeDestinations: normalizeDestinations,
    mergeDestinationContent: mergeDestinationContent,
    buildWellnessSummary: buildWellnessSummary,
    loadImageWithFallback: loadImageWithFallback,
    API_BASE: API_BASE,
    IS_STATIC_PREVIEW: IS_GITHUB_PAGES,
  };
})();
