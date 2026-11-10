/* ================= 主应用模块 =================
 * 负责：加载 content.json、渲染 Tab、页面切换、各页面的 UI 与交互逻辑
 */
let CONTENT = null;
let curTab = "today";

const TABS = [
  { id: "today", ico: "📅", name: "今日" },
  { id: "talk", ico: "💬", name: "亲子英语" },
  { id: "zoo", ico: "🦁", name: "动物园" },
  { id: "songs", ico: "🎵", name: "儿歌" },
  { id: "flash", ico: "🃏", name: "词卡" },
  { id: "assess", ico: "📋", name: "测评" },
  { id: "me", ico: "📈", name: "记录" }
];

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
}

function openSheet(html) {
  document.getElementById("sheet").innerHTML = html;
  document.getElementById("modal").classList.add("open");
}
function closeSheet() {
  document.getElementById("modal").classList.remove("open");
}

/* ================= 初始化 ================= */
async function initApp() {
  try {
    const res = await fetch("data/content.json");
    CONTENT = await res.json();
  } catch (e) {
    toast("内容加载失败，请检查网络或刷新页面");
    console.error(e);
    return;
  }
  document.getElementById("ageLine").textContent = fmtAge();
  renderTabbar();
  renderMain();

  document.getElementById("modal").addEventListener("click", e => {
    if (e.target.id === "modal") closeSheet();
  });
}

function renderTabbar() {
  const el = document.getElementById("tabbar");
  el.innerHTML = TABS.map(t =>
    `<button class="${t.id === curTab ? "active" : ""}" onclick="switchTab('${t.id}')">
      <span class="ico">${t.ico}</span>${t.name}
    </button>`
  ).join("");
}

function switchTab(id) {
  curTab = id;
  renderTabbar();
  renderMain();
  window.scrollTo(0, 0);
}

function renderMain() {
  const el = document.getElementById("main");
  const views = { today: vToday, talk: vTalk, zoo: vZoo, songs: vSongs, flash: vFlash, assess: vAssess, me: vMe };
  el.innerHTML = views[curTab] ? views[curTab]() : "";
  if (curTab === "flash") initFlash();
}

/* ================= 今日页 ================= */
function vToday() {
  const td = todayStr();
  const dayIdx = Math.floor(new Date(td) / 86400000);
  const scenarios = CONTENT.scenarios;
  const songs = CONTENT.songs;
  const vocab = CONTENT.vocab;

  const sc = scenarios[dayIdx % scenarios.length];
  const s1 = songs[dayIdx % songs.length];
  const s2 = songs[(dayIdx + 7) % songs.length];
  const vc = vocab[dayIdx % vocab.length];
  const zooAnimal = CONTENT.zoo.animals[dayIdx % CONTENT.zoo.animals.length];

  const scd = (S.scDone[td] || []).includes(sc.id);
  const s1d = (S.songDone[td] || []).includes(s1.id);
  const s2d = (S.songDone[td] || []).includes(s2.id);
  const fd = !!S.flashKnown[vc.words[0][0] + "_" + td];
  const zd = !!S.zooKnown[zooAnimal.en + "_" + td];

  const tasks = [
    { done: scd, em: sc.icon, t: "亲子场景：" + sc.title, d: "学会几句并运用到今天的日常里", go: "talk" },
    { done: s1d, em: s1.icon, t: "儿歌磨耳朵：" + s1.t, d: "唱一遍 + 跟读发音", go: "songs" },
    { done: s2d, em: s2.icon, t: "儿歌复习：" + s2.t, d: "复习上周的儿歌", go: "songs" },
    { done: zd, em: zooAnimal.icon, t: "认识新动物：" + zooAnimal.en, d: zooAnimal.sentence, go: "zoo" },
    { done: fd, em: vc.icon, t: "词卡时间：" + vc.cat, d: "认识几个新词，点点卡片听发音", go: "flash" }
  ];

  const doneN = tasks.filter(t => t.done).length;
  const heat = heatData();
  const streak = calcStreak();

  return `
  <div class="card">
    <h2>🎯 今日启蒙计划 <span class="tag">${doneN}/${tasks.length} 完成</span></h2>
    <div class="progress"><i style="width:${tasks.length ? (doneN / tasks.length * 100) : 0}%"></i></div>
    ${tasks.map(t => `
      <div class="plan-item ${t.done ? "done" : ""}" onclick="switchTab('${t.go}')">
        <span class="em">${t.em}</span>
        <div><div class="t">${t.t}</div><div class="d">${t.d}</div></div>
        <span class="go">${t.done ? "✓" : "›"}</span>
      </div>`).join("")}
  </div>
  <div class="card">
    <h2>💡 今日启蒙小贴士</h2>
    <div class="tip-box">${sc.tip}</div>
  </div>
  <div class="stat-row">
    <div class="stat"><b>${streak}</b><span>连续打卡(天)</span></div>
    <div class="stat"><b>${totalChecks()}</b><span>累计打卡(次)</span></div>
    <div class="stat"><b>${Object.keys(S.flashKnown).filter(k => !k.includes("_")).length}</b><span>已掌握词汇</span></div>
  </div>
  <div class="card">
    <h2>🔥 最近 28 天打卡</h2>
    <div class="heat">${heat}</div>
  </div>`;
}

/* ================= 亲子场景英语 ================= */
function vTalk() {
  const scenarios = CONTENT.scenarios;
  return `<div class="card">
    <h2>💬 亲子场景英语 <span class="tag">${scenarios.length} 个高频场景</span></h2>
    <p class="muted">点开场景，跟着句子在生活中说出来。点 🔊 可以听发音。每天一个场景就够，重复最重要！</p>
    <div class="sc-grid">
      ${scenarios.map(s => `<div class="sc-tile" onclick="openScenario('${s.id}')">
        <div class="em">${s.icon}</div><div class="t">${s.title}</div>
        <div class="s">${(S.scDone[todayStr()] || []).includes(s.id) ? "✅ 今天已练" : "共 " + s.phrases.length + " 句"}</div>
      </div>`).join("")}
    </div>
  </div>`;
}

function openScenario(id) {
  const s = CONTENT.scenarios.find(x => x.id === id);
  if (!s) return;
  openSheet(`
    <div class="sheet-head"><h3>${s.icon} ${s.title}</h3><button class="close-x" onclick="closeSheet()">✕</button></div>
    <div class="tip-box">💡 ${s.tip}</div>
    ${s.phrases.map((p, j) => `
      <div class="phrase">
        <div class="num">${j + 1}</div>
        <div><div class="en">${p.en}</div><div class="cn">${p.cn}</div></div>
        <button class="sp" onclick="speak('${escapeJs(p.en)}',0.8)">🔊</button>
      </div>`).join("")}
    <h3 style="margin-top:16px;font-size:15px">🔑 本场景关键词</h3>
    <div style="margin-top:8px">${s.words.map(w => `<span class="chip">${w.w} · ${w.cn}</span>`).join("")}</div>
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn btn-primary" style="flex:1" onclick="markScenario('${s.id}')">✅ 完成今天练习</button>
      <button class="btn btn-soft" onclick="speak('${escapeJs(s.phrases.map(p => p.en).join(" "))}',0.75)">▶ 朗读全部</button>
    </div>
  `);
}

function markScenario(id) {
  const td = todayStr();
  if (!S.scDone[td]) S.scDone[td] = [];
  if (!S.scDone[td].includes(id)) {
    S.scDone[td].push(id);
    const s = CONTENT.scenarios.find(x => x.id === id);
    logActivity("scenario", s ? s.title : id);
    saveState();
    toast("打卡成功！记得到生活里用起来 🎉");
    renderMain();
  } else {
    toast("今天这个场景已经打过卡啦");
  }
}

/* ================= 动物园专题 ================= */
let zooSection = "zoo"; // "zoo" | "outdoor"
function vZoo() {
  const data = zooSection === "zoo" ? CONTENT.zoo : CONTENT.zoo.outdoor;
  const title = zooSection === "zoo" ? CONTENT.zoo.title : CONTENT.zoo.outdoor.title;
  const intro = zooSection === "zoo" ? CONTENT.zoo.intro : CONTENT.zoo.outdoor.intro;
  const animals = data.animals;

  return `<div class="card">
    <h2>${title}</h2>
    <p class="muted">${intro}</p>
    <div class="lv-filter" style="margin-top:10px">
      <button class="${zooSection === "zoo" ? "on" : ""}" onclick="zooSection='zoo';renderMain()">🦁 动物园</button>
      <button class="${zooSection === "outdoor" ? "on" : ""}" onclick="zooSection='outdoor';renderMain()">🐦 路上的动物</button>
    </div>
    <div class="zoo-grid">
      ${animals.map(a => `
        <div class="zoo-tile" onclick="openZooAnimal('${zooSection}','${a.en}')">
          <div class="em">${a.icon}</div>
          <div class="en">${a.en}${S.zooKnown[a.en] ? " ✓" : ""}</div>
          <div class="cn">${a.cn}</div>
        </div>`).join("")}
    </div>
  </div>`;
}

function openZooAnimal(section, en) {
  const data = section === "zoo" ? CONTENT.zoo : CONTENT.zoo.outdoor;
  const a = data.animals.find(x => x.en === en);
  if (!a) return;
  openSheet(`
    <div class="sheet-head"><h3>${a.icon} ${a.en}</h3><button class="close-x" onclick="closeSheet()">✕</button></div>
    <p class="muted">${a.cn}</p>
    <div class="phrase">
      <div><div class="en">${a.sentence}</div>${a.sound ? `<div class="cn">拟声词：${a.sound}</div>` : ""}</div>
      <button class="sp" onclick="speak('${escapeJs(a.sentence)}',0.8)">🔊</button>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn btn-accent" style="flex:1" onclick="speak('${escapeJs(a.en)}',0.8)">🔊 听单词发音</button>
      <button class="btn btn-primary" style="flex:1" onclick="markZooKnown('${a.en}')">✓ 认识这个动物</button>
    </div>
  `);
}

function markZooKnown(en) {
  const td = todayStr();
  S.zooKnown[en] = true;
  S.zooKnown[en + "_" + td] = true;
  if (!S.logs.some(l => l.d === td && l.t === "zoo")) logActivity("zoo", "动物园学习");
  saveState();
  toast("记住啦！🐾");
  renderMain();
}

/* ================= 儿歌 ================= */
let openSong = null;
function vSongs() {
  const td = todayStr();
  const songs = CONTENT.songs;
  if (openSong !== null) {
    const s = songs.find(x => x.id === openSong);
    if (!s) { openSong = null; }
    else {
      const done = (S.songDone[td] || []).includes(s.id);
      return `<div class="card">
        <h2>${s.icon} ${s.t}</h2>
        <p class="muted">${s.d} · 建议每天 2-3 遍，配合动作跟唱效果最好${s.slow ? " · 适合放慢速度唱" : ""}</p>
        <div class="lyrics">
          ${s.lyrics.map(l => `<div class="line"><div>${l[0]}<span class="cn">${l[1]}</span></div><button class="play" onclick="speak('${escapeJs(l[0])}',${s.slow ? 0.7 : 0.9})">🔊</button></div>`).join("")}
        </div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn ${done ? "btn-ghost" : "btn-primary"}" style="flex:1" onclick="markSong('${s.id}')">${done ? "✅ 今天已打卡" : "🎵 完成跟唱打卡"}</button>
          <button class="btn btn-soft" onclick="speak('${escapeJs(s.lyrics.map(l => l[0]).join(" "))}',${s.slow ? 0.7 : 0.9})">▶ 连续朗读</button>
        </div>
        <button class="btn btn-ghost" style="width:100%;margin-top:10px" onclick="openSong=null;renderMain()">← 返回儿歌列表</button>
      </div>`;
    }
  }
  return `<div class="card">
    <h2>🎵 英文儿歌库 <span class="tag">${songs.length} 首经典</span></h2>
    <p class="muted">磨耳朵核心是重复加互动：一首歌连续唱一周，比一天换十首效果好得多。点歌进去看歌词，点 🔊 逐句听发音。</p>
    ${songs.map(s => `
      <div class="song-tile" onclick="openSong='${s.id}';renderMain();window.scrollTo(0,0)">
        <span class="em">${s.icon}</span>
        <div><div class="t">${s.t}</div><div class="d">${s.d}</div></div>
        <span style="margin-left:auto;color:var(--sub)">›</span>
      </div>`).join("")}
  </div>`;
}

function markSong(id) {
  const td = todayStr();
  if (!S.songDone[td]) S.songDone[td] = [];
  if (!S.songDone[td].includes(id)) {
    S.songDone[td].push(id);
    const s = CONTENT.songs.find(x => x.id === id);
    logActivity("song", s ? s.t : id);
    saveState();
    toast("儿歌打卡成功 🎶");
    renderMain();
  } else {
    toast("今天这首歌已经打过卡啦");
  }
}

/* ================= 词卡 ================= */
let flashCat = 0, flashIdx = 0, flashShowCn = false;
function vFlash() {
  const vocab = CONTENT.vocab;
  const c = vocab[flashCat];
  const word = c.words[flashIdx][0];
  return `<div class="card">
    <h2>🃏 词汇闪卡 <span class="tag">点卡片翻面</span></h2>
    <p class="muted">先听音看图，再看中文。每天几个新词加复习昨天的，量不必多。</p>
    <div class="cat-chips" style="margin-top:12px">
      ${vocab.map((v, i) => `<button class="${i === flashCat ? "on" : ""}" onclick="flashCat=${i};flashIdx=0;flashShowCn=false;renderMain()">${v.icon} ${v.cat.split(" ")[0]}</button>`).join("")}
    </div>
    <div class="flash" onclick="flashShowCn=!flashShowCn;renderMain()">
      <img class="fimg" src="images/vocab/${encodeURIComponent(word)}.svg" alt="${word}" onerror="this.style.display='none'">
      ${flashShowCn
        ? `<div class="fc">${c.words[flashIdx][1]}</div>`
        : `<div class="fw">${word}</div>`}
      <div class="hint">点按翻面 · 点下方喇叭听发音</div>
    </div>
    <div style="text-align:center;margin-top:10px"><button class="btn btn-accent" onclick="speak('${escapeJs(c.words[flashIdx][0])}',0.8)">🔊 听发音</button></div>
    <div class="flash-ops">
      <button class="btn btn-ghost" onclick="flashIdx=(flashIdx-1+${c.words.length})%${c.words.length};flashShowCn=false;renderMain()">← 上一个</button>
      <button class="btn btn-primary" onclick="knowWord('${escapeJs(c.words[flashIdx][0])}')">✓ 会了</button>
      <button class="btn btn-ghost" onclick="flashIdx=(flashIdx+1)%${c.words.length};flashShowCn=false;renderMain()">下一个 →</button>
    </div>
    <p class="muted" style="margin-top:12px">本组已掌握：${c.words.filter(w => S.flashKnown[w[0]]).length} / ${c.words.length}</p>
  </div>`;
}

function initFlash() {
  const vocab = CONTENT.vocab;
  speak(vocab[flashCat].words[flashIdx][0], 0.8);
}

function knowWord(w) {
  S.flashKnown[w] = true;
  const td = todayStr();
  if (!S.logs.some(l => l.d === td && l.t === "flash")) logActivity("flash", "词卡学习");
  saveState();
  const vocab = CONTENT.vocab;
  flashIdx = (flashIdx + 1) % vocab[flashCat].words.length;
  flashShowCn = false;
  renderMain();
}

/* ================= 测评 ================= */
function vAssess() {
  const a = ageInfo();
  const assess = CONTENT.assess;
  return `<div class="card">
    <h2>📋 英语发展测评 <span class="tag">按月龄对照</span></h2>
    <p class="muted">根据观察勾选宝宝能做到的项目。语言发展个体差异大，测评只做参考，重点是持续输入，不必焦虑。</p>
    ${assess.map((g, gi) => {
      const saved = S.assess[g.range] || [];
      const score = saved.filter(Boolean).length;
      const cur = a.months >= g.min && a.months <= g.max;
      return `<div style="margin-top:16px">
        <h3 style="font-size:15px">${cur ? "📍 当前月龄：" : ""}${g.range} <span class="muted" style="font-size:12px">${score}/${g.items.length}</span></h3>
        ${g.items.map((it, ii) => `
          <div class="q-item ${saved[ii] ? "on" : ""}" onclick="toggleAssess(${gi},${ii})">
            <div class="box">${saved[ii] ? "✓" : ""}</div>
            <div class="qt">${it}</div>
          </div>`).join("")}
        ${g.items.every((_, ii) => saved[ii] !== undefined) ? assessResult(g, score) : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function assessResult(g, score) {
  const pct = score / g.items.length;
  let txt;
  if (pct >= 0.7) txt = "宝宝目前的英语接受能力发展得很好，保持每日输入节奏，可以开始加入更多绘本和简单问答互动。";
  else if (pct >= 0.4) txt = "发展正常，处于爬坡期。建议增加日常场景英语的重复度（每天同一场景说同样的句子），儿歌配动作一起玩。";
  else txt = "不用担心，每个孩子节奏不同。现在最重要的是磨耳朵：每天固定时间放儿歌、听场景句子，先保证量，输出自然会来。";
  return `<div class="res-band" style="background:${pct >= 0.7 ? "var(--accent-soft)" : pct >= 0.4 ? "var(--yellow-soft)" : "var(--blue-soft)"}">
    <b>参考结果（${score}/${g.items.length}）</b><br>${txt}
  </div>`;
}

function toggleAssess(gi, ii) {
  const g = CONTENT.assess[gi];
  if (!S.assess[g.range]) S.assess[g.range] = [];
  S.assess[g.range][ii] = !S.assess[g.range][ii];
  saveState();
  renderMain();
}

/* ================= 记录页 ================= */
function vMe() {
  const vocabAll = CONTENT.vocab.reduce((s, v) => s + v.words.length, 0);
  const knownN = Object.keys(S.flashKnown).filter(k => !k.includes("_")).length;
  const zooAll = CONTENT.zoo.animals.length + CONTENT.zoo.outdoor.animals.length;
  const zooKnownN = Object.keys(S.zooKnown).filter(k => !k.includes("_")).length;

  return `
  <div class="card">
    <h2>📈 启蒙总览</h2>
    <div class="stat-row">
      <div class="stat"><b>${calcStreak()}</b><span>连续打卡</span></div>
      <div class="stat"><b>${knownN}/${vocabAll}</b><span>词卡掌握</span></div>
      <div class="stat"><b>${zooKnownN}/${zooAll}</b><span>动物认识</span></div>
    </div>
  </div>
  <div class="card">
    <h2>🗓 最近打卡动态</h2>
    ${S.logs.length ? S.logs.slice(0, 30).map(l => `<div class="log-line"><span>${typeIcon(l.t)} ${l.n}</span><span>${l.d}</span></div>`).join("") : `<div class="empty">还没有记录，去开始第一次打卡吧！</div>`}
  </div>
  <div class="card">
    <h2>⚙️ 宝宝档案</h2>
    <div class="form-row"><label>宝宝昵称</label><input id="st-name" value="${S.babyName}"></div>
    <div class="form-row"><label>出生日期</label><input id="st-birth" type="date" value="${S.birth}"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="saveProfile()">保存</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:10px" onclick="resetAllData()">清空全部数据</button>
  </div>
  <div class="card">
    <h2>📖 启蒙理念速查</h2>
    <div class="tip-box" style="margin-top:0">
      <b>① 输入先行</b>：2 岁前不逼输出，大量听（儿歌+日常对话）是根。<br><br>
      <b>② 重复为王</b>：一首儿歌唱一周，胜过一天换十个新的。<br><br>
      <b>③ 情境绑定</b>：英语跟着生活场景走（吃饭就说吃饭的英语），不用坐下来上课。<br><br>
      <b>④ 不翻译不考问</b>：指着实物直接说英文，让英语和实物直接挂钩。<br><br>
      <b>⑤ 家长口音不重要</b>：发音不标准没关系，配合儿歌原声输入即可。<br><br>
      <b>⑥ 每天 15 分钟就够</b>：坚持比时长重要。
    </div>
  </div>`;
}

function typeIcon(t) {
  return { scenario: "💬", song: "🎵", flash: "🃏", zoo: "🦁" }[t] || "⭐";
}

function saveProfile() {
  S.babyName = document.getElementById("st-name").value.trim() || "宝宝";
  S.birth = document.getElementById("st-birth").value || S.birth;
  saveState();
  document.getElementById("ageLine").textContent = fmtAge();
  toast("已保存");
  renderMain();
}

function resetAllData() {
  if (confirm("确定清空所有打卡记录吗？此操作不可恢复。")) {
    S = defaultState();
    saveState();
    renderMain();
  }
}

/* ================= 工具函数 ================= */
function escapeJs(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ");
}

/* ================= 启动 ================= */
initApp();
