/**
 * AI 康养旅居 — Earth Engine v2.2
 * 精修：精致标记 · 精准定位 · 粒子扩散 · 聚焦动画序列
 *
 * 交互状态机：idle | dragging | inertia | focusing
 * 依赖：Three.js 本地 vendor（index.html 提供 CDN 回退加载）→ window.THREE
 * 地球纹理：本地优先，超时或失败时降级为程序化纹理（canvas 生成）
 */

(function () {
  'use strict';

  /* 目的地数据由 HealthTravelAPI 在初始化时注入。 */
  var DESTINATIONS = [];
  var FEATURED_ORDER = ['大理古城', '巴马瑶族自治县', '苏马荡'];

  /* ═══════════════════════════════════════════════════════
     Three.js 对象
     ═══════════════════════════════════════════════════════ */
  var scene, camera, renderer;
  var earthGroup, earthMesh, atmosphereInner, atmosphereOuter;
  var markers = [];
  var markerParticles = [];       // 标记粒子系统
  var markerLabels = [];
  var labelContainer;
  var starField;
  var ambientLight, sunLight;
  var container;
  var isActive = false;
  var animId = null;
  var globeRadius = 5;

  var viewW = 1, viewH = 1;

  /* ═══════════════════════════════════════════════════════
     旋转状态机
     ═══════════════════════════════════════════════════════ */
  var AUTO_ROTATE_SPEED = 0.10;
  var INERTIA_FRICTION = 0.94;
  var INERTIA_THRESHOLD = 0.0003;

  var state = 'idle';
  var autoRotateY = 0;
  var dragStart = { x: 0, y: 0 };
  var dragPrev = { x: 0, y: 0 };
  var dragVel = { x: 0, y: 0 };
  var dragMoved = false;
  var DRAG_SENSITIVITY = 0.006;
  var DRAG_CLICK_THRESHOLD = 3;

  var focusStartQuat = null;
  var focusTargetQuat = null;
  var focusStartCamZ = 17;
  var focusTargetCamZ = 17;
  var focusProgress = 1;
  var focusedMarkerIdx = -1;
  var FOCUS_DURATION = 1.6;        // 聚焦动画时长（秒）
  var activeFocusDuration = FOCUS_DURATION;
  var focusMode = 'destination';

  var mouseOnScreen = { x: 0.5, y: 0.5 };
  var smoothMouseX = 0.5, smoothMouseY = 0.5;
  var hoveredMarkerIdx = -1;
  var pointerInside = false;
  var journeyCameraZ = 18;

  var entrancePhase = -1;
  var elapsedTotal = 0;

  /* 地球纹理本地优先；加载失败或超时降级为程序化纹理，保证地球始终可见 */
  var earthTextureURL = 'assets/textures/earth-blue-marble.jpg';
  var TEXTURE_TIMEOUT_MS = 8000;
  var textureLoaded = false;

  /* ═══════════════════════════════════════════════════════
     回调
     ═══════════════════════════════════════════════════════ */
  var onMarkerHover = null;
  var onMarkerSelect = null;       // 聚焦开始
  var onMarkerFocusDone = null;    // 聚焦完成（镜头就位）
  var onMarkerDeselect = null;
  var onStateChange = null;

  /* ═══════════════════════════════════════════════════════
     初始化
     ═══════════════════════════════════════════════════════ */

  function init(containerId, opts) {
    opts = opts || {};
    setDestinations(opts.destinations || []);
    if (opts.onMarkerHover) onMarkerHover = opts.onMarkerHover;
    if (opts.onMarkerSelect) onMarkerSelect = opts.onMarkerSelect;
    if (opts.onMarkerFocusDone) onMarkerFocusDone = opts.onMarkerFocusDone;
    if (opts.onMarkerDeselect) onMarkerDeselect = opts.onMarkerDeselect;
    if (opts.onStateChange) onStateChange = opts.onStateChange;

    container = document.getElementById(containerId);
    if (!container) { console.warn('EarthEngine: container not found'); return false; }
    if (typeof THREE === 'undefined') { showFallback(); return false; }
    if (!DESTINATIONS.length) { console.warn('EarthEngine: destinations not found'); showFallback(); return false; }

    viewW = container.clientWidth;
    viewH = container.clientHeight;

    setupScene();
    setupLights();
    createStarfield();
    createEarth();
    createMarkers();
    createLabelContainer();
    bindEvents();

    isActive = true;
    entrancePhase = -1;

    renderer.render(scene, camera);
    lastTime = performance.now();
    animate(lastTime);
    return true;
  }

  function setDestinations(destinations) {
    var next = Array.isArray(destinations) ? destinations.filter(isValidDestination) : [];
    DESTINATIONS = orderDestinations(next);
    focusedMarkerIdx = -1;
    hoveredMarkerIdx = -1;

    if (earthGroup) {
      clearMarkers();
      createMarkers();
      createMarkerLabels();
    }
    return DESTINATIONS.slice();
  }

  function isValidDestination(destination) {
    return destination && destination.id !== undefined && destination.name &&
      Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude));
  }

  function orderDestinations(destinations) {
    return destinations.map(function (destination, sourceIndex) {
      return { destination: destination, sourceIndex: sourceIndex };
    }).sort(function (a, b) {
      var aFeatured = FEATURED_ORDER.indexOf(a.destination.name);
      var bFeatured = FEATURED_ORDER.indexOf(b.destination.name);
      aFeatured = aFeatured < 0 ? FEATURED_ORDER.length : aFeatured;
      bFeatured = bFeatured < 0 ? FEATURED_ORDER.length : bFeatured;
      return aFeatured === bFeatured ? a.sourceIndex - b.sourceIndex : aFeatured - bFeatured;
    }).map(function (item) { return item.destination; });
  }

  /* ═══════════════════════════════════════════════════════
     Scene
     ═══════════════════════════════════════════════════════ */

  function setupScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, viewW / viewH, 0.5, 200);
    camera.position.set(0, 1.2, 18);
    camera.lookAt(0, 0, 0);
    focusStartCamZ = 18;
    focusTargetCamZ = 18;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(viewW, viewH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;';
  }

  function setupLights() {
    ambientLight = new THREE.AmbientLight(0x1a3a2a, 1.8);
    scene.add(ambientLight);
    sunLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    sunLight.position.set(8, 3, 5);
    scene.add(sunLight);
    var fillLight = new THREE.DirectionalLight(0x446688, 0.8);
    fillLight.position.set(-5, -2, -3);
    scene.add(fillLight);
  }

  /* ═══════════════════════════════════════════════════════
     Starfield
     ═══════════════════════════════════════════════════════ */

  function createStarfield() {
    var count = 800, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
      var r = 80 * (0.85 + Math.random() * 0.15);
      positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
      var c = Math.random();
      if (c < 0.6) { colors[i*3]=0.75+Math.random()*0.25; colors[i*3+1]=0.8+Math.random()*0.2; colors[i*3+2]=0.85+Math.random()*0.15; }
      else if (c < 0.85) { colors[i*3]=0.6+Math.random()*0.2; colors[i*3+1]=0.7+Math.random()*0.2; colors[i*3+2]=0.9+Math.random()*0.1; }
      else { colors[i*3]=0.9+Math.random()*0.1; colors[i*3+1]=0.7+Math.random()*0.2; colors[i*3+2]=0.5+Math.random()*0.15; }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starField = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.12, vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0, sizeAttenuation: true,
    }));
    starField.name = 'starfield';
    scene.add(starField);
  }

  /* ═══════════════════════════════════════════════════════
     Earth
     ═══════════════════════════════════════════════════════ */

  function createEarth() {
    earthGroup = new THREE.Group();
    earthGroup.name = 'earthGroup';
    scene.add(earthGroup);

    var geo = new THREE.SphereGeometry(globeRadius, 128, 128);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x1a3a2a, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0,
    });
    earthMesh = new THREE.Mesh(geo, mat);
    earthMesh.name = 'earth';
    earthGroup.add(earthMesh);
    loadEarthTexture();

    var atmoGeoInner = new THREE.SphereGeometry(globeRadius * 1.02, 72, 72);
    atmosphereInner = new THREE.Mesh(atmoGeoInner, new THREE.ShaderMaterial({
      vertexShader: ATMO_VERTEX, fragmentShader: ATMO_FRAGMENT_INNER,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#4a9e7e') }, uOpacity: { value: 0 } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    atmosphereInner.name = 'atmosphereInner';
    earthGroup.add(atmosphereInner);

    var atmoGeoOuter = new THREE.SphereGeometry(globeRadius * 1.18, 72, 72);
    atmosphereOuter = new THREE.Mesh(atmoGeoOuter, new THREE.ShaderMaterial({
      vertexShader: ATMO_VERTEX, fragmentShader: ATMO_FRAGMENT_OUTER,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#5cb8a0') }, uOpacity: { value: 0 } },
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    atmosphereOuter.name = 'atmosphereOuter';
    earthGroup.add(atmosphereOuter);
  }

  function loadEarthTexture() {
    var textureSettled = false;
    var timeoutId = setTimeout(function () {
      if (textureSettled) return;
      textureSettled = true;
      console.warn('[EarthEngine] 地球纹理加载超时，使用程序化纹理');
      applyProceduralTexture();
    }, TEXTURE_TIMEOUT_MS);

    new THREE.TextureLoader().load(earthTextureURL,
      function (t) {
        if (textureSettled) return;
        textureSettled = true;
        clearTimeout(timeoutId);
        t.colorSpace = THREE.SRGBColorSpace;
        earthMesh.material.map = t;
        earthMesh.material.color.set('#ffffff');
        earthMesh.material.roughness = 0.75;
        earthMesh.material.metalness = 0.05;
        earthMesh.material.needsUpdate = true;
        textureLoaded = true;
      },
      undefined,
      function () {
        if (textureSettled) return;
        textureSettled = true;
        clearTimeout(timeoutId);
        applyProceduralTexture();
      }
    );
  }

  function applyProceduralTexture() {
    var c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0,'#0d2620'); g.addColorStop(0.3,'#153a2e'); g.addColorStop(0.5,'#1a4a38'); g.addColorStop(0.7,'#153a2e'); g.addColorStop(1,'#0d2620');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
    var conts = [
      [[0.58,0.22],[0.78,0.18],[0.85,0.28],[0.82,0.42],[0.74,0.52],[0.68,0.44],[0.62,0.32],'rgba(45,110,75,0.85)'],
      [[0.72,0.48],[0.80,0.50],[0.84,0.55],[0.78,0.58],[0.72,0.54],null,'rgba(40,100,70,0.7)'],
      [[0.60,0.35],[0.66,0.42],[0.64,0.52],[0.58,0.46],[0.56,0.38],null,'rgba(50,115,80,0.75)'],
      [[0.42,0.12],[0.52,0.10],[0.55,0.20],[0.48,0.28],[0.38,0.24],[0.38,0.16],'rgba(55,120,85,0.8)'],
      [[0.44,0.28],[0.54,0.30],[0.56,0.48],[0.52,0.62],[0.46,0.58],[0.42,0.38],'rgba(50,115,80,0.82)'],
      [[0.12,0.08],[0.28,0.06],[0.32,0.18],[0.24,0.32],[0.14,0.28],[0.08,0.16],'rgba(48,112,78,0.78)'],
      [[0.18,0.42],[0.28,0.44],[0.24,0.62],[0.16,0.58],[0.14,0.48],null,'rgba(45,108,75,0.8)'],
      [[0.72,0.58],[0.80,0.56],[0.82,0.64],[0.74,0.66],[0.70,0.62],null,'rgba(50,110,78,0.75)'],
    ];
    conts.forEach(function(arr){var pts=arr.slice(0,-1),col=arr[arr.length-1];if(pts.length<3)return;ctx.beginPath();ctx.moveTo(pts[0][0]*2048,pts[0][1]*1024);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0]*2048,pts[i][1]*1024);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='rgba(60,130,90,0.3)';ctx.lineWidth=15;ctx.stroke();});
    var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    earthMesh.material.map = tex; earthMesh.material.color.set('#ffffff');
    earthMesh.material.roughness = 0.75; earthMesh.material.metalness = 0.05;
    earthMesh.material.needsUpdate = true; textureLoaded = true;
  }

  /* ═══════════════════════════════════════════════════════
     Markers — restrained warm map points
     ═══════════════════════════════════════════════════════ */

  function createMarkers() {
    markers = [];
    markerParticles = [];

    for (var i = 0; i < DESTINATIONS.length; i++) {
      var dest = DESTINATIONS[i];
      var pos = latLngToVec3(dest.latitude, dest.longitude, globeRadius * 1.005);

      var group = new THREE.Group();
      group.name = 'marker-' + dest.id;
      group.position.copy(pos);
      group.lookAt(pos.clone().multiplyScalar(2));
      group.userData = { destId: dest.id, destIndex: i, glowPhase: Math.random() * Math.PI * 2 };

      // A thin selection ring. It stays invisible until the point is selected.
      var areaHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.082, 40),
        new THREE.MeshBasicMaterial({ color: 0xe7c98d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      areaHalo.name = 'areaHalo';
      group.add(areaHalo);
      var areaPulse = new THREE.Mesh(
        new THREE.RingGeometry(0.105, 0.11, 40),
        new THREE.MeshBasicMaterial({ color: 0xd8b979, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      areaPulse.name = 'areaPulse';
      group.add(areaPulse);

      // Warm locator dot: visible without becoming a graphic overlay.
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0xf4d89d, transparent: true, opacity: 0.92 })
      );
      core.name = 'core';
      group.add(core);

      // Small local glow, never a filled region.
      var glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xd6ad62, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      glow.name = 'glow';
      group.add(glow);

      var leaderGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0.05),
        new THREE.Vector3(0, 0, 0.22),
      ]);
      var leaderLine = new THREE.Line(leaderGeometry, new THREE.LineBasicMaterial({
        color: 0xe7c98d, transparent: true, opacity: 0, depthWrite: false,
      }));
      leaderLine.name = 'leaderLine';
      group.add(leaderLine);

      group.visible = false;
      group.scale.set(0.01, 0.01, 0.01);
      earthGroup.add(group);
      markers.push(group);
    }
  }

  /* ═══════════════════════════════════════════════════════
     HTML 名称标签
     ═══════════════════════════════════════════════════════ */

  function createLabelContainer() {
    labelContainer = document.createElement('div');
    labelContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;';
    container.appendChild(labelContainer);

    createMarkerLabels();
  }

  function createMarkerLabels() {
    if (!labelContainer) return;
    labelContainer.innerHTML = '';
    markerLabels = DESTINATIONS.map(function (dest) {
      var el = document.createElement('div');
      var title = document.createElement('span');
      var region = document.createElement('span');
      title.textContent = dest.name;
      title.style.cssText = 'font-size:12px;font-weight:600;color:rgba(255,230,180,0.95);text-shadow:0 0 10px rgba(180,140,80,0.5),0 0 20px rgba(160,120,60,0.25),0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;letter-spacing:0.03em;';
      region.textContent = destinationRegion(dest);
      region.style.cssText = 'display:block;font-size:9px;color:rgba(255,255,255,0.5);text-shadow:0 1px 2px rgba(0,0,0,0.8);margin-top:2px;white-space:nowrap;';
      el.appendChild(title);
      el.appendChild(region);
      el.style.cssText = 'position:absolute;transform:translate(-50%,-130%);opacity:0;transition:opacity 0.25s ease;pointer-events:none;text-align:center;';
      labelContainer.appendChild(el);
      return el;
    });
  }

  function destinationRegion(destination) {
    return [destination.city, destination.province].filter(function (part, index, parts) {
      return part && parts.indexOf(part) === index;
    }).join(' · ');
  }

  function updateLabels() {
    for (var i = 0; i < markers.length; i++) {
      if (!markers[i].visible) { markerLabels[i].style.opacity = '0'; continue; }
      var wp = new THREE.Vector3(); markers[i].getWorldPosition(wp);
      var sp = wp.clone().project(camera);
      if (sp.z > 1) { markerLabels[i].style.opacity = '0'; continue; }
      markerLabels[i].style.left = ((sp.x + 1) / 2 * viewW) + 'px';
      markerLabels[i].style.top = ((-sp.y + 1) / 2 * viewH) + 'px';
      markerLabels[i].style.opacity = (i === hoveredMarkerIdx || i === focusedMarkerIdx) ? '1' : '0';
    }
  }

  /* ═══════════════════════════════════════════════════════
     Events
     ═══════════════════════════════════════════════════════ */

  function bindEvents() {
    var cv = renderer.domElement;
    cv.addEventListener('pointermove', onPointerMove, { passive: true });
    cv.addEventListener('pointerenter', function(){ pointerInside = true; });
    cv.addEventListener('pointerleave', function(){
      pointerInside = false;
      setHoveredMarker(-1);
    });
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);
  }

  function onPointerMove(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    var pointerX = (e.clientX - rect.left) / Math.max(rect.width, 1);
    var pointerY = (e.clientY - rect.top) / Math.max(rect.height, 1);
    smoothMouseX += (pointerX - smoothMouseX) * 0.08;
    smoothMouseY += (pointerY - smoothMouseY) * 0.08;
    mouseOnScreen.x = pointerX;
    mouseOnScreen.y = pointerY;
  }

  function onWheel(e) { if (!isActive||entrancePhase<5) return; e.preventDefault(); var z=Math.max(9,Math.min(22,camera.position.z+e.deltaY*0.01)); camera.position.z=z; if(state!=='focusing'){focusStartCamZ=z;focusTargetCamZ=z;} }

  function onClick(e) { if (!isActive||entrancePhase<5) return; if (hoveredMarkerIdx>=0) focusOnMarker(hoveredMarkerIdx); }

  function onResize() { if(!container||!renderer)return; viewW=container.clientWidth;viewH=container.clientHeight;camera.aspect=viewW/Math.max(viewH,1);camera.updateProjectionMatrix();renderer.setSize(viewW,viewH); }

  /* ═══════════════════════════════════════════════════════
     Animation Loop
     ═══════════════════════════════════════════════════════ */

  var lastTime = 0;

  function animate(time) {
    if (!isActive) return;
    animId = requestAnimationFrame(animate);
    var dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time; elapsedTotal += dt;

    if (entrancePhase < 5) updateEntrance(elapsedTotal * 1000);
    if (entrancePhase >= 0) updateRotation(dt);
    updateMarkers(dt, time);
    if (state === 'focusing' || state === 'journey') updateFocus(dt);
    if (entrancePhase >= 5 && state !== 'focusing') updateHoverDetection();
    if (entrancePhase >= 5) updateLabels();
    updateAtmosphere(time);
    updateLighting();
    renderer.render(scene, camera);
  }

  function updateRotation(dt) {
    if (!earthGroup) return;
    if (state === 'idle') {
      // The globe is a living scene, not a map control: it drifts subtly and
      // responds to gaze-like pointer movement with a restrained camera parallax.
      earthGroup.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), AUTO_ROTATE_SPEED * Math.PI/180 * dt));
      autoRotateY = extractY(earthGroup.quaternion);
      var tiltT = (smoothMouseY - 0.5) * 0.25;
      var diff = tiltT - extractX(earthGroup.quaternion);
      earthGroup.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), diff * 0.03));
      var parallaxX = pointerInside ? (smoothMouseX - 0.5) * 0.75 : 0;
      var parallaxY = 1.2 + (pointerInside ? (0.5 - smoothMouseY) * 0.35 : 0);
      camera.position.x += (parallaxX - camera.position.x) * 0.025;
      camera.position.y += (parallaxY - camera.position.y) * 0.025;
      camera.position.z += (journeyCameraZ - camera.position.z) * 0.018;
      camera.lookAt(0, 0, 0);
    }
    if (state === 'inertia') {
      var q = new THREE.Quaternion();
      if (Math.abs(dragVel.x)>INERTIA_THRESHOLD) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dragVel.x));
      if (Math.abs(dragVel.y)>INERTIA_THRESHOLD) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), dragVel.y));
      earthGroup.quaternion.multiply(q);
      dragVel.y*=INERTIA_FRICTION; dragVel.x*=INERTIA_FRICTION;
      if (Math.abs(dragVel.y)<INERTIA_THRESHOLD && Math.abs(dragVel.x)<INERTIA_THRESHOLD) { dragVel.x=0;dragVel.y=0;state='idle';autoRotateY=extractY(earthGroup.quaternion);if(onStateChange)onStateChange('idle'); }
    }
  }

  /* ═══════════════════════════════════════════════════════
     Markers — quiet default, one selected pulse
     ═══════════════════════════════════════════════════════ */

  function updateMarkers(dt, time) {
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      if (entrancePhase >= 3 && !m.visible) m.visible = true;
      if (!m.visible) continue;
      if (entrancePhase < 5) continue;

      var isSelected = i === focusedMarkerIdx;
      var isHovered = i === hoveredMarkerIdx;
      var targetScale = isSelected ? 1.12 : (isHovered ? 1.02 : 0.82);
      m.scale.setScalar(m.scale.x + (targetScale - m.scale.x) * 0.1);

      // 光晕
      var glow = m.getObjectByName('glow');
      if (glow) {
        var baseOp = isSelected ? 0.32 : (isHovered ? 0.22 : 0.1);
        glow.material.opacity += (baseOp - glow.material.opacity) * 0.12;
      }

      var halo = m.getObjectByName('areaHalo');
      var pulse = m.getObjectByName('areaPulse');
      var leaderLine = m.getObjectByName('leaderLine');
      if (halo) {
        halo.scale.setScalar(isSelected ? 1 : 0.9);
        halo.material.opacity = isSelected ? 0.68 : (isHovered ? 0.32 : 0);
      }
      if (pulse) {
        var pulsePhase = (Math.sin(time * 0.0016 + m.userData.glowPhase) + 1) * 0.5;
        pulse.scale.setScalar(1 + pulsePhase * 0.28);
        pulse.material.opacity = isSelected ? 0.18 * (1 - pulsePhase * 0.55) : 0;
      }
      if (leaderLine) {
        var leaderOpacity = isSelected ? 0.58 : (isHovered ? 0.22 : 0);
        leaderLine.material.opacity += (leaderOpacity - leaderLine.material.opacity) * 0.12;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════
     Hover Detection
     ═══════════════════════════════════════════════════════ */

  function updateHoverDetection() {
    if (!pointerInside) {
      setHoveredMarker(-1);
      return;
    }
    var best = -1, bestD = Infinity;
    var hitRadius = Math.max(24, Math.min(34, Math.min(viewW, viewH) * 0.035));
    for (var i = 0; i < markers.length; i++) {
      if (!markers[i].visible) continue;
      var wp = new THREE.Vector3(); markers[i].getWorldPosition(wp);
      var toCamera = camera.position.clone().sub(wp).normalize();
      if (wp.clone().normalize().dot(toCamera) <= 0) continue;
      var sp = wp.clone().project(camera); if (sp.z > 1) continue;
      var markerX = (sp.x + 1) * 0.5 * viewW;
      var markerY = (-sp.y + 1) * 0.5 * viewH;
      var pointerX = mouseOnScreen.x * viewW;
      var pointerY = mouseOnScreen.y * viewH;
      var d = Math.sqrt(Math.pow(markerX - pointerX, 2) + Math.pow(markerY - pointerY, 2));
      if (d < hitRadius && d < bestD) { bestD = d; best = i; }
    }
    setHoveredMarker(best);
  }

  function setHoveredMarker(index) {
    if (index === hoveredMarkerIdx) return;
    hoveredMarkerIdx = index;
    if (renderer && renderer.domElement) {
      renderer.domElement.style.cursor = index >= 0 ? 'pointer' : (state === 'idle' ? 'grab' : renderer.domElement.style.cursor);
    }
    if (onMarkerHover) onMarkerHover(index >= 0 ? DESTINATIONS[index] : null, index);
  }

  /* ═══════════════════════════════════════════════════════
     Focus — 点击标记 → 旋转定位 + 镜头推近
     ═══════════════════════════════════════════════════════ */

  function focusOnMarker(idx) {
    var dest = DESTINATIONS[idx]; if (!dest) return;
    focusedMarkerIdx = idx;
    state = 'focusing';
    focusMode = 'destination';
    activeFocusDuration = 1.45;
    focusProgress = 0;
    focusStartQuat = earthGroup.quaternion.clone();
    focusTargetQuat = new THREE.Quaternion().setFromUnitVectors(
      latLngToVec3(dest.latitude, dest.longitude, globeRadius).normalize(),
      new THREE.Vector3(0, 0, 1)
    );
    focusStartCamZ = camera.position.z;
    focusTargetCamZ = 12.6;
    renderer.domElement.style.cursor = 'default';
    if (onMarkerSelect) onMarkerSelect(dest, idx);
    if (onStateChange) onStateChange('focusing', { dest: dest, index: idx });
  }

  function updateFocus(dt) {
    focusProgress = Math.min(1, focusProgress + dt / activeFocusDuration);
    var t = easeInOutCubic(focusProgress);
    earthGroup.quaternion.copy(focusStartQuat).slerp(focusTargetQuat, t);
    camera.position.z = focusStartCamZ + (focusTargetCamZ - focusStartCamZ) * t;

    if (focusProgress >= 1) {
      if (focusMode === 'journey') {
        state = 'idle';
        autoRotateY = extractY(earthGroup.quaternion);
        if (onStateChange) onStateChange('journey-complete');
        return;
      }
      state = 'focused';
      autoRotateY = extractY(earthGroup.quaternion);
      renderer.domElement.style.cursor = 'grab';
      if (onStateChange) onStateChange('focused', { dest: DESTINATIONS[focusedMarkerIdx], index: focusedMarkerIdx });
      if (onMarkerFocusDone) onMarkerFocusDone(DESTINATIONS[focusedMarkerIdx], focusedMarkerIdx);
    }
  }

  function deselectMarker() {
    focusedMarkerIdx = -1;
    state = 'idle';
    camera.position.z = focusStartCamZ > 0 ? focusStartCamZ : 18;
    focusTargetCamZ = 18;
    autoRotateY = extractY(earthGroup.quaternion);
    renderer.domElement.style.cursor = 'grab';
    if (onMarkerDeselect) onMarkerDeselect();
    if (onStateChange) onStateChange('idle');
  }

  /* ═══════════════════════════════════════════════════════
     Atmosphere + Light
     ═══════════════════════════════════════════════════════ */

  function updateAtmosphere(time) {
    if (atmosphereInner) atmosphereInner.material.uniforms.uTime.value = time * 0.001;
    if (atmosphereOuter) atmosphereOuter.material.uniforms.uTime.value = time * 0.001;
  }
  function updateLighting() { sunLight.position.lerp(new THREE.Vector3(8+(smoothMouseX-0.5)*12,3-(smoothMouseY-0.5)*8,5),0.03); }

  /* ═══════════════════════════════════════════════════════
     Entrance
     ═══════════════════════════════════════════════════════ */

  function startEntrance() { entrancePhase=0;elapsedTotal=0;lastTime=performance.now();autoRotateY=earthGroup?extractY(earthGroup.quaternion):0; }
  function setJourneyStage(stage) {
    var targets = { global: 18, country: 16.4, city: 14.8 };
    journeyCameraZ = targets[stage] || 18;
    if (stage === 'country') orientToCoordinates(35, 105, targets.country, 1.25);
  }

  function orientToCoordinates(lat, lng, targetCameraZ, duration) {
    if (!earthGroup || !camera) return;
    state = 'journey';
    focusMode = 'journey';
    activeFocusDuration = duration || 1.25;
    focusProgress = 0;
    focusStartQuat = earthGroup.quaternion.clone();
    focusTargetQuat = new THREE.Quaternion().setFromUnitVectors(
      latLngToVec3(lat, lng, globeRadius).normalize(),
      new THREE.Vector3(0, 0, 1)
    );
    focusStartCamZ = camera.position.z;
    focusTargetCamZ = targetCameraZ || 16.4;
    if (onStateChange) onStateChange('journey', { lat: lat, lng: lng });
  }
  function updateEntrance(ms) {
    if (ms>=0&&entrancePhase===0) { if(starField)starField.material.opacity=Math.min(1,ms/500); if(ms>=500)entrancePhase=1; }
    if (ms>=300&&entrancePhase===1) { var p=Math.min(1,(ms-300)/600),e=1-Math.pow(1-p,3); earthMesh.material.opacity=Math.min(1,e); earthMesh.scale.setScalar(0.7+0.3*e); if(p>=1&&ms>=900)entrancePhase=2; }
    if (ms>=700&&entrancePhase===2) { var ap=Math.min(1,(ms-700)/600); if(atmosphereInner)atmosphereInner.material.uniforms.uOpacity.value=ap*0.45; if(atmosphereOuter)atmosphereOuter.material.uniforms.uOpacity.value=ap*0.28; if(ap>=1&&ms>=1300)entrancePhase=3; }
    if (ms>=1100&&entrancePhase===3) { var av=true; for(var i=0;i<markers.length;i++){var d=i*120,mp=Math.min(1,Math.max(0,(ms-1100-d)/500));if(!markers[i].visible&&mp>0)markers[i].visible=true;markers[i].scale.setScalar(Math.max(0.01,mp));if(mp<1)av=false;} if(av)entrancePhase=4; }
    if (entrancePhase===4) { entrancePhase=5; }
  }

  /* ═══════════════════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════════════════ */

  function latLngToVec3(lat, lng, radius) {
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
  }
  function extractY(q) { return new THREE.Euler().setFromQuaternion(q,'YXZ').y; }
  function extractX(q) { return new THREE.Euler().setFromQuaternion(q,'YXZ').x; }
  function easeInOutCubic(t) { return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
  function clearMarkers() {
    markers.forEach(function (marker) {
      if (earthGroup) earthGroup.remove(marker);
      marker.traverse(function (object) {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach(function (material) { material.dispose(); });
          else object.material.dispose();
        }
      });
    });
    markers = [];
    markerParticles = [];
    markerLabels = [];
    if (labelContainer) labelContainer.innerHTML = '';
  }
  function setCallbacks(o) { if(o.onMarkerHover!==undefined)onMarkerHover=o.onMarkerHover;if(o.onMarkerSelect!==undefined)onMarkerSelect=o.onMarkerSelect;if(o.onMarkerFocusDone!==undefined)onMarkerFocusDone=o.onMarkerFocusDone;if(o.onMarkerDeselect!==undefined)onMarkerDeselect=o.onMarkerDeselect;if(o.onStateChange!==undefined)onStateChange=o.onStateChange; }
  function showFallback() { if(container)container.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;pointer-events:none;"><div style="width:45vmin;height:45vmin;border-radius:50%;background:radial-gradient(circle,rgba(30,90,70,0.15),rgba(15,50,40,0.08) 50%,transparent 70%);box-shadow:0 0 80px rgba(30,80,60,0.1);"></div></div>'; }
  function destroy() { isActive=false;if(animId){cancelAnimationFrame(animId);animId=null;}window.removeEventListener('resize',onResize);if(renderer){renderer.dispose();renderer=null;}if(container)container.innerHTML='';scene=null;camera=null;earthGroup=null;earthMesh=null;markers=[];markerLabels=[];starField=null; }

  /* ═══════════════════════════════════════════════════════
     Shaders
     ═══════════════════════════════════════════════════════ */

  var ATMO_VERTEX = 'varying vec3 vNormal;varying vec3 vWorldPos;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorldPos=wp.xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  var ATMO_FRAGMENT_INNER = 'varying vec3 vNormal;varying vec3 vWorldPos;uniform float uTime;uniform vec3 uColor;uniform float uOpacity;void main(){vec3 vd=normalize(cameraPosition-vWorldPos);float f=pow(1.0-abs(dot(vd,vNormal)),3.5);float a=f*uOpacity*0.7;a+=f*0.04*sin(uTime*0.8)*uOpacity;gl_FragColor=vec4(uColor,a);}';
  var ATMO_FRAGMENT_OUTER = 'varying vec3 vNormal;varying vec3 vWorldPos;uniform float uTime;uniform vec3 uColor;uniform float uOpacity;void main(){vec3 vd=normalize(cameraPosition-vWorldPos);float f=pow(1.0-abs(dot(vd,vNormal)),5.5);float a=f*uOpacity*0.55;a+=f*0.03*sin(uTime*0.5+1.2)*uOpacity;gl_FragColor=vec4(uColor,a);}';

  /* ═══════════════════════════════════════════════════════
     Public API
     ═══════════════════════════════════════════════════════ */

  window.EarthEngine = {
    init: init, startEntrance: startEntrance, setCallbacks: setCallbacks,
    setDestinations: setDestinations,
    focusOnMarker: focusOnMarker,
    deselectMarker: deselectMarker,
    getDestinations: function(){return DESTINATIONS.slice();},
    getSelectedIndex: function(){return focusedMarkerIdx;},
    setJourneyStage: setJourneyStage,
    getState: function(){return state;},
    destroy: destroy,
  };

})();
