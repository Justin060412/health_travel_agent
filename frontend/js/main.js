/**
 * Act2 V2 — AI 康养旅居目的地探索
 * Phase 1: guided first journey, sequential discovery and analysis handoff.
 */

(function () {
  'use strict';

  var earthInitialized = false;
  var journeyStarted = false;
  var selectedIndex = 0;
  var introTimers = [];
  var earthInitPromise = null;
  var resumeParams = new URLSearchParams(window.location.search);
  var embeddedIOS = resumeParams.get('embedded') === 'ios';
  var resumeRequested = resumeParams.get('resume') === 'act2';
  var resumeDestinationId = resumeParams.get('destination_id');
  var resumeDestinationName = resumeParams.get('destination_name') || '';

  function init() {
    console.log('[Act2] main.js init — DOM ready');
    bindChapterButtons();
    bindHeroCTA();
    bindJourneyControls();
    bindDeepExperienceCTA();
    bindAnalysisCTA();
    document.addEventListener('chapterready', function (event) {
      console.log('[Act2] chapterready:', event.detail.id);
      if (event.detail.id === 'chapter-platform') initExploreChapter();
    });
    if ((resumeRequested || embeddedIOS) && window.ChapterManager) {
      window.ChapterManager.navigateTo(1);
    }
  }

  function bindChapterButtons() {
    document.querySelectorAll('.js-chapter-next').forEach(function (button) {
      button.addEventListener('click', function () {
        if (window.ChapterManager) window.ChapterManager.next();
      });
    });

    document.querySelectorAll('[data-chapter]').forEach(function (button) {
      button.addEventListener('click', function () {
        var target = parseInt(button.getAttribute('data-chapter'), 10);
        if (window.ChapterManager && !isNaN(target)) window.ChapterManager.navigateTo(target);
      });
    });
  }

  function bindHeroCTA() {
    document.querySelectorAll('.js-hero-explore').forEach(function (button) {
      button.addEventListener('click', function () {
        if (window.ChapterManager) window.ChapterManager.navigateTo(1);
      });
    });
  }

  function initExploreChapter() {
    if (!window.EarthEngine) {
      showExploreFallback();
      return;
    }

    if (earthInitialized) {
      activateExploreJourney();
      return;
    }

    if (earthInitPromise) return;
    setText('journey-status', '正在加载精选目的地');
    earthInitPromise = loadDestinations().then(function (destinations) {
      if (!destinations.length) {
        showExploreFallback('目的地数据暂时无法加载');
        return false;
      }
      earthInitialized = window.EarthEngine.init('earth-stage', {
        destinations: destinations,
        onMarkerSelect: handleMarkerSelect,
        onMarkerFocusDone: handleMarkerFocusDone,
        onStateChange: handleStateChange,
      }) === true;
      if (!earthInitialized) showExploreFallback('地球体验正在准备中');
      return earthInitialized;
    }).catch(function (error) {
      console.error('[Act2] 目的地初始化失败:', error);
      showExploreFallback('目的地数据暂时无法加载');
      return false;
    }).then(function (ready) {
      if (ready) activateExploreJourney();
      earthInitPromise = null;
    });
  }

  function loadDestinations() {
    if (!window.HealthTravelAPI || !window.HealthTravelAPI.getDestinations) {
      return Promise.resolve([]);
    }
    return window.HealthTravelAPI.getDestinations();
  }

  function activateExploreJourney() {
    resetJourneyView();
    window.EarthEngine.startEntrance();
    if (resumeRequested) {
      resumeRequested = false;
      var destinations = window.EarthEngine.getDestinations();
      var resumeIndex = destinations.findIndex(function (destination) {
        var idMatches = resumeDestinationId !== null && String(destination.id) === String(resumeDestinationId);
        var nameMatches = resumeDestinationName && destination.name === resumeDestinationName;
        return nameMatches || (idMatches && (!resumeDestinationName || destination.name === resumeDestinationName));
      });
      selectedIndex = resumeIndex >= 0 ? resumeIndex : 0;
      journeyStarted = true;
      setJourneyStage('city', '正在返回 · ' + shortName(destinations[selectedIndex] || {}));
      introTimers.push(setTimeout(function () {
        window.EarthEngine.focusOnMarker(selectedIndex);
      }, 420));
      return;
    }
    beginGuidedJourney();
  }

  function resetJourneyView() {
    journeyStarted = false;
    selectedIndex = 0;
    clearIntroTimers();
    if (window.EarthEngine && window.EarthEngine.deselectMarker) {
      window.EarthEngine.deselectMarker();
    }

    var intro = document.getElementById('explore-intro');
    var story = document.getElementById('destination-story');
    var controls = document.getElementById('journey-controls');
    if (intro) intro.classList.remove('is-complete');
    if (story) {
      story.classList.remove('is-visible');
      story.setAttribute('aria-hidden', 'true');
    }
    if (controls) controls.hidden = true;
    setText('journey-status', '正在建立全球视角');
  }

  function beginGuidedJourney() {
    var startButton = document.getElementById('journey-start-btn');
    if (startButton) startButton.onclick = function () { startFirstDestination(); };

    setJourneyStage('global', '正在建立全球视角');
    introTimers.push(setTimeout(function () {
      setJourneyStage('country', '视线正在转向亚洲与中国');
    }, 1100));
    introTimers.push(setTimeout(function () {
      startFirstDestination();
    }, 2600));
  }

  function startFirstDestination() {
    if (journeyStarted || !window.EarthEngine) return;
    journeyStarted = true;
    clearIntroTimers();
    setJourneyStage('city', '第一站 · 正在前往目的地');
    window.EarthEngine.focusOnMarker(0);
  }

  function setJourneyStage(stage, message) {
    if (window.EarthEngine && window.EarthEngine.setJourneyStage) {
      window.EarthEngine.setJourneyStage(stage);
    }
    setText('journey-status', message);
  }

  function clearIntroTimers() {
    introTimers.forEach(function (timer) { clearTimeout(timer); });
    introTimers = [];
  }

  function handleStateChange(state, data) {
    if (state === 'focusing' && data && data.dest) {
      setText('journey-status', '正在前往 · ' + shortName(data.dest));
    }
  }

  function handleMarkerSelect(dest, index) {
    selectedIndex = index;
    journeyStarted = true;
    setText('journey-status', '正在前往 · ' + shortName(dest));
  }

  function handleMarkerFocusDone(dest, index) {
    selectedIndex = index;
    populateDestinationStory(dest);

    var intro = document.getElementById('explore-intro');
    var story = document.getElementById('destination-story');
    var controls = document.getElementById('journey-controls');

    if (intro) intro.classList.add('is-complete');
    if (story) {
      story.classList.add('is-visible');
      story.setAttribute('aria-hidden', 'false');
    }
    if (controls) controls.hidden = false;
    updateJourneyProgress(dest, index);
    notifyIOSDestination(dest, index);
  }

  function selectDestinationFromIOS(index) {
    if (!window.EarthEngine || window.EarthEngine.getState() === 'focusing') return;
    var destinations = window.EarthEngine.getDestinations();
    if (!destinations || !destinations.length) return;
    var nextIndex = Math.max(0, Math.min(Number(index) || 0, destinations.length - 1));
    selectedIndex = nextIndex;
    journeyStarted = true;
    clearIntroTimers();
    window.EarthEngine.focusOnMarker(nextIndex);
  }

  function notifyIOSDestination(dest, index) {
    if (!embeddedIOS || !window.webkit || !window.webkit.messageHandlers) return;
    var handler = window.webkit.messageHandlers.destinationSelected;
    if (!handler) return;
    handler.postMessage({ index: index, id: dest && dest.id, name: shortName(dest || {}) });
  }

  window.HealthTravelIOS = {
    selectDestination: selectDestinationFromIOS
  };

  function bindJourneyControls() {
    var previous = document.getElementById('journey-prev');
    var next = document.getElementById('journey-next');
    if (previous) previous.addEventListener('click', function () { goToRelativeDestination(-1); });
    if (next) next.addEventListener('click', function () { goToRelativeDestination(1); });
  }

  function goToRelativeDestination(direction) {
    if (!window.EarthEngine || window.EarthEngine.getState() === 'focusing') return;
    var destinations = window.EarthEngine.getDestinations();
    if (!destinations || destinations.length === 0) return;
    selectedIndex = (selectedIndex + direction + destinations.length) % destinations.length;
    window.EarthEngine.focusOnMarker(selectedIndex);
  }

  function updateJourneyProgress(dest, index) {
    var destinations = window.EarthEngine ? window.EarthEngine.getDestinations() : [];
    var total = destinations.length || 1;
    setText('journey-current-name', shortName(dest));
    setText('journey-progress-text', pad(index + 1) + ' / ' + pad(total));
  }

  function populateDestinationStory(dest) {
    if (!dest) return;
    try { populateDestinationStoryInternal(dest); } catch (e) {
      console.error('[Act2] populateDestinationStory 失败:', e.message, e);
    }
  }

  function populateDestinationStoryInternal(dest) {
    var storyPanel = document.getElementById('destination-story');
    var wasVisible = storyPanel && storyPanel.classList.contains('is-visible');

    /* ── Layer 2: Place identity ── */
    var cleanProvince = (dest.province || '').replace(/[（(].*?[）)]/g, '').trim();
    setText('info-province', cleanProvince || '中国');
    setText('info-name', dest.name || '--');

    /* ── Layer 3: Storytelling ── */
    setText('info-tagline', dest.tagline || '');
    setText('info-story', dest.story || '在自然与生活之间，发现更适合长期停留的康养方式。');

    /* ── Layer 4: Health tags ── */
    renderHealthTags(dest.health_tags || []);

    /* ── Layer 5: Living info ── */
    setText('info-best-season', dest.best_season || '全年皆宜');
    var suitableText = (dest.suitable_for || []).join(' · ');
    setText('info-suitable-for', suitableText || '各类康养旅居人群');

    /* ── Wellness summary cards ── */
    var ws = dest.wellness_summary;
    if (ws) {
      setWellnessItem('wellness-air', ws.air_quality);
      setWellnessItem('wellness-forest', ws.forest);
      setWellnessItem('wellness-medical', ws.medical);
      setWellnessItem('wellness-budget', ws.budget);
    }

    /* ── Layer 1: Image ── 远程授权照片 → 本地降级图 → CSS 占位 */
    var imageArea = document.getElementById('info-image-area');
    if (imageArea) {
      var imageUrl = dest.image || '';
      var localImageUrl = dest.image_local || '';
      var destinationKey = String(dest.id || dest.name || '');
      imageArea.dataset.destinationId = destinationKey;
      imageArea.dataset.imageShown = '';
      imageArea.style.removeProperty('--destination-image');
      imageArea.dataset.imageStatus = (imageUrl || localImageUrl) ? 'loading' : 'unavailable';

      var imageLoader = window.HealthTravelAPI && window.HealthTravelAPI.loadImageWithFallback;
      if (imageLoader) {
        imageLoader(imageUrl, localImageUrl).then(function (loadedUrl) {
          if (imageArea.dataset.destinationId !== destinationKey) return;
          if (loadedUrl) {
            imageArea.style.setProperty('--destination-image', 'url("' + loadedUrl + '")');
            imageArea.dataset.imageStatus = 'loaded';
            imageArea.dataset.imageShown = loadedUrl;
          } else {
            imageArea.style.removeProperty('--destination-image');
            imageArea.dataset.imageStatus = 'unavailable';
          }
          updateImageAttribution(dest, imageArea);
        });
      }
      updateImageAttribution(dest, imageArea);
      imageArea.setAttribute('aria-label', (dest.name || '目的地') + '风景');
    }

    /* ── Image attribution ── */
    function updateImageAttribution(dest, imageArea) {
      var attrEl = document.getElementById('info-image-attr');
      if (!attrEl) return;
      // 本地占位图为项目自绘，无需署名；署名仅随远程授权照片展示
      var isLocalShown = String(imageArea.dataset.imageShown || '').indexOf('assets/images/destinations') !== -1;
      var attrParts = [];
      if (!isLocalShown) {
        if (dest.image_attribution) attrParts.push(dest.image_attribution);
        if (dest.image_license && dest.image_license !== 'pending') attrParts.push(dest.image_license);
      }
      attrEl.textContent = attrParts.join(' · ');
    }

    /* ── Deep experience + AI CTA ── */
    var deepButton = document.getElementById('info-deep-btn');
    if (deepButton) deepButton.textContent = '了解在' + shortName(dest) + '生活会怎样';
    var analysisButton = document.getElementById('info-cta-btn');
    if (analysisButton) analysisButton.textContent = '直接分析' + shortName(dest);

    /* ── Refresh: re-trigger fade-up on destination switch ── */
    if (wasVisible && storyPanel) refreshStoryEntrance(storyPanel);
  }

  /* ── Render health tags as glass pills ── */
  function renderHealthTags(tags) {
    var container = document.getElementById('info-health-tags');
    if (!container) return;
    container.innerHTML = '';
    var displayTags = (tags || []).slice(0, 4);
    displayTags.forEach(function (tag) {
      var pill = document.createElement('span');
      pill.className = 'destination-health-tag';
      pill.textContent = tag;
      container.appendChild(pill);
    });
  }

  /* ── Populate a single wellness data card ── */
  function setWellnessItem(id, data) {
    if (!data) return;
    setText(id + '-title', data.title || '');
    setText(id + '-value', data.value || '');
    setText(id + '-desc', data.description || '');
  }

  /* ── Re-trigger entrance animations on destination switch ── */
  function refreshStoryEntrance(panel) {
    var animated = panel.querySelectorAll(
      '.destination-tagline, .destination-story-text, .destination-living-info, .destination-wellness, .destination-health-tag'
    );
    animated.forEach(function (el) {
      el.style.animation = 'none';
      void el.offsetWidth; /* force reflow */
      el.style.animation = '';
    });
  }

  function getCurrentDestination() {
    if (!window.EarthEngine) return null;
    var destinations = window.EarthEngine.getDestinations();
    return destinations && destinations[selectedIndex] ? destinations[selectedIndex] : null;
  }

  function persistDestinationContext(dest, source) {
    if (!dest || !window.EarthEngine) return;
    var destinations = window.EarthEngine.getDestinations();
    sessionStorage.setItem('ht_selected_dest', JSON.stringify(dest));
    sessionStorage.setItem('ht_exploration_context', JSON.stringify({
      source: source || 'act2_v2',
      destination_id: dest.id,
      destination_name: dest.name,
      viewed_index: selectedIndex,
      viewed_total: destinations.length,
      earth_state: window.EarthEngine.getState ? window.EarthEngine.getState() : 'focused',
      environment: {
        climate: dest.climate,
        temperature: dest.temperature,
        air_quality: dest.air_quality,
        forest_coverage: dest.forest_coverage,
        medical_level: dest.medical_level,
        budget_level: dest.budget_level,
        monthly_budget: dest.monthly_budget,
        altitude: dest.altitude
      },
      selected_at: new Date().toISOString()
    }));
  }

  function bindDeepExperienceCTA() {
    var button = document.getElementById('info-deep-btn');
    if (!button) return;
    button.addEventListener('click', function () {
      var dest = getCurrentDestination();
      if (!dest) return;
      persistDestinationContext(dest, 'act2_to_act3');
      var query = new URLSearchParams({
        destination_id: String(dest.id),
        destination_name: dest.name,
        source: 'act2'
      });
      window.location.href = 'destination.html?' + query.toString();
    });
  }

  function bindAnalysisCTA() {
    var button = document.getElementById('info-cta-btn');
    if (!button) return;
    button.addEventListener('click', function () {
      var dest = getCurrentDestination();
      if (!dest) return;
      persistDestinationContext(dest, 'act2_v2');
      var query = new URLSearchParams({
        mode: 'destination',
        destination_id: String(dest.id),
        destination_name: dest.name,
        source: 'act2'
      });
      window.location.href = 'questionnaire.html?' + query.toString();
    });
  }

  function shortName(dest) { return dest.name || dest.city || '目的地'; }

  function pad(value) { return String(value).padStart(2, '0'); }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value == null ? '--' : value;
  }

  function showExploreFallback(message) {
    var stage = document.getElementById('earth-stage');
    if (stage) {
      var fallback = document.createElement('div');
      fallback.className = 'explore-fallback';
      fallback.textContent = message || '地球体验正在准备中';
      stage.replaceChildren(fallback);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
