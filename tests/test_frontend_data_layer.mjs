/**
 * 前端数据层 + Hero 面板行为测试（Node VM 沙箱，mock fetch）
 *
 * 覆盖：
 * - 场景 A：后端关闭 → 纯 GeoJSON 兜底，面板无 --，来源如实说明
 * - 场景 B：后端开启但数据库字段不完整 → API + GeoJSON 按名称补充
 * - 场景 C：后端返回完整字段 → API 优先，GeoJSON 不得覆盖
 * - 场景 D：API 仅返回部分目的地 → 与 GeoJSON 取并集
 * - 兼容性：getDestinations() 仍返回数组（Act2 地球依赖），
 *   wellness_summary / 坐标 / 标签等字段完整
 * - 静态检查：hero.js 无直接请求、无旧扁平字段、无硬编码指标值
 *
 * 用法：
 *   node tests/test_frontend_data_layer.mjs           # mock 后端
 *   LIVE_API=1 node tests/test_frontend_data_layer.mjs # /api/destinations 走真实后端
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf-8');

const API_JS = read('frontend/js/api.js');
const HERO_JS = read('frontend/js/hero.js');
const GEOJSON = JSON.parse(read('frontend/data/destinations.geojson'));
const CONTENT = JSON.parse(read('frontend/data/destination-content.json'));

const LIVE_API = process.env.LIVE_API === '1';
const API_URL_MARK = '/api/destinations';
let lastLiveApiPayload = null; // LIVE 模式下记录真实后端原始返回，用于断言“API 值不被覆盖”

const MOCK_SNAPSHOT_AT = '2026-08-14T01:00:00+00:00';

function jsonResponse(payload) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
}

/**
 * 当前旧 SQLite 结构：有等级无 AQI 数值，缺森林覆盖率/年均气温/医疗等级等。
 * province 与实库一致为“省（州市）”格式（12 条各不同），如实反映旧库数据形态。
 */
function apiRecordsOldSchema(features) {
  return features.map((f, i) => {
    const p = f.properties;
    return {
      id: i + 1,
      name: p.name,
      province: p.province + '（' + p.city + '）',
      climate: p.climate,
      altitude: p.altitude,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      temperature_summer: p.summer_temperature,
      temperature_winter: p.winter_temperature,
      air_quality: p.air_quality,
      monthly_cost_low: p.monthly_cost_low,
      monthly_cost_high: p.monthly_cost_high,
      features: JSON.stringify(p.features),
      description: '旧数据库描述',
      suitable_for: p.suitable_people,
      best_season: p.best_season,
      image_url: null,
      score: p.score,
    };
  });
}

/** 未来完整字段：全部字段有值；巴马的值刻意与 GeoJSON 不同以验证 API 优先 */
function apiRecordsFullSchema(features) {
  return features.map((f, i) => {
    const p = f.properties;
    const rec = {
      id: i + 1,
      name: p.name,
      province: p.province,
      city: p.city,
      climate: p.climate,
      altitude: p.altitude,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      temperature_summer: p.summer_temperature,
      temperature_winter: p.winter_temperature,
      average_temperature: p.average_temperature,
      air_quality: p.air_quality,
      air_quality_index: p.air_quality_index,
      forest_coverage: p.forest_coverage,
      medical_level: p.medical_level,
      budget_level: p.budget_level,
      monthly_cost_low: p.monthly_cost_low,
      monthly_cost_high: p.monthly_cost_high,
      features: JSON.stringify(p.features),
      description: '完整数据库描述',
      suitable_for: p.suitable_people,
      best_season: p.best_season,
      image_url: null,
      score: p.score,
    };
    if (rec.name === '巴马瑶族自治县') {
      rec.air_quality_index = 99;
      rec.forest_coverage = '50.0%';
      rec.medical_level = '三级特等';
      rec.average_temperature = '21.0℃';
    }
    return rec;
  });
}

function makeFetch(apiMode, apiFeatures) {
  return function fetch(url, options) {
    const urlStr = String(url);
    if (urlStr.indexOf(API_URL_MARK) !== -1) {
      if (LIVE_API) {
        // 真实后端：透传响应并记录原始 payload
        return globalThis.fetch(url, options).then((resp) => ({
          ok: resp.ok,
          status: resp.status,
          json: () => resp.json().then((data) => { lastLiveApiPayload = data; return data; }),
        }));
      }
      if (apiMode === 'down') return Promise.reject(new Error('backend down'));
      return jsonResponse({
        count: apiFeatures.length,
        results: apiFeatures,
        meta: {
          served_at: '2026-08-14T00:00:00+00:00',
          database_snapshot_updated_at: MOCK_SNAPSHOT_AT,
          verification_status: 'pending_data_contract',
        },
      });
    }
    if (urlStr.indexOf('destinations.geojson') !== -1) return jsonResponse(GEOJSON);
    if (urlStr.indexOf('destination-content.json') !== -1) return jsonResponse(CONTENT);
    return Promise.reject(new Error('unexpected URL: ' + urlStr));
  };
}

function makeSandbox(apiMode, apiFeatures, hostname = 'localhost') {
  const elements = {};
  ['hero-aqi', 'hero-forest', 'hero-provinces', 'hero-medical',
    'hero-aqi-label', 'hero-data-source', 'hero-stats'].forEach((id) => {
    elements[id] = {
      id,
      textContent: '',
      innerHTML: '',
      style: {},
      hidden: false,
      classList: { add() {}, remove() {} },
      setAttribute() {},
      addEventListener() {},
      removeEventListener() {},
    };
  });

  const captured = { errors: [], warns: [] };
  let rafTime = 0;

  const requests = [];
  const sandbox = {
    location: {
      hostname,
      origin: hostname === 'localhost' ? 'http://localhost:5500' : 'https://' + hostname,
    },
    console: {
      log: (...a) => console.log('[sandbox]', ...a),
      warn: (...a) => { captured.warns.push(a.map(String).join(' ')); console.warn('[sandbox]', ...a); },
      error: (...a) => { captured.errors.push(a.map(String).join(' ')); console.error('[sandbox]', ...a); },
    },
    document: {
      readyState: 'complete',
      getElementById: (id) => elements[id] || null,
      querySelector: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (cb) => { rafTime += 1e9; cb(rafTime); },
    setTimeout: () => 0,
    clearTimeout: () => {},
    AbortController, // 宿主真实现：LIVE_API 模式下 signal 必须是真 AbortSignal
    fetch: (url, options) => {
      requests.push(String(url));
      return makeFetch(apiMode, apiFeatures)(url, options);
    },
    Promise, Date, JSON, Object, Array, String, Number, Math, Set, RegExp,
    isNaN, isFinite, parseFloat, parseInt, Error,
  };

  const context = vm.createContext(sandbox);
  vm.runInContext('globalThis.window = globalThis;', context);
  return { context, elements, captured, requests };
}

async function flush(ms = 30) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootPage(apiMode, apiFeatures, hostname) {
  const { context, elements, captured, requests } = makeSandbox(apiMode, apiFeatures, hostname);
  vm.runInContext(API_JS, context, { filename: 'api.js' });
  vm.runInContext(HERO_JS, context, { filename: 'hero.js' });

  // 请求期间必须显示“载入中”，而不是占位符 --
  assert.strictEqual(elements['hero-aqi'].textContent, '载入中', '加载期间应显示载入中');
  assert.strictEqual(elements['hero-data-source'].textContent, '数据来源：正在载入…');

  await flush();
  const API = vm.runInContext('window.HealthTravelAPI', context);
  return { context, elements, captured, requests, API };
}

function assertPanel(elements, { aqi, forest, provinces, medical, label, sourcePrefix }) {
  for (const el of Object.values(elements)) {
    assert.ok(!el.textContent.includes('--'), `不应保留占位符 --（${el.id}: "${el.textContent}"）`);
  }
  assert.strictEqual(elements['hero-aqi'].textContent, aqi, '平均 AQI');
  assert.strictEqual(elements['hero-forest'].textContent, forest, '平均森林覆盖率');
  assert.strictEqual(elements['hero-provinces'].textContent, provinces, '覆盖省份数');
  assert.strictEqual(elements['hero-medical'].textContent, medical, '主要医疗等级');
  assert.strictEqual(elements['hero-aqi-label'].textContent, label, '空气质量标签');
  assert.ok(
    elements['hero-data-source'].textContent.startsWith(sourcePrefix),
    `来源文案不符: "${elements['hero-data-source'].textContent}"`
  );
}

async function assertCompat(API) {
  // Act2 等调用方依赖：getDestinations() 仍然只返回数组
  const array = await API.getDestinations();
  assert.ok(Array.isArray(array), 'getDestinations 应返回数组');
  assert.strictEqual(array.length, 12, 'Act2 地球应获得 12 个目的地');
  array.forEach((d) => {
    assert.strictEqual(typeof d.name, 'string');
    assert.ok(d.name, '目的地名称不能为空');
    assert.strictEqual(typeof d.latitude, 'number', `${d.name} 纬度`);
    assert.strictEqual(typeof d.longitude, 'number', `${d.name} 经度`);
    assert.ok(d.wellness_summary, `${d.name} 缺少 wellness_summary（Act2 康养面板依赖）`);
    assert.ok(Array.isArray(d.health_tags));
    assert.ok(Array.isArray(d.gallery));
  });
  assert.strictEqual(API.fetchDestinations, API.getDestinations, 'fetchDestinations 兼容别名');
  assert.strictEqual(typeof API.postRecommend, 'function');
  assert.strictEqual(API.API_BASE, 'http://127.0.0.1:8000');
}

function staticChecks() {
  console.log('── 静态检查：无硬编码 / 无旧字段 / 无直接请求 ──');
  assert.ok(!/fetch\s*\(/.test(HERO_JS), 'hero.js 不得直接发起 fetch');
  assert.ok(!HERO_JS.includes('API_BASE'), 'hero.js 不得定义独立 API_BASE');
  assert.ok(!HERO_JS.includes('127.0.0.1'), 'hero.js 不得硬编码后端地址');
  assert.ok(!HERO_JS.includes('air_quality_index'), 'hero.js 不得读取旧扁平字段 air_quality_index');
  assert.ok(!HERO_JS.includes('average_temperature'), 'hero.js 不得读取旧扁平字段 average_temperature');
  assert.ok(HERO_JS.includes('air_quality.index'), 'hero.js 应读取标准化 air_quality.index');
  assert.ok(HERO_JS.includes('temperature.average'), 'hero.js 应读取标准化 temperature.average');
  assert.ok(HERO_JS.includes('forest_coverage'), 'hero.js 应读取 forest_coverage');
  assert.ok(HERO_JS.includes('medical_level'), 'hero.js 应读取 medical_level');
  assert.ok(HERO_JS.includes('d.province'), 'hero.js 应读取 province');
  assert.ok(HERO_JS.includes('getDestinationsSnapshot'), 'hero.js 应使用统一数据层快照接口');
  assert.ok(HERO_JS.includes('database_snapshot_updated_at'), 'hero.js 应消费快照元信息');
  assert.ok(HERO_JS.includes('载入中'), 'hero.js 应有载入中状态');
  assert.ok(HERO_JS.includes('待核验'), 'hero.js 应有待核验状态');

  for (const line of [
    '数据来源：目的地数据库 · 静态汇总，非实时监测',
    '数据来源：目的地数据库 + 本地静态资料补充 · 非实时监测 · 内容待统一核验',
    '数据来源：本地静态目的地资料 · 后端暂不可用 · 非实时监测',
    '数据来源：本地静态目的地资料 · GitHub Pages 预览 · 非实时监测',
  ]) {
    assert.ok(HERO_JS.includes(line), `hero.js 缺少来源文案: ${line}`);
  }

  // 不硬编码任何指标数值（AQI / 森林覆盖率 / 医疗等级）——检查代码本体（剥离注释）
  const heroCode = HERO_JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const hard of ['二级甲等', '三级甲等', '三级乙等', '78.4', '82.3', '37.7']) {
    assert.ok(!heroCode.includes(hard), `hero.js 不得硬编码数据值: ${hard}`);
  }

  assert.ok(API_JS.includes('getDestinationsSnapshot'), 'api.js 应提供快照接口');
  assert.ok(API_JS.includes("'api+geojson'"), 'api.js 应能标记补充数据源');
  assert.ok(API_JS.includes('supplementDestination'), 'api.js 应有按名称字段补充逻辑');
  assert.ok(API_JS.includes('getDestinations'), 'api.js 应保留兼容接口 getDestinations');
  assert.ok(API_JS.includes('DESTINATION_CONTENT_URL'), 'api.js 应继续加载内容清单');
}

async function scenarioA() {
  console.log('── 场景 A：后端关闭 → 纯 GeoJSON 兜底 ──');
  const { elements, captured, API } = await bootPage('down');
  assertPanel(elements, {
    aqi: '37', forest: '80.6', provinces: '9', medical: '二级甲等', label: '优质',
    sourcePrefix: '数据来源：本地静态目的地资料 · 后端暂不可用 · 非实时监测',
  });
  assert.strictEqual(captured.errors.length, 0, '场景 A 不应有 console.error');
  assert.ok(captured.warns.some((w) => w.includes('后端目的地加载失败')), '应记录后端失败告警');

  const snapshot = await API.getDestinationsSnapshot();
  assert.strictEqual(snapshot.meta.source, 'geojson');
  assert.strictEqual(snapshot.meta.database_snapshot_updated_at, null);
  assert.strictEqual(snapshot.meta.verification_status, 'pending_data_contract');
  assert.strictEqual(snapshot.results.length, 12);
  console.log('   ✅ 面板: AQI 37 · 森林 80.6% · 9 省 · 二级甲等 · 来源=本地静态资料');
}

async function scenarioB() {
  console.log('── 场景 B：后端开启但数据库字段不完整 → API + GeoJSON 按名称补充 ──');
  const { elements, captured, API } = await bootPage('partial', apiRecordsOldSchema(GEOJSON.features));
  assertPanel(elements, {
    aqi: '37', forest: '80.6', provinces: '12', medical: '二级甲等', label: '优质',
    sourcePrefix: '数据来源：目的地数据库 + 本地静态资料补充 · 非实时监测 · 内容待统一核验',
  });
  assert.ok(
    elements['hero-data-source'].textContent.includes('数据库快照更新于'),
    'API 参与的来源应附带数据库快照时间'
  );
  assert.strictEqual(captured.errors.length, 0, '场景 B 不应有 console.error');

  const snapshot = await API.getDestinationsSnapshot();
  assert.strictEqual(snapshot.meta.source, 'api+geojson');
  if (LIVE_API) {
    assert.ok(snapshot.meta.database_snapshot_updated_at, '真实后端应提供数据库快照时间');
  } else {
    assert.strictEqual(snapshot.meta.database_snapshot_updated_at, MOCK_SNAPSHOT_AT);
  }

  // 按名称补充：巴马在旧库中没有 AQI 数值/森林覆盖率/年均气温/医疗等级
  const bama = snapshot.results.find((d) => d.name === '巴马瑶族自治县');
  assert.ok(bama, '应包含巴马');
  assert.strictEqual(bama.air_quality.index, 35, 'AQI 应由 GeoJSON 补充');
  if (LIVE_API) {
    // 实库的 air_quality 可能带注记（如“优（世界长寿之乡）”），必须原样保留
    const liveBama = (lastLiveApiPayload.results || lastLiveApiPayload)
      .find((r) => r.name === '巴马瑶族自治县');
    assert.ok(liveBama, '真实后端应返回巴马');
    assert.strictEqual(bama.air_quality.level, liveBama.air_quality, 'API 已有的空气质量等级不被覆盖');
  } else {
    assert.strictEqual(bama.air_quality.level, '优', 'API 已有的空气质量等级不被覆盖');
  }
  assert.strictEqual(bama.temperature.average, '20.5℃', '年均气温应由 GeoJSON 补充');
  assert.strictEqual(bama.forest_coverage, '78.4%', '森林覆盖率应由 GeoJSON 补充');
  assert.strictEqual(bama.medical_level, '二级甲等', '医疗等级应由 GeoJSON 补充');
  assert.ok(bama.story, '内容层（图片/故事）应继续生效');
  assert.ok(bama.wellness_summary, '康养面板数据应可用');

  await assertCompat(API);
  console.log('   ✅ 面板: AQI 37 · 森林 80.6% · 来源=数据库 + 本地静态资料补充');
}

async function scenarioC() {
  console.log('── 场景 C：后端返回完整字段 → API 优先，GeoJSON 不得覆盖 ──');
  const { elements, API } = await bootPage('full', apiRecordsFullSchema(GEOJSON.features));
  assertPanel(elements, {
    aqi: '43', forest: '78.3', provinces: '9', medical: '二级甲等', label: '优质',
    sourcePrefix: '数据来源：目的地数据库 · 静态汇总，非实时监测',
  });

  const snapshot = await API.getDestinationsSnapshot();
  assert.strictEqual(snapshot.meta.source, 'api', '完整 API 不应触发 GeoJSON 补充');
  const bama = snapshot.results.find((d) => d.name === '巴马瑶族自治县');
  assert.strictEqual(bama.air_quality.index, 99, 'API AQI 必须优先');
  assert.strictEqual(bama.forest_coverage, '50.0%', 'API 森林覆盖率必须优先');
  assert.strictEqual(bama.medical_level, '三级特等', 'API 医疗等级必须优先');
  assert.strictEqual(bama.temperature.average, '21.0℃', 'API 年均气温必须优先');
  console.log('   ✅ 面板: AQI 43（含 API 值 99）· 来源=目的地数据库');
}

async function scenarioD() {
  console.log('── 场景 D：API 仅返回部分目的地 → 与 GeoJSON 取并集 ──');
  const { API } = await bootPage('partial', apiRecordsOldSchema(GEOJSON.features.slice(0, 3)));
  const snapshot = await API.getDestinationsSnapshot();
  assert.strictEqual(snapshot.meta.source, 'api+geojson');
  assert.strictEqual(snapshot.results.length, 12, 'GeoJSON 独有的目的地应追加');
  const emei = snapshot.results.find((d) => d.name === '峨眉山');
  assert.ok(emei, '峨眉山应由 GeoJSON 提供');
  assert.strictEqual(emei.air_quality.index, 38);
  console.log('   ✅ 并集 12 个目的地，峨眉山由 GeoJSON 提供');
}

async function scenarioGithubPages() {
  console.log('── 场景 E：GitHub Pages → 跳过后端并使用静态资料 ──');
  const { API, requests, elements } = await bootPage('down', null, 'justin060412.github.io');
  const snapshot = await API.getDestinationsSnapshot();
  assert.strictEqual(API.IS_STATIC_PREVIEW, true, 'GitHub Pages 应识别为静态预览');
  assert.strictEqual(snapshot.meta.source, 'github-pages-static');
  assert.strictEqual(snapshot.results.length, 12, '静态预览仍应加载 12 个目的地');
  assert.ok(!requests.some((url) => url.includes('/api/destinations')), '静态预览不应请求不存在的 API');
  assert.ok(elements['hero-data-source'].textContent.includes('GitHub Pages 预览'));
  console.log('   ✅ 静态目的地 12 个；未请求后端 API；来源明确标记 GitHub Pages 预览');
}

if (LIVE_API) {
  // 实机验证：LIVE_EXPECT_BACKEND=off 时后端应关闭（场景 A）；
  // 默认后端开启（场景 B，当前旧库结构）
  const expectBackend = process.env.LIVE_EXPECT_BACKEND || 'on';
  await staticChecks();
  if (expectBackend === 'off') {
    await scenarioA();
    console.log('\n✅ 实机验证通过：后端关闭 → GeoJSON 兜底（真实网络失败）');
  } else {
    await scenarioB();
    console.log('\n✅ 实机验证通过：真实后端（旧库结构）→ API + GeoJSON 按名称补充');
  }
} else {
  await staticChecks();
  await scenarioA();
  await scenarioB();
  await scenarioC();
  await scenarioD();
  await scenarioGithubPages();
  console.log('\n✅ 全部前端数据层测试通过（mock 后端）');
}
