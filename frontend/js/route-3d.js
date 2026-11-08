/**
 * M8 route overview: a restrained Three.js consumer of HealthRouteWorkspace.
 * Horizontal positions come from the same WGS84 route model as OpenLayers.
 * No elevation source is connected, so every route coordinate stays on y=0.
 */
(function () {
  'use strict';

  var workspace = window.HealthRouteWorkspace;
  var container = document.getElementById('route-3d-view');
  var stage = document.querySelector('.map-stage');
  if (!workspace || !container) return;
  if (typeof window.THREE === 'undefined') {
    markUnavailable('Three.js 未加载，三维概览暂不可用');
    return;
  }

  var scene, camera, renderer, routeGroup, labelLayer, raycaster, pointer;
  var model = null;
  var nodeMeshes = [];
  var nodePositions = {};
  var origin = { longitude: 100.16, latitude: 25.70 };
  var visualScale = 0.01;
  var orbitTarget = new THREE.Vector3(0, 0, 0);
  var yaw = Math.PI * 0.22, pitch = 0.72, radius = 20;
  var dragging = false, moved = false, dragX = 0, dragY = 0;
  var activeView = '2d';
  var playToken = 0;
  var categoryColors = {
    lodging: 0xe1c58b, dining: 0xc99a74, activity: 0x8fc8ad,
    medical: 0xd8a19a, service: 0x9fb7cf, custom: 0xc7c7c0
  };

  function init() {
    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x092321);
      scene.fog = new THREE.Fog(0x092321, 24, 52);
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 160);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = 'route-3d-canvas';
      renderer.domElement.setAttribute('aria-label', '大理路线三维空间概览，可拖动视角并点击节点');
      container.prepend(renderer.domElement);
      labelLayer = document.createElement('div');
      labelLayer.className = 'route-3d-labels';
      container.appendChild(labelLayer);
      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();
      setupScene();
      bindEvents();
      workspace.subscribeRouteChange(syncModel);
      resize();
      animate();
    } catch (error) {
      markUnavailable('当前设备无法建立 WebGL 三维概览');
    }
  }

  function setupScene() {
    scene.add(new THREE.HemisphereLight(0xdfe8d7, 0x173833, 1.7));
    var sun = new THREE.DirectionalLight(0xffe4b5, 1.5);
    sun.position.set(-8, 14, 7);
    scene.add(sun);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x123a35, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.025;
    scene.add(ground);
    var grid = new THREE.GridHelper(80, 32, 0x41645a, 0x244b44);
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    scene.add(grid);
    routeGroup = new THREE.Group();
    scene.add(routeGroup);
  }

  function bindEvents() {
    document.querySelectorAll('[data-route-view]').forEach(function (button) {
      button.addEventListener('click', function () { setView(button.dataset.routeView); });
    });
    var playButton = document.getElementById('route-3d-play');
    if (playButton) playButton.addEventListener('click', playActiveDay);
    var fitButton = document.getElementById('fit-route-button');
    if (fitButton) fitButton.addEventListener('click', function () {
      if (activeView === '3d') fitScene();
    });
    renderer.domElement.addEventListener('pointerdown', function (event) {
      dragging = true; moved = false; dragX = event.clientX; dragY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var dx = event.clientX - dragX, dy = event.clientY - dragY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      yaw -= dx * 0.006;
      pitch = clamp(pitch + dy * 0.004, 0.28, 1.25);
      dragX = event.clientX; dragY = event.clientY;
    });
    renderer.domElement.addEventListener('pointerup', function (event) {
      dragging = false;
      if (!moved) selectAt(event);
    });
    renderer.domElement.addEventListener('wheel', function (event) {
      event.preventDefault();
      radius = clamp(radius + event.deltaY * 0.018, 5, 58);
    }, { passive: false });
    window.addEventListener('resize', resize);
  }

  function setView(view) {
    if (view !== '2d' && view !== '3d') return;
    activeView = view;
    stage.classList.toggle('is-3d', view === '3d');
    container.setAttribute('aria-hidden', view === '3d' ? 'false' : 'true');
    document.querySelectorAll('[data-route-view]').forEach(function (button) {
      var selected = button.dataset.routeView === view;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    if (view === '3d') {
      resize();
      renderModel('view');
      setThreeDimensionalMapNote();
    } else {
      playToken += 1;
      var playButton = document.getElementById('route-3d-play');
      if (playButton) playButton.disabled = false;
      setTwoDimensionalMapNote();
    }
  }

  function syncModel(nextModel, reason) {
    model = nextModel;
    renderModel(reason);
    if (activeView === '3d') setThreeDimensionalMapNote();
  }

  function setThreeDimensionalMapNote() {
    document.getElementById('map-state-title').textContent = '三维空间概览';
    document.getElementById('map-state-copy').textContent = '真实水平坐标 · 暂无可核验高程';
  }

  function setTwoDimensionalMapNote() {
    var title = '二维精确编辑', copy = 'OpenLayers · WGS84 编辑坐标';
    if (model && model.route_status === 'preview') {
      title = '部分路段仅为预览'; copy = '虚线不是可导航道路，请检查后端路线服务。';
    } else if (model && model.route_status === 'snapshot') {
      title = '已载入核验路线'; copy = '高德道路快照 · 渲染坐标 WGS84';
    } else if (model && model.route_status === 'provider') {
      title = '道路路线已更新'; copy = '高德服务计算 · 渲染坐标 WGS84';
    }
    document.getElementById('map-state-title').textContent = title;
    document.getElementById('map-state-copy').textContent = copy;
  }

  function renderModel(reason) {
    if (!model || !routeGroup) return;
    clearGroup(routeGroup);
    nodeMeshes = [];
    nodePositions = {};
    labelLayer.innerHTML = '';
    var allNodes = flattenNodes(model.days);
    if (!allNodes.length) {
      updateStatus('当前没有路线节点');
      return;
    }
    setProjection(allNodes);
    var visibleDays = model.active_day ? model.days.filter(function (day) {
      return day.day === model.active_day;
    }) : model.days;
    var visibleNodes = flattenNodes(visibleDays);
    var visibleNodeIds = new Set(visibleNodes.map(function (node) { return node.id; }));
    visibleDays.forEach(function (day) {
      day.segments.forEach(function (segment) { addSegment(segment, visibleNodeIds); });
    });
    visibleNodes.forEach(addNode);
    updateSelection();
    updateStatus((model.active_day ? '第 ' + model.active_day + ' 天' : '全部行程') + ' · ' + visibleNodes.length + ' 个节点');
    if (reason === 'initial' || reason === 'view' || reason === 'render' || reason === 'route') fitScene();
    if (reason === 'selection') followSelected();
  }

  function flattenNodes(days) {
    var rows = [];
    (days || []).forEach(function (day) {
      (day.nodes || []).forEach(function (node) { rows.push(node); });
    });
    return rows;
  }

  function setProjection(nodes) {
    origin.longitude = nodes.reduce(function (sum, node) { return sum + Number(node.longitude); }, 0) / nodes.length;
    origin.latitude = nodes.reduce(function (sum, node) { return sum + Number(node.latitude); }, 0) / nodes.length;
    var raw = nodes.map(function (node) { return rawMeters(node.longitude, node.latitude); });
    var spanX = Math.max.apply(null, raw.map(function (p) { return p.x; })) - Math.min.apply(null, raw.map(function (p) { return p.x; }));
    var spanZ = Math.max.apply(null, raw.map(function (p) { return p.z; })) - Math.min.apply(null, raw.map(function (p) { return p.z; }));
    visualScale = 15 / Math.max(spanX, spanZ, 800);
  }

  function rawMeters(longitude, latitude) {
    var latRadians = origin.latitude * Math.PI / 180;
    return {
      x: (Number(longitude) - origin.longitude) * 111320 * Math.cos(latRadians),
      z: -(Number(latitude) - origin.latitude) * 110540
    };
  }

  function routePosition(coordinate) {
    var point = rawMeters(coordinate[0], coordinate[1]);
    return new THREE.Vector3(point.x * visualScale, 0, point.z * visualScale);
  }

  function addSegment(segment, visibleNodeIds) {
    if (!visibleNodeIds.has(segment.fromId) || !visibleNodeIds.has(segment.toId)) return;
    var coordinates = segment.renderCoordinates || [];
    if (coordinates.length < 2) return;
    var geometry = new THREE.BufferGeometry().setFromPoints(coordinates.map(routePosition));
    var preview = segment.status === 'preview_only';
    var material = preview
      ? new THREE.LineDashedMaterial({ color: 0xc58d74, dashSize: 0.24, gapSize: 0.16, transparent: true, opacity: 0.82 })
      : new THREE.LineBasicMaterial({ color: 0xc7e1ce, transparent: true, opacity: 0.92 });
    var line = new THREE.Line(geometry, material);
    if (preview) line.computeLineDistances();
    // Tiny render offset prevents z-fighting; it is not elevation data.
    line.position.y = 0.035;
    routeGroup.add(line);
  }

  function addNode(node, index) {
    var position = routePosition([node.longitude, node.latitude]);
    nodePositions[node.id] = position.clone();
    var color = categoryColors[node.category] || categoryColors.custom;
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 20),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.58, metalness: 0.04 })
    );
    // Marker lift is a visual symbol only; the geographic route remains y=0.
    mesh.position.copy(position); mesh.position.y = 0.18;
    mesh.userData.nodeId = node.id;
    mesh.userData.baseColor = color;
    nodeMeshes.push(mesh);
    routeGroup.add(mesh);
    var stemGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(position.x, 0, position.z),
      new THREE.Vector3(position.x, 0.13, position.z)
    ]);
    routeGroup.add(new THREE.Line(stemGeometry, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.52 })));
    addLabel(node, index + 1, position);
  }

  function addLabel(node, order, position) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-3d-label';
    button.dataset.nodeId = node.id;
    button.textContent = order + ' · ' + node.name;
    button._routePosition = position.clone();
    button.addEventListener('click', function () { workspace.selectNode(node.id); });
    labelLayer.appendChild(button);
  }

  function updateSelection() {
    nodeMeshes.forEach(function (mesh) {
      var selected = mesh.userData.nodeId === model.selected_node_id;
      mesh.scale.setScalar(selected ? 1.52 : 1);
      mesh.material.emissive.setHex(selected ? mesh.userData.baseColor : 0x000000);
      mesh.material.emissiveIntensity = selected ? 0.3 : 0;
    });
    labelLayer.querySelectorAll('.route-3d-label').forEach(function (label) {
      label.classList.toggle('is-selected', label.dataset.nodeId === model.selected_node_id);
    });
  }

  function followSelected() {
    var position = nodePositions[model.selected_node_id];
    if (position) orbitTarget.lerp(position, 0.72);
  }

  function selectAt(event) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hit = raycaster.intersectObjects(nodeMeshes, false)[0];
    if (hit && hit.object.userData.nodeId) workspace.selectNode(hit.object.userData.nodeId);
  }

  function fitScene() {
    if (!model) return;
    var nodes = flattenNodes(model.active_day ? model.days.filter(function (day) { return day.day === model.active_day; }) : model.days);
    if (!nodes.length) return;
    var positions = nodes.map(function (node) { return routePosition([node.longitude, node.latitude]); });
    var center = positions.reduce(function (sum, point) { return sum.add(point); }, new THREE.Vector3()).multiplyScalar(1 / positions.length);
    var extent = positions.reduce(function (max, point) { return Math.max(max, point.distanceTo(center)); }, 0);
    orbitTarget.copy(center);
    radius = clamp(Math.max(8, extent * 2.6), 8, 46);
    yaw = Math.PI * 0.22; pitch = 0.72;
  }

  async function playActiveDay() {
    if (!model) return;
    var token = ++playToken;
    var dayNumber = model.active_day || 1;
    if (!model.active_day) workspace.setActiveDay(dayNumber);
    var day = model.days.find(function (item) { return item.day === dayNumber; });
    var nodes = day ? day.nodes : [];
    var button = document.getElementById('route-3d-play');
    if (!nodes.length) return;
    button.disabled = true;
    for (var index = 0; index < nodes.length; index++) {
      if (token !== playToken || activeView !== '3d') break;
      workspace.selectNode(nodes[index].id);
      updateStatus('第 ' + dayNumber + ' 天 · ' + (index + 1) + '/' + nodes.length + ' · ' + nodes[index].name);
      await delay(950);
    }
    if (token === playToken) updateStatus('第 ' + dayNumber + ' 天 · 播放完成');
    button.disabled = false;
  }

  function animate() {
    requestAnimationFrame(animate);
    var horizontal = Math.cos(pitch) * radius;
    camera.position.set(
      orbitTarget.x + Math.sin(yaw) * horizontal,
      orbitTarget.y + Math.sin(pitch) * radius,
      orbitTarget.z + Math.cos(yaw) * horizontal
    );
    camera.lookAt(orbitTarget);
    if (activeView === '3d') {
      updateLabels();
      renderer.render(scene, camera);
    }
  }

  function updateLabels() {
    var width = container.clientWidth, height = container.clientHeight;
    labelLayer.querySelectorAll('.route-3d-label').forEach(function (label) {
      var point = label._routePosition.clone(); point.y = 0.48; point.project(camera);
      var visible = point.z > -1 && point.z < 1;
      label.style.transform = 'translate(-50%,-50%) translate(' + ((point.x * 0.5 + 0.5) * width) + 'px,' + ((-point.y * 0.5 + 0.5) * height) + 'px)';
      label.hidden = !visible;
    });
  }

  function resize() {
    var width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateStatus(text) {
    var status = document.getElementById('route-3d-status');
    if (status) status.textContent = text;
  }

  function markUnavailable(message) {
    container.classList.add('is-unavailable');
    updateStatus(message);
    var button = document.querySelector('[data-route-view="3d"]');
    if (button) button.disabled = true;
  }

  function clearGroup(group) {
    while (group.children.length) {
      var child = group.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(function (item) { item.dispose(); });
        else child.material.dispose();
      }
    }
  }

  function delay(milliseconds) { return new Promise(function (resolve) { setTimeout(resolve, milliseconds); }); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  window.HealthRoute3D = { setView: setView, fit: fitScene };
  init();
})();
