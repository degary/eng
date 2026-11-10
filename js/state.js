/* ================= 状态管理模块 =================
 * 负责：本地存储读写、宝宝档案、打卡记录、连续打卡统计
 */
const STORAGE_KEY = "english_qimeng_v2";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return {
    babyName: "宝宝",
    birth: "2024-12-02",
    scDone: {},        // date -> [scenario id]
    songDone: {},       // date -> [song id]
    assess: {},          // range -> [bool...]
    flashKnown: {},      // word -> true
    zooKnown: {},        // animal en -> true
    logs: []              // {d:date, t:type, n:name}
  };
}

let S;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  S = raw ? JSON.parse(raw) : defaultState();
} catch (e) {
  S = defaultState();
}

// Ensure all keys exist for forward compatibility
const DEFAULTS = defaultState();
for (const k in DEFAULTS) {
  if (S[k] === undefined) S[k] = DEFAULTS[k];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
}

function logActivity(type, name) {
  S.logs.unshift({ d: todayStr(), t: type, n: name });
  if (S.logs.length > 200) S.logs.length = 200;
  saveState();
}

function ageInfo() {
  const b = new Date(S.birth + "T00:00:00");
  const n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) m--;
  const days = Math.floor((n - b) / 86400000);
  return { months: m, days, years: (m / 12).toFixed(1) };
}

function fmtAge() {
  const a = ageInfo();
  return `${S.babyName} · ${a.months} 个月（约 ${a.years} 岁）· 出生日期 ${S.birth}`;
}

function activityCount(d) {
  let c = 0;
  if (S.scDone[d]) c += S.scDone[d].length;
  if (S.songDone[d]) c += S.songDone[d].length;
  if (S.logs.some(l => l.d === d && (l.t === "flash" || l.t === "zoo"))) c++;
  return c;
}

function totalChecks() {
  return S.logs.length;
}

function calcStreak() {
  const base = Math.floor(new Date(todayStr()) / 86400000);
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date((base - i) * 86400000).toISOString().slice(0, 10);
    if (activityCount(d) > 0) {
      s++;
    } else {
      if (i === 0) continue;
      break;
    }
  }
  return s;
}

function heatData() {
  let html = "";
  const base = Math.floor(new Date(todayStr()) / 86400000);
  for (let i = 27; i >= 0; i--) {
    const ts = (base - i) * 86400000;
    const d = new Date(ts).toISOString().slice(0, 10);
    const cnt = activityCount(d);
    const cls = cnt >= 3 ? "on2" : cnt > 0 ? "on1" : "";
    html += `<div class="d ${cls} ${i === 0 ? "today" : ""}">${cnt > 0 ? "●" : new Date(ts).getDate()}</div>`;
  }
  return html;
}
