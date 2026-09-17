import './style.css';
import { load, save, init as storeInit } from './store.js';
import { scheduleDaytimeInterrupt, registerNotificationOpenHandler } from './notify.js';

/* ============================================================
   AI 人生重启 App — Capacitor 工程版
   逻辑与原单文件一致；存储走 store 抽象（Preferences / localStorage 降级），
   AI 提问/反馈默认规则引擎，预留 aiHook 两函数接真 LLM。
   ============================================================ */
const K = { profile:'lr_profile', streak:'lr_streak', entries:'lr_entries', breaklog:'lr_breaklog', notify_date:'lr_notify_date' };
const pick = a => a[Math.floor(Math.random()*a.length)];
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayStr = ()=> fmt(new Date());
function daysBetween(a,b){ if(!a||!b) return 99; const da=new Date(a+'T00:00:00'), db=new Date(b+'T00:00:00'); return Math.round((db-da)/86400000); }
const hasTwo = t => { const m=(t||'').match(/[。！？!?]/g); return (m?m.length:0)>=2 && (t||'').trim().length>=15; };

/* ---------- 30 个示例问题池 ---------- */
const MORNING_EXAMPLES = [
  "如果今天就是你未来五年里普通的一天，你愿意接受吗？为什么？",
  "你今天做的第一件事，是「你想成为的那个人」会做的事吗？",
  "你昨天有没有某个瞬间，感觉自己正在扮演旧身份？那一刻发生了什么？",
  "如果五年后的你站在今天早上看着你，他会对你说什么？",
  "你今天最想逃避的一件事是什么？你打算怎么面对它？",
  "你现在的身份宣言是「______」。今天哪一件事最能证明这句话？",
  "如果今天只能做一件事来靠近主线任务，那件事是什么？",
  "你最近一次感到「这就是我」是什么时候？那件符合你的身份宣言吗？",
  "你今天准备用什么具体行动，来拒绝你的反愿景？",
  "如果今天结束时你只能给自己一句评价，你希望那句话是什么？"
];
const DAYTIME_EXAMPLES = [
  "你现在做的事，是在靠近主线任务，还是在逃避它？",
  "如果有人在旁边记录你过去两小时，他会认为你想过什么样的人生？",
  "你现在感觉到的疲惫，是身体的累，还是逃避带来的累？",
  "你刚才刷手机的时候，在躲什么？",
  "如果现在立刻停下手里的事，去做那件最重要的事，你会损失什么？",
  "你现在做的事，五年后的你会感谢你，还是会遗憾？",
  "你有没有在等一个「更好的时机」？那个时机真的会来吗？",
  "你现在最不想面对的那件事，是什么？",
  "如果今天是你生命里最后一个普通工作日，你还会做现在这件事吗？",
  "你现在的状态，更像你的身份宣言，还是更像你的反愿景？"
];
const EVENING_EXAMPLES = [
  "今天哪一刻你感觉自己活成了身份宣言里的那个人？",
  "今天哪一刻你退回了旧身份？当时你在想什么？",
  "你今天的最小行动完成了吗？如果没有，真实原因是什么？",
  "如果给今天的自己打分，1 到 10 分，你打几分？为什么不是更高？",
  "今天有没有一件事，你本来可以做但没做？你在躲什么？",
  "今天你对自己说的最多的一句话是什么？那句话是在帮你，还是在害你？",
  "如果明天只能改变一个行为，你会改哪一个？",
  "今天你有没有某个瞬间，忘记了反愿景？那是什么时候？",
  "你今天做的哪件事，五年后的你会感谢现在的你？",
  "明天早上醒来，你想成为谁？用一句话描述。"
];

/* ---------- 引导问卷 ---------- */
const ONBOARD = {
  av:[
    "如果未来五年一切都不改变，描述一个普通的星期二：你在哪醒来？身体什么感觉？你做的第一件事是什么？",
    "那天晚上十点，你在想什么？你对自己说了什么？",
    "你身边最亲近的人，会怎么描述这五年里的你？",
    "你一直没有改变的最真实、最让你难堪的原因是什么？不是「没时间」，是那个你不太想承认的原因。",
    "你一直在用「拖延」逃避什么？如果那件事你认真做了，最坏会发生什么？",
    "如果五年后你还在过今天的生活，你最不能接受的是什么？"
  ],
  id:[
    "如果五年后你已经过上了想要的生活，那个人的身份是什么？用一句话描述（例：我是一个每天创作、身体强壮、不被他人评价绑架的人）。",
    "你现在身上有哪些旧身份标签？（例：我天生懒惰 / 我不擅长公开表达 / 我不是那种能坚持的人）",
    "这些标签里，哪一个最限制你？它是什么时候开始被你接受的？",
    "如果放弃这个标签，你会失去什么？为什么你一直抓着它不放？"
  ],
  mq:[
    "未来一年，如果只能完成一件事，那件事是什么？",
    "这件事对应哪个「魔王战」？也就是未来一个月你要攻克的具体项目。",
    "明天你能做的最小行动是什么？要求小到不可能失败（例：写 50 字 / 读 2 页 / 做 5 个俯卧撑）。"
  ]
};

/* ---------- 状态（启动时由 store 载入） ---------- */
let profile, streak, entries, breaklog;
let S = { screen:'boot', sub:0, breakReturned:false, answered:{} };

/* ============================================================
   AI 接入点（默认规则引擎；接入真 LLM 时替换这两函数即可）
   ============================================================ */
const aiHook = {
  genMorning(p, flags){
    const av=p.anti_vision, id=p.identity_declaration, yg=p.yearly_goal;
    let category, main;
    if(flags.missedMinAction){
      category='逃避识别类';
      main = pick([
        `你昨天逃避了最小行动「${flags.minAction}」。今天你打算怎么补上这第一步？`,
        "你今天最想逃避的一件事是什么？你打算怎么面对它？",
        `如果今天只能做一件事来靠近主线任务「${yg}」，那件事是什么？`
      ]);
    } else if(flags.streak>7){
      category='身份确认类';
      main = pick([
        `你现在的身份宣言是「${id}」。今天哪一件事最能证明这句话？`,
        "你最近一次感到「这就是我」是什么时候？那件事符合你的身份宣言吗？",
        "如果五年后的你站在今天早上看着你，他会对你说什么？"
      ]);
    } else {
      category = pick(['反愿景类','身份确认类','最小行动类']);
      if(category==='反愿景类') main="如果今天就是你未来五年里普通的一天，你愿意接受吗？为什么？";
      else if(category==='身份确认类') main="你今天做的第一件事，是「你想成为的那个人」会做的事吗？";
      else main=`如果今天只能做一件事来靠近主线任务「${yg}」，那件事是什么？`;
    }
    const fl = shuffle(['具体是哪一步？','为什么是现在？','你打算几点做？','那一刻你在想什么？','逃避的是什么？','如果失败会怎样？','谁会受影响？','你感觉怎样？','你打算怎么做？','现在卡在哪？']);
    return { main, f1:fl[0], f2:fl[1], category };
  },
  genFeedback(p, e){
    const ans = (e.answer||'')+(e.followup_1||'')+(e.followup_2||'');
    const key = (e.answer||'').slice(0,26);
    const mirror = key ? `我听到你说：「${key}${key.length>=26?'…':''}」。` : '我听到你了。';
    const avoid=['不想','逃避','累','刷手机','拖延','没时间','等','懒','烦','焦虑','没做'];
    const pos=['做了','完成','行动','开始','写','读','运动','跑','创作','联系','打'];
    let pattern;
    if(avoid.some(w=>ans.includes(w))) pattern=`我注意到一个「躲」的信号——你在把能量花在回避，而不是靠近「${p.identity_declaration}」。`;
    else if(pos.some(w=>ans.includes(w))) pattern=`你的回答里有一个身份信号：你已经在用「${p.identity_declaration}」的方式行动。`;
    else pattern='今天的信息里，我还没看到明确的逃避或行动信号，这本身值得留意。';
    const action = e.action_completed
      ? `明天的最小行动：把「${p.tomorrow_min_action||'一件小事'}」再做一次，并多加一点点量。`
      : `明天的最小行动：只做「${p.tomorrow_min_action||'写 50 字'}」——小到不可能失败。`;
    return mirror+'\n'+pattern+'\n'+action;
  }
};

/* ---------- 工具 ---------- */
function getToday(){ return entries.find(e=>e.date===todayStr()) || null; }
function ensureToday(){
  let e = getToday();
  if(!e){
    const flags = computeFlags();
    const q = aiHook.genMorning(profile, flags);
    e = { id:'e'+Date.now(), date:todayStr(), main_question:q.main, followup_1:'', followup_2:'',
          interrupt_log:[], min_action: profile.tomorrow_min_action||'', action_completed:false,
          feedback:'', checked_in:false, category:q.category, f1:q.f1, f2:q.f2 };
    entries.push(e); save(K.entries, entries);
  }
  return e;
}
function computeFlags(){
  const y = entries.find(e=>e.date===fmt(new Date(Date.now()-86400000)));
  return {
    missedMinAction: !!(y && y.checked_in && !y.action_completed),
    minAction: y? y.min_action : (profile.tomorrow_min_action||''),
    streak: streak.current_streak
  };
}
function addPoints(n){ streak.identity_points = Math.round((streak.identity_points+n)*10)/10; save(K.streak, streak); }

/* ============================================================
   渲染
   ============================================================ */
const app = document.getElementById('app');
function topbar(){
  const st = streak.break_status ? '<span class="pill return">回归</span>' :
    (streak.current_streak>0 ? `<span class="pill acc">连续 ${streak.current_streak} 天</span>` : '');
  const pts = `<span class="pill points">身份积分 ${streak.identity_points}</span>`;
  return `<div class="topbar">
    <div class="logo">人生重启<small>AI LIFE RESTART</small></div>
    <div class="spacer"></div>${st}${pts}
    <button class="iconbtn" onclick="App.go('panel')">面板</button>
    <button class="iconbtn" onclick="App.go('history')">历史</button>
  </div>`;
}
function render(){
  if(!profile || !profile.onboarding_completed){ return renderOnboarding(); }
  const gap = daysBetween(streak.last_checkin_date, todayStr());
  if(gap>=2 && !S.breakReturned && !getTodayCheckedToday()){ S.screen='break'; }
  if(S.screen==='break') return renderBreak();
  if(S.screen==='home') return renderHome();
  if(S.screen==='morning') return renderMorning();
  if(S.screen==='daytime') return renderDaytime();
  if(S.screen==='evening') return renderEvening();
  if(S.screen==='done') return renderDone();
  if(S.screen==='panel') return renderPanel();
  if(S.screen==='history') return renderHistory();
  if(S.screen==='about') return renderAbout();
  S.screen='home'; renderHome();
}
function getTodayCheckedToday(){ const e=getToday(); return e && e.checked_in; }

/* ---------- 引导 ---------- */
function renderOnboarding(){
  const o = S.answered;
  if(S.sub===0){
    app.innerHTML = `<div class="screen">
      <div class="wrap center" style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div class="big">24 小时重启</div>
        <p class="sub" style="margin-top:14px">不是设定目标，是重新定义你是谁。</p>
        <p style="font-size:14px;color:var(--muted)">第一次打开，先完成一次深度初始化：<br>反愿景挖掘 → 身份定义 → 主线任务。<br>每段都需要你认真写，不能跳过。</p>
        <button class="btn" onclick="App.onbStep(1)">开始重启</button>
      </div></div>`;
    return;
  }
  if(S.sub===4){ return renderOnbPanel(); }
  const map = {1:'反愿景挖掘',2:'身份定义',3:'主线任务与最小行动'}[S.sub];
  const keys = {1:'av',2:'id',3:'mq'}[S.sub];
  const qs = ONBOARD[keys];
  let html = `<div class="screen">${topbar()}<div class="wrap">
    <h1>${map}</h1><div class="sub">第 ${S.sub} / 3 段 · 每个问题请认真作答${S.sub===1?'（不少于两句话）':''}</div>`;
  qs.forEach((q,i)=>{
    const val = (o[keys]&&o[keys][i])||'';
    html += `<label class="q">${i+1}. ${q}${S.sub===1?'<span class="need">至少两句话</span>':''}</label>
      <textarea id="${keys}_${i}" placeholder="在这里写下你的真实回答…">${val}</textarea>`;
  });
  html += `<div class="err" id="onbErr"></div>
    <button class="btn" onclick="App.onbSave(${S.sub})">${S.sub<3?'下一步':'生成人生游戏面板'}</button>
    <button class="btn ghost" onclick="App.onbStep(${S.sub-1})">上一步</button>
  </div></div>`;
  app.innerHTML = html;
}
function renderOnbPanel(){
  const o = S.answered;
  const avAns = (o.av&&o.av[5])||'';
  const idAns = (o.id&&o.id[0])||'';
  const antiDraft = "我绝不让自己的人生变成：" + (avAns.split(/[。！？]/)[0]||"一个继续逃避、五年后还是老样子的自己") + "。";
  const idDraft = "我是那种 " + (idAns.trim()||"每天创作、身体强壮、不被他人评价绑架") + " 的人。";
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>人生游戏面板</h1><div class="sub">AI 已根据你的回答生成初始设定，可修改后确认。</div>
    <div class="card">
      <h3>反愿景 · Game Over 条件</h3>
      <textarea id="antiDecl">${antiDraft}</textarea>
      <h3 style="margin-top:14px">身份宣言 · 角色设定</h3>
      <textarea id="idDecl">${idDraft}</textarea>
    </div>
    <div class="card">
      <div class="kv"><span class="k">一年目标 · 主线任务</span><span class="v">${(o.mq&&o.mq[0])||'—'}</span></div>
      <div class="kv"><span class="k">月度项目 · 魔王战</span><span class="v">${(o.mq&&o.mq[1])||'—'}</span></div>
      <div class="kv"><span class="k">每日行动 · 最小行动</span><span class="v">${(o.mq&&o.mq[2])||'—'}</span></div>
    </div>
    <div class="err" id="onbErr"></div>
    <button class="btn sec" onclick="App.onbFinish()">完成初始化，进入每日循环</button>
  </div></div>`;
}
function renderBreak(){
  const av = profile.anti_vision, id = profile.identity_declaration;
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>你回来了</h1>
    <div class="quote">这是你写下的反愿景：<br><b>${av}</b></div>
    <div class="quote">这是你想成为的人：<br><b>${id}</b></div>
    <p class="sub">今天不需要补卡，只需要回答一个问题。</p>
    <label class="q">你现在想回到哪种生活？</label>
    <textarea id="breakAns" placeholder="诚实写一句…"></textarea>
    <div class="err" id="bkErr"></div>
    <button class="btn" onclick="App.breakSubmit()">回到今天的循环</button>
  </div></div>`;
}

/* ---------- 首页 / 每日主循环 ---------- */
function renderHome(){
  const e = getToday();
  const morningDone = !!(e && e.answer);
  const dayDone = !!(e && e.interrupt_log.length>0);
  const eveningDone = !!(e && e.checked_in);
  const gap = daysBetween(streak.last_checkin_date, todayStr());
  const warn = (gap>=3 || (streak.current_streak===0 && breaklog.length>0 && gap>=3));
  let warnHtml = warn ? `<div class="warnbar">如果什么都不改变，这就是五年后的普通星期二：<br><b>${profile.anti_vision}</b></div>` : '';
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    ${warnHtml}
    <h1>今天的问题</h1>
    <div class="sub">${todayStr()} · 回答它，别绕过去。</div>
    <div class="card" style="background:#fbe9e4;border-color:#f3cfc4">
      <div style="font-size:12px;color:var(--accent);font-weight:700">反愿景</div>
      <div style="font-weight:700;margin-top:2px">${profile.anti_vision}</div>
      <div style="font-size:12px;color:var(--accent2);font-weight:700;margin-top:10px">身份宣言</div>
      <div style="font-weight:700;margin-top:2px;color:var(--accent2)">${profile.identity_declaration}</div>
    </div>
    <div class="phase ${morningDone?'':'locked'}" onclick="${morningDone?'':'App.go(\'morning\')'}">
      <div class="num">☀</div><div class="meta"><div class="t">早上 · 校准</div><div class="d">${morningDone?('主问题已答 · '+e.category):'回答 1 个主问题 + 至少 1 个追问'}</div></div>
      <div class="st ${morningDone?'done':'todo'}">${morningDone?'已完成':'待做'}</div>
    </div>
    <div class="phase ${dayDone?'':'locked'}" onclick="${dayDone?'':'App.go(\'daytime\')'}">
      <div class="num">⚡</div><div class="meta"><div class="t">白天 · 打断</div><div class="d">${dayDone?'已回应打断':(morningDone?'随机打断提醒，可跳过':'先完成早上校准')}</div></div>
      <div class="st ${dayDone?'done':'todo'}">${dayDone?'已记录':'可选'}</div>
    </div>
    <div class="phase ${eveningDone?'':'locked'}" onclick="${eveningDone?'':(morningDone?'App.go(\'evening\')':'')}">
      <div class="num">🌙</div><div class="meta"><div class="t">晚上 · 复盘</div><div class="d">${eveningDone?'已打卡':(morningDone?'AI 生成反馈 + 确认最小行动':'需先完成早上校准')}</div></div>
      <div class="st ${eveningDone?'done':'todo'}">${eveningDone?'已打卡':'待做'}</div>
    </div>
    <button class="btn ghost" onclick="App.go('panel')">查看人生游戏面板</button>
  </div></div>`;
}

/* ---------- 早上校准 ---------- */
function renderMorning(){
  const e = ensureToday();
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>今天的问题</h1>
    <div class="sub">类别：${e.category} · 回答它，别绕过去。</div>
    <div class="card" style="background:#fbe9e4;border-color:#f3cfc4">
      <div style="font-size:12px;color:var(--accent);font-weight:700">反愿景</div><div style="font-weight:700">${profile.anti_vision}</div>
      <div style="font-size:12px;color:var(--accent2);font-weight:700;margin-top:8px">身份宣言</div><div style="font-weight:700;color:var(--accent2)">${profile.identity_declaration}</div>
    </div>
    <label class="q">主问题</label>
    <div class="quote">${e.main_question}</div>
    <textarea id="ans" placeholder="写下你的真实回答…">${e.answer||''}</textarea>
    <label class="q">追问 1 <span class="need">（${e.f1}）</span></label>
    <input type="text" id="fu1" value="${e.followup_1||''}" placeholder="一句话即可" />
    <label class="q">追问 2 <span class="need">（${e.f2}）</span></label>
    <input type="text" id="fu2" value="${e.followup_2||''}" placeholder="一句话即可（至少答 1 个）" />
    <div class="err" id="mErr"></div>
    <button class="btn" onclick="App.morningSubmit()">提交校准</button>
    <button class="btn ghost" onclick="App.go('home')">稍后再说</button>
  </div></div>`;
}

/* ---------- 白天打断 ---------- */
function renderDaytime(){
  const e = ensureToday();
  const log = e.interrupt_log[0];
  let body;
  if(log){
    body = `<div class="quote">${log.q}</div>
      ${log.skipped? '<p class="sub">你选择了跳过（已记录，不惩罚）。</p>' : `<div class="quote">你的回答：${log.a}</div>`}
      <button class="btn ghost" onclick="App.go('home')">返回</button>`;
  } else {
    const q = e.interrupt_q || (e.interrupt_q = pick(DAYTIME_EXAMPLES));
    save(K.entries, entries);
    body = `<label class="q">一次打断提醒</label>
      <div class="quote">${q}</div>
      <textarea id="itAns" placeholder="一句话回答，或选择跳过"></textarea>
      <div class="err" id="itErr"></div>
      <button class="btn" onclick="App.itRespond()">回应</button>
      <button class="btn ghost" onclick="App.itSkip()">跳过（不惩罚）</button>`;
  }
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>白天 · 打断</h1><div class="sub">随机一次，把注意力拉回当下。</div>${body}</div></div>`;
}

/* ---------- 晚上复盘 ---------- */
async function renderEvening(){
  const e = ensureToday();
  if(!e.answer){ S.screen='home'; return renderHome(); }
  const fb = aiHook.genFeedback(profile, e);
  const ev = shuffle(EVENING_EXAMPLES).slice(0,2);
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>晚上 · 复盘</h1><div class="sub">回看今天，是否符合你的身份。</div>
    <div class="mirror">今天你写了：${(e.answer||'').slice(0,40)||'（未填写）'}${(e.answer||'').length>40?'…':''}</div>
    <div class="card"><h3>AI 反馈</h3><div class="fb" style="white-space:pre-line;color:var(--ink);font-size:14px">${fb}</div></div>
    <div class="card">
      <h3>今天的最小行动</h3>
      <div class="quote">${e.min_action||'（未设定）'}</div>
      <div class="seg" id="actSeg">
        <button class="${e.action_completed?'on':''}" onclick="App.setAct(true)">完成了</button>
        <button class="${!e.action_completed?'on':''}" onclick="App.setAct(false)">没做</button>
      </div>
      <div class="hint">额外 +1 身份积分（完成）/ 不扣分（没做）。</div>
    </div>
    <div class="card">
      <h3>今晚顺便想想</h3>
      <div class="quote">${ev[0]}</div>
      <div class="quote">${ev[1]}</div>
    </div>
    <label class="q">明天的最小行动（可修改）</label>
    <input type="text" id="nextMin" value="${profile.tomorrow_min_action||''}" placeholder="小到不可能失败" />
    <div class="err" id="evErr"></div>
    <button class="btn sec" onclick="App.eveningSubmit()">完成打卡</button>
  </div></div>`;
}

/* ---------- 打卡完成 ---------- */
function renderDone(){
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap center" style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div class="big">今天结束</div>
    <p class="sub" style="margin-top:12px">你今天的行动，正在投票给你想成为的人。</p>
    <div class="card" style="text-align:left">
      <div class="kv"><span class="k">连续打卡</span><span class="v">${streak.current_streak} 天</span></div>
      <div class="kv"><span class="k">累计打卡</span><span class="v">${streak.total_checkins} 次</span></div>
      <div class="kv"><span class="k">身份积分</span><span class="v">${streak.identity_points}</span></div>
    </div>
    <button class="btn" onclick="App.go('home')">回到首页</button>
    <button class="btn ghost" onclick="App.go('panel')">查看人生游戏面板</button>
  </div></div>`;
}

/* ---------- 人生游戏面板 ---------- */
function renderPanel(){
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>人生游戏面板</h1>
    <div class="card"><h3>反愿景 · Game Over 条件</h3><div class="decl">${profile.anti_vision}</div></div>
    <div class="card"><h3>身份宣言 · 角色设定</h3><div class="decl id">${profile.identity_declaration}</div></div>
    <div class="card">
      <div class="kv"><span class="k">一年目标 · 主线任务</span><span class="v">${profile.yearly_goal||'—'}</span></div>
      <div class="kv"><span class="k">月度项目 · 魔王战</span><span class="v">${profile.monthly_project||'—'}</span></div>
      <div class="kv"><span class="k">每日行动 · 最小行动</span><span class="v">${profile.tomorrow_min_action||'—'}</span></div>
    </div>
    <div class="card">
      <h3>主线任务进度</h3>
      <div class="kv"><span class="k">推进度</span><span class="v">${streak.main_quest_progress}%</span></div>
      <div class="progress"><i style="width:${streak.main_quest_progress}%"></i></div>
      <input type="range" min="0" max="100" step="5" value="${streak.main_quest_progress}" id="prog" style="width:100%;margin-top:12px"
        oninput="document.getElementById('progv').textContent=this.value+'%'" />
      <div class="hint">每周复盘手动更新。<span id="progv">${streak.main_quest_progress}%</span>
        <button class="iconbtn" style="margin-left:8px" onclick="App.saveProg()">保存</button></div>
    </div>
    <div class="card">
      <div class="kv"><span class="k">连续打卡</span><span class="v">${streak.break_status?'回归':streak.current_streak+' 天'}</span></div>
      <div class="kv"><span class="k">累计打卡</span><span class="v">${streak.total_checkins} 次</span></div>
      <div class="kv"><span class="k">身份积分</span><span class="v">${streak.identity_points}</span></div>
    </div>
    <button class="btn ghost" onclick="App.exportBackup()">导出备份</button>
    <button class="btn ghost" onclick="App.importBackup()">导入备份</button>
    <button class="btn ghost" onclick="App.go('about')">关于 AI 引擎</button>
    <button class="btn ghost" onclick="App.go('history')">历史回看</button>
    <button class="btn ghost" onclick="App.go('home')">返回首页</button>
  </div></div>`;
}

/* ---------- 历史 ---------- */
function renderHistory(){
  const list = entries.slice().reverse();
  let html = list.map(e=>{
    return `<div class="hist"><div class="dt">${e.date} ${e.checked_in?'✓打卡':'·未打卡'}</div>
      <div>主问题：${e.main_question}</div>
      <div class="fb">答：${e.answer||'—'}</div>
      ${e.feedback?`<div class="fb">反馈：${e.feedback}</div>`:''}
      <div class="fb">最小行动：${e.min_action||'—'} ${e.action_completed?'✓':'✗'}</div></div>`;
  }).join('');
  const bk = breaklog.length? `<div class="card"><h3>断卡回归记录</h3>${breaklog.slice().reverse().map(b=>`<div class="hist"><div class="dt">${b.date}</div><div class="fb">${b.answer}</div></div>`).join('')}</div>` : '';
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>历史回看</h1><div class="sub">本地读取，不调用大模型。</div>
    ${html||'<p class="sub">还没有记录。</p>'}${bk}
    <button class="btn ghost" onclick="App.go('home')">返回首页</button>
  </div></div>`;
}

/* ---------- 关于 AI ---------- */
function renderAbout(){
  app.innerHTML = `<div class="screen">${topbar()}<div class="wrap">
    <h1>关于 AI 引擎</h1>
    <div class="card">
      <h3>当前模式：规则引擎</h3>
      <p class="sub">为保证离线可用、零 API 成本，提问与反馈默认由本地规则生成，严格遵循产品定义的问题分类、生成规则与反馈结构。</p>
      <p style="font-size:14px">接入真大模型只需替换两处：</p>
      <div class="tag">aiHook.genMorning()</div><div class="tag">aiHook.genFeedback()</div>
      <p class="hint">传入参数已包含：反愿景、身份宣言、一年目标、魔王战、连续天数、是否断卡、昨天最小行动与回答摘要，符合提示词模板。</p>
    </div>
    <div class="card">
      <h3>问题分类覆盖</h3>
      <div class="tag">反愿景类</div><div class="tag">身份确认类</div><div class="tag">逃避识别类</div>
      <div class="tag">最小行动类</div><div class="tag">复盘类</div><div class="tag">断卡回归类</div>
      <p class="hint">内置 30 个示例问题（早上 10 / 白天 10 / 晚上 10）作为语料池。</p>
    </div>
    <button class="btn ghost" onclick="App.go('panel')">返回面板</button>
  </div></div>`;
}

/* ============================================================
   行为
   ============================================================ */
const App = {
  go(s){ S.screen=s; render(); },
  onbStep(n){ S.sub=n; render(); },
  onbSave(step){
    const keys={1:'av',2:'id',3:'mq'}[step];
    const arr=ONBOARD[keys].map((_,i)=> (document.getElementById(keys+'_'+i).value||'').trim());
    const err=document.getElementById('onbErr');
    for(let i=0;i<arr.length;i++){
      if(!arr[i]){ err.textContent='请完成所有问题，不能跳过。'; return; }
      if(step===1 && !hasTwo(arr[i])){ err.textContent=`第 ${i+1} 题需要至少两句话（用句号/问号分隔）。`; return; }
    }
    S.answered[keys]=arr; err.textContent='';
    S.sub=step+1; render();
  },
  onbFinish(){
    const o=S.answered;
    const anti=document.getElementById('antiDecl').value.trim();
    const idv=document.getElementById('idDecl').value.trim();
    if(!anti||!idv){ document.getElementById('onbErr').textContent='宣言不能为空。'; return; }
    profile={ onboarding_completed:true, created_at:todayStr(),
      anti_vision:anti, identity_declaration:idv,
      yearly_goal:(o.mq&&o.mq[0])||'', monthly_project:(o.mq&&o.mq[1])||'',
      tomorrow_min_action:(o.mq&&o.mq[2])||'', onboarding:o };
    save(K.profile, profile);
    streak={ current_streak:0, total_checkins:0, last_checkin_date:'', break_status:false, identity_points:0, main_quest_progress:0 };
    save(K.streak, streak);
    S={ screen:'home', sub:0, breakReturned:false, answered:{} };
    render();
    maybeSchedule();
  },
  breakSubmit(){
    const a=document.getElementById('breakAns').value.trim();
    if(!a){ document.getElementById('bkErr').textContent='写一句再继续。'; return; }
    breaklog.push({date:todayStr(), answer:a}); save(K.breaklog, breaklog);
    streak.break_status=true; save(K.streak, streak);
    S.breakReturned=true; S.screen='home'; render();
  },
  morningSubmit(){
    const e=ensureToday();
    const ans=document.getElementById('ans').value.trim();
    const f1=document.getElementById('fu1').value.trim();
    const f2=document.getElementById('fu2').value.trim();
    const err=document.getElementById('mErr');
    if(!ans){ err.textContent='请回答主问题。'; return; }
    if(!f1 && !f2){ err.textContent='至少回答一个追问。'; return; }
    e.answer=ans; e.followup_1=f1; e.followup_2=f2; save(K.entries, entries);
    app.insertAdjacentHTML('beforeend', `<div class="modal"><div class="box"><h3>校准已记录</h3>
      <div class="mirror">我听到了：「${ans.slice(0,24)}${ans.length>24?'…':''}」。</div>
      <p class="sub">继续，晚上见。</p><button class="btn" onclick="App.closeModal()">好的</button></div></div>`);
  },
  closeModal(){ document.querySelector('.modal')?.remove(); S.screen='home'; render(); },
  itRespond(){
    const e=ensureToday();
    const a=document.getElementById('itAns').value.trim();
    if(!a){ document.getElementById('itErr').textContent='写一句，或点跳过。'; return; }
    e.interrupt_log=[{q:e.interrupt_q, a, skipped:false, date:todayStr()}];
    delete e.interrupt_q; save(K.entries, entries);
    addPoints(0.5);
    S.screen='home'; render();
  },
  itSkip(){
    const e=ensureToday();
    e.interrupt_log=[{q:e.interrupt_q, a:'', skipped:true, date:todayStr()}];
    delete e.interrupt_q; save(K.entries, entries);
    S.screen='home'; render();
  },
  setAct(done){
    const e=ensureToday(); e.action_completed=done; save(K.entries, entries); render();
  },
  async eveningSubmit(){
    const e=ensureToday();
    const next=document.getElementById('nextMin').value.trim();
    if(!next){ document.getElementById('evErr').textContent='设定一个明天的最小行动。'; return; }
    e.feedback=aiHook.genFeedback(profile, e);
    e.checked_in=true; save(K.entries, entries);
    const gap=daysBetween(streak.last_checkin_date, todayStr());
    streak.current_streak = (gap===1)? streak.current_streak+1 : 1;
    streak.total_checkins += 1;
    streak.last_checkin_date = todayStr();
    streak.break_status=false;
    streak.identity_points = Math.round((streak.identity_points+1+(e.action_completed?1:0))*10)/10;
    profile.tomorrow_min_action=next; save(K.profile, profile);
    save(K.streak, streak);
    S.screen='done'; render();
  },
  saveProg(){
    const v=parseInt(document.getElementById('prog').value,10)||0;
    streak.main_quest_progress=v; save(K.streak, streak);
    document.getElementById('progv').textContent=v+'%';
    App.go('panel');
  },
  /* ---------- 备份导出/导入 ---------- */
  exportBackup(){
    const data={ v:1, profile, streak, entries, breaklog };
    const json=JSON.stringify(data, null, 2);
    app.insertAdjacentHTML('beforeend', `<div class="modal"><div class="box"><h3>导出备份</h3>
      <p class="sub">复制下面的 JSON，或用「下载」存到本地/网盘（换机或重装可导入恢复）。</p>
      <textarea id="bkJson" style="min-height:180px">${json}</textarea>
      <div class="row"><button class="btn" onclick="App.copyBk()">复制</button>
      <button class="btn sec" onclick="App.dlBk()">下载</button></div>
      <button class="btn ghost" onclick="App.closeModal()">关闭</button></div></div>`);
  },
  copyBk(){
    const t=document.getElementById('bkJson'); if(!t) return;
    t.select();
    try{ navigator.clipboard && navigator.clipboard.writeText(t.value); }catch(_){}
    try{ document.execCommand && document.execCommand('copy'); }catch(_){}
  },
  dlBk(){
    const t=document.getElementById('bkJson'); if(!t) return;
    const blob=new Blob([t.value],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='liferestart-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  },
  importBackup(){
    app.insertAdjacentHTML('beforeend', `<div class="modal"><div class="box"><h3>导入备份</h3>
      <p class="sub">粘贴之前导出的 JSON，将覆盖当前本地数据。</p>
      <textarea id="imJson" style="min-height:180px" placeholder="在此粘贴备份 JSON"></textarea>
      <div class="err" id="imErr"></div>
      <button class="btn sec" onclick="App.doImport()">导入并重启</button>
      <button class="btn ghost" onclick="App.closeModal()">取消</button></div></div>`);
  },
  doImport(){
    const el=document.getElementById('imJson'); const err=document.getElementById('imErr');
    if(!el) return;
    try{
      const d=JSON.parse(el.value);
      if(!d || !d.profile) throw new Error('格式错误');
      profile=d.profile;
      streak=d.streak || { current_streak:0, total_checkins:0, last_checkin_date:'', break_status:false, identity_points:0, main_quest_progress:0 };
      entries=Array.isArray(d.entries)? d.entries : [];
      breaklog=Array.isArray(d.breaklog)? d.breaklog : [];
      save(K.profile, profile); save(K.streak, streak); save(K.entries, entries); save(K.breaklog, breaklog);
      App.closeModal();
      S={ screen: profile.onboarding_completed?'home':'onb0', sub:0, breakReturned:false, answered:{} };
      render();
    }catch(e){ if(err) err.textContent='JSON 解析失败，请检查格式。'; }
  }
};
window.App = App;

/* ============================================================
   启动
   ============================================================ */
async function maybeSchedule(){
  if(!profile || !profile.onboarding_completed) return;
  if(load(K.notify_date, '') === todayStr()) return;
  const ok = await scheduleDaytimeInterrupt(pick(DAYTIME_EXAMPLES));
  if(ok) save(K.notify_date, todayStr());
}

async function boot(){
  await storeInit();
  profile = load(K.profile, null);
  streak  = load(K.streak, { current_streak:0, total_checkins:0, last_checkin_date:'', break_status:false, identity_points:0, main_quest_progress:0 });
  entries = load(K.entries, []);
  breaklog = load(K.breaklog, []);
  render();
  registerNotificationOpenHandler(()=>{ if(profile && profile.onboarding_completed){ S.screen='daytime'; render(); } });
  maybeSchedule();
}

boot();
