/* ══════════════════════════════════════════════════════════════
   data.js — справочники Wraeclast и агрегации реестра.
   Сгенерированных записей нет: реестр начинается пустым и наполняется
   только отчётами игроков (localStorage или серверный API).
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  /* ── Классы ───────────────────────────────────────────────── */
  const CLASSES = [
    { key: "Warrior",    label: "Warrior",    color: "#c9533f", ascendancies: ["Titan", "Warbringer"] },
    { key: "Ranger",     label: "Ranger",     color: "#78b062", ascendancies: ["Deadeye", "Pathfinder"] },
    { key: "Witch",      label: "Witch",      color: "#9a7ad0", ascendancies: ["Infernalist", "Blood Mage"] },
    { key: "Sorceress",  label: "Sorceress",  color: "#5b93d6", ascendancies: ["Stormweaver", "Chronomancer"] },
    { key: "Monk",       label: "Monk",       color: "#5fbcb2", ascendancies: ["Invoker", "Acolyte of Chayula"] },
    { key: "Mercenary",  label: "Mercenary",  color: "#c0a660", ascendancies: ["Witchhunter", "Gemling Legionnaire"] },
    { key: "Huntress",   label: "Huntress",   color: "#a8b96a", ascendancies: ["Amazon", "Ritualist"] },
    { key: "Druid",      label: "Druid",      color: "#a8855a", ascendancies: ["Oracle", "Shaman"] }
  ];

  /* ── Причины смерти ───────────────────────────────────────── */
  const CAUSES = [
    { key: "boss",     label: "Механика босса",        color: "#d3402f" },
    { key: "oneshot",  label: "Ваншот",                color: "#e2662f" },
    { key: "chaos",    label: "Хаос-урон",             color: "#a05ad0" },
    { key: "swarm",    label: "Толпа монстров",        color: "#c9a761" },
    { key: "ground",   label: "Наземный эффект",       color: "#b3872f" },
    { key: "bleed",    label: "Кровотечение",          color: "#9d2b26" },
    { key: "ignite",   label: "Поджог",                color: "#d97a3a" },
    { key: "offscr",   label: "Снаряд вне экрана",     color: "#7f9ec4" },
    { key: "freeze",   label: "Заморозка / шок",       color: "#5fa8c9" },
    { key: "poison",   label: "Яд",                    color: "#6c9a4e" },
    { key: "trap",     label: "Ловушка",               color: "#8b7f6b" }
  ];

  /* ── Локации ──────────────────────────────────────────────── */
  const AREAS = [
    // Акт 1
    { area: "Clearfell",                 act: "Акт I" },
    { area: "The Grelwood",              act: "Акт I" },
    { area: "The Red Vale",              act: "Акт I" },
    { area: "Grim Tangle",               act: "Акт I" },
    { area: "Cemetery of the Eternals",  act: "Акт I" },
    { area: "Ogham Farmlands",           act: "Акт I" },
    { area: "Ogham Village",             act: "Акт I" },
    { area: "The Manor Ramparts",        act: "Акт I" },
    { area: "Ogham Manor",               act: "Акт I" },
    // Акт 2
    { area: "Vastiri Outskirts",         act: "Акт II" },
    { area: "The Halani Gates",          act: "Акт II" },
    { area: "The Mastodon Badlands",     act: "Акт II" },
    { area: "The Bone Pits",             act: "Акт II" },
    { area: "The Spires of Deshar",      act: "Акт II" },
    { area: "The Lost City",             act: "Акт II" },
    { area: "Trial of the Sekhemas",     act: "Акт II" },
    { area: "Valley of the Titans",      act: "Акт II" },
    { area: "The Titan Grotto",          act: "Акт II" },
    { area: "The Dreadnought",           act: "Акт II" },
    // Акт 3
    { area: "Sandswept Marsh",           act: "Акт III" },
    { area: "Jungle Ruins",              act: "Акт III" },
    { area: "Infested Barrens",          act: "Акт III" },
    { area: "The Azak Bog",              act: "Акт III" },
    { area: "Chimeral Wetlands",         act: "Акт III" },
    { area: "Jiquani's Machinarium",     act: "Акт III" },
    { area: "The Venom Crypts",          act: "Акт III" },
    { area: "Utzaal",                    act: "Акт III" },
    { area: "The Black Chambers",        act: "Акт III" },
    { area: "Aggorat",                   act: "Акт III" },
    { area: "The Ziggurat",              act: "Акт III" },
    // Эндгейм
    { area: "The Burning Monolith",      act: "Эндгейм" },
    { area: "Twisted Domain",            act: "Эндгейм" },
    { area: "Trial of Chaos",            act: "Эндгейм" },
    { area: "The Atlas — T15 Maps",      act: "Эндгейм" },
    { area: "Xesht's Sanctum",           act: "Эндгейм" }
  ];

  /* ── Боссы по локациям (подсказка для поля «Источник») ────── */
  const BOSS_BY_AREA = {
    "The Grelwood": ["The Devourer"],
    "Grim Tangle": ["The Rust King"],
    "Ogham Manor": ["Count Geonor"],
    "Cemetery of the Eternals": ["Draven, the Eternal"],
    "The Halani Gates": ["Rudja, the Dread"],
    "The Bone Pits": ["Balbala, the Traitor"],
    "The Titan Grotto": ["Zalmarath, the Colossus"],
    "The Dreadnought": ["Jamanra, the Abomination"],
    "Trial of the Sekhemas": ["The Sekhemas Trials"],
    "The Azak Bog": ["Ignagduk, the Bog Witch"],
    "Jiquani's Machinarium": ["The Silverback"],
    "The Venom Crypts": ["Queen of Filth"],
    "Utzaal": ["Tor Gul, the Decayer"],
    "The Black Chambers": ["Doryani, the Architect"],
    "Aggorat": ["The Executioner"],
    "The Ziggurat": ["Xesht, We That Are One"],
    "The Burning Monolith": ["Olroth, the Origin of the Fall"],
    "Twisted Domain": ["The Twisted One"],
    "Trial of Chaos": ["The Trialmaster"],
    "The Atlas — T15 Maps": ["Rare Map Boss"],
    "Xesht's Sanctum": ["Xesht, We That Are One"]
  };

  const LEAGUES = ["Dawn of the Hunt", "Hardcore", "Standard", "SSF"];

  /* ── Агрегации ────────────────────────────────────────────── */
  function countBy(records, key) {
    const map = new Map();
    for (const r of records) {
      const k = typeof key === "function" ? key(r) : r[key];
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);
  }

  function hourHistogram(records) {
    const bins = new Array(24).fill(0);
    for (const r of records) bins[new Date(r.timestamp).getHours()]++;
    return bins;
  }

  function dayHistogram(records, days) {
    const now = new Date();
    const bins = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      bins.push({ label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }), value: 0, start: d.getTime() });
    }
    const first = bins[0].start;
    for (const r of records) {
      if (r.timestamp < first) continue;
      const idx = Math.floor((r.timestamp - first) / DAY);
      if (bins[idx]) bins[idx].value++;
    }
    return bins;
  }

  function summarize(records) {
    const total = records.length;
    const dayAgo = Date.now() - DAY;
    const today = records.filter((r) => r.timestamp >= dayAgo).length;
    const hc = records.filter((r) => r.hardcore).length;
    const avgLevel = total ? records.reduce((s, r) => s + r.level, 0) / total : 0;
    const areas = countBy(records, "area");
    const causes = countBy(records, "causeKey");
    const classes = countBy(records, "className");
    const causeMeta = (k) => CAUSES.find((c) => c.key === k) || { label: k, color: "#888" };
    const classMeta = (k) => CLASSES.find((c) => c.key === k) || { color: "#888" };

    let maxLevel = null;
    for (const r of records) if (!maxLevel || r.level > maxLevel.level) maxLevel = r;

    const hourAgo = Date.now() - 3600000;
    const lastHour = records.filter((r) => r.timestamp >= hourAgo).length;
    const oldest = records.length ? records[records.length - 1].timestamp : Date.now();
    const spanHours = Math.max(1, (Date.now() - oldest) / 3600000);

    return {
      total,
      today,
      hcCount: hc,
      hcShare: total ? (hc / total) * 100 : 0,
      avgLevel,
      topArea: areas[0] ? { name: areas[0].key, count: areas[0].value } : null,
      topCause: causes[0] ? { ...causeMeta(causes[0].key), count: causes[0].value } : null,
      topClass: classes[0] ? { ...classMeta(classes[0].key), name: classes[0].key, count: classes[0].value } : null,
      maxLevel,
      lastHour,
      perMinute: total / (spanHours * 60),
      avgPerHour: total / spanHours
    };
  }

  /* ── Утилиты ──────────────────────────────────────────────── */
  const DAY = 86400000;
  const nf = new Intl.NumberFormat("ru-RU");

  function fmt(n) { return nf.format(Math.round(n)); }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "только что";
    if (m < 60) return m + " мин назад";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " ч назад";
    const d = Math.floor(h / 24);
    if (d < 7) return d + " дн назад";
    return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  }

  function fullDate(ts) {
    return new Date(ts).toLocaleString("ru-RU", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function clock(ts) {
    return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  global.PoE = global.PoE || {};
  global.PoE.data = {
    CLASSES, CAUSES, AREAS, LEAGUES, BOSS_BY_AREA,
    records: [],
    countBy, hourHistogram, dayHistogram, summarize,
    fmt, timeAgo, fullDate, clock,
    classMeta: (k) => CLASSES.find((c) => c.key === k),
    causeMeta: (k) => CAUSES.find((c) => c.key === k),
    areasByAct: () => {
      const map = new Map();
      for (const a of AREAS) {
        if (!map.has(a.act)) map.set(a.act, []);
        map.get(a.act).push(a.area);
      }
      return map;
    }
  };
})(window);
