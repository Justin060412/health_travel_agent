/**
 * AI 康养旅居 — API Layer
 * 统一数据访问层，处理所有后端通信
 */

(function () {
  'use strict';

  var API_BASE = 'http://127.0.0.1:8000';
  var DEFAULT_TIMEOUT = 8000;

  /**
   * 获取所有目的地数据
   * @returns {Promise<Array>} 目的地数组
   */
  async function fetchDestinations() {
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, DEFAULT_TIMEOUT);

    try {
      var resp = await fetch(API_BASE + '/api/destinations', { signal: ctrl.signal });
      clearTimeout(tid);
      if (resp.ok) {
        var data = await resp.json();
        return data.results || [];
      }
      throw new Error('HTTP ' + resp.status);
    } catch (e) {
      console.warn('[API] 目的地数据加载失败:', e.message);
      return [];
    } finally {
      clearTimeout(tid);
    }
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

  // 挂载到全局（兼容非模块化引用）
  window.HealthTravelAPI = {
    fetchDestinations: fetchDestinations,
    postRecommend: postRecommend,
    API_BASE: API_BASE,
  };
})();
