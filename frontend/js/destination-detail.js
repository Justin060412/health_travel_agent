/**
 * Act3 V1 — 目的地深度体验
 * 将 Act2 的目的地上下文延续到季节、预算和 AI 适合度分析。
 */

(function () {
  'use strict';

  var DETAIL_URL = 'data/destination-details.json';
  var selectedDestination = null;
  var selectedDetail = null;
  var detailDatasetMeta = { version: null, contract: null, updated_at: null };
  var act3Context = null;

  function init() {
    Promise.all([loadDestinations(), loadDetails()])
      .then(function (values) {
        var destinations = values[0];
        var details = values[1];
        selectedDestination = resolveDestination(destinations);
        if (!selectedDestination) throw new Error('没有找到当前目的地');

        selectedDetail = resolveDetail(selectedDestination, details) || buildBaseDetail(selectedDestination);
        act3Context = restoreContext(selectedDestination);
        persistSelectedDestination();
        renderPage();
        bindAnalysisActions();
        bindEvidenceActions();
        trackViewedSections();
      })
      .catch(function (error) {
        console.error('[Act3] 目的地深度体验加载失败:', error);
        showError(error.message || '目的地内容暂时无法加载');
      });
  }

  function loadDestinations() {
    if (!window.HealthTravelAPI || !window.HealthTravelAPI.getDestinations) {
      return Promise.resolve([]);
    }
    return window.HealthTravelAPI.getDestinations();
  }

  function loadDetails() {
    return fetch(DETAIL_URL, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('深度内容 HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        detailDatasetMeta = {
          version: data && data.version || null,
          contract: data && data.contract || null,
          updated_at: data && data.updated_at || null
        };
        return data && Array.isArray(data.destinations) ? data.destinations : [];
      })
      .catch(function (error) {
        console.warn('[Act3] 深度内容文件不可用，改用基础目的地信息:', error.message);
        return [];
      });
  }

  function resolveDestination(destinations) {
    if (!Array.isArray(destinations) || !destinations.length) return readSession('ht_selected_dest');

    var params = new URLSearchParams(window.location.search);
    var queryId = params.get('destination_id');
    var queryName = params.get('destination_name');
    var sessionDestination = readSession('ht_selected_dest');
    var expectedName = queryName || (sessionDestination && sessionDestination.name) || '';

    if (queryId !== null) {
      var byId = destinations.find(function (item) {
        return String(item.id) === String(queryId) && (!expectedName || item.name === expectedName);
      });
      if (byId) return byId;
    }

    if (expectedName) {
      var byName = destinations.find(function (item) { return item.name === expectedName; });
      if (byName) return byName;
    }

    var dali = destinations.find(function (item) { return item.name === '大理古城'; });
    return dali || destinations[0];
  }

  function resolveDetail(destination, details) {
    if (!Array.isArray(details)) return null;

    var byName = details.find(function (item) { return item && item.name === destination.name; });
    if (byName) return byName;

    return details.find(function (item) {
      return item && String(item.id) === String(destination.id) && (!item.name || item.name === destination.name);
    }) || null;
  }

  function buildBaseDetail(destination) {
    var place = destination.name || '这个目的地';
    return {
      name: place,
      is_base_only: true,
      hero: {
        eyebrow: place + ' · 深度旅居体验',
        title: destination.tagline || ('进一步了解在' + place + '生活会怎样'),
        summary: destination.story || '这里的深度旅居资料正在持续核验，先从现有环境与生活条件开始判断。',
        image: destination.image || '',
        image_attribution: destination.image_attribution || '',
        image_license: destination.image_license || ''
      },
      quick_facts: [
        { label: '气候印象', value: destination.climate || '待核验', description: temperatureLabel(destination) || '具体月份体感需结合实时天气。' },
        { label: '最佳季节', value: destination.best_season || '待核验', description: '选择出行季节后，再结合个人健康与活动习惯判断。' },
        { label: '医疗资源', value: destination.medical_level || '待核验', description: '医院距离、科室与急救条件仍需单独确认。' }
      ],
      day_in_life: [
        { period: '上午', title: '从日常步行开始观察', description: '用真实活动强度感受气候、地形和生活补给，不以景点打卡代替试住判断。' },
        { period: '午后', title: '核对长住所需的配套', description: '根据实际住址确认交通、餐饮、采购与休息空间；详细本地资料仍在核验。' },
        { period: '傍晚', title: '记录身体与环境的适应度', description: '关注活动后的体感、温差与睡眠节奏，为后续 AI 分析留下真实依据。' }
      ],
      seasons: [
        { id: 'planned', label: destination.best_season || '计划季节', title: '按你的计划时间核验', description: '本地分季节资料尚待补充，请在出发前结合官方天气与目的地实时信息确认。', focus: '当前页面会把这个季节偏好带入 AI 分析。' }
      ],
      living_conditions: [
        { title: '气候条件', value: destination.climate || '待核验', description: temperatureLabel(destination) || '以实时天气与个人体感为准。' },
        { title: '空气环境', value: airLabel(destination), description: '空气数据会随季节变化，敏感人群应关注实时监测。' },
        { title: '自然接触', value: destination.forest_coverage || '待核验', description: '基础环境数据不代表医疗或康复效果。' },
        { title: '长住配套', value: '资料待补充', description: '交通、购物与居住条件将在该目的地内容核验后补齐。' }
      ],
      medical_access: {
        status: destination.medical_level || '医疗资料待核验',
        items: [{ name: '本地医疗机构', level: '待核验', description: '请按实际住址与个人科室需求确认医院、交通时间和连续治疗条件。' }],
        disclaimer: '本页不构成医疗建议。当前目的地的医院清单与服务能力尚待官方来源核验。'
      },
      budget_scenarios: defaultBudgetScenarios(),
      suitable_conditions: (destination.suitable_for || []).length ? destination.suitable_for : ['愿意先短住并记录真实生活体验的人'],
      caution_notes: ['深度本地资料仍在核验，不应仅凭基础环境数据做长住决定', '季节、房价、交通与医疗条件需要在出发前再次确认'],
      sources: (destination.text_sources || []).map(function (url, index) {
        return { title: '目的地基础资料 ' + (index + 1), publisher: '外部来源', url: url, scope: '目的地基础介绍' };
      })
    };
  }

  function defaultBudgetScenarios() {
    return [
      { id: 'essential', label: '基础试住', value_mode: 'base_low', description: '优先验证身体适应与日常便利。' },
      { id: 'balanced', label: '舒适长住', value_mode: 'base_range', description: '为交通与体验预留弹性空间。' },
      { id: 'flexible', label: '从容体验', value_mode: 'base_high', description: '更重视居住条件，实际费用仍需实时核验。' }
    ];
  }

  function restoreContext(destination) {
    var previous = readSession('ht_act3_context');
    var sameDestination = previous && String(previous.destination_id) === String(destination.id)
      && (!previous.destination_name || previous.destination_name === destination.name);

    return {
      source: 'act3_v1',
      destination_id: destination.id,
      destination_name: destination.name,
      selected_season: sameDestination ? previous.selected_season || '' : '',
      selected_season_label: sameDestination ? previous.selected_season_label || '' : '',
      budget_scenario: sameDestination ? previous.budget_scenario || '' : '',
      budget_scenario_label: sameDestination ? previous.budget_scenario_label || '' : '',
      viewed_sections: sameDestination && Array.isArray(previous.viewed_sections) ? previous.viewed_sections : [],
      entered_at: sameDestination && previous.entered_at ? previous.entered_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  function persistSelectedDestination() {
    writeSession('ht_selected_dest', selectedDestination);
    writeSession('ht_act3_context', act3Context);
    writeSession('ht_exploration_context', {
      source: 'act3_v1',
      destination_id: selectedDestination.id,
      destination_name: selectedDestination.name,
      environment: buildEnvironmentContext(selectedDestination),
      act3: act3Context,
      selected_at: new Date().toISOString()
    });
  }

  function renderPage() {
    document.title = selectedDestination.name + '深度旅居体验 · AI 康养旅居';
    renderHero();
    renderFacts();
    renderDayTimeline();
    renderSeasons();
    renderLivingConditions();
    renderMedical();
    renderBudgets();
    renderFitSummary();
    renderSources();

    setText('analysis-title', '分析' + selectedDestination.name + '是否适合你');
    setText('analysis-summary', 'AI 会结合你在这里选择的季节、预算情景，以及当前目的地的环境数据继续判断。');
    setText('detail-analysis-btn', '分析' + selectedDestination.name + '是否适合我');
    setText('hero-analysis-btn', '直接分析' + selectedDestination.name);

    var back = document.getElementById('detail-back-link');
    if (back) {
      back.href = 'index.html?resume=act2&destination_id=' + encodeURIComponent(String(selectedDestination.id))
        + '&destination_name=' + encodeURIComponent(selectedDestination.name);
    }
  }

  function renderHero() {
    var hero = selectedDetail.hero || {};
    setText('detail-eyebrow', hero.eyebrow || selectedDestination.name + ' · 深度旅居体验');
    setText('detail-title', hero.title || selectedDestination.tagline || selectedDestination.name);
    setText('detail-summary', hero.summary || selectedDestination.story || '进一步了解这里的真实旅居条件。');

    var imageUrl = hero.image || selectedDestination.image;
    var localImageUrl = selectedDestination.image_local || hero.image_local || '';
    var media = document.getElementById('detail-hero-media');
    if (media && (imageUrl || localImageUrl)) {
      media.dataset.imageStatus = 'loading';
      var imageLoader = window.HealthTravelAPI && window.HealthTravelAPI.loadImageWithFallback;
      var loadPromise = imageLoader ? imageLoader(imageUrl, localImageUrl) : Promise.resolve(null);
      loadPromise.then(function (loadedUrl) {
        if (loadedUrl) {
          var resolvedImageUrl;
          try {
            resolvedImageUrl = new URL(String(loadedUrl), document.baseURI).href;
          } catch (error) {
            resolvedImageUrl = String(loadedUrl);
          }
          media.style.backgroundImage = 'url("' + resolvedImageUrl.replace(/"/g, '\\"') + '")';
          media.dataset.imageStatus = 'loaded';
          // 本地占位图为项目自绘，无需署名；署名仅随远程授权照片展示
          var isLocalShown = String(loadedUrl).indexOf('assets/images/destinations') !== -1;
          var credit = isLocalShown
            ? ''
            : [hero.image_attribution, hero.image_license].filter(Boolean).join(' · ');
          setText('detail-image-credit', credit ? '图片：' + credit : '');
        } else {
          media.dataset.imageStatus = 'unavailable';
          setText('detail-image-credit', '');
        }
      });
      media.setAttribute('aria-label', selectedDestination.name + '风景');
    }
  }

  function renderFacts() {
    renderCollection('detail-facts', selectedDetail.quick_facts || [], function (item) {
      return '<article class="detail-fact">'
        + '<p class="detail-fact-label">' + escapeHtml(item.label) + '</p>'
        + '<p class="detail-fact-value">' + escapeHtml(item.value) + '</p>'
        + '<p class="detail-fact-description">' + escapeHtml(item.description) + '</p>'
        + '</article>';
    });
  }

  function renderDayTimeline() {
    renderCollection('detail-day-timeline', selectedDetail.day_in_life || [], function (item) {
      return '<li class="timeline-item">'
        + '<p class="timeline-period">' + escapeHtml(item.period) + '</p>'
        + '<h3>' + escapeHtml(item.title) + '</h3>'
        + '<p>' + escapeHtml(item.description) + '</p>'
        + '</li>';
    });
  }

  function renderSeasons() {
    var seasons = selectedDetail.seasons || [];
    if (!seasons.length) return;
    var selectedId = act3Context.selected_season || seasons[0].id;
    if (!seasons.some(function (season) { return season.id === selectedId; })) selectedId = seasons[0].id;

    var tabs = document.getElementById('season-tabs');
    tabs.innerHTML = '';
    seasons.forEach(function (season, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'season-tab';
      button.id = 'season-tab-' + season.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'season-panel');
      button.setAttribute('aria-selected', String(season.id === selectedId));
      button.setAttribute('tabindex', season.id === selectedId ? '0' : '-1');
      button.dataset.seasonId = season.id;
      button.dataset.seasonIndex = String(index);
      button.textContent = season.label;
      button.addEventListener('click', function () { selectSeason(season.id, true); });
      button.addEventListener('keydown', handleSeasonKeydown);
      tabs.appendChild(button);
    });
    selectSeason(selectedId, true);
  }

  function selectSeason(seasonId, shouldPersist) {
    var seasons = selectedDetail.seasons || [];
    var season = seasons.find(function (item) { return item.id === seasonId; }) || seasons[0];
    if (!season) return;

    document.querySelectorAll('.season-tab').forEach(function (button) {
      var selected = button.dataset.seasonId === season.id;
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute('tabindex', selected ? '0' : '-1');
    });

    var panel = document.getElementById('season-panel');
    panel.setAttribute('aria-labelledby', 'season-tab-' + season.id);
    panel.innerHTML = '<h3>' + escapeHtml(season.title) + '</h3>'
      + '<div class="season-panel-body"><p>' + escapeHtml(season.description) + '</p>'
      + '<p class="season-focus">' + escapeHtml(season.focus) + '</p></div>';

    if (shouldPersist) {
      act3Context.selected_season = season.id;
      act3Context.selected_season_label = season.label || season.id;
      persistContext();
    }
  }

  function handleSeasonKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    var tabs = Array.from(document.querySelectorAll('.season-tab'));
    var current = tabs.indexOf(event.currentTarget);
    var direction = event.key === 'ArrowRight' ? 1 : -1;
    var next = tabs[(current + direction + tabs.length) % tabs.length];
    next.focus();
    selectSeason(next.dataset.seasonId, true);
  }

  function renderLivingConditions() {
    renderCollection('detail-living-grid', selectedDetail.living_conditions || [], function (item, index) {
      return '<article class="living-card">'
        + '<span class="living-card-number">' + pad(index + 1) + '</span>'
        + '<h3>' + escapeHtml(item.title) + '</h3>'
        + '<p class="living-card-value">' + escapeHtml(item.value) + '</p>'
        + '<p class="living-card-description">' + escapeHtml(item.description) + '</p>'
        + '</article>';
    });
  }

  function renderMedical() {
    var medical = selectedDetail.medical_access || {};
    setText('medical-status', medical.status || '按个人需求核验');
    setText('medical-disclaimer', medical.disclaimer || '本页不构成医疗建议。');
    renderCollection('medical-list', medical.items || [], function (item) {
      return '<article class="medical-item">'
        + '<div class="medical-item-head"><h4>' + escapeHtml(item.name) + '</h4>'
        + '<span class="medical-level">' + escapeHtml(item.level) + '</span></div>'
        + '<p>' + escapeHtml(item.description) + '</p>'
        + '</article>';
    });
  }

  function renderBudgets() {
    var scenarios = selectedDetail.budget_scenarios || defaultBudgetScenarios();
    var selectedId = act3Context.budget_scenario || (scenarios[1] ? scenarios[1].id : scenarios[0].id);
    var range = budgetRange(selectedDestination);
    setText('budget-range', range.full);

    var container = document.getElementById('budget-options');
    container.innerHTML = '';
    scenarios.forEach(function (scenario) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'budget-option';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(scenario.id === selectedId));
      button.dataset.budgetId = scenario.id;
      button.innerHTML = '<span class="budget-option-head"><span class="budget-option-label">'
        + escapeHtml(scenario.label) + '</span><span class="budget-option-value">'
        + escapeHtml(budgetValue(scenario.value_mode, range)) + '</span></span>'
        + '<p>' + escapeHtml(scenario.description) + '</p>';
      button.addEventListener('click', function () { selectBudget(scenario.id); });
      container.appendChild(button);
    });
    selectBudget(selectedId);
  }

  function selectBudget(scenarioId) {
    var scenarios = selectedDetail.budget_scenarios || defaultBudgetScenarios();
    var scenario = scenarios.find(function (item) { return item.id === scenarioId; }) || scenarios[0];
    if (!scenario) return;
    document.querySelectorAll('.budget-option').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.budgetId === scenario.id));
    });
    act3Context.budget_scenario = scenario.id;
    act3Context.budget_scenario_label = scenario.label || scenario.id;
    persistContext();
  }

  function renderFitSummary() {
    renderCollection('suitable-list', selectedDetail.suitable_conditions || [], function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    });
    renderCollection('caution-list', selectedDetail.caution_notes || [], function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    });
  }

  function renderSources() {
    var sources = selectedDetail.sources || [];
    if (!sources.length) {
      document.getElementById('sources').hidden = true;
      return;
    }
    renderCollection('source-list', sources, function (source) {
      var sourceMeta = [
        source.publisher,
        sourceLevelLabel(source.source_level),
        source.scope,
        source.verified_at ? '核验于 ' + source.verified_at : '',
        verificationLabel(source.verification_status)
      ].filter(Boolean).join(' · ');
      return '<article class="source-item"><a href="' + escapeAttribute(source.url) + '" target="_blank" rel="noopener noreferrer">'
        + escapeHtml(source.title) + ' ↗</a>'
        + '<p class="source-meta">' + escapeHtml(sourceMeta) + '</p></article>';
    });
  }

  function sourceLevelLabel(level) {
    return ({
      government: '政府来源', institution: '机构来源', academic: '学术来源',
      map_provider: '地图平台', merchant: '商家来源', editorial: '编辑资料'
    })[level] || '';
  }

  function verificationLabel(status) {
    return ({
      verified: '已核验', verified_with_gaps: '已核验，仍有缺口',
      reference_only: '仅作参考', pending: '待核验', stale: '资料已过期',
      conflict: '来源存在冲突', unknown: '暂无可靠数据'
    })[status] || '';
  }

  function bindEvidenceActions() {
    var form = document.getElementById('evidence-form');
    var prompts = document.getElementById('evidence-prompts');
    var input = document.getElementById('evidence-question');
    var coverage = document.getElementById('evidence-coverage');
    if (!form || !prompts || !input) return;

    var questions = [
      selectedDestination.name + '有哪些可信的环境依据？',
      selectedDestination.name + '周边医疗能力如何？',
      '这些资料能证明什么，不能证明什么？'
    ];
    prompts.innerHTML = questions.map(function (question) {
      return '<button type="button" data-evidence-question="' + escapeAttribute(question) + '">' + escapeHtml(question) + '</button>';
    }).join('');
    prompts.querySelectorAll('[data-evidence-question]').forEach(function (button) {
      button.addEventListener('click', function () {
        input.value = button.dataset.evidenceQuestion || '';
        askEvidence(input.value);
      });
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      askEvidence(input.value);
    });

    if (!window.HealthTravelAPI || !window.HealthTravelAPI.getEvidenceStatus) {
      coverage.textContent = '证据服务暂时不可用，页面原有资料来源仍可查看。';
      return;
    }
    window.HealthTravelAPI.getEvidenceStatus().then(function (status) {
      coverage.textContent = status.status === 'ready'
        ? '可信证据库已连接 · ' + status.documents + ' 份文档 · ' + status.destinations + ' 个目的地'
        : '证据索引正在维护，暂时只显示已核验的页面资料。';
    }).catch(function () {
      coverage.textContent = '证据服务暂时不可用，页面原有资料来源仍可查看。';
    });
  }

  function askEvidence(question) {
    var answer = document.getElementById('evidence-answer');
    var destinationKey = selectedDetail && selectedDetail.destination_key;
    var cleaned = String(question || '').trim();
    if (!answer || cleaned.length < 2) return;
    if (!window.HealthTravelAPI || !window.HealthTravelAPI.answerEvidence || !destinationKey) {
      answer.innerHTML = '<p class="evidence-answer-error">当前目的地尚未建立可查询的证据索引。</p>';
      return;
    }
    answer.setAttribute('aria-busy', 'true');
    answer.innerHTML = '<p class="evidence-answer-loading">正在检索已授权资料…</p>';
    window.HealthTravelAPI.answerEvidence({
      query: cleaned,
      destination_key: destinationKey,
      limit: 4
    }).then(function (result) {
      renderEvidenceAnswer(answer, result);
    }).catch(function (error) {
      answer.innerHTML = '<p class="evidence-answer-error">证据服务暂时无法响应：' + escapeHtml(error.message || '请稍后重试') + '</p>';
    }).finally(function () {
      answer.removeAttribute('aria-busy');
    });
  }

  function renderEvidenceAnswer(container, result) {
    var grounded = result && result.status === 'grounded';
    var citations = grounded && Array.isArray(result.citations) ? result.citations : [];
    var missing = result && result.retrieval && result.retrieval.meta && result.retrieval.meta.missing_data || [];
    if (!grounded || !citations.length) {
      container.innerHTML = '<div class="evidence-answer-state"><span>证据不足</span><h3>当前资料不能可靠回答</h3><p>'
        + escapeHtml(missing[0] || '没有找到同时满足目的地和来源要求的有效证据。')
        + '</p></div>';
      return;
    }
    container.innerHTML = '<div class="evidence-answer-state is-grounded"><span>有依据的回答</span><p class="evidence-answer-text">'
      + escapeHtml(result.answer) + '</p></div><div class="evidence-citations">'
      + citations.map(function (citation) {
        var meta = [citation.publisher, sourceLevelLabel(citation.source_level), citation.verified_at ? '核验于 ' + citation.verified_at : ''].filter(Boolean).join(' · ');
        return '<article><div><strong>' + escapeHtml(citation.citation_id + ' · ' + citation.heading) + '</strong><p>'
          + escapeHtml(citation.content) + '</p><small>' + escapeHtml(meta) + '</small></div><a href="'
          + escapeAttribute(citation.url) + '" target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a></article>';
      }).join('') + '</div>';
  }

  function bindAnalysisActions() {
    ['hero-analysis-btn', 'detail-analysis-btn'].forEach(function (id) {
      var button = document.getElementById(id);
      if (button) button.addEventListener('click', goToAnalysis);
    });
  }

  function goToAnalysis() {
    persistContext();
    writeSession('ht_selected_dest', selectedDestination);
    writeSession('ht_exploration_context', {
      source: 'act3_v1',
      destination_id: selectedDestination.id,
      destination_name: selectedDestination.name,
      environment: buildEnvironmentContext(selectedDestination),
      act3: act3Context,
      selected_at: new Date().toISOString()
    });

    var query = new URLSearchParams({
      mode: 'destination',
      destination_id: String(selectedDestination.id),
      destination_name: selectedDestination.name,
      source: 'act3'
    });
    window.location.href = 'questionnaire.html?' + query.toString();
  }

  function trackViewedSections() {
    var sections = document.querySelectorAll('#day-life, #seasons, #long-stay, #practical, #fit-summary');
    if (!('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      var changed = false;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < .22) return;
        var id = entry.target.id;
        if (act3Context.viewed_sections.indexOf(id) === -1) {
          act3Context.viewed_sections.push(id);
          changed = true;
        }
      });
      if (changed) persistContext();
    }, { threshold: [.22] });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function persistContext() {
    act3Context.updated_at = new Date().toISOString();
    writeSession('ht_act3_context', act3Context);
    var exploration = readSession('ht_exploration_context') || {};
    exploration.source = 'act3_v1';
    exploration.act3 = act3Context;
    exploration.destination_id = selectedDestination.id;
    exploration.destination_name = selectedDestination.name;
    writeSession('ht_exploration_context', exploration);
  }

  function buildEnvironmentContext(destination) {
    var facts = selectedDetail && selectedDetail.facts ? selectedDetail.facts : {};
    var evidence = selectedDetail && Array.isArray(selectedDetail.analysis_evidence)
      ? selectedDetail.analysis_evidence : [];
    return {
      climate: destination.climate,
      temperature: destination.temperature,
      air_quality: destination.air_quality,
      forest_coverage: destination.forest_coverage,
      medical_level: destination.medical_level,
      budget_level: destination.budget_level,
      monthly_budget: destination.monthly_budget,
      altitude: destination.altitude,
      contract_version: detailDatasetMeta.version,
      contract_name: detailDatasetMeta.contract,
      contract_updated_at: detailDatasetMeta.updated_at,
      destination_key: selectedDetail && selectedDetail.destination_key,
      verification: selectedDetail && selectedDetail.verification,
      verified_facts: facts,
      analysis_evidence: evidence,
      source_ids: evidence.reduce(function (ids, item) {
        (item.source_ids || []).forEach(function (sourceId) {
          if (ids.indexOf(sourceId) === -1) ids.push(sourceId);
        });
        return ids;
      }, [])
    };
  }

  function budgetRange(destination) {
    var budget = destination.monthly_budget || {};
    var low = budget.low !== null && budget.low !== undefined && budget.low !== '' && Number.isFinite(Number(budget.low))
      ? Number(budget.low) : null;
    var high = budget.high !== null && budget.high !== undefined && budget.high !== '' && Number.isFinite(Number(budget.high))
      ? Number(budget.high) : null;
    return {
      low: low,
      high: high,
      full: low !== null && high !== null ? formatMoney(low) + '–' + formatMoney(high) + '/月' : (destination.budget_level || '待核验')
    };
  }

  function budgetValue(mode, range) {
    if (mode === 'base_low' && range.low !== null) return '约 ' + formatMoney(range.low) + ' 起';
    if (mode === 'base_high' && range.high !== null) return '约 ' + formatMoney(range.high) + ' 内';
    if (mode === 'base_range') return range.full;
    return '待核验';
  }

  function formatMoney(value) {
    return '¥' + Number(value).toLocaleString('zh-CN');
  }

  function airLabel(destination) {
    var air = destination.air_quality || {};
    if (typeof air === 'string') return air || '待核验';
    var parts = [];
    if (air.level) parts.push(air.level);
    if (air.index !== null && air.index !== undefined) parts.push('AQI ' + air.index);
    return parts.join(' · ') || '待核验';
  }

  function temperatureLabel(destination) {
    var temperature = destination.temperature || {};
    if (typeof temperature === 'string') return temperature;
    return temperature.average ? '年均气温 ' + temperature.average : '';
  }

  function renderCollection(id, items, renderer) {
    var element = document.getElementById(id);
    if (!element) return;
    element.innerHTML = (items || []).map(renderer).join('');
  }

  function readSession(key) {
    try {
      var value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('[Act3] 无法读取会话数据:', key, error.message);
      return null;
    }
  }

  function writeSession(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[Act3] 无法保存会话数据:', key, error.message);
    }
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value == null ? '' : value;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function showError(message) {
    document.body.classList.add('is-detail-failed');
    var error = document.getElementById('detail-error');
    if (error) error.hidden = false;
    setText('detail-error-message', message || '请返回地球探索后重新选择目的地。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
