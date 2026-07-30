/* ===== 石榴学习屋 app.js ===== */
"use strict";

const TODAY = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

let DB = {};
let SEC = "home";
let managing = false;
let KID = localStorage.getItem("shiliu_kid") === "1";

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

/* ---------- 数据读写 ----------
 * 双模式：
 * - 本地模式（电脑上跑 server.py，127.0.0.1/192.168.x/10.x）：读 data/*.json，写 /api/save。
 * - 云端/独立模式（部署到静态托管，如 CloudStudio）：数据存浏览器 localStorage，
 *   首次打开用打包的 data/*.json 做种子；之后所有读写都在手机本地，不依赖电脑。
 */
const STANDALONE = !/^(127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname) || !!window.__EMBEDDED__;
const LS_PREFIX = "shiliu_db_";

function loadJSON(name) {
  const emb = window.__EMBEDDED__;
  if (emb && emb[name]) {
    const cached = localStorage.getItem(LS_PREFIX + name);
    if (cached) {
      try { return Promise.resolve(JSON.parse(cached)); } catch (e) { /* 损坏则回退种子 */ }
    }
    return Promise.resolve(JSON.parse(JSON.stringify(emb[name]))); // 深拷贝种子，避免污染
  }
  if (STANDALONE) {
    const cached = localStorage.getItem(LS_PREFIX + name);
    if (cached) {
      try { return Promise.resolve(JSON.parse(cached)); } catch (e) { /* 损坏则回退种子 */ }
    }
  }
  return fetch(`data/${name}.json?t=${Date.now()}`).then((r) => r.json());
}
function apiSave(name, data) {
  if (STANDALONE) {
    try {
      localStorage.setItem(LS_PREFIX + name, JSON.stringify(data));
      return Promise.resolve({ ok: true });
    } catch (e) {
      toast("⚠️ 保存失败：存储空间不足");
      return Promise.resolve({ ok: false });
    }
  }
  return fetch(`/api/save?name=${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
}

/* 独立模式：导出/导入全部数据（备份用） */
const DB_NAMES = ["tasks", "points", "gifts", "garden", "calendar", "handbook", "challenge30", "knowledge", "settings"];
function exportData() {
  const dump = { _app: "石榴学习屋", _exportedAt: new Date().toISOString() };
  DB_NAMES.forEach((n) => { if (DB[n]) dump[n] = DB[n]; });
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `石榴学习屋备份_${TODAY}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("📦 备份文件已导出");
}
function importData(file) {
  const fr = new FileReader();
  fr.onload = async () => {
    try {
      const dump = JSON.parse(fr.result);
      if (dump._app !== "石榴学习屋") { toast("⚠️ 不是石榴学习屋的备份文件"); return; }
      let n = 0;
      for (const name of DB_NAMES) {
        if (dump[name]) { DB[name] = dump[name]; await apiSave(name, dump[name]); n++; }
      }
      applyName();
      render();
      toast(`✅ 已恢复 ${n} 项数据`);
    } catch (e) {
      toast("⚠️ 备份文件读取失败");
    }
  };
  fr.readAsText(file);
}
async function loadAll() {
  const names = ["tasks", "points", "gifts", "garden", "calendar", "handbook", "challenge30", "knowledge"];
  const res = await Promise.all(names.map(loadJSON));
  names.forEach((n, i) => (DB[n] = res[i]));
  try {
    DB.settings = await loadJSON("settings");
  } catch (e) {
    DB.settings = { childName: "石榴" };
  }
}

/* 孩子昵称（可在 ⚙️ 设置中修改） */
const NAME = () => (DB.settings && DB.settings.childName) || "石榴";

function applyName() {
  const n = NAME();
  document.title = `${n}学习屋 🍎`;
  const bn = $("#brandName");
  if (bn) bn.innerHTML = `${esc(n)}<small>学习屋</small>`;
}

/* ---------- 工具 ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}
function uid(prefix) {
  return prefix + Date.now().toString(36);
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function doneToday(taskId) {
  return DB.tasks.checkins.some((c) => c.date === TODAY && c.taskId === taskId);
}

/* ---------- 撒花 & 连续打卡 ---------- */
function confetti() {
  const emojis = ["🌞", "🌟", "🎉", "🌸", "💛", "✨"];
  for (let i = 0; i < 24; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    c.style.left = Math.random() * 100 + "vw";
    c.style.fontSize = 14 + Math.random() * 16 + "px";
    c.style.animationDelay = Math.random() * 0.25 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1600);
  }
}

function computeStreak() {
  let streak = 0;
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const map = {};
  DB.calendar.days.forEach((x) => (map[x.date] = x));
  for (;;) {
    const ds = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const rec = map[ds];
    if (rec && rec.missed === 0 && rec.doneTasks > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

/* ---------- 导航 ---------- */
function updateNav() {
  const daily = DB.tasks.tasks.filter((t) => t.active && t.repeat === "daily");
  const done = daily.filter((t) => doneToday(t.id)).length;
  $("#cnt-tasks").textContent = `${done}/${daily.length}`;
  $("#cnt-bank").textContent = DB.points.total;
  if (DB.handbook) {
    const hb = hbAllItems();
    $("#cnt-handbook").textContent = `${hb.filter((i) => i.done).length}/${hb.length}`;
  }
  if (DB.challenge30) {
    const ch = chAllDays();
    $("#cnt-challenge").textContent = `${ch.filter((d) => d.done).length}/${ch.length}`;
  }
  if (DB.knowledge) {
    const kb = kbAllCards();
    $("#cnt-knowledge").textContent = `${kb.filter((i) => i.learned).length}/${kb.length}`;
  }
  const z = DB.garden.zombies[0];
  $("#cnt-garden").textContent = z ? `${z.progress}%` : "";
}

function secMeta() {
  const today = new Date();
  const weekDay = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][today.getDay()];
  const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日 ${weekDay}`;
  return {
    home: ["首页", `${dateStr} · 今天也要加油呀 ☀️`],
    tasks: ["今日任务", `${NAME()}的每日小任务`],
    bank: ["阳光银行 & 礼物商城", "攒阳光值，换喜欢的礼物 🎁"],
    garden: ["植物园", `别让僵尸吃掉${NAME()}的小植物！🧟`],
    handbook: ["暑假见世面行动手册", "40 件家门口就能做的生活探索小事 🌏"],
    challenge: ["暑假 30 天亲子打卡挑战", "陪孩子完成一个有趣、有记录、有成长的暑假 🗓"],
    calendar: ["成长日历", "每一天都在进步 🌱"],
    knowledge: ["知识百宝箱", "每天拆开一个为什么 💡"],
  };
}

function render() {
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.sec === SEC)
  );
  const meta = secMeta();
  $("#sec-title").textContent = meta[SEC][0];
  $("#sec-sub").textContent = meta[SEC][1];
  const c = $("#content");
  c.innerHTML = "";
  if (SEC === "home") renderHome(c);
  else if (SEC === "tasks") renderTasks(c);
  else if (SEC === "bank") renderBank(c);
  else if (SEC === "garden") renderGarden(c);
  else if (SEC === "handbook") renderHandbook(c);
  else if (SEC === "challenge") renderChallenge(c);
  else if (SEC === "calendar") renderCalendar(c);
  else if (SEC === "knowledge") renderKnowledge(c);
  updateNav();
}

/* ---------- 板块0：首页（总览） ---------- */
function renderHome(c) {
  // 1. Hero 区
  const daily = DB.tasks.tasks.filter((t) => t.active);
  const doneTodayN = daily.filter((t) => doneToday(t.id)).length;
  const rate = daily.length ? Math.round((doneTodayN / daily.length) * 100) : 0;
  const streak = computeStreak();
  const n = NAME();

  const hero = el("div", "home-hero");
  const heroRow = el("div", "home-hero-row");
  const heroText = el("div", "home-hero-text");
  heroText.appendChild(el("div", "home-hero-title", `${n}学习屋 · 加油哦 ☀️`));
  heroText.appendChild(el("div", "home-hero-sub",
    daily.length
      ? `今日已完成 ${doneTodayN}/${daily.length} 项任务${streak > 0 ? ` · 连续全勤 ${streak} 天 🔥` : ""}`
      : `还没有任务，去「今日任务」添加第一个吧～`
  ));
  const heroActions = el("div", "home-hero-actions");
  const goTasks = el("button", "btn primary lg");
  goTasks.innerHTML = `📅 ${doneTodayN < daily.length ? "去打卡" : "查看今日任务"}`;
  goTasks.onclick = () => { SEC = "tasks"; render(); };
  heroActions.appendChild(goTasks);
  const goBank = el("button", "btn ghost");
  goBank.innerHTML = `🎁 兑换礼物（${DB.points.total} 🌞）`;
  goBank.onclick = () => { SEC = "bank"; render(); };
  heroActions.appendChild(goBank);
  heroText.appendChild(heroActions);
  heroRow.appendChild(heroText);
  hero.appendChild(heroRow);
  c.appendChild(hero);

  // 2. 数据卡片 4 连
  const stats = el("div", "home-stats");
  const hbDone = DB.handbook ? hbAllItems().filter((i) => i.done).length : 0;
  const hbTotal = DB.handbook ? hbAllItems().length : 0;
  const chDone = DB.challenge30 ? chAllDays().filter((d) => d.done).length : 0;
  const chTotal = DB.challenge30 ? chAllDays().length : 0;
  const kbDone = DB.knowledge ? kbAllCards().filter((i) => i.learned).length : 0;
  const kbTotal = DB.knowledge ? kbAllCards().length : 0;
  stats.appendChild(makeStat("📅", "今日任务", `${doneTodayN}/${daily.length}`, `${rate}% 完成率`, "sun"));
  stats.appendChild(makeStat("🔥", "连续全勤", `${streak} 天`, streak >= 7 ? "🏆 太棒了" : "再接再厉", "green"));
  stats.appendChild(makeStat("🌞", "阳光值", `${DB.points.total}`, `已累计`, "purple"));
  stats.appendChild(makeStat("📚", "见世面+挑战+知识", `${hbDone + chDone + kbDone}/${hbTotal + chTotal + kbTotal}`, `探索打卡`, "blue"));
  c.appendChild(stats);

  // 3. 今日任务卡片网格
  const secTasks = el("div", "section");
  const secHeadT = el("div", "section-head");
  secHeadT.appendChild(el("div", "section-title", "📅 今日任务"));
  const sp = el("div", "spacer"); secHeadT.appendChild(sp);
  const more = el("span", "more", "查看全部 →");
  more.onclick = () => { SEC = "tasks"; render(); };
  secHeadT.appendChild(more);
  secTasks.appendChild(secHeadT);

  if (daily.length === 0) {
    secTasks.appendChild(el("div", "empty", "还没有任务，点「今日任务」→ 「➕ 添加任务」建一个吧～"));
  } else {
    const grid = el("div", "task-grid");
    daily.forEach((t) => {
      const isDone = doneToday(t.id);
      const card = el("div", "task" + (isDone ? " done" : ""));
      const top = el("div", "t-top");
      top.appendChild(el("span", "t-ico", t.icon || "📌"));
      top.appendChild(el("span", "t-title", esc(t.title)));
      card.appendChild(top);
      const meta = el("div", "row");
      meta.appendChild(el("span", "t-cat", esc(t.category)));
      meta.appendChild(el("span", "t-pts", `+${t.points} 🌞`));
      card.appendChild(meta);
      if (isDone) {
        card.appendChild(el("div", "done-badge", "🌟 今天已完成"));
      } else {
        const btn = el("button", "btn primary", "✅ 打卡");
        btn.onclick = () => checkIn(t.id);
        card.appendChild(btn);
      }
      grid.appendChild(card);
    });
    secTasks.appendChild(grid);
  }
  c.appendChild(secTasks);

  // 4. 板块快捷入口
  const secEntries = el("div", "section");
  const secHeadE = el("div", "section-head");
  secHeadE.appendChild(el("div", "section-title", "🧭 全部板块"));
  secEntries.appendChild(secHeadE);
  const grid = el("div", "entry-grid");
  const entries = [
    { sec: "garden", ico: "🌻", name: "植物园", cls: "green", desc: "每天结束结算，保卫小植物", extra: () => `${DB.garden.zombies[0]?.progress ?? 0}% 僵尸逼近` },
    { sec: "handbook", ico: "🌏", name: "见世面", cls: "blue", desc: "40 件家门口就能做的探索小事", extra: () => DB.handbook ? `${hbDone}/${hbTotal}` : "" },
    { sec: "challenge", ico: "🗓", name: "30天挑战", cls: "purple", desc: "5 周亲子打卡，见证成长", extra: () => DB.challenge30 ? `${chDone}/${chTotal}` : "" },
    { sec: "knowledge", ico: "📚", name: "知识库", cls: "pink", desc: "6 大主题，每天学一个为什么", extra: () => DB.knowledge ? `${kbDone}/${kbTotal}` : "" },
    { sec: "bank", ico: "💰", name: "阳光银行", cls: "sun", desc: "兑换礼物，看阳光值流水", extra: () => `${DB.points.total} 🌞` },
    { sec: "calendar", ico: "📈", name: "成长日历", cls: "sun", desc: "月历打卡视图 + 里程碑", extra: () => "" },
  ];
  entries.forEach((e) => {
    const node = el("div", "entry");
    const top = el("div", "entry-top");
    top.appendChild(el("span", `entry-ico stat-icon ${e.cls}`, e.ico));
    top.appendChild(el("span", "entry-name", e.name));
    const extraText = e.extra();
    if (extraText) top.appendChild(el("span", "entry-extra", extraText));
    node.appendChild(top);
    node.appendChild(el("div", "entry-desc", e.desc));
    node.onclick = () => { SEC = e.sec; render(); };
    grid.appendChild(node);
  });
  secEntries.appendChild(grid);
  c.appendChild(secEntries);
}

function makeStat(ico, label, value, extra, color) {
  const card = el("div", "stat");
  card.appendChild(el("span", `stat-icon ${color}`, ico));
  const info = el("div", "stat-info");
  info.appendChild(el("div", "stat-label", label));
  info.appendChild(el("div", "stat-value", value));
  info.appendChild(el("div", "stat-extra", extra));
  card.appendChild(info);
  return card;
}

/* ---------- 板块1：今日任务 ---------- */
function renderTasks(c) {
  const daily = DB.tasks.tasks.filter((t) => t.active);
  const done = daily.filter((t) => doneToday(t.id)).length;

  const head = el("div", "sec-head");
  head.appendChild(el("div", "progress-pill", `✅ 今日 ${done}/${daily.length}`));
  const streak = computeStreak();
  if (streak > 0) {
    head.appendChild(el("div", "progress-pill streak", `🔥 连续全勤 ${streak} 天`));
  }
  const sp = el("div", "spacer");
  head.appendChild(sp);
  const addBtn = el("button", "btn sun sm manage-only", "➕ 添加任务");
  addBtn.onclick = addTaskModal;
  head.appendChild(addBtn);
  const mBtn = el("button", "btn ghost sm manage-only", managing ? "完成管理" : "✏️ 管理");
  mBtn.onclick = () => {
    managing = !managing;
    render();
  };
  head.appendChild(mBtn);
  c.appendChild(head);

  if (daily.length === 0) {
    c.appendChild(el("div", "empty", "还没有任务，点「➕ 添加任务」加一个吧～"));
    return;
  }

  const grid = el("div", "task-grid" + (managing ? " manage" : ""));
  daily.forEach((t) => {
    const isDone = doneToday(t.id);
    const card = el("div", "task" + (isDone ? " done" : ""));
    const top = el("div", "t-top");
    top.appendChild(el("span", "t-ico", t.icon || "📌"));
    top.appendChild(el("span", "t-title", esc(t.title)));
    card.appendChild(top);

    const meta = el("div", "row");
    meta.appendChild(el("span", "t-cat", esc(t.category)));
    meta.appendChild(el("span", "t-pts", `+${t.points} 🌞`));
    card.appendChild(meta);

    if (isDone) {
      card.appendChild(el("div", "done-badge", "🌟 今天已完成"));
    } else {
      const btn = el("button", "btn primary", "✅ 打卡");
      btn.onclick = () => checkIn(t.id);
      card.appendChild(btn);
    }

    if (managing) {
      const del = el("button", "del manage-only", "🗑");
      del.title = "删除任务";
      del.onclick = () => deleteTask(t.id);
      card.appendChild(del);
    }
    grid.appendChild(card);
  });
  c.appendChild(grid);
}

async function checkIn(taskId) {
  const t = DB.tasks.tasks.find((x) => x.id === taskId);
  if (!t) return;
  if (doneToday(taskId)) {
    toast("今天已经打卡啦~ 🌞");
    return;
  }
  DB.tasks.checkins.push({
    id: uid("C"),
    date: TODAY,
    taskId,
    doneAt: new Date().toISOString(),
    points: t.points,
  });
  DB.points.total += t.points;
  DB.points.log.unshift({ date: TODAY, type: "earn", amount: t.points, reason: `完成 ${t.title}`, ref: taskId });
  DB.garden.zombies.forEach((z) => (z.progress = Math.max(0, z.progress - 5)));
  await Promise.all([apiSave("tasks", DB.tasks), apiSave("points", DB.points), apiSave("garden", DB.garden)]);
  confetti();
  toast(`🌞 +${t.points} 阳光值！${NAME()}真棒！`);
  render();
}

async function deleteTask(taskId) {
  DB.tasks.tasks = DB.tasks.tasks.filter((t) => t.id !== taskId);
  DB.tasks.checkins = DB.tasks.checkins.filter((c) => c.taskId !== taskId);
  await apiSave("tasks", DB.tasks);
  toast("🗑 已删除");
  render();
}

function addTaskModal() {
  openModal(
    "➕ 添加任务",
    `<label>任务名称<input id="f_title" placeholder="如：背一首古诗"></label>
     <label>分类<select id="f_cat"><option>语文</option><option>数学</option><option>阅读</option><option>运动</option><option>习惯</option><option>其他</option></select></label>
     <label>阳光值<input id="f_pts" type="number" value="10" min="1"></label>
     <label>图标<select id="f_icon">
       <option>📖</option><option>🔢</option><option>📚</option><option>⚽</option><option>🎒</option>
       <option>✏️</option><option>🎨</option><option>🎹</option><option>🧩</option><option>🌟</option><option>💡</option>
     </select></label>`,
    async () => {
      const title = $("#f_title").value.trim();
      if (!title) return false;
      DB.tasks.tasks.push({
        id: uid("T"),
        title,
        category: $("#f_cat").value,
        points: Math.max(1, parseInt($("#f_pts").value, 10) || 10),
        icon: $("#f_icon").value,
        repeat: "daily",
        active: true,
      });
      await apiSave("tasks", DB.tasks);
      toast("✅ 任务已添加");
      render();
    }
  );
}

/* ---------- 板块2：阳光银行 & 礼物商城 ---------- */
function renderBank(c) {
  const grid = el("div", "bank-grid");

  // 左：阳光值大数字
  const box = el("div", "card bank-box");
  box.appendChild(el("div", "piggy", "🐷"));
  box.appendChild(el("div", "bank-num", `${DB.points.total} <small>阳光值</small>`));
  box.appendChild(el("div", "bank-sub", "打卡赚阳光，兑换小礼物"));
  const addGift = el("button", "btn pink sm manage-only", "➕ 添加礼物");
  addGift.style.marginTop = "14px";
  addGift.onclick = addGiftModal;
  box.appendChild(addGift);
  grid.appendChild(box);

  // 右：礼物墙 + 兑换记录
  const right = el("div");
  right.appendChild(el("div", "blk-title", "🎁 礼物商城"));
  const wall = el("div", "gift-wall");
  DB.gifts.gifts.forEach((g) => {
    const locked = DB.points.total < g.cost;
    const card = el("div", "gift" + (locked ? " locked" : " afford"));
    card.appendChild(el("div", "g-ico", g.icon || "🎁"));
    card.appendChild(el("div", "g-name", esc(g.name)));
    card.appendChild(el("div", "g-desc", esc(g.desc || "")));
    const costRow = el("div", "g-cost-row");
    costRow.appendChild(el("span", "g-need", locked ? `还差 ${g.cost - DB.points.total} 阳光` : "✅ 可直接兑换"));
    costRow.appendChild(el("div", "g-cost", `${g.cost} 🌞`));
    card.appendChild(costRow);
    const prog = el("div", "gift-prog");
    const fill = el("div", "gift-prog-fill");
    fill.style.width = Math.min(100, Math.round((DB.points.total / g.cost) * 100)) + "%";
    prog.appendChild(fill);
    card.appendChild(prog);
    const btn = el("button", "btn " + (locked ? "ghost" : "sun") + " sm g-btn", locked ? "还差一点" : "🎉 兑换");
    btn.disabled = locked;
    btn.onclick = () => redeem(g.id);
    card.appendChild(btn);
    wall.appendChild(card);
  });
  right.appendChild(wall);

  // 兑换记录
  if (DB.gifts.redeems.length) {
    right.appendChild(el("div", "blk-title", "📝 兑换记录"));
    const list = el("div", "log-list");
    DB.gifts.redeems.slice(0, 12).forEach((r) => {
      const item = el("div", "redeem-item");
      item.appendChild(el("span", null, `${r.name} · ${r.cost}🌞`));
      const st = el("span", "st " + (r.status === "已兑现" ? "done" : "wait"), r.status);
      if (r.status !== "已兑现") {
        const done = el("button", "btn primary sm manage-only", "✅ 已兑现");
        done.style.marginLeft = "8px";
        done.onclick = () => markRedeemDone(r.id);
        item.appendChild(done);
      }
      item.appendChild(st);
      list.appendChild(item);
    });
    right.appendChild(list);
  }

  // 阳光流水
  if (DB.points.log.length) {
    right.appendChild(el("div", "blk-title", "🌞 阳光值流水"));
    const list = el("div", "log-list");
    DB.points.log.slice(0, 12).forEach((l) => {
      const item = el("div", "log-item");
      item.appendChild(el("span", null, esc(l.reason)));
      const amt = el("span", "lg-amt " + (l.type === "earn" ? "earn" : "spend"), (l.type === "earn" ? "+" : "-") + l.amount);
      item.appendChild(amt);
      list.appendChild(item);
    });
    right.appendChild(list);
  }

  grid.appendChild(right);
  c.appendChild(grid);
}

async function redeem(giftId) {
  const g = DB.gifts.gifts.find((x) => x.id === giftId);
  if (!g) return;
  if (DB.points.total < g.cost) {
    toast("阳光值还不够哦，再攒攒~ 🌱");
    return;
  }
  DB.points.total -= g.cost;
  DB.points.log.unshift({ date: TODAY, type: "spend", amount: g.cost, reason: `兑换 ${g.name}`, ref: giftId });
  DB.gifts.redeems.unshift({ id: uid("R"), giftId, name: g.name, date: TODAY, cost: g.cost, status: "待兑现" });
  await Promise.all([apiSave("points", DB.points), apiSave("gifts", DB.gifts)]);
  confetti();
  toast(`🎁 兑换成功：${g.name}！`);
  render();
}

async function markRedeemDone(redeemId) {
  const r = DB.gifts.redeems.find((x) => x.id === redeemId);
  if (r) r.status = "已兑现";
  await apiSave("gifts", DB.gifts);
  toast("✅ 已兑现");
  render();
}

function addGiftModal() {
  openModal(
    "➕ 添加礼物",
    `<label>礼物名称<input id="g_name" placeholder="如：去吃肯德基"></label>
     <label>需要阳光值<input id="g_cost" type="number" value="50" min="1"></label>
     <label>图标<select id="g_icon">
       <option>🎡</option><option>📚</option><option>🌙</option><option>🍦</option><option>🎮</option>
       <option>🍿</option><option>🧸</option><option>🍓</option><option>🚲</option><option>🎁</option>
     </select></label>
     <label>说明<input id="g_desc" placeholder="小奖励的说明"></label>`,
    async () => {
      const name = $("#g_name").value.trim();
      if (!name) return false;
      DB.gifts.gifts.push({
        id: uid("G"),
        name,
        cost: Math.max(1, parseInt($("#g_cost").value, 10) || 50),
        icon: $("#g_icon").value,
        desc: $("#g_desc").value.trim(),
      });
      await apiSave("gifts", DB.gifts);
      toast("✅ 礼物已添加");
      render();
    }
  );
}

/* ---------- 板块3：植物园（僵尸防御） ---------- */
function renderGarden(c) {
  // 战绩条
  const top = el("div", "sec-head");
  top.appendChild(el("div", "progress-pill", `🏆 已击退僵尸 ${DB.garden.victories} 次`));
  top.appendChild(el("div", "progress-pill streak", `🌱 小植物 ${DB.garden.plants.filter((p) => p.hp > 0).length}/${DB.garden.plants.length} 株健康`));
  c.appendChild(top);

  // 战斗车道
  const lane = el("div", "lane");
  lane.appendChild(el("div", "lane-title", "🛡️ 防线：植物在左，僵尸从右逼近"));
  const track = el("div", "lane-track");

  const plantPos = el("div", "plant-pos");
  DB.garden.plants.forEach((p) => {
    const fig = el("div", "plant-fig" + (p.hp <= 0 ? " withered" : ""));
    fig.appendChild(el("div", "pf-ico", p.hp <= 0 ? "🥀" : p.icon));
    fig.appendChild(el("div", "pf-name", esc(p.name)));
    const bar = el("div", "hp-bar");
    const fill = el("div", "hp-fill");
    fill.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
    bar.appendChild(fill);
    fig.appendChild(bar);
    plantPos.appendChild(fig);
  });
  track.appendChild(plantPos);

  const zPos = el("div", "zombie-pos");
  DB.garden.zombies.forEach((z) => {
    const fig = el("div", "zombie-fig");
    fig.appendChild(el("div", null, z.icon + " " + esc(z.name)));
    const prog = el("div", "z-prog");
    const fill = el("div", "z-fill");
    fill.style.width = Math.min(100, z.progress) + "%";
    prog.appendChild(fill);
    fig.appendChild(prog);
    fig.appendChild(el("div", "z-prog-txt", `进攻 ${Math.min(100, z.progress)}%`));
    zPos.appendChild(fig);
  });
  track.appendChild(zPos);
  lane.appendChild(track);
  c.appendChild(lane);

  // 种子商店
  c.appendChild(el("div", "blk-title", "🛒 种子商店 · 用阳光值种新植物"));
  const shop = el("div", "seed-wall");
  DB.garden.seeds.forEach((s) => {
    const can = DB.points.total >= s.cost;
    const seed = el("div", "seed" + (can ? "" : " locked"));
    seed.appendChild(el("div", "seed-ico", s.icon));
    seed.appendChild(el("div", "seed-name", esc(s.name)));
    seed.appendChild(el("div", "seed-role", esc(s.role)));
    seed.appendChild(el("div", "seed-desc", esc(s.desc)));
    seed.appendChild(el("div", "seed-cost", `${s.cost} 🌞`));
    const btn = el("button", "btn " + (can ? "sun" : "ghost") + " sm", can ? "🌱 种下" : "阳光不够");
    btn.disabled = !can;
    btn.onclick = () => plantSeed(s.id);
    seed.appendChild(btn);
    shop.appendChild(seed);
  });
  c.appendChild(shop);

  // 植物清单
  c.appendChild(el("div", "blk-title", `🌿 ${esc(NAME())}的小植物`));
  const pg = el("div", "plants-grid");
  DB.garden.plants.forEach((p) => {
    const card = el("div", "plant-card" + (p.hp <= 0 ? " withered" : ""));
    const ptop = el("div", "pc-top");
    ptop.appendChild(el("span", "pc-ico", p.hp <= 0 ? "🥀" : p.icon));
    ptop.appendChild(el("span", "pc-name", esc(p.name)));
    ptop.appendChild(el("span", "pc-hp", p.hp <= 0 ? "被吃掉" : `HP ${p.hp}`));
    card.appendChild(ptop);
    const bar = el("div", "hp-bar");
    const fill = el("div", "hp-fill");
    fill.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
    bar.appendChild(fill);
    card.appendChild(bar);
    pg.appendChild(card);
  });
  c.appendChild(pg);

  // 阳光浇灌
  const waterBox = el("div", "settle-box");
  const waterBtn = el("button", "btn blue water-btn", "💧 给小植物浇点水（回血 +30）");
  waterBtn.onclick = waterGarden;
  waterBox.appendChild(waterBtn);
  c.appendChild(waterBox);

  // 战斗日志
  if (DB.garden.log.length) {
    c.appendChild(el("div", "blk-title", "📜 战斗日志"));
    const list = el("div", "log-list");
    DB.garden.log.slice(0, 15).forEach((l) => {
      const item = el("div", "bl-item");
      item.appendChild(el("span", "bl-date", l.date));
      item.appendChild(el("span", null, esc(l.text)));
      list.appendChild(item);
    });
    c.appendChild(list);
  }

  // 结算
  const settled = DB.garden.settledDates.includes(TODAY);
  const box = el("div", "settle-box");
  if (settled) {
    box.appendChild(el("div", "progress-pill", "🌙 今天已结算，明天继续加油！"));
  } else {
    const btn = el("button", "btn sun manage-only", "🌙 结束今天（结算僵尸进攻）");
    btn.onclick = endToday;
    box.appendChild(btn);
    box.appendChild(el("div", "bank-sub", "点这里结算：漏做的任务会让僵尸前进，全勤则僵尸后退、植物回血"));
  }
  c.appendChild(box);
}

async function plantSeed(seedId) {
  const s = DB.garden.seeds.find((x) => x.id === seedId);
  if (!s) return;
  if (DB.points.total < s.cost) {
    toast("阳光值不够种这株植物，先去打卡攒一攒~ 🌱");
    return;
  }
  DB.points.total -= s.cost;
  DB.points.log.unshift({ date: TODAY, type: "spend", amount: s.cost, reason: `种下${s.name}`, ref: seedId });
  DB.garden.plants.push({
    id: uid("P"),
    name: s.name,
    icon: s.icon,
    hp: 100,
    maxHp: 100,
    role: s.role,
    plantedDate: TODAY,
  });
  DB.garden.log.unshift({ date: TODAY, text: `🌱 种下了「${s.name}」，花费 ${s.cost} 阳光值` });
  await Promise.all([apiSave("garden", DB.garden), apiSave("points", DB.points)]);
  confetti();
  toast(`🌱 种下了「${s.name}」！`);
  render();
}

async function waterGarden() {
  const needy = DB.garden.plants.filter((p) => p.hp > 0 && p.hp < p.maxHp);
  if (needy.length === 0) {
    toast("植物都满血啦，或小花园还空空的~ 🌿");
    return;
  }
  const target = needy.sort((a, b) => a.hp - b.hp)[0];
  target.hp = Math.min(target.maxHp, target.hp + 30);
  DB.garden.log.unshift({ date: TODAY, text: `💧 给「${target.name}」浇了水，回血 +30` });
  await apiSave("garden", DB.garden);
  toast(`💧 「${target.name}」喝饱水啦！`);
  render();
}

async function endToday() {
  if (DB.garden.settledDates.includes(TODAY)) {
    toast("今天已经结算过啦~");
    return;
  }
  const daily = DB.tasks.tasks.filter((t) => t.active && t.repeat === "daily");
  const total = daily.length;
  const done = daily.filter((t) => doneToday(t.id)).length;
  const missed = total - done;

  let victory = false;
  const eaten = [];
  DB.garden.zombies.forEach((z) => {
    const before = z.progress;
    if (missed === 0) {
      z.progress = Math.max(0, z.progress - 20);
    } else {
      z.progress += missed * z.speed;
    }
    // 吃植物
    while (z.progress >= 100) {
      z.progress -= 100;
      const alive = DB.garden.plants.filter((p) => p.hp > 0);
      if (alive.length === 0) {
        z.progress = 100;
        break;
      }
      const victim = alive.slice().sort((a, b) => a.hp - b.hp)[0];
      victim.hp = 0;
      eaten.push(victim.name);
    }
    if (before > 0 && z.progress === 0) {
      victory = true;
      DB.garden.victories++;
      DB.garden.lastVictoryDate = TODAY;
      DB.garden.log.unshift({ date: TODAY, text: `🏆 击退了「${z.name}」！${NAME()}守住了小花园！` });
    }
  });
  if (missed === 0) DB.garden.plants.forEach((p) => (p.hp = p.maxHp));
  if (eaten.length) {
    DB.garden.log.unshift({ date: TODAY, text: `💀 僵尸吃掉了：${eaten.join("、")}` });
  }
  DB.garden.log.unshift({
    date: TODAY,
    text: missed === 0 ? "🛡️ 全勤结算：僵尸后退，植物满血！" : `🧟 漏了 ${missed} 项，僵尸前进了 ${missed * DB.garden.zombies[0].speed}！`,
  });
  DB.garden.settledDates.push(TODAY);
  if (victory) confetti();

  // 写日历
  const earnedToday = DB.points.log
    .filter((l) => l.date === TODAY && l.type === "earn")
    .reduce((s, l) => s + l.amount, 0);
  let day = DB.calendar.days.find((d) => d.date === TODAY);
  if (!day) {
    day = { date: TODAY, doneTasks: done, totalTasks: total, pointsEarned: earnedToday, missed, note: "" };
    DB.calendar.days.push(day);
  } else {
    day.doneTasks = done;
    day.totalTasks = total;
    day.missed = missed;
    day.pointsEarned = earnedToday;
  }

  // 连续打卡里程碑
  let newMs = null;
  if (missed === 0) {
    const streak = computeStreak();
    if (streak === 7 && !DB.calendar.milestones.some((m) => m.title.includes("连续打卡7天"))) {
      newMs = `连续打卡7天，${NAME()}太棒了！🏆`;
      DB.calendar.milestones.push({ date: TODAY, title: newMs, icon: "🏆" });
    } else if (streak >= 30 && !DB.calendar.milestones.some((m) => m.title.includes("连续打卡30天"))) {
      newMs = "连续打卡30天，超级小学霸！🎖";
      DB.calendar.milestones.push({ date: TODAY, title: newMs, icon: "🎖" });
    }
  }

  await Promise.all([
    apiSave("garden", DB.garden),
    apiSave("calendar", DB.calendar),
    apiSave("points", DB.points),
  ]);
  let toastMsg;
  if (missed === 0) {
    if (victory) toastMsg = "🏆 僵尸被彻底击退！小花园安全啦！";
    else if (newMs) toastMsg = `🏆 ${newMs}`;
    else toastMsg = "🏆 全勤！僵尸被击退，植物满血！";
  } else {
    toastMsg = `🧟 漏了 ${missed} 项，僵尸前进了！`;
  }
  toast(toastMsg);
  render();
}

/* ---------- 板块：暑假见世面行动手册 ---------- */
function hbAllItems() {
  return DB.handbook.categories.flatMap((c) => c.items);
}
function hbFindItem(id) {
  for (const c of DB.handbook.categories) {
    const it = c.items.find((i) => i.id === id);
    if (it) return { cat: c, item: it };
  }
  return null;
}

function renderHandbook(c) {
  const HB = DB.handbook;
  const all = hbAllItems();
  const doneCount = all.filter((i) => i.done).length;

  /* — 封面横幅 — */
  const banner = el("div", "hb-banner");
  banner.appendChild(el("div", "hb-banner-title", `🌏 ${esc(HB.meta.title)}`));
  banner.appendChild(el("div", "hb-banner-sub", esc(HB.meta.subtitle)));
  banner.appendChild(el("div", "hb-motto", `「${esc(HB.meta.motto1)}」`));
  c.appendChild(banner);

  /* — 总进度：涂亮星星 — */
  const prog = el("div", "card hb-progress");
  const ptop = el("div", "hb-prog-top");
  ptop.appendChild(el("div", "blk-title", `⭐ 完成一件小事，就涂亮一颗星（${doneCount}/${all.length}）`));
  ptop.appendChild(el("div", "progress-pill", `已获得 ${doneCount * HB.meta.pointsPerItem} 🌞`));
  prog.appendChild(ptop);
  const stars = el("div", "hb-stars");
  all.forEach((i) => {
    const s = el("span", "hb-star" + (i.done ? " lit" : ""), i.done ? "⭐" : "☆");
    s.title = i.title + (i.done ? `（${i.date} 完成）` : "");
    stars.appendChild(s);
  });
  prog.appendChild(stars);
  c.appendChild(prog);

  /* — 本周小计划 — */
  const wk = el("div", "card hb-weekly");
  const wkHead = el("div", "hb-prog-top");
  wkHead.appendChild(el("div", "blk-title", "📌 本周小计划：先挑 3 件最想做的小事"));
  const wkEdit = el("button", "btn sun sm", "✏️ 选一选");
  wkEdit.onclick = weeklyModal;
  wkHead.appendChild(wkEdit);
  wk.appendChild(wkHead);
  if (HB.weekly.picks.length === 0) {
    wk.appendChild(el("div", "empty", "还没挑呢～点「✏️ 选一选」，挑 3 件这周最想做的小事吧！"));
  } else {
    const pickRow = el("div", "hb-pick-row");
    HB.weekly.picks.forEach((pid) => {
      const f = hbFindItem(pid);
      if (!f) return;
      pickRow.appendChild(
        el("div", "hb-pick" + (f.item.done ? " done" : ""), `${f.cat.icon} ${esc(f.item.title)} ${f.item.done ? "🌟" : ""}`)
      );
    });
    wk.appendChild(pickRow);
    if (HB.weekly.expect) wk.appendChild(el("div", "hb-wk-line", `💛 我最期待的是：${esc(HB.weekly.expect)}`));
    if (HB.weekly.companion) wk.appendChild(el("div", "hb-wk-line", `👨‍👩‍👧 和我一起出门的人：${esc(HB.weekly.companion)}`));
  }
  c.appendChild(wk);

  /* — 8 大类打卡 — */
  const catGrid = el("div", "hb-cat-grid");
  HB.categories.forEach((cat, idx) => {
    const card = el("div", "card hb-cat");
    const done = cat.items.filter((i) => i.done).length;
    const head = el("div", "hb-cat-head");
    head.appendChild(el("span", "hb-cat-name", `${cat.icon} ${idx + 1}｜${esc(cat.name)}`));
    head.appendChild(el("span", "hb-cat-cnt" + (done === cat.items.length ? " full" : ""), `${done}/${cat.items.length}`));
    card.appendChild(head);

    cat.items.forEach((it) => {
      const row = el("label", "hb-item" + (it.done ? " done" : ""));
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = it.done;
      cb.onchange = () => toggleHbItem(it.id, cb.checked);
      row.appendChild(cb);
      row.appendChild(el("span", "hb-item-title", esc(it.title)));
      if (it.done) row.appendChild(el("span", "hb-item-date", it.date));
      card.appendChild(row);
    });

    const cardTpl = HB.cards.find((k) => k.catId === cat.id);
    if (cardTpl) {
      const filled = HB.entries.filter((e) => e.cardId === cardTpl.id).length;
      const btn = el("button", "btn ghost sm hb-card-btn", `📝 ${esc(cardTpl.title)}${filled ? ` · 已记 ${filled} 次` : ""}`);
      btn.onclick = () => hbCardModal(cardTpl.id);
      card.appendChild(btn);
    }
    catGrid.appendChild(card);
  });
  c.appendChild(catGrid);

  /* — 我的记录本 — */
  if (HB.entries.length) {
    c.appendChild(el("div", "blk-title", `📔 ${esc(NAME())}的观察记录本（${HB.entries.length} 篇）`));
    const list = el("div", "hb-entry-list");
    HB.entries.slice().reverse().forEach((en) => {
      const tpl = HB.cards.find((k) => k.id === en.cardId);
      if (!tpl) return;
      const item = el("div", "card hb-entry");
      const h = el("div", "hb-entry-head");
      h.appendChild(el("span", "hb-entry-title", `${tpl.icon} ${esc(tpl.title)}`));
      h.appendChild(el("span", "ms-date", en.date));
      const delBtn = el("button", "del manage-only", "🗑");
      delBtn.title = "删除这篇记录";
      delBtn.onclick = () => deleteHbEntry(en.id);
      h.appendChild(delBtn);
      item.appendChild(h);
      tpl.fields.forEach((f) => {
        const v = en.values[f.k];
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
        const txt = Array.isArray(v) ? v.map((x) => "✅ " + x).join("　") : v;
        item.appendChild(el("div", "hb-entry-line", `<b>${esc(f.label)}</b>：${esc(txt)}`));
      });
      list.appendChild(item);
    });
    c.appendChild(list);
  }

  /* — 见世面地图（汇总页） — */
  const mapCard = el("div", "card hb-map");
  mapCard.appendChild(el("div", "blk-title", "🗺 我的暑假见世面地图"));
  mapCard.appendChild(el("div", "bank-sub", "把你走过、看过、问过的地方点亮～"));
  const placeRow = el("div", "hb-place-row");
  HB.map.places.forEach((p, i) => {
    const b = el("button", "hb-place" + (p.been ? " been" : ""), `${p.icon} ${esc(p.name)}`);
    b.onclick = () => toggleHbPlace(i);
    placeRow.appendChild(b);
  });
  mapCard.appendChild(placeRow);
  mapCard.appendChild(el("div", "hb-wk-line", `⭐ 我完成了 <b>${doneCount}</b> 件小事`));
  if (HB.map.proud) mapCard.appendChild(el("div", "hb-wk-line", `🌸 我最骄傲的是：${esc(HB.map.proud)}`));
  if (HB.map.parentNote) mapCard.appendChild(el("div", "hb-wk-line", `💌 家长的一句话：${esc(HB.map.parentNote)}`));
  const mapEdit = el("button", "btn pink sm", "✏️ 写下骄傲 & 家长寄语");
  mapEdit.onclick = hbMapModal;
  mapCard.appendChild(mapEdit);
  mapCard.appendChild(el("div", "hb-motto bottom", `「${esc(HB.meta.motto2)}」`));
  c.appendChild(mapCard);
}

async function toggleHbItem(id, checked) {
  const f = hbFindItem(id);
  if (!f) return;
  const it = f.item;
  it.done = checked;
  const saves = [];
  if (checked) {
    it.date = TODAY;
    if (!it.awarded) {
      it.awarded = true;
      const pts = DB.handbook.meta.pointsPerItem;
      DB.points.total += pts;
      DB.points.log.unshift({ date: TODAY, type: "earn", amount: pts, reason: `见世面：${it.title}`, ref: id });
      saves.push(apiSave("points", DB.points));
      confetti();
      toast(`🌏 +${pts} 阳光值！${NAME()}又见了一次世面！`);
    } else {
      toast("⭐ 已点亮");
    }
  } else {
    it.date = "";
    toast("已取消（阳光值保留，不重复奖励）");
  }
  saves.push(apiSave("handbook", DB.handbook));
  await Promise.all(saves);
  render();
}

function weeklyModal() {
  const HB = DB.handbook;
  const opts = HB.categories
    .map((cat) =>
      cat.items
        .map((it) => {
          const ck = HB.weekly.picks.includes(it.id) ? "checked" : "";
          return `<label class="hb-pick-opt"><input type="checkbox" class="wkpick" value="${it.id}" ${ck}> ${cat.icon} ${esc(it.title)}${it.done ? " 🌟" : ""}</label>`;
        })
        .join("")
    )
    .join("");
  openModal(
    "📌 本周小计划（挑 3 件）",
    `<div class="hb-pick-box">${opts}</div>
     <label>我最期待的是<input id="wk_expect" value="${esc(HB.weekly.expect || "")}" placeholder="如：去菜市场当小侦探"></label>
     <label>和我一起出门的人<input id="wk_comp" value="${esc(HB.weekly.companion || "")}" placeholder="如：妈妈"></label>`,
    async () => {
      const picked = Array.from(document.querySelectorAll(".wkpick:checked")).map((x) => x.value);
      if (picked.length > 3) {
        toast("最多挑 3 件哦～");
        return false;
      }
      HB.weekly.picks = picked;
      HB.weekly.expect = $("#wk_expect").value.trim();
      HB.weekly.companion = $("#wk_comp").value.trim();
      await apiSave("handbook", DB.handbook);
      toast("📌 本周小计划定好啦！");
      render();
    }
  );
}

function hbCardModal(cardId) {
  const tpl = DB.handbook.cards.find((k) => k.id === cardId);
  if (!tpl) return;
  let html = `<div class="bank-sub" style="margin-bottom:10px">${esc(tpl.sub)}</div>`;
  tpl.fields.forEach((f, i) => {
    if (f.type === "checks") {
      html += `<div class="hb-f-label">${esc(f.label)}</div><div class="hb-check-box">`;
      f.options.forEach((op, j) => {
        html += `<label class="hb-pick-opt"><input type="checkbox" class="hbck_${i}" value="${esc(op)}"> ${esc(op)}</label>`;
      });
      html += `</div>`;
    } else if (f.type === "area") {
      html += `<label>${esc(f.label)}<textarea id="hbf_${i}" rows="3" placeholder="写一写、说一说～"></textarea></label>`;
    } else {
      html += `<label>${esc(f.label)}<input id="hbf_${i}" placeholder="写一写～"></label>`;
    }
  });
  if (tpl.tip) html += `<div class="hb-tip">💡 ${esc(tpl.tip)}</div>`;
  openModal(
    `${tpl.icon} ${tpl.title}`,
    html,
    async () => {
      const values = {};
      let hasAny = false;
      tpl.fields.forEach((f, i) => {
        if (f.type === "checks") {
          const v = Array.from(document.querySelectorAll(`.hbck_${i}:checked`)).map((x) => x.value);
          if (v.length) hasAny = true;
          values[f.k] = v;
        } else {
          const v = ($(`#hbf_${i}`).value || "").trim();
          if (v) hasAny = true;
          values[f.k] = v;
        }
      });
      if (!hasAny) {
        toast("先写一点点再保存吧～");
        return false;
      }
      DB.handbook.entries.push({ id: uid("E"), cardId, date: TODAY, values });
      await apiSave("handbook", DB.handbook);
      confetti();
      toast("📔 记录保存好啦！");
      render();
    }
  );
}

async function deleteHbEntry(id) {
  DB.handbook.entries = DB.handbook.entries.filter((e) => e.id !== id);
  await apiSave("handbook", DB.handbook);
  toast("🗑 已删除");
  render();
}

async function toggleHbPlace(i) {
  const p = DB.handbook.map.places[i];
  p.been = !p.been;
  await apiSave("handbook", DB.handbook);
  if (p.been) toast(`🗺 点亮了「${p.name}」！`);
  render();
}

function hbMapModal() {
  const M = DB.handbook.map;
  openModal(
    "🗺 见世面地图 · 写一写",
    `<label>🌸 我最骄傲的是<input id="mp_proud" value="${esc(M.proud || "")}" placeholder="如：第一次自己点餐"></label>
     <label>💌 家长的一句话<textarea id="mp_note" rows="2" placeholder="给孩子的鼓励～">${esc(M.parentNote || "")}</textarea></label>`,
    async () => {
      M.proud = $("#mp_proud").value.trim();
      M.parentNote = $("#mp_note").value.trim();
      await apiSave("handbook", DB.handbook);
      toast("💌 已保存");
      render();
    }
  );
}

/* ---------- 板块：暑假 30 天亲子打卡挑战 ---------- */
function chAllDays() {
  return DB.challenge30.weeks.flatMap((w) => w.days);
}
function chFindDay(id) {
  for (const w of DB.challenge30.weeks) {
    const d = w.days.find((x) => x.id === id);
    if (d) return { week: w, day: d };
  }
  return null;
}

function renderChallenge(c) {
  const CH = DB.challenge30;
  const all = chAllDays();
  const doneCount = all.filter((d) => d.done).length;
  const pct = Math.round((doneCount / all.length) * 100);

  /* — 封面横幅 — */
  const banner = el("div", "hb-banner ch-banner");
  banner.appendChild(el("div", "hb-banner-title", `🗓 ${esc(CH.meta.title)}`));
  banner.appendChild(el("div", "hb-banner-sub", esc(CH.meta.subtitle)));
  c.appendChild(banner);

  /* — 30 格进度足迹 — */
  const prog = el("div", "card hb-progress");
  const ptop = el("div", "hb-prog-top");
  ptop.appendChild(el("div", "blk-title", `👣 挑战足迹（${doneCount}/30 · ${pct}%）`));
  ptop.appendChild(el("div", "progress-pill", `已获得 ${doneCount * CH.meta.pointsPerTask} 🌞`));
  prog.appendChild(ptop);
  const trail = el("div", "ch-trail");
  all.forEach((d) => {
    const cell = el("span", "ch-foot" + (d.done ? " lit" : ""), d.done ? "🌟" : d.day);
    cell.title = `Day ${d.day}：${d.title}` + (d.done ? `（${d.date} 完成）` : "");
    trail.appendChild(cell);
  });
  prog.appendChild(trail);
  const bar = el("div", "ch-bar");
  const fill = el("div", "ch-bar-fill");
  fill.style.width = pct + "%";
  bar.appendChild(fill);
  prog.appendChild(bar);
  c.appendChild(prog);

  /* — 5 周主题卡 — */
  CH.weeks.forEach((w, wi) => {
    const wDone = w.days.filter((d) => d.done).length;
    const card = el("div", "card ch-week");
    const head = el("div", "hb-cat-head");
    head.appendChild(el("span", "hb-cat-name", `${w.icon} 第${["一", "二", "三", "四", "五"][wi]}周｜${esc(w.name)}`));
    head.appendChild(el("span", "hb-cat-cnt" + (wDone === w.days.length ? " full" : ""), `${wDone}/${w.days.length}`));
    card.appendChild(head);

    w.days.forEach((d) => {
      const row = el("div", "ch-day" + (d.done ? " done" : ""));
      const line = el("label", "ch-day-line");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = d.done;
      cb.onchange = () => toggleChDay(d.id, cb.checked);
      line.appendChild(cb);
      line.appendChild(el("span", "ch-day-num", `Day ${d.day}`));
      const tt = el("span", "hb-item-title", esc(d.title));
      tt.title = d.desc;
      line.appendChild(tt);
      if (d.done) line.appendChild(el("span", "hb-item-date", d.date));
      row.appendChild(line);
      row.appendChild(el("div", "ch-day-desc", esc(d.desc)));
      if (d.note) row.appendChild(el("div", "ch-day-note", `💬 ${esc(d.note)}`));
      const noteBtn = el("button", "btn ghost sm ch-note-btn", d.note ? "✏️ 改记录" : "✏️ 记一句");
      noteBtn.onclick = () => chNoteModal(d.id);
      row.appendChild(noteBtn);
      card.appendChild(row);
    });
    c.appendChild(card);
  });

  /* — 挑战记忆盒（收官） — */
  const mem = el("div", "card hb-map");
  mem.appendChild(el("div", "blk-title", "📦 挑战记忆盒"));
  mem.appendChild(el("div", "bank-sub", "30 天走完，把最难忘的时刻封存在这里～"));
  if (doneCount === all.length) {
    mem.appendChild(el("div", "hb-wk-line", `🎉 挑战全部完成！${esc(NAME())}拥有了一个有趣、有记录、有成长的暑假！`));
  } else {
    mem.appendChild(el("div", "hb-wk-line", `⭐ 已完成 <b>${doneCount}</b> / 30 件，继续加油～`));
  }
  if (CH.memory.bestDay) mem.appendChild(el("div", "hb-wk-line", `🌈 最难忘的一天：${esc(CH.memory.bestDay)}`));
  if (CH.memory.parentNote) mem.appendChild(el("div", "hb-wk-line", `💌 家长寄语：${esc(CH.memory.parentNote)}`));
  const memBtn = el("button", "btn pink sm", "✏️ 写下难忘时刻 & 寄语");
  memBtn.onclick = chMemoryModal;
  mem.appendChild(memBtn);
  c.appendChild(mem);
}

async function toggleChDay(id, checked) {
  const f = chFindDay(id);
  if (!f) return;
  const d = f.day;
  d.done = checked;
  const saves = [];
  if (checked) {
    d.date = TODAY;
    if (!d.awarded) {
      d.awarded = true;
      const pts = DB.challenge30.meta.pointsPerTask;
      DB.points.total += pts;
      DB.points.log.unshift({ date: TODAY, type: "earn", amount: pts, reason: `30天挑战 Day${d.day}：${d.title}`, ref: id });
      saves.push(apiSave("points", DB.points));
      confetti();
      toast(`🗓 Day ${d.day} 完成！+${pts} 阳光值！`);
    } else {
      toast("🌟 已点亮");
    }
  } else {
    d.date = "";
    toast("已取消（阳光值保留，不重复奖励）");
  }
  saves.push(apiSave("challenge30", DB.challenge30));
  await Promise.all(saves);
  render();
}

function chNoteModal(id) {
  const f = chFindDay(id);
  if (!f) return;
  const d = f.day;
  openModal(
    `✏️ Day ${d.day} · ${d.title}`,
    `<div class="bank-sub" style="margin-bottom:10px">${esc(d.desc)}</div>
     <label>今天的一句话记录<textarea id="ch_note" rows="3" placeholder="孩子说了什么、发生了什么好玩的事～">${esc(d.note || "")}</textarea></label>`,
    async () => {
      d.note = $("#ch_note").value.trim();
      await apiSave("challenge30", DB.challenge30);
      toast("💬 记录保存好啦！");
      render();
    }
  );
}

function chMemoryModal() {
  const M = DB.challenge30.memory;
  openModal(
    "📦 挑战记忆盒",
    `<label>🌈 最难忘的一天<input id="ch_best" value="${esc(M.bestDay || "")}" placeholder="如：全家看日出那天"></label>
     <label>💌 家长寄语<textarea id="ch_pnote" rows="2" placeholder="给孩子的一段话～">${esc(M.parentNote || "")}</textarea></label>`,
    async () => {
      M.bestDay = $("#ch_best").value.trim();
      M.parentNote = $("#ch_pnote").value.trim();
      await apiSave("challenge30", DB.challenge30);
      toast("📦 已封存进记忆盒");
      render();
    }
  );
}

/* ---------- 板块：知识百宝箱（知识库） ---------- */
function kbAllCards() {
  if (!DB.knowledge) return [];
  return DB.knowledge.categories.flatMap((c) => c.cards);
}
function kbFindCard(id) {
  for (const c of DB.knowledge.categories) {
    const it = c.cards.find((x) => x.id === id);
    if (it) return it;
  }
  return null;
}

function renderKnowledge(c) {
  const KB = DB.knowledge;
  const all = kbAllCards();
  const learned = all.filter((i) => i.learned).length;

  /* — 封面横幅 — */
  const banner = el("div", "hb-banner");
  banner.appendChild(el("div", "hb-banner-title", `${KB.meta.icon} ${esc(KB.meta.title)}`));
  banner.appendChild(el("div", "hb-banner-sub", esc(KB.meta.subtitle)));
  banner.appendChild(el("div", "hb-motto", `「${esc(KB.meta.motto)}」`));
  c.appendChild(banner);

  /* — 总进度 — */
  const prog = el("div", "card hb-progress");
  const ptop = el("div", "hb-prog-top");
  ptop.appendChild(el("div", "blk-title", `💡 已学会 ${learned}/${all.length} 个知识（每学会 1 个 +${KB.meta.pointsPerCard} 🌞）`));
  ptop.appendChild(el("div", "progress-pill", `已获得 ${learned * KB.meta.pointsPerCard} 🌞`));
  prog.appendChild(ptop);
  c.appendChild(prog);

  /* — 主题分类卡 — */
  KB.categories.forEach((cat) => {
    const done = cat.cards.filter((i) => i.learned).length;
    const card = el("div", "card hb-cat");
    const head = el("div", "hb-cat-head");
    head.appendChild(el("span", "hb-cat-name", `${cat.icon} ${esc(cat.name)}`));
    head.appendChild(el("span", "hb-cat-cnt" + (done === cat.cards.length ? " full" : ""), `${done}/${cat.cards.length}`));
    card.appendChild(head);

    cat.cards.forEach((it) => {
      const kc = el("div", "kb-card" + (it.learned ? " done" : ""));
      const top = el("div", "kb-card-top");
      top.appendChild(el("span", "kb-ico", it.icon));
      top.appendChild(el("span", "kb-title", esc(it.title)));
      top.appendChild(el("span", "kb-tag", esc(it.tag)));
      kc.appendChild(top);
      kc.appendChild(el("div", "kb-point", esc(it.point)));
      if (it.tip) kc.appendChild(el("div", "kb-tip", `💡 ${esc(it.tip)}`));
      const btn = el("button", "btn sun sm kb-learn", it.learned ? "✅ 已学会" : "✅ 我学会啦");
      btn.disabled = it.learned;
      btn.onclick = () => learnCard(it.id);
      kc.appendChild(btn);
      card.appendChild(kc);
    });
    c.appendChild(card);
  });
}

async function learnCard(id) {
  const it = kbFindCard(id);
  if (!it) return;
  if (it.learned) {
    toast("已经学会啦~ 💡");
    return;
  }
  it.learned = true;
  it.date = TODAY;
  const pts = DB.knowledge.meta.pointsPerCard;
  DB.points.total += pts;
  DB.points.log.unshift({ date: TODAY, type: "earn", amount: pts, reason: `知识库：${it.title}`, ref: id });
  await Promise.all([apiSave("knowledge", DB.knowledge), apiSave("points", DB.points)]);
  confetti();
  toast(`💡 +${pts} 阳光值！${NAME()}又学会一个新本领！`);
  render();
}

/* ---------- 板块4：成长日历 ---------- */
function renderCalendar(c) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const head = el("div", "cal-head");
  head.appendChild(el("div", "cal-month", `${y}年 ${m + 1}月`));
  head.appendChild(el("div", "bank-sub", "绿=全勤 · 黄=部分完成 · 灰=未打卡"));
  c.appendChild(head);

  const grid = el("div", "cal-grid");
  ["日", "一", "二", "三", "四", "五", "六"].forEach((d) => grid.appendChild(el("div", "cal-dow", d)));
  for (let i = 0; i < first; i++) grid.appendChild(el("div", "cal-cell empty-day", ""));
  const dayMap = {};
  DB.calendar.days.forEach((d) => (dayMap[d.date] = d));
  for (let d = 1; d <= daysInMonth; d++) {
    const p = (n) => String(n).padStart(2, "0");
    const ds = `${y}-${p(m + 1)}-${p(d)}`;
    const cell = el("div", "cal-cell");
    cell.appendChild(el("div", "cd-num", d));
    const isFuture = ds > TODAY;
    if (ds === TODAY) cell.classList.add("today");
    const rec = dayMap[ds];
    if (isFuture) {
      cell.classList.add("empty-day");
    } else if (rec) {
      if (rec.missed === 0 && rec.doneTasks > 0) {
        cell.classList.add("full");
        cell.appendChild(el("div", "cd-dot", "🌟"));
      } else if (rec.doneTasks > 0) {
        cell.classList.add("part");
        cell.appendChild(el("div", "cd-dot", "🌱"));
      } else {
        cell.classList.add("empty-day");
        cell.appendChild(el("div", "cd-dot", "🌫"));
      }
    } else {
      cell.classList.add("empty-day");
    }
    grid.appendChild(cell);
  }
  c.appendChild(grid);

  // 里程碑
  if (DB.calendar.milestones.length) {
    c.appendChild(el("div", "blk-title", "🏆 成长里程碑"));
    const list = el("div", "ms-list");
    DB.calendar.milestones.forEach((ms) => {
      const item = el("div", "ms-item");
      item.appendChild(el("span", "ms-ico", ms.icon || "🏆"));
      item.appendChild(el("span", "ms-title", esc(ms.title)));
      item.appendChild(el("span", "ms-date", ms.date));
      list.appendChild(item);
    });
    c.appendChild(list);
  } else {
    c.appendChild(el("div", "empty", "打卡满 7 天就能解锁第一个里程碑啦 🏆"));
  }
}

/* ---------- 弹层 ---------- */
function openModal(title, bodyHtml, onOk) {
  const mask = $("#mask");
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHtml;
  mask.classList.add("show");
  $("#modalOk").onclick = () => {
    const ok = onOk && onOk();
    if (ok !== false) mask.classList.remove("show");
  };
  $("#modalCancel").onclick = () => mask.classList.remove("show");
}

/* ---------- 儿童/家长视图切换 ---------- */
function applyKidView() {
  document.body.classList.toggle("kid", KID);
  const btn = $("#kidToggle");
  if (btn) btn.textContent = KID ? "👩 家长视图" : "🧒 儿童视图";
}

/* ---------- 启动 ---------- */
document.querySelectorAll(".nav-btn").forEach((b) => {
  b.onclick = () => {
    SEC = b.dataset.sec;
    render();
  };
});
$("#kidToggle").onclick = () => {
  KID = !KID;
  localStorage.setItem("shiliu_kid", KID ? "1" : "0");
  applyKidView();
  render();
};

/* ---------- 设置（孩子昵称可配置） ---------- */
function settingsModal() {
  openModal(
    "⚙️ 设置",
    `<label>孩子昵称<input id="s_name" value="${esc(NAME())}" maxlength="8" placeholder="如：石榴"></label>
     <div class="bank-sub" style="margin-top:6px">改名后，侧栏、标题、夸奖语都会跟着变 🌟</div>
     <div style="margin-top:14px;padding-top:12px;border-top:2px dashed #f0e6c8">
       <div class="bank-sub" style="margin-bottom:8px">📦 数据备份${STANDALONE ? "（数据保存在本手机浏览器里，建议定期备份）" : ""}</div>
       <button type="button" class="btn ghost sm" id="s_export">⬇️ 导出备份</button>
       <button type="button" class="btn ghost sm" id="s_import">⬆️ 导入恢复</button>
       <input type="file" id="s_file" accept=".json,application/json" style="display:none">
     </div>`,
    async () => {
      const v = $("#s_name").value.trim();
      if (!v) return false;
      DB.settings.childName = v;
      await apiSave("settings", DB.settings);
      applyName();
      toast(`✅ 已改为「${v}」`);
      render();
    }
  );
  /* 备份/恢复按钮 */
  $("#s_export").onclick = exportData;
  $("#s_import").onclick = () => $("#s_file").click();
  $("#s_file").onchange = (e) => {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
  };
}
$("#settingsBtn").onclick = settingsModal;
$("#sideSettings").onclick = settingsModal;

(async function init() {
  try {
    await loadAll();
    applyName();
    applyKidView();
    render();
  } catch (e) {
    $("#content").textContent = "加载失败：" + e.message;
  }
})();
