(function () {
  'use strict';

  var DESTINATION_KEY = 'cn-yunnan-dali-ancient-city';
  var destinationName = '';
  var destinationCenter = null;
  var ready = false;
  var STORAGE_KEY = 'ht_route_draft:' + DESTINATION_KEY;
  var REMOTE_STORAGE_KEY = 'ht_route_remote:' + DESTINATION_KEY;
  var DRAFT_VERSION = 1;
  var HISTORY_LIMIT = 30;
  var CATEGORY_LABELS = { lodging: '住宿', dining: '餐饮', activity: '活动', medical: '医疗', service: '服务', custom: '自定义' };
  var state = {
    pois: [], nodes: [], segments: [], days: 1, activeDay: 1, mode: 'walking',
    selectedNodeId: null, history: [], future: [], dirty: false,
    routeStatus: 'snapshot', poiFilter: 'all', poiQuery: '', aiConstraints: null,
    poiMeta: null, poiDataSource: 'local', savedRouteId: null,
    savedRouteToken: null, savedRouteVersion: null, storageStatus: 'local'
  };
  var map, nodeSource, poiSource, routeSource, modifyInteraction, drawInteraction;
  var recalcTimer = null;
  var recalcGeneration = 0;
  var routeListeners = [];

  function byId(id) { return document.getElementById(id); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function finite(value) { return value !== null && value !== '' && Number.isFinite(Number(value)); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function outOfChina(lng, lat) { return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271; }
  function transformLat(x, y) {
    return -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x))
      + (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3
      + (20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3
      + (160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;
  }
  function transformLng(x, y) {
    return 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x))
      + (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3
      + (20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3
      + (150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;
  }
  function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    var a=6378245, ee=.006693421622965943;
    var dLat=transformLat(lng-105,lat-35), dLng=transformLng(lng-105,lat-35);
    var radLat=lat/180*Math.PI, magic=Math.sin(radLat);
    magic=1-ee*magic*magic;
    var sqrtMagic=Math.sqrt(magic);
    dLat=(dLat*180)/((a*(1-ee))/(magic*sqrtMagic)*Math.PI);
    dLng=(dLng*180)/(a/sqrtMagic*Math.cos(radLat)*Math.PI);
    return [lng+dLng, lat+dLat];
  }
  function gcj02ToWgs84(lng, lat) {
    var gcj=wgs84ToGcj02(lng,lat);
    return [lng*2-gcj[0], lat*2-gcj[1]];
  }

  function snapshotState() {
    return clone({ nodes: state.nodes, segments: state.segments, days: state.days, activeDay: state.activeDay, mode: state.mode, routeStatus: state.routeStatus, aiConstraints: state.aiConstraints });
  }
  function pushHistory() {
    state.history.push(snapshotState());
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.future = [];
    updateActionState();
  }
  function restoreSnapshot(snapshot) {
    state.nodes=clone(snapshot.nodes||[]);
    state.segments=clone(snapshot.segments||[]);
    state.days=snapshot.days||1;
    state.activeDay=Math.min(snapshot.activeDay||1,state.days);
    state.mode=snapshot.mode||'walking';
    state.routeStatus=snapshot.routeStatus||'edited';
    state.aiConstraints=snapshot.aiConstraints||null;
    markDirty();
    renderAll();
    syncMap();
    updateMapStatus();
  }
  function undo() {
    if (!state.history.length) return;
    state.future.push(snapshotState());
    restoreSnapshot(state.history.pop());
    updateActionState();
  }
  function redo() {
    if (!state.future.length) return;
    state.history.push(snapshotState());
    restoreSnapshot(state.future.pop());
    updateActionState();
  }

  function routeNodeFromPoi(poi, day) {
    return {
      id:uid('node'), poiId:poi.id||null, name:poi.name, category:poi.category||'custom',
      day:day||1, locked:false, longitude:Number(poi.longitude), latitude:Number(poi.latitude),
      coordinate_system:'WGS84', provider:poi.provider||'amap',
      provider_poi_id:poi.provider_poi_id||poi.provider_id||'', source_url:poi.source_url||'',
      verification_status:poi.verification_status||'unverified', address:poi.address||'',
      price_low:poi.price_low, price_high:poi.price_high, price_unit:poi.price_unit,
      price_status:poi.price_status||'unknown', price_note:poi.price_note||'',
      price_observed_at:poi.price_observed_at||null,price_valid_until:poi.price_valid_until||null,
      opening_hours:poi.opening_hours||'',suggested_stay_minutes:poi.suggested_stay_minutes||null,
      activity_intensity:poi.activity_intensity||'unknown',accessibility:poi.accessibility||[],
      verified_at:poi.verified_at||'',valid_until:poi.valid_until||'',source_publisher:poi.source_publisher||'',
      aiReason:poi.aiReason||''
    };
  }
  function buildInitialNodes(route, pois) {
    return (route.nodes||[]).map(function (routeNode) {
      var poi=pois.find(function (item) { return item.id===routeNode.poi_id; });
      if (poi) return routeNodeFromPoi(poi,1);
      var wgs=gcj02ToWgs84(Number(routeNode.longitude_gcj02),Number(routeNode.latitude_gcj02));
      return routeNodeFromPoi({
        id:routeNode.poi_id,name:routeNode.name,category:routeNode.category,
        longitude:wgs[0],latitude:wgs[1],provider:'amap',
        verification_status:'verified_with_gaps'
      },1);
    });
  }
  function buildSnapshotSegments(route, nodes) {
    return (route.segments||[]).map(function (segment) {
      var from=nodes.find(function(n){return n.poiId===segment.from_poi_id;});
      var to=nodes.find(function(n){return n.poiId===segment.to_poi_id;});
      var providerCoordinates=(segment.geometry&&segment.geometry.coordinates)||[];
      return {
        id:uid('segment'),fromId:from&&from.id,toId:to&&to.id,
        distance_m:Number(segment.distance_m)||0,duration_seconds:Number(segment.duration_seconds)||0,
        provider:segment.provider||'amap',status:'verified_snapshot',
        provider_coordinate_system:'GCJ-02',render_coordinate_system:'WGS84',
        providerCoordinates:providerCoordinates,
        renderCoordinates:providerCoordinates.map(function(c){return gcj02ToWgs84(Number(c[0]),Number(c[1]));})
      };
    }).filter(function(s){return s.fromId&&s.toId;});
  }
  function loadJson(url) {
    return fetch(url).then(function(response){
      if(!response.ok) throw new Error(url+' HTTP '+response.status);
      return response.json();
    });
  }

  async function initialize() {
    try {
      await resolveDestinationContext();
      if (!window.ol) throw new Error('OpenLayers 地图库未加载。');
      var routePromise=DESTINATION_KEY==='cn-yunnan-dali-ancient-city'
        ?loadJson('data/dali-route.json'):Promise.resolve({nodes:[],segments:[]});
      var poiPayload;
      try {
        if(!window.HealthTravelAPI||!window.HealthTravelAPI.getDestinationPois)throw new Error('POI 数据服务未加载');
        poiPayload=await window.HealthTravelAPI.getDestinationPois(DESTINATION_KEY);
        state.poiDataSource='api';
      } catch (apiError) {
        console.warn('[Route] POI API 不可用，使用本地核验快照:',apiError.message);
        poiPayload=await loadJson(DESTINATION_KEY==='cn-yunnan-dali-ancient-city'
          ?'data/dali-poi.json':'data/pois/'+DESTINATION_KEY+'.json');
        state.poiDataSource='local';
      }
      var routePayload=await routePromise;
      if(poiPayload.destination_key!==DESTINATION_KEY)throw new Error('地点数据与当前目的地不一致，请重新进入。');
      state.pois=poiPayload.results||poiPayload.pois||[];
      state.poiMeta=poiPayload.meta||{
        dataset_updated_at:poiPayload.updated_at||null,
        fetched_at:(poiPayload.snapshot&&poiPayload.snapshot.fetched_at)||null,
        provider_status:poiPayload.provider_status||'fallback',
        freshness:{unknown:state.pois.length}
      };
      if(!state.pois.length)throw new Error('当前目的地没有可用的核验地点。');
      var restored=loadDraft();
      loadRemoteReference();
      if (restored) {
        state.nodes=restored.nodes;
        state.segments=restored.segments||[];
        state.days=restored.days||1;
        state.mode=restored.mode||'walking';
        state.routeStatus=restored.routeStatus||'draft';
        state.aiConstraints=restored.aiConstraints||null;
      } else {
        state.nodes=buildInitialNodes(routePayload,state.pois);
        state.segments=buildSnapshotSegments(routePayload,state.nodes);
        if(!state.nodes.length){
          ['lodging','activity','dining'].forEach(function(category){
            var poi=state.pois.find(function(item){return item.category===category;});
            if(poi)state.nodes.push(routeNodeFromPoi(poi,1));
          });
          state.routeStatus='edited';
        }
      }
      initMap();
      bindEvents();
      renderAll();
      syncMap();
      fitRoute();
      updateMapStatus();
      ready=true;
      loadWeather();
      byId('start-ai-planner').disabled=false;
      if(!restored)scheduleRecalculate();
      if (restored) setFeedback('已恢复上次保存在本机的路线草稿。',false);
    } catch (error) {
      byId('route-error').hidden=false;
      byId('route-error-copy').textContent=error&&error.message?error.message:'数据加载失败';
    }
  }
  async function resolveDestinationContext() {
    var params=new URLSearchParams(window.location.search);
    var name=params.get('destination_name')||'';
    var key=params.get('destination_key')||'';
    var context=null;
    try { context=JSON.parse(sessionStorage.getItem('ht_route_context')||'null'); } catch(ignore) {}
    if(!key&&!name){name=(context&&context.destination_name)||'大理古城';key=(context&&context.destination_key)||'';}
    var payload=await loadJson('data/destination-details.json');
    var detail=payload.destinations.find(function(item){return key?item.destination_key===key:item.name===name;});
    if(!detail||(name&&detail.name!==name))throw new Error('目的地信息无效或不一致，请从推荐报告重新进入。');
    var geo=await loadJson('data/destinations.geojson');
    var feature=geo.features.find(function(item){return item.properties.name===detail.name;});
    if(!feature)throw new Error('缺少当前目的地的地理位置。');
    DESTINATION_KEY=detail.destination_key;
    destinationName=detail.name;
    destinationCenter=feature.geometry.coordinates.slice(0,2);
    STORAGE_KEY='ht_route_draft:'+DESTINATION_KEY;
    REMOTE_STORAGE_KEY='ht_route_remote:'+DESTINATION_KEY;
    document.title=destinationName+' · 康养线路工作台';
    document.querySelector('.route-heading p').textContent=destinationName+' · 康养线路';
    document.querySelector('.route-intro h2').textContent=destinationName+'旅居路线';
    document.querySelector('.ai-panel-header h2').textContent='一起规划'+destinationName+'旅居';
    document.querySelector('.map-stage').setAttribute('aria-label',destinationName+'路线地图');
  }

  async function loadWeather(){
    var el=byId('route-weather');
    try{
      var controller=new AbortController();
      var timer=setTimeout(function(){controller.abort();},25000);
      var response=await fetch(window.HealthTravelAPI.API_BASE+'/api/destinations/'+encodeURIComponent(DESTINATION_KEY)+'/weather',{signal:controller.signal});
      if(!response.ok)throw new Error('weather');
      var weather=await response.json();
      if(weather.status==='unavailable')throw new Error('weather');
      el.textContent=(weather.status==='stale'?'旧天气记录 · ':'')+(weather.scope||destinationName)+'：'+(weather.weather||'待更新')+' '+(weather.temperature_c||'—')+'℃ · 观测 '+weather.observed_at+'。区域口径，非路线逐点天气；实时 AQI 待接入。';
      if(/雨|雪|雷|雾/.test(weather.weather||''))el.textContent+=' 当前天气可能影响户外活动，请复核道路与预警。';
    }catch(error){el.textContent='天气暂不可用；出行前请查询当地天气、AQI 与预警。';}
    finally{clearTimeout(timer);}
  }

  function initMap() {
    routeSource=new ol.source.Vector();
    nodeSource=new ol.source.Vector();
    poiSource=new ol.source.Vector();
    var base=new ol.layer.Tile({source:new ol.source.OSM(),opacity:.88});
    var routeLayer=new ol.layer.Vector({
      source:routeSource,
      style:function(feature){
        var preview=feature.get('preview');
        return new ol.style.Style({stroke:new ol.style.Stroke({
          color:preview?'rgba(180,125,93,.9)':'rgba(34,103,88,.95)',
          width:preview?4:6,lineDash:preview?[10,9]:undefined
        })});
      }
    });
    var poiLayer=new ol.layer.Vector({
      source:poiSource,
      style:new ol.style.Style({image:new ol.style.Circle({
        radius:5,fill:new ol.style.Fill({color:'rgba(183,217,195,.9)'}),
        stroke:new ol.style.Stroke({color:'#244c42',width:2})
      })})
    });
    var nodeLayer=new ol.layer.Vector({
      source:nodeSource,
      style:function(feature){
        var selected=feature.get('nodeId')===state.selectedNodeId;
        return new ol.style.Style({
          image:new ol.style.Circle({
            radius:selected?11:9,fill:new ol.style.Fill({color:'#e1c58b'}),
            stroke:new ol.style.Stroke({color:selected?'#fff7e2':'#173c34',width:selected?4:3})
          }),
          text:new ol.style.Text({
            text:String(feature.get('index')||''),fill:new ol.style.Fill({color:'#17312b'}),
            font:'700 10px sans-serif'
          })
        });
      }
    });
    map=new ol.Map({
      target:'route-map',layers:[base,routeLayer,poiLayer,nodeLayer],
      view:new ol.View({center:ol.proj.fromLonLat(destinationCenter),zoom:14,minZoom:5,maxZoom:19})
    });
    modifyInteraction=new ol.interaction.Modify({source:nodeSource,pixelTolerance:16});
    map.addInteraction(modifyInteraction);
    map.addInteraction(new ol.interaction.Snap({source:nodeSource,pixelTolerance:14}));
    modifyInteraction.on('modifystart',function(event){
      var feature=event.features.item(0);
      var node=findNode(feature&&feature.get('nodeId'));
      if(node&&node.locked){
        event.features.clear();
        setFeedback('该节点已锁定，请先解锁再移动。',true);
        return;
      }
      pushHistory();
    });
    modifyInteraction.on('modifyend',function(event){
      event.features.forEach(function(feature){
        var node=findNode(feature.get('nodeId'));
        if(!node||node.locked)return;
        var lngLat=ol.proj.toLonLat(feature.getGeometry().getCoordinates());
        node.longitude=Number(lngLat[0].toFixed(6));
        node.latitude=Number(lngLat[1].toFixed(6));
        node.verification_status='user_adjusted';
      });
      markDirty();
      renderAll();
      scheduleRecalculate();
    });
    map.on('singleclick',function(event){
      var hit=map.forEachFeatureAtPixel(event.pixel,function(feature){return feature;},{hitTolerance:10});
      if(hit&&hit.get('nodeId')) selectNode(hit.get('nodeId'));
      else if(hit&&hit.get('poiId')){
        var poi=state.pois.find(function(item){return item.id===hit.get('poiId');});
        if(poi) showDetail(poi);
      }
    });
  }

  function bindEvents() {
    byId('undo-button').addEventListener('click',undo);
    byId('redo-button').addEventListener('click',redo);
    byId('save-button').addEventListener('click',saveDraft);
    byId('fit-route-button').addEventListener('click',fitRoute);
    byId('close-drawer-button').addEventListener('click',closeDrawer);
    byId('add-day-button').addEventListener('click',function(){
      pushHistory();state.days+=1;state.activeDay=state.days;markDirty();renderAll();syncMap();
    });
    byId('draw-node-button').addEventListener('click',toggleDraw);
    byId('poi-search').addEventListener('input',function(event){
      state.poiQuery=event.target.value.trim().toLowerCase();renderPoiList();
    });
    byId('poi-filters').addEventListener('click',function(event){
      var button=event.target.closest('[data-category]');
      if(!button)return;
      state.poiFilter=button.dataset.category;
      document.querySelectorAll('#poi-filters button').forEach(function(item){item.classList.toggle('is-active',item===button);});
      renderPoiList();
    });
    document.querySelectorAll('.mode-switch [data-mode]').forEach(function(button){
      button.addEventListener('click',function(){
        if(state.mode===button.dataset.mode)return;
        pushHistory();state.mode=button.dataset.mode;markDirty();renderAll();scheduleRecalculate(50);
      });
    });
    window.addEventListener('beforeunload',function(){if(state.dirty)persistDraft(false);});
  }
  function toggleDraw() {
    var button=byId('draw-node-button');
    if(drawInteraction){
      map.removeInteraction(drawInteraction);drawInteraction=null;
      button.textContent='地图加点';return;
    }
    drawInteraction=new ol.interaction.Draw({source:new ol.source.Vector(),type:'Point'});
    map.addInteraction(drawInteraction);
    button.textContent='取消加点';
    setFeedback('请在地图上点击要加入路线的位置。',false);
    drawInteraction.once('drawend',function(event){
      var coord=ol.proj.toLonLat(event.feature.getGeometry().getCoordinates());
      pushHistory();
      state.nodes.push({
        id:uid('node'),poiId:null,name:'自定义停靠点',category:'custom',
        day:state.activeDay||1,locked:false,longitude:Number(coord[0].toFixed(6)),
        latitude:Number(coord[1].toFixed(6)),coordinate_system:'WGS84',
        provider:'user',source_url:'',verification_status:'user_created',
        address:'地图手动添加',price_low:null,price_high:null,price_status:'unknown',
        price_note:'自定义地点未接入价格来源。'
      });
      markDirty();toggleDraw();renderAll();syncMap();scheduleRecalculate();
    });
  }

  function renderAll() {
    renderDayTabs();renderNodeList();renderPoiList();renderPoiDataStatus();renderSummary();
    document.querySelectorAll('.mode-switch [data-mode]').forEach(function(button){
      button.classList.toggle('is-active',button.dataset.mode===state.mode);
    });
    updateActionState();
    notifyRouteChange('render');
  }
  function renderDayTabs() {
    var html='<button type="button" data-day="all"'+(state.activeDay===0?' class="is-active"':'')+'>全部</button>';
    for(var i=1;i<=state.days;i++)html+='<button type="button" data-day="'+i+'"'+(state.activeDay===i?' class="is-active"':'')+'>第 '+i+' 天</button>';
    byId('day-tabs').innerHTML=html;
    byId('day-tabs').querySelectorAll('button').forEach(function(button){
      button.addEventListener('click',function(){
        setActiveDay(button.dataset.day==='all'?0:Number(button.dataset.day));
      });
    });
  }
  function renderNodeList() {
    var list=byId('node-list');
    var nodes=state.activeDay===0?state.nodes:state.nodes.filter(function(n){return n.day===state.activeDay;});
    if(!nodes.length){
      list.innerHTML='<li class="route-feedback">这一天还没有节点，可从下方真实地点或地图加入。</li>';
      return;
    }
    list.innerHTML=nodes.map(function(node){
      var index=state.nodes.indexOf(node);
      return '<li class="node-item'+(node.id===state.selectedNodeId?' is-selected':'')+'" draggable="true" data-node-id="'+escapeHtml(node.id)+'">'
        +'<span class="node-index">'+(index+1)+'</span>'
        +'<button class="node-copy" type="button" data-action="select"><strong>'+escapeHtml(node.name)+'</strong><span>第 '+node.day+' 天 · '+escapeHtml(CATEGORY_LABELS[node.category]||'地点')+'</span></button>'
        +'<span class="node-tools"><select class="node-day-select" title="调整到第几天" aria-label="调整 '+escapeHtml(node.name)+' 所在天数">'+dayOptions(node.day)+'</select><button type="button" data-action="up" title="上移">↑</button><button type="button" data-action="down" title="下移">↓</button><button type="button" data-action="lock" title="'+(node.locked?'解锁':'锁定')+'">'+(node.locked?'●':'○')+'</button><button type="button" data-action="delete" title="删除">×</button></span></li>';
    }).join('');
    bindNodeList();
  }
  function dayOptions(selectedDay) {
    var options='';
    for(var day=1;day<=state.days;day++){
      options+='<option value="'+day+'"'+(day===selectedDay?' selected':'')+'>D'+day+'</option>';
    }
    return options;
  }
  function bindNodeList() {
    byId('node-list').querySelectorAll('.node-item').forEach(function(item){
      var id=item.dataset.nodeId;
      var daySelect=item.querySelector('.node-day-select');
      daySelect.addEventListener('change',function(){moveNodeToDay(id,Number(daySelect.value));});
      item.addEventListener('click',function(event){
        var action=event.target.closest('[data-action]');
        if(!action)return;
        if(action.dataset.action==='select')selectNode(id);
        if(action.dataset.action==='up')moveNode(id,-1);
        if(action.dataset.action==='down')moveNode(id,1);
        if(action.dataset.action==='lock')toggleLock(id);
        if(action.dataset.action==='delete')deleteNode(id);
      });
      item.addEventListener('dragstart',function(event){item.classList.add('is-dragging');event.dataTransfer.setData('text/plain',id);});
      item.addEventListener('dragend',function(){item.classList.remove('is-dragging');});
      item.addEventListener('dragover',function(event){event.preventDefault();});
      item.addEventListener('drop',function(event){event.preventDefault();reorderNode(event.dataTransfer.getData('text/plain'),id);});
    });
  }
  function moveNode(id,delta) {
    var index=state.nodes.findIndex(function(n){return n.id===id;}),target=index+delta;
    if(index<0||target<0||target>=state.nodes.length)return;
    pushHistory();var moved=state.nodes.splice(index,1)[0];state.nodes.splice(target,0,moved);
    markDirty();renderAll();syncMap();scheduleRecalculate();
  }
  function reorderNode(fromId,toId) {
    if(!fromId||fromId===toId)return;
    var from=state.nodes.findIndex(function(n){return n.id===fromId;});
    var to=state.nodes.findIndex(function(n){return n.id===toId;});
    if(from<0||to<0)return;
    pushHistory();var moved=state.nodes.splice(from,1)[0];state.nodes.splice(to,0,moved);
    markDirty();renderAll();syncMap();scheduleRecalculate();
  }
  function toggleLock(id) {
    var node=findNode(id);if(!node)return;
    pushHistory();node.locked=!node.locked;markDirty();renderAll();syncMap();
  }
  function moveNodeToDay(id,day) {
    var node=findNode(id);
    if(!node||node.day===day||day<1||day>state.days)return;
    pushHistory();node.day=day;markDirty();renderAll();syncMap();scheduleRecalculate();
    setFeedback(node.name+' 已调整到第 '+day+' 天。',false);
  }
  function deleteNode(id) {
    var node=findNode(id);if(!node)return;
    if(node.locked){setFeedback('该节点已锁定，请先解锁再删除。',true);return;}
    pushHistory();state.nodes=state.nodes.filter(function(n){return n.id!==id;});
    if(state.selectedNodeId===id)closeDrawer();
    markDirty();renderAll();syncMap();scheduleRecalculate();
  }
  function addPoi(poi) {
    if(state.nodes.some(function(n){return n.poiId===poi.id;})){setFeedback('这个地点已经在线路中。',true);return;}
    pushHistory();state.nodes.push(routeNodeFromPoi(poi,state.activeDay||1));
    markDirty();renderAll();syncMap();scheduleRecalculate();
  }
  function selectNode(id) {
    var node=findNode(id);if(!node)return;
    state.selectedNodeId=id;nodeSource.changed();renderNodeList();showDetail(node);
    var feature=nodeSource.getFeatures().find(function(f){return f.get('nodeId')===id;});
    if(feature)map.getView().animate({center:feature.getGeometry().getCoordinates(),duration:420,zoom:Math.max(map.getView().getZoom(),15)});
    notifyRouteChange('selection');
  }
  function setActiveDay(day) {
    var next=Number(day);
    if(!Number.isInteger(next)||next<0||next>state.days)return;
    state.activeDay=next;renderAll();syncMap();
  }
  function findNode(id) { return state.nodes.find(function(n){return n.id===id;}); }

  function renderPoiList() {
    var filtered=state.pois.filter(function(poi){
      var matches=state.poiFilter==='all'||poi.category===state.poiFilter;
      var hay=(poi.name+' '+(poi.address||'')+' '+(CATEGORY_LABELS[poi.category]||'')).toLowerCase();
      return matches&&(!state.poiQuery||hay.indexOf(state.poiQuery)!==-1);
    });
    byId('poi-list').innerHTML=filtered.map(function(poi){
      var added=state.nodes.some(function(n){return n.poiId===poi.id;});
      return '<article class="poi-card"><div><strong>'+escapeHtml(poi.name)+'</strong><span>'+escapeHtml(CATEGORY_LABELS[poi.category]||'地点')+' · '+escapeHtml(poi.address||'地址待复核')+'</span></div><button type="button" data-poi-id="'+escapeHtml(poi.id)+'"'+(added?' disabled':'')+'>'+(added?'已加入':'+ 加入')+'</button></article>';
    }).join('')||'<p class="route-feedback">没有符合条件的地点。</p>';
    byId('poi-list').querySelectorAll('[data-poi-id]').forEach(function(button){
      button.addEventListener('click',function(){
        var poi=state.pois.find(function(item){return item.id===button.dataset.poiId;});
        if(poi)addPoi(poi);
      });
    });
  }
  function renderPoiDataStatus() {
    var element=byId('poi-data-status');if(!element)return;
    var meta=state.poiMeta||{},freshness=meta.freshness||{};
    var stale=Number(freshness.stale)||0;
    if(state.poiDataSource==='api'){
      element.textContent=stale
        ?'数据服务 · '+stale+' 条已过有效期，请复核'
        :'数据服务 · '+state.pois.length+' 个可追溯地点';
      element.classList.toggle('is-warning',stale>0);
    }else{
      element.textContent='本地核验快照 · 后端暂不可用';
      element.classList.add('is-warning');
    }
  }
  function renderSummary() {
    var distance=state.segments.reduce(function(sum,s){return sum+(Number(s.distance_m)||0);},0);
    var seconds=state.segments.reduce(function(sum,s){return sum+(Number(s.duration_seconds)||0);},0);
    var minutes=Math.round(seconds/60);
    byId('summary-distance').textContent=distance>=1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';
    byId('summary-duration').textContent=minutes>=60?Math.floor(minutes/60)+'h '+minutes%60+'m':minutes+' 分钟';
    var daily=state.days?minutes/state.days:minutes;
    byId('summary-intensity').textContent=state.mode==='driving'?'低':daily<=60?'舒缓':daily<=150?'适中':'偏高';
    var verified=state.nodes.filter(function(n){return finite(n.price_low)||finite(n.price_high);});
    var pending=state.nodes.length-verified.length;
    var totalLow=verified.reduce(function(sum,n){return sum+(Number(n.price_low)||0);},0);
    byId('budget-summary').textContent=verified.length
      ?'已核验预算 ¥'+Math.round(totalLow)+' 起 · '+pending+' 项待询价'
      :'预算待补商家来源 · '+pending+' 个节点不推测价格';
  }

  function routeMetrics() {
    var distance=state.segments.reduce(function(sum,segment){return sum+(Number(segment.distance_m)||0);},0);
    var duration=state.segments.reduce(function(sum,segment){return sum+(Number(segment.duration_seconds)||0);},0);
    var priced=state.nodes.filter(function(node){return finite(node.price_low)||finite(node.price_high);});
    return {
      distance_m:distance,
      duration_seconds:duration,
      priced_nodes:priced.length,
      pending_price_nodes:state.nodes.length-priced.length,
      node_count:state.nodes.length,
      days:state.days,
      mode:state.mode
    };
  }

  function syncMap() {
    if(!map)return;
    nodeSource.clear();poiSource.clear();routeSource.clear();
    state.nodes.forEach(function(node,index){
      if(state.activeDay&&node.day!==state.activeDay)return;
      nodeSource.addFeature(new ol.Feature({
        geometry:new ol.geom.Point(ol.proj.fromLonLat([node.longitude,node.latitude])),
        nodeId:node.id,index:index+1
      }));
    });
    state.pois.forEach(function(poi){
      if(state.nodes.some(function(n){return n.poiId===poi.id;}))return;
      poiSource.addFeature(new ol.Feature({
        geometry:new ol.geom.Point(ol.proj.fromLonLat([Number(poi.longitude),Number(poi.latitude)])),
        poiId:poi.id
      }));
    });
    state.segments.forEach(function(segment){
      var from=findNode(segment.fromId),to=findNode(segment.toId);
      if(!from||!to)return;
      if(state.activeDay&&(from.day!==state.activeDay||to.day!==state.activeDay))return;
      var coords=segment.renderCoordinates&&segment.renderCoordinates.length>1
        ?segment.renderCoordinates:[[from.longitude,from.latitude],[to.longitude,to.latitude]];
      routeSource.addFeature(new ol.Feature({
        geometry:new ol.geom.LineString(coords.map(function(c){return ol.proj.fromLonLat(c);})),
        preview:segment.status==='preview_only'
      }));
    });
  }
  function fitRoute() {
    if(!map||!nodeSource.getFeatures().length)return;
    map.getView().fit(nodeSource.getExtent(),{padding:[90,90,90,90],duration:600,maxZoom:15});
  }

  function scheduleRecalculate(delay) {
    clearTimeout(recalcTimer);
    recalcTimer=setTimeout(recalculateRoute,delay||650);
  }
  async function recalculateRoute() {
    var generation=++recalcGeneration;
    if(state.nodes.length<2){state.segments=[];state.routeStatus='edited';renderSummary();syncMap();notifyRouteChange('route');return;}
    setMapLoading(true);setFeedback('正在按真实道路重新计算…',false);
    var next=[],warning=false;
    for(var i=0;i<state.nodes.length-1;i++){
      var from=state.nodes[i],to=state.nodes[i+1];
      if(from.day!==to.day)continue;
      try{
        if(!window.HealthTravelAPI||!window.HealthTravelAPI.planRoute)throw new Error('路线服务未加载');
        var result=await window.HealthTravelAPI.planRoute({
          destination_key:DESTINATION_KEY,mode:state.mode,
          origin:{longitude:from.longitude,latitude:from.latitude,coordinate_system:'WGS84'},
          destination:{longitude:to.longitude,latitude:to.latitude,coordinate_system:'WGS84'}
        });
        next.push({
          id:uid('segment'),fromId:from.id,toId:to.id,
          distance_m:result.distance_m,duration_seconds:result.duration_seconds,
          provider:result.provider,status:'provider_computed',
          provider_coordinate_system:result.provider_coordinate_system,
          render_coordinate_system:result.render_coordinate_system,
          providerCoordinates:result.geometry.provider_coordinates,
          renderCoordinates:result.geometry.render_coordinates
        });
      }catch(error){
        warning=true;next.push(buildPreviewSegment(from,to));
      }
    }
    if(generation!==recalcGeneration)return;
    state.segments=next;
    state.routeStatus=warning?'preview':'provider';
    markDirty();renderSummary();syncMap();updateMapStatus();setMapLoading(false);
    var constraintWarning=walkingConstraintWarning();
    setFeedback(
      warning?'部分路段无法连接高德，虚线仅为直线预览，不是可导航道路。'
        :constraintWarning||'道路路线、距离与时间已经更新。',
      warning||!!constraintWarning
    );
    notifyRouteChange('route');
    return routeMetrics();
  }
  function walkingConstraintWarning() {
    if(!state.aiConstraints||state.mode!=='walking'||!finite(state.aiConstraints.max_daily_walk_km))return '';
    var limit=Number(state.aiConstraints.max_daily_walk_km)*1000;
    var totals={};
    state.segments.forEach(function(segment){
      var from=findNode(segment.fromId);
      if(from)totals[from.day]=(totals[from.day]||0)+(Number(segment.distance_m)||0);
    });
    var exceeded=Object.keys(totals).filter(function(day){return totals[day]>limit;});
    return exceeded.length?'第 '+exceeded.join('、')+' 天道路步行超过已确认上限，请减少节点或改用驾车。':'';
  }
  function buildPreviewSegment(from,to) {
    var km=haversine(from.longitude,from.latitude,to.longitude,to.latitude);
    var speed=state.mode==='walking'?4.5:25;
    return {
      id:uid('segment'),fromId:from.id,toId:to.id,distance_m:Math.round(km*1000),
      duration_seconds:Math.round(km/speed*3600),provider:'local_preview',status:'preview_only',
      provider_coordinate_system:null,render_coordinate_system:'WGS84',
      providerCoordinates:[],renderCoordinates:[[from.longitude,from.latitude],[to.longitude,to.latitude]]
    };
  }
  function haversine(lng1,lat1,lng2,lat2) {
    var r=6371,p1=lat1*Math.PI/180,p2=lat2*Math.PI/180;
    var dP=(lat2-lat1)*Math.PI/180,dL=(lng2-lng1)*Math.PI/180;
    var a=Math.sin(dP/2)*Math.sin(dP/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dL/2)*Math.sin(dL/2);
    return 2*r*Math.asin(Math.sqrt(a));
  }
  function setMapLoading(loading) {
    byId('map-state-dot').classList.toggle('is-loading',loading);
    if(loading){byId('map-state-title').textContent='道路计算中';byId('map-state-copy').textContent='WGS84 编辑坐标由服务端转换后请求高德。';}
  }
  function updateMapStatus() {
    if(state.routeStatus==='snapshot'){
      byId('map-state-title').textContent='已载入核验路线';byId('map-state-copy').textContent='高德道路快照 · 渲染坐标 WGS84';
    }else if(state.routeStatus==='preview'){
      byId('map-state-title').textContent='部分路段仅为预览';byId('map-state-copy').textContent='虚线不是可导航道路，请检查后端路线服务。';
    }else{
      byId('map-state-title').textContent='道路路线已更新';byId('map-state-copy').textContent='高德服务计算 · 渲染坐标 WGS84';
    }
  }
  function setFeedback(message,warning) {
    var el=byId('route-feedback');el.textContent=message||'';el.classList.toggle('is-warning',!!warning);
  }
  function markDirty() { state.dirty=true;updateActionState(); }
  function updateActionState() {
    byId('undo-button').disabled=!state.history.length;
    byId('redo-button').disabled=!state.future.length;
    var status=byId('save-status');
    status.textContent=state.dirty?'有未保存修改':(
      state.storageStatus==='remote'&&state.savedRouteVersion
        ?'已保存 · v'+state.savedRouteVersion
        :state.storageStatus==='conflict'?'本机已保存 · 后端待同步':'已保存在本机'
    );
    status.classList.toggle('is-dirty',state.dirty);
  }

  function showDetail(item) {
    byId('drawer-category').textContent=CATEGORY_LABELS[item.category]||'地点';
    byId('drawer-name').textContent=item.name||'未命名地点';
    byId('drawer-address').textContent=item.address||'地址待复核';
    byId('drawer-source').textContent=item.source_publisher||(item.provider==='amap'?'高德开放平台':item.provider==='user'?'用户添加':'数据快照');
    byId('drawer-verification').textContent=verificationLabel(item.verification_status);
    byId('drawer-price').textContent=priceLabel(item);
    byId('drawer-price-date').textContent=item.price_observed_at
      ?'观察 '+item.price_observed_at+(item.price_valid_until?' · 有效至 '+item.price_valid_until:'')
      :'未取得授权价格观察记录';
    byId('drawer-hours').textContent=item.opening_hours||'待商家或现场复核';
    byId('drawer-stay').textContent=finite(item.suggested_stay_minutes)?item.suggested_stay_minutes+' 分钟':'待结合路线确认';
    byId('drawer-intensity').textContent=intensityLabel(item.activity_intensity);
    byId('drawer-accessibility').textContent=accessibilityLabel(item.accessibility);
    byId('drawer-fit').textContent=item.aiReason||'尚未经过当前用户的 AI 需求分析';
    byId('drawer-next-leg').textContent=nextLegLabel(item);
    byId('drawer-verified-at').textContent=item.verified_at
      ?item.verified_at+(item.valid_until?' · 有效至 '+item.valid_until:''):'待核验';
    byId('drawer-coordinate').textContent=Number(item.longitude).toFixed(6)+', '+Number(item.latitude).toFixed(6)+' · WGS84';
    byId('drawer-notice').textContent=item.price_note||'营业状态、现场无障碍条件与动态路况可能变化。';
    var link=byId('drawer-source-link');link.href=item.source_url||'#';link.hidden=!item.source_url;
    var drawer=byId('detail-drawer');drawer.classList.add('is-open');drawer.setAttribute('aria-hidden','false');
  }
  function closeDrawer() {
    state.selectedNodeId=null;
    byId('detail-drawer').classList.remove('is-open');
    byId('detail-drawer').setAttribute('aria-hidden','true');
    if(nodeSource)nodeSource.changed();
    renderNodeList();
    notifyRouteChange('selection');
  }
  function verificationLabel(status) {
    return ({
      verified:'已核验',verified_with_gaps:'已核验，动态信息待复核',
      provider_only:'地图供应商返回，现场条件待核验',
      provider_computed:'服务商计算',user_adjusted:'用户已移动，需复核',
      user_created:'用户自定义，未核验'
    })[status]||'待核验';
  }
  function priceLabel(item) {
    if(finite(item.price_low)||finite(item.price_high)){
      var low=finite(item.price_low)?'¥'+item.price_low:'';
      var high=finite(item.price_high)?'¥'+item.price_high:'';
      return low+(low&&high?'–':'')+high+(item.price_unit?' / '+item.price_unit:'');
    }
    return '待商家或授权价格源，不展示推测金额';
  }
  function intensityLabel(value) {
    return ({low:'舒缓',moderate:'适中',active:'较高',high:'较高'})[value]||'待评估';
  }
  function accessibilityLabel(values) {
    if(!Array.isArray(values)||!values.length)return '尚无现场无障碍核验';
    if(values.indexOf('wheelchair:no')!==-1)return '来源记录不支持轮椅，出发前复核';
    return values.join(' · ');
  }
  function nextLegLabel(item) {
    var nodeId=item.id;
    var segment=state.segments.find(function(candidate){return candidate.fromId===nodeId;});
    if(!segment&&item.poiId){
      var node=state.nodes.find(function(candidate){return candidate.poiId===item.poiId;});
      segment=node&&state.segments.find(function(candidate){return candidate.fromId===node.id;});
    }
    if(!segment)return '当前没有可计算的下一段道路';
    var distance=segment.distance_m>=1000?(segment.distance_m/1000).toFixed(1)+' km':Math.round(segment.distance_m)+' m';
    return distance+' · 约 '+Math.max(1,Math.round(segment.duration_seconds/60))+' 分钟';
  }

  function toGeoJSON() {
    var features=[];
    state.nodes.forEach(function(node,index){
      features.push({
        type:'Feature',geometry:{type:'Point',coordinates:[node.longitude,node.latitude]},
        properties:{id:node.id,poi_id:node.poiId,name:node.name,category:node.category,
          day:node.day,order:index+1,locked:node.locked,coordinate_system:'WGS84',
          verification_status:node.verification_status}
      });
    });
    state.segments.forEach(function(segment,index){
      features.push({
        type:'Feature',geometry:{type:'LineString',coordinates:segment.renderCoordinates||[]},
        properties:{id:segment.id,order:index+1,from_id:segment.fromId,to_id:segment.toId,
          mode:state.mode,distance_m:segment.distance_m,duration_seconds:segment.duration_seconds,
          provider:segment.provider,coordinate_system:'WGS84',verification_status:segment.status}
      });
    });
    return {type:'FeatureCollection',properties:{
      destination_key:DESTINATION_KEY,coordinate_system:'WGS84',generated_at:new Date().toISOString()
    },features:features};
  }
  function routeBudgetSummary() {
    var priced=state.nodes.filter(function(node){return finite(node.price_low)||finite(node.price_high);});
    var low=priced.reduce(function(sum,node){return sum+(Number(node.price_low)||0);},0);
    var high=priced.reduce(function(sum,node){return sum+(Number(node.price_high)||Number(node.price_low)||0);},0);
    return {
      currency:'CNY',price_low:priced.length?low:null,price_high:priced.length?high:null,
      priced_nodes:priced.length,pending_price_nodes:state.nodes.length-priced.length,
      verification_status:priced.length===state.nodes.length?'verified':'incomplete'
    };
  }
  function getRouteModel() {
    var days=[];
    for(var day=1;day<=state.days;day++){
      var dayNodes=state.nodes.filter(function(node){return node.day===day;});
      var dayNodeIds=new Set(dayNodes.map(function(node){return node.id;}));
      days.push({
        day:day,
        nodes:clone(dayNodes),
        segments:clone(state.segments.filter(function(segment){return dayNodeIds.has(segment.fromId)&&dayNodeIds.has(segment.toId);}))
      });
    }
    return {
      route_id:state.savedRouteId||('route-'+DESTINATION_KEY+'-workspace-current'),destination_key:DESTINATION_KEY,version:DRAFT_VERSION,
      days:days,geometry:toGeoJSON(),budget_summary:routeBudgetSummary(),
      constraints:clone(state.aiConstraints||{}),data_snapshot_at:(state.poiMeta&&state.poiMeta.fetched_at)||null,
      active_day:state.activeDay,selected_node_id:state.selectedNodeId,mode:state.mode,
      route_status:state.routeStatus,
      elevation:{status:'unavailable',source:null,values:[],notice:'尚未接入可核验高程数据，不生成坡度结论。'}
    };
  }
  function notifyRouteChange(reason) {
    if(!routeListeners.length)return;
    var model=getRouteModel();
    routeListeners.slice().forEach(function(listener){
      try{listener(clone(model),reason||'update');}catch(error){console.warn('[Route] 视图同步失败:',error.message);}
    });
  }
  function subscribeRouteChange(listener) {
    if(typeof listener!=='function')return function(){};
    routeListeners.push(listener);
    try{listener(getRouteModel(),'initial');}catch(error){console.warn('[Route] 初始视图同步失败:',error.message);}
    return function(){routeListeners=routeListeners.filter(function(item){return item!==listener;});};
  }
  function persistDraft(markSaved) {
    var payload={
      version:DRAFT_VERSION,destination_key:DESTINATION_KEY,updated_at:new Date().toISOString(),
      nodes:state.nodes,segments:state.segments,days:state.days,mode:state.mode,
      aiConstraints:state.aiConstraints,
      routeStatus:state.routeStatus,geojson:toGeoJSON()
    };
    localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));
    if(markSaved){state.dirty=false;state.storageStatus='local';updateActionState();setFeedback('路线草稿已保存到这台设备。',false);}
  }
  function loadRemoteReference() {
    try {
      var reference=JSON.parse(localStorage.getItem(REMOTE_STORAGE_KEY)||'null');
      if(!reference||!reference.route_id||!reference.access_token)return;
      state.savedRouteId=reference.route_id;
      state.savedRouteToken=reference.access_token;
      state.savedRouteVersion=Number(reference.version)||1;
      state.storageStatus='remote';
    } catch(ignore) {}
  }
  function persistRemoteReference(payload) {
    state.savedRouteId=payload.route_id;
    state.savedRouteToken=payload.access_token||state.savedRouteToken;
    state.savedRouteVersion=Number(payload.version)||state.savedRouteVersion||1;
    localStorage.setItem(REMOTE_STORAGE_KEY,JSON.stringify({
      route_id:state.savedRouteId,access_token:state.savedRouteToken,
      version:state.savedRouteVersion,updated_at:new Date().toISOString()
    }));
  }
  async function saveDraft() {
    var button=byId('save-button');
    button.disabled=true;
    setFeedback('正在安全保存路线…',false);
    try {
      persistDraft(false);
      var api=window.HealthTravelAPI;
      if(!api||!api.createStoredRoute||!api.updateStoredRoute)throw new Error('后端保存服务未加载');
      var model=getRouteModel();
      var result;
      if(state.savedRouteId&&state.savedRouteToken){
        result=await api.updateStoredRoute(state.savedRouteId,state.savedRouteToken,{
          expected_version:state.savedRouteVersion,route:model,change_summary:'用户在路线工作台保存修改'
        });
      }else{
        result=await api.createStoredRoute({title:destinationName+'康养路线',route:model,change_summary:'路线工作台首次保存'});
      }
      persistRemoteReference(result);
      state.dirty=false;state.storageStatus='remote';updateActionState();
      setFeedback('路线已安全保存，并保留为版本 v'+state.savedRouteVersion+'。',false);
    }catch(error){
      try{persistDraft(false);}catch(localError){
        setFeedback('浏览器和后端都未能保存路线：'+localError.message,true);
        return;
      }
      state.storageStatus=error&&error.status===409?'conflict':'local';
      updateActionState();
      setFeedback(error&&error.status===409
        ?'本机草稿已保存，但服务器已有新版本；为避免覆盖，请重新载入后再同步。'
        :'本机草稿已保存，后端暂未同步：'+(error&&error.message?error.message:'服务不可用'),true);
    }finally{
      button.disabled=false;
    }
  }
  function loadDraft() {
    try{
      var value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!value||value.version!==DRAFT_VERSION||value.destination_key!==DESTINATION_KEY||!Array.isArray(value.nodes))return null;
      return value;
    }catch(error){return null;}
  }

  function currentAINodes() {
    return state.nodes.map(function(node,index){
      return {
        poi_id:node.poiId,
        day:node.day,
        order:index+1,
        reason:node.aiReason||'用户当前路线节点',
        locked:!!node.locked
      };
    }).filter(function(node){return !!node.poi_id;});
  }
  async function applyAIPlan(plan) {
    if(!plan||!Array.isArray(plan.nodes))throw new Error('AI 路线格式不完整');
    if(plan.destination_key!==DESTINATION_KEY)throw new Error('AI 返回了其他目的地的路线，未应用。');
    if(plan.nodes.some(function(item){return !state.pois.some(function(poi){return poi.id===item.poi_id;});}))throw new Error('AI 路线含未加载的地点，未应用。');
    var planned=plan.nodes.map(function(item){
      var poi=state.pois.find(function(candidate){return candidate.id===item.poi_id;});
      if(!poi)return null;
      var node=routeNodeFromPoi(poi,item.day);
      node.locked=!!item.locked;
      node.aiReason=item.reason||'基于已确认需求安排';
      return node;
    }).filter(Boolean);
    if(!planned.length)throw new Error('AI 路线没有可用的真实地点');
    pushHistory();
    state.nodes=planned;
    state.segments=[];
    state.days=Math.max(1,Number(plan.constraints&&plan.constraints.days)||1);
    state.activeDay=1;
    state.mode=plan.transport_mode==='driving'?'driving':'walking';
    state.aiConstraints=clone(plan.constraints||null);
    state.routeStatus='edited';
    markDirty();renderAll();syncMap();fitRoute();
    var metrics=await recalculateRoute();
    persistDraft(false);
    return metrics||routeMetrics();
  }
  function getAIContext() {
    return {
      destination_key:DESTINATION_KEY,
      destination_name:destinationName,
      ready:ready,
      constraints:clone(state.aiConstraints),
      current_nodes:currentAINodes(),
      metrics:routeMetrics()
    };
  }

  window.HealthRouteWorkspace = {
    applyAIPlan:applyAIPlan,
    getAIContext:getAIContext,
    getMetrics:routeMetrics,
    saveDraft:saveDraft,
    getRouteModel:getRouteModel,
    subscribeRouteChange:subscribeRouteChange,
    selectNode:selectNode,
    setActiveDay:setActiveDay
  };

  initialize();
})();
