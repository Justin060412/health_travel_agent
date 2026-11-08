(function () {
  'use strict';

  var stepIndex=0;
  var messages=[];
  var lastPlan=null;
  var externalAIConsent=false;
  var answers=defaultAnswers();
  var panel=document.getElementById('ai-planner-panel');
  var stage=document.getElementById('ai-stage');
  var chatLog=document.getElementById('ai-chat-log');
  var footer=document.getElementById('ai-panel-footer');
  var backButton=document.getElementById('ai-back-button');
  var nextButton=document.getElementById('ai-next-button');
  var progressLabel=document.getElementById('ai-progress-label');
  var progressBar=document.getElementById('ai-progress-bar');

  var steps=[
    {title:'你计划停留多久？',copy:'先确定天数，AI 才能控制每天的信息量与活动节奏。'},
    {title:'这次旅居最想获得什么？',copy:'最多选择三个目标，并告诉我更偏自然、文化还是休养。'},
    {title:'每天愿意走多少？',copy:'这里填写的是可接受上限，生成后会用真实道路距离复核。'},
    {title:'有哪些身体限制需要照顾？',copy:'这些信息只用于行程节奏和医疗位置参考，不用于诊断。'},
    {title:'预算边界是什么？',copy:'没有可靠价格来源时可以留空，系统不会替你猜金额。'},
    {title:'饮食上需要注意什么？',copy:'候选餐饮仍需在出发前复核营业状态与实际菜单。'},
    {title:'希望住在哪里、住成什么样？',copy:'当前样板只有已核验酒店候选，民宿与康养机构不足会明确提示。'},
    {title:'最后确认交通与节奏',copy:'AI 负责选点，高德道路服务负责实际距离和时间。'}
  ];

  function defaultAnswers(){
    return {
      destination_name:'',days:3,wellness_goals:['慢生活'],
      activity_level:'low',max_daily_walk_km:4,health_constraints:[],
      medical_access_minutes:30,lodging_budget_per_night:[],
      meal_budget_per_person:[],dietary_needs:[],
      lodging_preference:'no_preference',transport_modes:['walk'],
      experience_preference:'balanced',pace:'relaxed'
    };
  }
  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>'"]/g,function(char){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char];
    });
  }
  function isChecked(value,current){
    return String(value)===String(current)?' checked':'';
  }
  function inList(value,list){
    return (list||[]).indexOf(value)!==-1?' checked':'';
  }
  function option(type,name,value,label,checked){
    var id='ai-'+name+'-'+String(value).replace(/[^a-z0-9\u4e00-\u9fa5]/gi,'-');
    return '<span class="ai-option"><input id="'+id+'" type="'+type+'" name="'+name+'" value="'+escapeHtml(value)+'"'+checked+'><label for="'+id+'">'+escapeHtml(label)+'</label></span>';
  }

  function openPanel(){
    var context=window.HealthRouteWorkspace&&window.HealthRouteWorkspace.getAIContext();
    if(!context||!context.ready)return;
    answers=context&&context.constraints?Object.assign(defaultAnswers(),context.constraints):defaultAnswers();
    answers.destination_name=context.destination_name;
    steps[0].title='你计划在'+context.destination_name+'停留多久？';
    stepIndex=0;lastPlan=null;
    messages=[
      {role:'assistant',text:'先确认你的康养需求，再从'+context.destination_name+'的真实地图候选地点中安排路线。'},
      {role:'assistant',text:steps[0].title}
    ];
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden','false');
    document.getElementById('detail-drawer').classList.remove('is-open');
    renderStep();
  }
  function closePanel(){
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden','true');
  }
  function renderMessages(){
    chatLog.innerHTML=messages.slice(-6).map(function(message){
      return '<p class="ai-message is-'+message.role+'">'+escapeHtml(message.text)+'</p>';
    }).join('');
    chatLog.scrollTop=chatLog.scrollHeight;
  }
  function setProgress(label,percent){
    progressLabel.textContent=label;
    progressBar.style.width=Math.max(0,Math.min(100,percent))+'%';
  }
  function renderStep(){
    setProgress('需求确认 '+(stepIndex+1)+' / '+steps.length,(stepIndex/steps.length)*100);
    renderMessages();
    stage.innerHTML='<form id="ai-question-form" class="ai-question-card"><h3>'+escapeHtml(steps[stepIndex].title)+'</h3><p>'+escapeHtml(steps[stepIndex].copy)+'</p>'+stepMarkup(stepIndex)+'</form>';
    footer.hidden=false;
    backButton.disabled=stepIndex===0;
    nextButton.disabled=false;
    nextButton.textContent=stepIndex===steps.length-1?'查看需求卡':'继续';
  }
  function stepMarkup(index){
    if(index===0){
      var presets=[2,3,5,7],hasPreset=presets.indexOf(Number(answers.days))!==-1;
      return '<div class="ai-option-grid">'
        +presets.map(function(day){return option('radio','days',day,day+' 天',isChecked(day,answers.days));}).join('')
        +'</div><label class="ai-field"><span>也可以输入 1–7 天</span><input name="custom_days" type="number" min="1" max="7" placeholder="'+answers.days+'" value="'+(hasPreset?'':answers.days)+'"></label>';
    }
    if(index===1){
      return '<div class="ai-option-grid">'
        +['慢生活','睡眠改善','自然疗愈','文化调适'].map(function(goal){return option('checkbox','wellness_goals',goal,goal,inList(goal,answers.wellness_goals));}).join('')
        +'</div><label class="ai-field"><span>体验偏好</span><select name="experience_preference">'
        +selectOptions([['rest','以休养为主'],['nature','自然体验'],['culture','文化体验'],['balanced','综合体验']],answers.experience_preference)
        +'</select></label>';
    }
    if(index===2){
      return '<div class="ai-option-grid">'
        +option('radio','activity_level','low','轻度活动',isChecked('low',answers.activity_level))
        +option('radio','activity_level','moderate','适中活动',isChecked('moderate',answers.activity_level))
        +option('radio','activity_level','active','较多活动',isChecked('active',answers.activity_level))
        +'</div><label class="ai-field"><span>每天道路步行上限（公里）</span><input name="max_daily_walk_km" type="number" min=".5" max="20" step=".5" value="'+answers.max_daily_walk_km+'"></label><p class="ai-help">生成后会按高德道路逐日检查，不使用直线距离冒充。</p>';
    }
    if(index===3){
      return '<div class="ai-option-grid">'
        +['膝关节不适','心肺耐力有限','慢病管理','行动不便'].map(function(item){return option('checkbox','health_constraints',item,item,inList(item,answers.health_constraints));}).join('')
        +'</div><label class="ai-field"><span>希望距离医疗位置不超过（分钟）</span><input name="medical_access_minutes" type="number" min="5" max="120" step="5" value="'+answers.medical_access_minutes+'"></label><p class="ai-help">医疗 POI 只作为位置参考，不代表科室能力或治疗建议。</p>';
    }
    if(index===4){
      var lodging=answers.lodging_budget_per_night||[],meal=answers.meal_budget_per_person||[];
      return '<div class="ai-dual-fields"><label class="ai-field"><span>住宿最低 / 晚</span><input name="lodging_low" type="number" min="0" placeholder="可留空" value="'+escapeHtml(lodging[0]||'')+'"></label><label class="ai-field"><span>住宿最高 / 晚</span><input name="lodging_high" type="number" min="0" placeholder="可留空" value="'+escapeHtml(lodging[1]||'')+'"></label></div>'
        +'<div class="ai-dual-fields"><label class="ai-field"><span>每餐最低 / 人</span><input name="meal_low" type="number" min="0" placeholder="可留空" value="'+escapeHtml(meal[0]||'')+'"></label><label class="ai-field"><span>每餐最高 / 人</span><input name="meal_high" type="number" min="0" placeholder="可留空" value="'+escapeHtml(meal[1]||'')+'"></label></div>'
        +'<p class="ai-help">金额只是你的约束。当前 POI 没有授权价格时，结果仍显示“待询价”。</p>';
    }
    if(index===5){
      return '<div class="ai-option-grid">'
        +['清淡','低盐','素食','无特殊要求'].map(function(item){return option('checkbox','dietary_needs',item,item,inList(item,answers.dietary_needs));}).join('')
        +'</div>';
    }
    if(index===6){
      return '<div class="ai-option-grid">'
        +option('radio','lodging_preference','hotel','酒店',isChecked('hotel',answers.lodging_preference))
        +option('radio','lodging_preference','homestay','民宿',isChecked('homestay',answers.lodging_preference))
        +option('radio','lodging_preference','wellness','康养机构',isChecked('wellness',answers.lodging_preference))
        +option('radio','lodging_preference','no_preference','没有特别偏好',isChecked('no_preference',answers.lodging_preference))
        +'</div>';
    }
    return '<div class="ai-option-grid">'
      +option('radio','transport','walk','以步行为主',inList('walk',answers.transport_modes))
      +option('radio','transport','drive','自驾 / 打车',inList('drive',answers.transport_modes)||inList('taxi',answers.transport_modes))
      +'</div><label class="ai-field"><span>行程节奏</span><select name="pace">'
      +selectOptions([['relaxed','轻松：每天一个重点'],['moderate','适中：动静平衡'],['rich','丰富：安排更多活动']],answers.pace)
      +'</select></label>';
  }
  function selectOptions(items,current){
    return items.map(function(item){return '<option value="'+item[0]+'"'+(item[0]===current?' selected':'')+'>'+escapeHtml(item[1])+'</option>';}).join('');
  }
  function getValues(form,name){
    return new FormData(form).getAll(name).map(String);
  }
  function numberOr(value,fallback){
    var number=Number(value);
    return Number.isFinite(number)?number:fallback;
  }
  function rangeFrom(form,lowName,highName){
    var low=form.elements[lowName].value,high=form.elements[highName].value;
    if(low===''&&high==='')return [];
    var first=Math.max(0,numberOr(low,numberOr(high,0)));
    var second=Math.max(first,numberOr(high,first));
    return [Math.round(first),Math.round(second)];
  }
  function collectStep(){
    var form=document.getElementById('ai-question-form');
    var data=new FormData(form),summary='';
    if(stepIndex===0){
      answers.days=Math.max(1,Math.min(7,Math.round(numberOr(data.get('custom_days'),numberOr(data.get('days'),3)))));
      summary='计划停留 '+answers.days+' 天';
    }else if(stepIndex===1){
      answers.wellness_goals=getValues(form,'wellness_goals').slice(0,3);
      answers.experience_preference=String(data.get('experience_preference')||'balanced');
      summary=(answers.wellness_goals.join('、')||'综合调养')+'，偏好'+experienceLabel(answers.experience_preference);
    }else if(stepIndex===2){
      answers.activity_level=String(data.get('activity_level')||'low');
      answers.max_daily_walk_km=Math.max(.5,Math.min(20,numberOr(data.get('max_daily_walk_km'),4)));
      summary=activityLabel(answers.activity_level)+'，每天最多步行 '+answers.max_daily_walk_km+' 公里';
    }else if(stepIndex===3){
      answers.health_constraints=getValues(form,'health_constraints');
      answers.medical_access_minutes=Math.max(5,Math.min(120,Math.round(numberOr(data.get('medical_access_minutes'),30))));
      summary=(answers.health_constraints.join('、')||'没有补充身体限制')+'；医疗位置 '+answers.medical_access_minutes+' 分钟内';
    }else if(stepIndex===4){
      answers.lodging_budget_per_night=rangeFrom(form,'lodging_low','lodging_high');
      answers.meal_budget_per_person=rangeFrom(form,'meal_low','meal_high');
      summary='住宿 '+budgetLabel(answers.lodging_budget_per_night,'元/晚')+'，餐饮 '+budgetLabel(answers.meal_budget_per_person,'元/人');
    }else if(stepIndex===5){
      answers.dietary_needs=getValues(form,'dietary_needs');
      if(answers.dietary_needs.indexOf('无特殊要求')!==-1)answers.dietary_needs=[];
      summary=answers.dietary_needs.length?'饮食需要：'+answers.dietary_needs.join('、'):'饮食没有特殊要求';
    }else if(stepIndex===6){
      answers.lodging_preference=String(data.get('lodging_preference')||'no_preference');
      summary='住宿偏好：'+lodgingLabel(answers.lodging_preference);
    }else{
      var transport=String(data.get('transport')||'walk');
      answers.transport_modes=[transport];
      answers.pace=String(data.get('pace')||'relaxed');
      summary=(transport==='walk'?'以步行为主':'自驾或打车')+'，'+paceLabel(answers.pace);
    }
    return summary;
  }
  function goNext(){
    try{
      var summary=collectStep();
      messages.push({role:'user',text:summary});
      if(stepIndex===steps.length-1){showConfirmation();return;}
      stepIndex+=1;
      messages.push({role:'assistant',text:steps[stepIndex].title});
      renderStep();
    }catch(error){
      renderInlineError(error.message||'请检查当前输入');
    }
  }
  function goBack(){
    if(stepIndex===0)return;
    stepIndex-=1;
    if(messages.length>2)messages.splice(-2);
    renderStep();
  }
  function showConfirmation(){
    setProgress('确认结构化需求',100);renderMessages();footer.hidden=true;
    var items=[
      ['停留时间',answers.days+' 天'],
      ['康养目标',answers.wellness_goals.join('、')||'综合调养'],
      ['步行上限',answers.max_daily_walk_km+' km / 天'],
      ['身体限制',answers.health_constraints.join('、')||'未补充'],
      ['医疗位置',answers.medical_access_minutes+' 分钟内'],
      ['住宿预算',budgetLabel(answers.lodging_budget_per_night,'元/晚')],
      ['餐饮预算',budgetLabel(answers.meal_budget_per_person,'元/人')],
      ['饮食需要',answers.dietary_needs.join('、')||'无特殊要求'],
      ['住宿偏好',lodgingLabel(answers.lodging_preference)],
      ['交通与节奏',(answers.transport_modes[0]==='walk'?'步行':'自驾/打车')+' · '+paceLabel(answers.pace)]
    ];
    stage.innerHTML='<section class="ai-confirm-card"><h3>确认后才会生成路线</h3><p>你仍可以返回修改；生成后每个节点也能继续拖动、删除或锁定。</p><div class="ai-confirm-grid">'
      +items.map(function(item){return '<div class="ai-confirm-item"><span>'+escapeHtml(item[0])+'</span><strong>'+escapeHtml(item[1])+'</strong></div>';}).join('')
      +'</div><div class="ai-truth-note">AI 只能使用当前目的地的真实地图候选地点。价格缺失、医疗能力和现场无障碍不会被自动补全。</div>'
      +'<label class="ai-consent"><input id="external-ai-consent" type="checkbox"'+(externalAIConsent?' checked':'')+'><span><strong>可选：使用 DeepSeek 智能编排</strong>同意将这张确认卡中的康养限制与预算发送给已配置的外部 AI。不同意也能使用本地规则规划。</span></label>'
      +'<div class="ai-panel-footer"><button id="edit-ai-needs" class="ai-secondary-button" type="button">返回修改</button><button id="confirm-ai-plan" class="ai-primary-button" type="button">确认并生成路线</button></div></section>';
    document.getElementById('edit-ai-needs').addEventListener('click',function(){stepIndex=steps.length-1;renderStep();});
    document.getElementById('confirm-ai-plan').addEventListener('click',generatePlan);
  }
  async function generatePlan(){
    var workspace=window.HealthRouteWorkspace,api=window.HealthTravelAPI;
    if(!workspace||!api||!api.planAIRoute){renderInlineError('路线规划服务尚未加载，请稍后重试。');return;}
    var context=workspace.getAIContext(),before=workspace.getMetrics();
    var consent=document.getElementById('external-ai-consent');
    externalAIConsent=!!(consent&&consent.checked);
    renderLoading('正在从真实地点中编排行程','随后会调用道路服务复核每一天的距离与时间。');
    try{
      var plan=await api.planAIRoute({
        destination_key:context.destination_key,
        constraints:answers,
        locked_poi_ids:context.current_nodes.filter(function(node){return node.locked;}).map(function(node){return node.poi_id;}),
        locked_nodes:context.current_nodes.filter(function(node){return node.locked;}),
        allow_external_ai:externalAIConsent
      });
      var after=await workspace.applyAIPlan(plan);
      answers=plan.constraints;lastPlan=plan;
      renderResult(plan,before,after,'');
    }catch(error){
      renderFailure(error,'生成路线');
    }
  }
  async function revisePlan(instruction){
    var workspace=window.HealthRouteWorkspace,api=window.HealthTravelAPI;
    var context=workspace.getAIContext(),before=workspace.getMetrics();
    renderLoading('正在理解这次修改','锁定节点会保留，变更后的道路距离将重新计算。');
    try{
      var plan=await api.reviseAIRoute({
        destination_key:context.destination_key,
        instruction:instruction,
        constraints:context.constraints||answers,
        current_nodes:context.current_nodes,
        allow_external_ai:externalAIConsent
      });
      var after=await workspace.applyAIPlan(plan);
      answers=plan.constraints;lastPlan=plan;
      renderResult(plan,before,after,instruction);
    }catch(error){
      renderFailure(error,'修改路线');
    }
  }
  function renderLoading(title,copy){
    footer.hidden=true;setProgress('正在生成可编辑路线',100);
    stage.innerHTML='<div class="ai-loading"><div><i></i><strong>'+escapeHtml(title)+'</strong><p>'+escapeHtml(copy)+'</p></div></div>';
  }
  function renderResult(plan,before,after,instruction){
    setProgress('路线已写入地图',100);footer.hidden=true;
    var warnings=(plan.missing_data||[]).concat(plan.safety_notes||[]);
    stage.innerHTML='<section class="ai-result-card"><h3>'+escapeHtml(instruction?'路线已按要求修改':'路线已经生成')+'</h3><p>'+escapeHtml(plan.summary)+'</p>'
      +'<span class="ai-engine-badge'+(plan.engine_mode==='fallback'?' is-fallback':'')+'">'+escapeHtml(plan.engine_mode==='llm'?'DeepSeek 受约束规划':'规则降级方案')+'</span>'
      +(plan.degraded_reason?'<p class="ai-help">降级原因：'+escapeHtml(plan.degraded_reason)+'</p>':'')
      +'<div class="ai-plan-stats"><div><strong>'+after.node_count+'</strong><span>真实节点</span></div><div><strong>'+formatDistance(after.distance_m)+'</strong><span>道路距离</span></div><div><strong>'+formatDuration(after.duration_seconds)+'</strong><span>预计用时</span></div></div>'
      +(instruction?'<div class="ai-compare">'+escapeHtml(compareMetrics(before,after))+'</div>':'')
      +'<ul class="ai-warning-list">'+warnings.map(function(item){return '<li>'+escapeHtml(item)+'</li>';}).join('')+'</ul>'
      +'<form id="ai-revise-form" class="ai-revise-form"><label for="ai-revise-input">继续用一句话修改</label><textarea id="ai-revise-input" maxlength="300" placeholder="例如：第二天少走一点，换一家清淡餐厅"></textarea><button type="submit">修改并重新计算道路</button></form></section>';
    document.getElementById('ai-revise-form').addEventListener('submit',function(event){
      event.preventDefault();
      var input=document.getElementById('ai-revise-input');
      var instructionText=input.value.trim();
      if(instructionText.length<2){input.focus();return;}
      revisePlan(instructionText);
    });
  }
  function renderFailure(error,action){
    footer.hidden=true;
    stage.innerHTML='<div class="ai-error"><strong>'+escapeHtml(action+'没有完成')+'</strong><p>'+escapeHtml(error&&error.message?error.message:'服务暂时不可用')+'。手动路线仍然保留，可关闭面板继续编辑。</p></div><div class="ai-panel-footer"><button id="ai-failure-close" class="ai-secondary-button" type="button">继续手动编辑</button><button id="ai-failure-retry" class="ai-primary-button" type="button">重试</button></div>';
    document.getElementById('ai-failure-close').addEventListener('click',closePanel);
    document.getElementById('ai-failure-retry').addEventListener('click',function(){lastPlan?renderResult(lastPlan,window.HealthRouteWorkspace.getMetrics(),window.HealthRouteWorkspace.getMetrics(),''):showConfirmation();});
  }
  function renderInlineError(message){
    var old=stage.querySelector('.ai-error');if(old)old.remove();
    stage.insertAdjacentHTML('beforeend','<div class="ai-error"><strong>还需要一点信息</strong><p>'+escapeHtml(message)+'</p></div>');
  }
  function budgetLabel(range,unit){
    return range&&range.length?('¥'+range[0]+'–'+range[1]+' '+unit):'留空，不推测';
  }
  function experienceLabel(value){return ({rest:'休养',nature:'自然',culture:'文化',balanced:'综合体验'})[value]||'综合体验';}
  function activityLabel(value){return ({low:'轻度活动',moderate:'适中活动',active:'较多活动'})[value]||'轻度活动';}
  function lodgingLabel(value){return ({hotel:'酒店',homestay:'民宿',wellness:'康养机构',no_preference:'没有特别偏好'})[value]||'没有特别偏好';}
  function paceLabel(value){return ({relaxed:'轻松节奏',moderate:'适中节奏',rich:'丰富节奏'})[value]||'轻松节奏';}
  function formatDistance(meters){return meters>=1000?(meters/1000).toFixed(1)+' km':Math.round(meters||0)+' m';}
  function formatDuration(seconds){var minutes=Math.round((seconds||0)/60);return minutes>=60?Math.floor(minutes/60)+'h '+minutes%60+'m':minutes+' 分钟';}
  function compareMetrics(before,after){
    return '修改前 '+formatDistance(before.distance_m)+' / '+formatDuration(before.duration_seconds)
      +'，修改后 '+formatDistance(after.distance_m)+' / '+formatDuration(after.duration_seconds)
      +'；预算仍有 '+after.pending_price_nodes+' 个节点待授权价格来源。';
  }

  document.getElementById('start-ai-planner').addEventListener('click',openPanel);
  document.getElementById('close-ai-planner').addEventListener('click',closePanel);
  backButton.addEventListener('click',goBack);
  nextButton.addEventListener('click',goNext);
  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&panel.classList.contains('is-open'))closePanel();
  });
})();
