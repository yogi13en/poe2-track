/* ══════════════════════════════════════════════════════════════
   data.js — справочники Wraeclast и генератор глобального реестра
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
    { key: "boss",     label: "Механика босса",        color: "#d3402f", weight: 21 },
    { key: "oneshot",  label: "Ваншот",                color: "#e2662f", weight: 15 },
    { key: "chaos",    label: "Хаос-урон",             color: "#a05ad0", weight: 12 },
    { key: "swarm",    label: "Толпа монстров",        color: "#c9a761", weight: 12 },
    { key: "ground",   label: "Наземный эффект",       color: "#b3872f", weight: 10 },
    { key: "bleed",    label: "Кровотечение",          color: "#9d2b26", weight: 8 },
    { key: "ignite",   label: "Поджог",                color: "#d97a3a", weight: 7 },
    { key: "offscr",   label: "Снаряд вне экрана",     color: "#7f9ec4", weight: 6 },
    { key: "freeze",   label: "Заморозка / шок",       color: "#5fa8c9", weight: 4 },
    { key: "poison",   label: "Яд",                    color: "#6c9a4e", weight: 3 },
    { key: "trap",     label: "Ловушка",               color: "#8b7f6b", weight: 2 }
  ];

  /* ── Локации ──────────────────────────────────────────────── */
  const AREAS = [
    // Акт 1
    { area: "Clearfell",                 act: "Акт I",   weight: 42 },
    { area: "The Grelwood",              act: "Акт I",   weight: 34 },
    { area: "The Red Vale",              act: "Акт I",   weight: 26 },
    { area: "Grim Tangle",               act: "Акт I",   weight: 30 },
    { area: "Cemetery of the Eternals",  act: "Акт I",   weight: 33 },
    { area: "Ogham Farmlands",           act: "Акт I",   weight: 38 },
    { area: "Ogham Village",             act: "Акт I",   weight: 36 },
    { area: "The Manor Ramparts",        act: "Акт I",   weight: 29 },
    { area: "Ogham Manor",               act: "Акт I",   weight: 44 },
    // Акт 2
    { area: "Vastiri Outskirts",         act: "Акт II",  weight: 40 },
    { area: "The Halani Gates",          act: "Акт II",  weight: 31 },
    { area: "The Mastodon Badlands",     act: "Акт II",  weight: 28 },
    { area: "The Bone Pits",             act: "Акт II",  weight: 35 },
    { area: "The Spires of Deshar",      act: "Акт II",  weight: 32 },
    { area: "The Lost City",             act: "Акт II",  weight: 39 },
    { area: "Trial of the Sekhemas",     act: "Акт II",  weight: 58 },
    { area: "Valley of the Titans",      act: "Акт II",  weight: 30 },
    { area: "The Titan Grotto",          act: "Акт II",  weight: 46 },
    { area: "The Dreadnought",           act: "Акт II",  weight: 52 },
    // Акт 3
    { area: "Sandswept Marsh",           act: "Акт III", weight: 37 },
    { area: "Jungle Ruins",              act: "Акт III", weight: 33 },
    { area: "Infested Barrens",          act: "Акт III", weight: 31 },
    { area: "The Azak Bog",              act: "Акт III", weight: 45 },
    { area: "Chimeral Wetlands",         act: "Акт III", weight: 40 },
    { area: "Jiquani's Machinarium",     act: "Акт III", weight: 43 },
    { area: "The Venom Crypts",          act: "Акт III", weight: 48 },
    { area: "Utzaal",                    act: "Акт III", weight: 55 },
    { area: "The Black Chambers",        act: "Акт III", weight: 50 },
    { area: "Aggorat",                   act: "Акт III", weight: 61 },
    { area: "The Ziggurat",              act: "Акт III", weight: 57 },
    // Эндгейм
    { area: "The Burning Monolith",      act: "Эндгейм", weight: 74 },
    { area: "Twisted Domain",            act: "Эндгейм", weight: 68 },
    { area: "Trial of Chaos",            act: "Эндгейм", weight: 63 },
    { area: "The Atlas — T15 Maps",      act: "Эндгейм", weight: 71 },
    { area: "Xesht's Sanctum",           act: "Эндгейм", weight: 66 }
  ];

  /* ── Боссы и опасные твари по локациям ────────────────────── */
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

  const RARE_MOBS = [
    "Brambleghast, Thicket Tyrant", "Vorn, the Bonecarver", "Sablethorn the Unbroken",
    "Mordreth, Warden of Rot", "Ghalvorn the Skinless", "Ithara, Widow of Ash",
    "Skarn the Drowned", "Ulmgar, Flesh Architect", "The Pale Choir",
    "Nyx, Hollow Matriarch", "Gravewretch", "Kethra the Emberbound"
  ];

  const DAMAGE = {
    boss: ["Physical", "Fire", "Cold", "Chaos", "Lightning"],
    oneshot: ["Physical", "Fire", "Chaos"],
    chaos: ["Chaos", "Chaos", "Poison"],
    swarm: ["Physical", "Lightning", "Cold"],
    ground: ["Fire", "Chaos", "Lightning"],
    bleed: ["Physical"],
    ignite: ["Fire"],
    offscr: ["Physical", "Cold", "Lightning"],
    freeze: ["Cold", "Lightning"],
    poison: ["Chaos"],
    trap: ["Physical", "Fire"]
  };

  const LEAGUES = ["Dawn of the Hunt", "Hardcore", "Standard", "SSF"];

  const NAME_A = ["Kalandra", "Malachai", "Ogham", "Vastiri", "Sarn", "Oriath", "Wraeclast", "Axiom", "Doryani", "Geonor", "Utzaal", "Ralakesh", "Kitava", "Zana", "Tarkleigh", "Nessa", "Yeena", "Silk", "Azmeri", "Vaal"];
  const NAME_B = ["sLast", "Ash", "Ember", "Vow", "Oath", "Bane", "Hollow", "Warden", "Widow", "Thorn", "Requiem", "Dirge", "Cinder", "Grave", "Pyre", "Ruin", "Frost", "Vesper", "Nocturne", "Sorrow"];

  /* ── PRNG ─────────────────────────────────────────────────── */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeighted(list, rand) {
    const total = list.reduce((s, x) => s + (x.weight || 1), 0);
    let r = rand() * total;
    for (const item of list) {
      r -= item.weight || 1;
      if (r <= 0) return item;
    }
    return list[list.length - 1];
  }

  /* ── Генерация реестра ────────────────────────────────────── */
  const DAY = 86400000;
  const NOW = Date.now();
  const SPAN_DAYS = 16;
  const TOTAL = 2680;

  function build() {
    const rand = mulberry32(20241207);
    const records = [];
    const areaWeights = AREAS.map((a) => ({ ...a, weight: a.weight }));

    for (let i = 0; i < TOTAL; i++) {
      // свежие записи гуще старых: 3 волны + равномерный фон
      let age = Math.pow(rand(), 1.7) * SPAN_DAYS * DAY;
      if (rand() < 0.09) age = rand() * DAY * 0.6;      // «только что»
      const ts = NOW - age;

      const area = pickWeighted(areaWeights, rand);
      const cause = pickWeighted(CAUSES, rand);
      const klass = pickWeighted(CLASSES.map((c) => ({ ...c, weight: 1 })), rand);
      const league = pickWeighted(
        LEAGUES.map((l) => ({ key: l, weight: l === "Dawn of the Hunt" ? 52 : l === "Hardcore" ? 20 : l === "SSF" ? 12 : 16 })),
        rand
      ).key;

      const hardcore = league === "Hardcore" || (league === "SSF" && rand() < 0.4);

      // уровень: новички гибнут часто, но и хай-левел встречается
      let level;
      const roll = rand();
      if (roll < 0.16) level = 1 + Math.floor(rand() * 24);
      else if (roll < 0.52) level = 25 + Math.floor(rand() * 31);
      else if (roll < 0.87) level = 56 + Math.floor(rand() * 25);
      else level = 81 + Math.floor(rand() * 20);
      if (area.act === "Эндгейм") level = Math.max(level, 62 + Math.floor(rand() * 30));
      if (cause.key === "chaos") level = Math.max(level, 30);

      let source;
      if (cause.key === "boss") {
        const bosses = BOSS_BY_AREA[area.area] || ["Rare Map Boss"];
        source = bosses[Math.floor(rand() * bosses.length)];
      } else if (cause.key === "swarm") {
        source = ["Pack of Vastiri Bandits", "Vaal Spawn", "Swarm of Bog Crawlers", "Rare Pack"][Math.floor(rand() * 4)];
      } else {
        source = RARE_MOBS[Math.floor(rand() * RARE_MOBS.length)];
      }

      const damagePool = DAMAGE[cause.key] || ["Physical"];
      const damage = damagePool[Math.floor(rand() * damagePool.length)];

      const name = NAME_A[Math.floor(rand() * NAME_A.length)] + "_" + NAME_B[Math.floor(rand() * NAME_B.length)];
      const ascendancy = klass.ascendancies[Math.floor(rand() * klass.ascendancies.length)];

      records.push({
        id: "d" + (100000 + i),
        charName: name,
        className: klass.key,
        classColor: klass.color,
        ascendancy,
        level,
        area: area.area,
        act: area.act,
        causeKey: cause.key,
        cause: cause.label,
        causeColor: cause.color,
        source,
        damage,
        league,
        hardcore,
        timestamp: Math.round(ts),
        community: false,
        note: buildNote(area, cause, source, klass)
      });
    }

    records.sort((a, b) => b.timestamp - a.timestamp);
    return records;
  }

  const NOTE_TEMPLATES = [
    (a, c, s, k) => `${k} вошёл в ${a.area} с полным запасом здоровья. ${s} вышел навстречу — и всё закончилось за один удар.`,
    (a, c, s, k) => `${a.area}. ${c.label}. Последнее, что увидел ${k}, — всполох ${s} в темноте.`,
    (a, c, s, k) => `Уровень остался позади, ${a.area} забрал своё. ${s} не оставил ни шанса.`,
    (a, c, s, k) => `${s} в ${a.area}. ${c.label} — и экран смерти вместо карты.`,
    (a, c, s, k) => `Портал закрылся. ${k} остался в ${a.area} навсегда. Причина: ${c.label}.`
  ];

  function buildNote(area, cause, source, klass) {
    const t = NOTE_TEMPLATES[Math.floor(Math.random() * NOTE_TEMPLATES.length)];
    return t(area, cause, source, klass.key);
  }

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
    records: build(),
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
