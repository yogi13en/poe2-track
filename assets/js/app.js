/* ══════════════════════════════════════════════════════════════
   app.js — сборка интерфейса: сводка, графики, реестр,
   аккаунт, отчёт о смерти и «живой» поток записей.
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const D = window.PoE.data;
  const C = window.PoE.charts;
  const S = window.PoE.store;
  const esc = C.escapeHtml;

  const PAGE_SIZE = 12;
  const emptySeries = (n) => new Array(n).fill(0);

  /* ── состояние ───────────────────────────────────────────── */
  const state = {
    league: "all",
    range: "all",
    search: "",
    cause: "all",
    klass: "all",
    act: "all",
    hc: false,
    sortKey: "timestamp",
    sortDesc: true,
    page: 1,
    live: true,
    user: null,
    overlay: []
  };

  let all = D.records.slice();

  /* ── helpers ─────────────────────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  function leagueFiltered(records) {
    return state.league === "all" ? records : records.filter((r) => r.league === state.league);
  }

  function rangeFiltered(records) {
    if (state.range === "all") return records;
    const hours = Number(state.range);
    const since = Date.now() - hours * 3600000;
    return records.filter((r) => r.timestamp >= since);
  }

  function ledgerFiltered() {
    const q = state.search.trim().toLowerCase();
    return leagueFiltered(all).filter((r) => {
      if (state.cause !== "all" && r.causeKey !== state.cause) return false;
      if (state.klass !== "all" && r.className !== state.klass) return false;
      if (state.act !== "all" && r.act !== state.act) return false;
      if (state.hc && !r.hardcore) return false;
      if (q) {
        const hay = [r.charName, r.area, r.cause, r.source, r.className, r.damage, r.league].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function sortRecords(list) {
    const dir = state.sortDesc ? -1 : 1;
    return list.slice().sort((a, b) => {
      const av = a[state.sortKey];
      const bv = b[state.sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ru") * dir;
    });
  }

  function animateNumber(node, to, dur) {
    const from = Number(String(node.textContent).replace(/[^\d]/g, "")) || 0;
    if (from === to || document.hidden) { node.textContent = D.fmt(to); return; }
    const start = performance.now();
    const time = dur || 800;
    // страховка: даже если rAF заморожен (фоновая вкладка), число станет верным
    setTimeout(() => { node.textContent = D.fmt(to); }, time + 150);
    function tick(now) {
      const p = Math.min(1, (now - start) / time);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = D.fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
      else node.textContent = D.fmt(to);
    }
    requestAnimationFrame(tick);
  }

  /* ── сводка ──────────────────────────────────────────────── */
  function renderSummary() {
    const records = leagueFiltered(all);
    const s = D.summarize(records);

    animateNumber($("#total-counter"), s.total);
    $("#today-counter").textContent = D.fmt(s.today);
    $("#per-minute").textContent = s.perMinute.toFixed(2).replace(".", ",");
    $("#avg-level").textContent = s.avgLevel ? s.avgLevel.toFixed(1).replace(".", ",") : "—";
    $("#hc-share").textContent = s.hcShare.toFixed(1).replace(".", ",") + "%";

    if (s.topArea) {
      const areaMeta = D.AREAS.find((a) => a.area === s.topArea.name);
      $("#deadliest-area").textContent = s.topArea.name;
      $("#deadliest-act").textContent = areaMeta ? areaMeta.act : "—";
      $("#deadliest-count").textContent = D.fmt(s.topArea.count);
      $("#deadliest-share").textContent = ((s.topArea.count / s.total) * 100).toFixed(1).replace(".", ",") + "%";
      const maxArea = D.countBy(records, "area")[0];
      $("#deadliest-meter").style.width = (maxArea ? (maxArea.value / s.total) * 100 : 0) + "%";
    }

    if (s.topCause) {
      $("#top-cause").textContent = s.topCause.label;
      $("#top-cause-count").textContent = D.fmt(s.topCause.count);
    }

    if (s.topClass) {
      $("#top-class").textContent = s.topClass.name;
      $("#top-class-count").textContent = D.fmt(s.topClass.count);
    }

    if (s.maxLevel) {
      $("#max-level-name").textContent = s.maxLevel.charName;
      $("#max-level-value").textContent = s.maxLevel.level;
      $("#max-level-place").textContent = s.maxLevel.area;
    }

    $("#last-hour").textContent = D.fmt(s.lastHour);
    $("#hour-avg").textContent = Math.round(s.avgPerHour).toLocaleString("ru-RU");

    renderTicker(records.slice(0, 12));
  }

  function renderTicker(records) {
    const track = $("#ticker-track");
    const items = records.map((r) =>
      `<span class="ticker__item"><b>${esc(r.charName)}</b>` +
      `<span class="t-sep">·</span>ур. ${r.level}` +
      `<span class="t-sep">·</span>${esc(r.area)}` +
      `<span class="t-sep">—</span><span class="t-blood">${esc(r.cause)}</span>` +
      `<span class="t-sep">·</span>${D.timeAgo(r.timestamp)}</span>`
    );
    track.innerHTML = items.concat(items).join(""); // дубль для бесшовной прокрутки
  }

  /* ── графики ─────────────────────────────────────────────── */
  function renderCharts() {
    const base = rangeFiltered(leagueFiltered(all));

    const areas = D.countBy(base, "area").slice(0, 10).map((row) => {
      const meta = D.AREAS.find((a) => a.area === row.key);
      return { label: row.key, sub: meta ? meta.act : "", value: row.value };
    });
    C.bars($("#chart-areas"), areas, { labelW: 200, rowH: 40 });

    const causeRows = D.countBy(base, "causeKey");
    const total = base.length || 1;
    const top = causeRows.slice(0, 6).map((row) => {
      const meta = D.causeMeta(row.key) || { label: row.key, color: "#8a8175" };
      return { label: meta.label, value: row.value, color: meta.color };
    });
    const restVal = causeRows.slice(6).reduce((s, r) => s + r.value, 0);
    if (restVal > 0) top.push({ label: "Прочее", value: restVal, color: "#57503f" });

    C.donut($("#chart-causes"), top, "смертей", D.fmt(base.length));
    C.legend($("#legend-causes"), top, total);

    const classes = D.countBy(base, "className").map((row) => {
      const meta = D.classMeta(row.key) || { color: "#8a8175" };
      return { label: row.key, sub: ((row.value / total) * 100).toFixed(1).replace(".", ",") + "% смертей", value: row.value, color: meta.color };
    });
    C.bars($("#chart-classes"), classes, { labelW: 140, rowH: 40, width: 560 });

    C.hourLine($("#chart-hours"), D.hourHistogram(base));
  }

  /* ── реестр ──────────────────────────────────────────────── */
  function renderLedger() {
    const list = sortRecords(ledgerFiltered());
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const startIdx = (state.page - 1) * PAGE_SIZE;
    const rows = list.slice(startIdx, startIdx + PAGE_SIZE);
    const body = $("#ledger-body");

    body.innerHTML = rows.map((r) => {
      const date = new Date(r.timestamp);
      return `<tr data-id="${r.id}">
        <td><span class="td-char"><b>${esc(r.charName)}</b><small>${esc(r.ascendancy || r.className)}</small></span></td>
        <td><span class="class-cell"><span class="class-gem" style="color:${r.classColor || "#8a8175"}"></span>${esc(r.className)}</span></td>
        <td class="td-num"><span class="lvl${r.level >= 80 ? " lvl--high" : ""}">${r.level}</span></td>
        <td class="td-area">${esc(r.area)}<small>${esc(r.act)}</small></td>
        <td><span class="cause-cell"><span class="cause-dot" style="background:${r.causeColor || "#8a8175"}"></span>${esc(r.cause)}<small>${esc(r.source || "")}</small></span></td>
        <td class="td-muted" title="${D.fullDate(r.timestamp)}">${D.timeAgo(r.timestamp)}</td>
        <td class="td-num">${r.hardcore ? '<span class="badge badge--hc">HC</span>' : '<span class="badge">' + esc(r.league) + "</span>"}</td>
      </tr>`;
    }).join("");

    $("#ledger-empty").hidden = rows.length > 0;
    $("#ledger-count").innerHTML = list.length
      ? `Показано <b>${startIdx + 1}–${startIdx + rows.length}</b> из <b>${D.fmt(list.length)}</b> записей`
      : "Записей не найдено";

    renderPager(pages);

    $$("#ledger-body tr").forEach((tr) => {
      tr.addEventListener("click", () => openDeath(tr.dataset.id));
    });

    $$(".th-sort").forEach((th) => {
      const active = th.dataset.sort === state.sortKey;
      th.classList.toggle("is-sorted", active);
      th.classList.toggle("is-desc", active && state.sortDesc);
    });

    state.currentRows = rows;
  }

  function renderPager(pages) {
    const pager = $("#pager");
    const p = state.page;
    const parts = [];
    const btn = (label, page, opts) => {
      const o = opts || {};
      return `<button type="button" data-page="${page}"${o.disabled ? " disabled" : ""} class="${o.active ? "is-active" : ""}" aria-label="${o.label || "Страница " + page}">${label}</button>`;
    };

    parts.push(btn("‹", p - 1, { disabled: p === 1, label: "Назад" }));
    const windowPages = new Set([1, pages, p, p - 1, p + 1]);
    const sorted = [...windowPages].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    let prev = 0;
    sorted.forEach((n) => {
      if (n - prev > 1) parts.push('<span class="pager__gap">…</span>');
      parts.push(btn(String(n), n, { active: n === p }));
      prev = n;
    });
    parts.push(btn("›", p + 1, { disabled: p === pages, label: "Вперёд" }));

    pager.innerHTML = parts.join("");
    $$("button[data-page]", pager).forEach((b) => {
      b.addEventListener("click", () => {
        const n = Number(b.dataset.page);
        if (!n || n < 1) return;
        state.page = n;
        renderLedger();
        $("#ledger").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ── модальное окно смерти ───────────────────────────────── */
  function openDeath(id) {
    const r = all.find((x) => x.id === id);
    if (!r) return;
    const modal = $("#death-modal");
    $("#death-eyebrow").textContent = r.hardcore ? "Hardcore · отчёт о смерти" : "Отчёт о смерти";
    $("#death-title").textContent = r.charName;
    $("#death-sub").textContent = `${r.className}${r.ascendancy ? " · " + r.ascendancy : ""} · уровень ${r.level} · ${r.league}`;

    const facts = [
      ["Место смерти", r.area],
      ["Акт / регион", r.act],
      ["Причина", r.cause],
      ["Источник", r.source || "—"],
      ["Тип урона", r.damage || "—"],
      ["Время", D.fullDate(r.timestamp)]
    ];
    $("#death-facts").innerHTML = facts
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("");

    $("#death-report").textContent = r.note || "Запись добавлена сообществом. Подробности не сохранились.";

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal__close", modal).focus();
  }

  function closeModals() {
    $$(".modal").forEach((m) => { m.hidden = true; });
    document.body.style.overflow = "";
  }

  /* ── аккаунт ─────────────────────────────────────────────── */
  function renderAuthSlot() {
    const slot = $("#auth-slot");
    if (!state.user) {
      slot.innerHTML =
        '<button class="btn btn--ghost" type="button" data-open-auth="login">Войти</button>' +
        '<button class="btn btn--gold" type="button" data-open-auth="register">Регистрация</button>';
      bindAuthButtons();
      $("#report-user").textContent = "требуется вход";
      $("#report-login").hidden = false;
      $("#report-submit").textContent = "Войти и внести в реестр";
      return;
    }

    const initial = (state.user.name || "?")[0].toUpperCase();
    slot.innerHTML =
      `<div class="user-menu" id="user-menu">
        <button class="user-chip" type="button" id="user-chip" aria-haspopup="true" aria-expanded="false">
          <span class="user-chip__avatar">${esc(initial)}</span>
          <span class="user-chip__meta">
            <span class="user-chip__name">${esc(state.user.name)}</span>
            <span class="user-chip__mode">${S.mode === "api" ? "сервер" : "локально"}</span>
          </span>
        </button>
        <div class="user-menu__dropdown">
          <button class="user-menu__item" type="button" id="menu-report">✚ Добавить смерть</button>
          <button class="user-menu__item" type="button" id="menu-stats">☠ Мои записи: ${S.stats().submitted}</button>
          <button class="user-menu__item" type="button" id="menu-logout">⏻ Выйти</button>
        </div>
      </div>`;

    $("#user-chip").addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = $("#user-menu");
      const open = menu.classList.toggle("is-open");
      $("#user-chip").setAttribute("aria-expanded", String(open));
    });
    $("#menu-logout").addEventListener("click", async () => {
      await S.logout();
      toast("Вы вышли из аккаунта.");
    });
    $("#menu-report").addEventListener("click", () => {
      $("#user-menu").classList.remove("is-open");
      $("#report").scrollIntoView({ behavior: "smooth" });
    });
    $("#menu-stats").addEventListener("click", () => {
      $("#user-menu").classList.remove("is-open");
      toast(`Ваших записей в реестре: ${S.stats().submitted}.`);
    });

    $("#report-user").textContent = "вы вошли как " + state.user.name;
    $("#report-login").hidden = true;
    $("#report-submit").textContent = "Внести в реестр";
  }

  function bindAuthButtons() {
    $$("[data-open-auth]").forEach((b) => {
      b.addEventListener("click", () => openAuth(b.dataset.openAuth));
    });
  }

  let authMode = "login";

  function openAuth(mode) {
    authMode = mode || "login";
    const modal = $("#auth-modal");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setAuthMode(authMode);
    setTimeout(() => $('input[name="email"]', modal).focus(), 60);
  }

  function setAuthMode(mode) {
    authMode = mode;
    const modal = $("#auth-modal");
    $$(".auth-tabs__btn", modal).forEach((b) => {
      const active = b.dataset.authTab === mode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    $('[data-auth-field="name"]', modal).hidden = mode !== "register";
    $('[data-auth-field="confirm"]', modal).hidden = mode !== "register";
    $("#auth-title").textContent = mode === "login" ? "Врата Рэкласта" : "Стать охотником";
    $("#auth-sub").textContent = mode === "login"
      ? "Войдите, чтобы добавлять записи в реестр."
      : "Аккаунт хранит ваши отчёты о смертях. Это бесплатно.";
    $("#auth-submit").textContent = mode === "login" ? "Войти" : "Создать аккаунт";
    $("#auth-foot").innerHTML = mode === "login"
      ? 'Нет аккаунта? <button type="button" class="link-btn" data-auth-switch="register">Создать</button>'
      : 'Уже есть аккаунт? <button type="button" class="link-btn" data-auth-switch="login">Войти</button>';
    $$("[data-auth-switch]", modal).forEach((b) => {
      b.addEventListener("click", () => setAuthMode(b.dataset.authSwitch));
    });
    $('input[name="password"]', modal).setAttribute("autocomplete", mode === "login" ? "current-password" : "new-password");
    $("#auth-error").hidden = true;
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const errBox = $("#auth-error");
    const submit = $("#auth-submit");
    errBox.hidden = true;
    submit.disabled = true;
    submit.textContent = "Проверяем…";

    try {
      if (authMode === "register") {
        if (data.password !== data.confirm) throw new Error("Пароли не совпадают.");
        if ((data.password || "").length < 6) throw new Error("Пароль должен быть не короче 6 символов.");
        await S.register({ email: data.email, password: data.password, name: data.name });
        toast("Аккаунт создан. Добро пожаловать, охотник.", "ok");
      } else {
        await S.login({ email: data.email, password: data.password });
        toast("С возвращением в Рэкласт.", "ok");
      }
      form.reset();
      closeModals();
      $("#report").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      errBox.textContent = err.message || "Что-то пошло не так.";
      errBox.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = authMode === "login" ? "Войти" : "Создать аккаунт";
    }
  }

  /* ── отчёт о смерти ──────────────────────────────────────── */
  function fillFormSelects() {
    const classSel = $('select[name="class"]', $("#report-form"));
    classSel.innerHTML = D.CLASSES.map((c) => `<option value="${c.key}">${c.key} — ${c.ascendancies.join(" / ")}</option>`).join("");

    const leagueSel = $('select[name="league"]', $("#report-form"));
    leagueSel.innerHTML = D.LEAGUES.map((l) => `<option value="${l}">${l}</option>`).join("");

    const acts = [...new Set(D.AREAS.map((a) => a.act))];
    $("#form-act").innerHTML = acts.map((a) => `<option value="${a}">${a}</option>`).join("");
    refreshAreaSelect();

    const causeSel = $('select[name="cause"]', $("#report-form"));
    causeSel.innerHTML = D.CAUSES.map((c) => `<option value="${c.key}">${c.label}</option>`).join("");

    $("#filter-cause").innerHTML = '<option value="all">Все причины</option>' +
      D.CAUSES.map((c) => `<option value="${c.key}">${c.label}</option>`).join("");
    $("#filter-class").innerHTML = '<option value="all">Все классы</option>' +
      D.CLASSES.map((c) => `<option value="${c.key}">${c.key}</option>`).join("");
    $("#filter-act").innerHTML = '<option value="all">Все акты</option>' +
      acts.map((a) => `<option value="${a}">${a}</option>`).join("");
  }

  function refreshAreaSelect() {
    const act = $("#form-act").value;
    const areas = D.AREAS.filter((a) => a.act === act).map((a) => a.area);
    $("#form-area").innerHTML = areas.map((a) => `<option value="${a}">${a}</option>`).join("");
  }

  async function handleReportSubmit(e) {
    e.preventDefault();
    if (!state.user) {
      openAuth("login");
      return;
    }
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const err = $("#form-error");
    err.hidden = true;

    const charName = (data.charName || "").trim();
    if (charName.length < 2) {
      err.textContent = "Введите имя персонажа (мин. 2 символа).";
      err.hidden = false;
      return;
    }
    const level = Math.max(1, Math.min(100, Number(data.level) || 1));
    const meta = D.classMeta(data.class);
    const cause = D.causeMeta(data.cause);
    const areaMeta = D.AREAS.find((a) => a.area === data.area);

    const record = {
      charName,
      className: data.class,
      classColor: meta ? meta.color : "#8a8175",
      ascendancy: meta ? meta.ascendancies[0] : "",
      level,
      area: data.area,
      act: areaMeta ? areaMeta.act : "—",
      causeKey: data.cause,
      cause: cause ? cause.label : data.cause,
      causeColor: cause ? cause.color : "#8a8175",
      source: (data.source || "").trim() || "Не указан",
      damage: "—",
      league: data.league,
      hardcore: data.hardcore === "on",
      timestamp: Date.now(),
      community: true,
      note: `Личный отчёт: ${charName} погиб в ${data.area}. Причина — ${cause ? cause.label : "неизвестна"}.`
    };

    const btn = $("#report-submit");
    btn.disabled = true;
    btn.textContent = "Записываем…";
    try {
      const saved = await S.addDeath(record);
      all.unshift(saved);
      all.sort((a, b) => b.timestamp - a.timestamp);
      form.reset();
      refreshAreaSelect();
      state.page = 1;
      state.sortKey = "timestamp";
      state.sortDesc = true;
      renderAll();
      toast("Запись добавлена в книгу падших.", "ok");
      if (state.currentRows && state.currentRows[0]) {
        const row = $(`#ledger-body tr[data-id="${saved.id}"]`);
        if (row) row.classList.add("is-new");
      }
    } catch (ex) {
      err.textContent = ex.message || "Не удалось сохранить запись.";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Внести в реестр";
    }
  }

  /* ── живые записи ────────────────────────────────────────── */
  function randomRecord() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const klass = pick(D.CLASSES);
    const cause = pick(D.CAUSES);
    const area = pick(D.AREAS);
    const boss = (D.BOSS_BY_AREA[area.area] || [])[0];
    const source = cause.key === "boss" && boss ? boss : pick([
      "Rare Pack", "Vaal Spawn", "Bog Crawler", "Twisted Remnant", "Rare Monster"
    ]);
    return {
      id: "live" + Date.now().toString(36),
      charName: pick(["Kelari", "Draven", "Ysla", "Vornt", "Mirelle", "Thane", "Ashka", "Bram"]) + "_" + pick(["Ash", "Vow", "Bane", "Pyre", "Dirge"]),
      className: klass.key,
      classColor: klass.color,
      ascendancy: klass.ascendancies[0],
      level: 20 + Math.floor(Math.random() * 78),
      area: area.area,
      act: area.act,
      causeKey: cause.key,
      cause: cause.label,
      causeColor: cause.color,
      source,
      damage: "—",
      league: pick(D.LEAGUES),
      hardcore: Math.random() < 0.3,
      timestamp: Date.now(),
      community: false,
      note: "Смерть зафиксирована в live-потоке."
    };
  }

  let liveTimer = null;

  function startLive() {
    stopLive();
    liveTimer = setInterval(() => {
      const rec = randomRecord();
      all.unshift(rec);
      renderSummary();
      if (state.page === 1) renderLedger();
      $("#updated-at").textContent = "только что";
    }, 9000);
    $("#live-toggle").setAttribute("aria-pressed", "true");
  }

  function stopLive() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = null;
    $("#live-toggle").setAttribute("aria-pressed", "false");
  }

  /* ── тосты ───────────────────────────────────────────────── */
  function toast(message, kind) {
    const box = document.createElement("div");
    box.className = "toast" + (kind ? " toast--" + kind : "");
    box.textContent = message;
    $("#toasts").appendChild(box);
    setTimeout(() => {
      box.classList.add("is-out");
      setTimeout(() => box.remove(), 320);
    }, 3600);
  }

  /* ── события ─────────────────────────────────────────────── */
  function bindEvents() {
    $$(".hero__league .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$(".hero__league .chip").forEach((c) => {
          c.classList.toggle("is-active", c === chip);
          c.setAttribute("aria-selected", String(c === chip));
        });
        state.league = chip.dataset.league;
        state.page = 1;
        renderAll();
      });
    });

    $$("#chart-range .segmented__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#chart-range .segmented__btn").forEach((b) => b.classList.toggle("is-active", b === btn));
        state.range = btn.dataset.range;
        renderCharts();
      });
    });

    let searchTimer = null;
    $("#search-input").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value;
        state.page = 1;
        renderLedger();
      }, 180);
    });

    $("#filter-cause").addEventListener("change", (e) => { state.cause = e.target.value; state.page = 1; renderLedger(); });
    $("#filter-class").addEventListener("change", (e) => { state.klass = e.target.value; state.page = 1; renderLedger(); });
    $("#filter-act").addEventListener("change", (e) => { state.act = e.target.value; state.page = 1; renderLedger(); });
    $("#filter-hc").addEventListener("change", (e) => { state.hc = e.target.checked; state.page = 1; renderLedger(); });

    const reset = () => {
      state.search = "";
      state.cause = "all";
      state.klass = "all";
      state.act = "all";
      state.hc = false;
      state.page = 1;
      $("#search-input").value = "";
      $("#filter-cause").value = "all";
      $("#filter-class").value = "all";
      $("#filter-act").value = "all";
      $("#filter-hc").checked = false;
      renderLedger();
    };
    $("#reset-filters").addEventListener("click", reset);
    $("#empty-reset").addEventListener("click", reset);

    $$(".th-sort").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDesc = !state.sortDesc;
        else { state.sortKey = key; state.sortDesc = key === "timestamp" || key === "level"; }
        state.page = 1;
        renderLedger();
      });
    });

    $("#live-toggle").addEventListener("click", () => {
      state.live = !state.live;
      if (state.live) { startLive(); toast("Live-поток включён."); }
      else { stopLive(); toast("Live-поток приостановлен."); }
    });

    $("#form-act").addEventListener("change", refreshAreaSelect);

    $("#report-form").addEventListener("submit", handleReportSubmit);
    $("#report-login").addEventListener("click", () => openAuth("login"));
    $("#auth-form").addEventListener("submit", handleAuthSubmit);
    $$("[data-auth-tab]").forEach((b) => b.addEventListener("click", () => setAuthMode(b.dataset.authTab)));

    $$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModals));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModals();
    });

    document.addEventListener("click", (e) => {
      const menu = $("#user-menu");
      if (menu && !menu.contains(e.target)) menu.classList.remove("is-open");
    });

    const burger = $("#nav-burger");
    burger.addEventListener("click", () => {
      const nav = $(".nav");
      const open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    $$(".nav a").forEach((a) => a.addEventListener("click", () => $(".nav").classList.remove("is-open")));

    S.onChange((user) => {
      state.user = user;
      renderAuthSlot();
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderCharts, 220);
    });
  }

  /* ── общий рендер ────────────────────────────────────────── */
  function renderAll() {
    renderAuthSlot();
    renderSummary();
    renderCharts();
    renderLedger();
    $("#updated-at").textContent = "только что";
  }

  /* ── запуск ──────────────────────────────────────────────── */
  async function init() {
    fillFormSelects();
    bindEvents();
    renderCharts();
    renderLedger();

    await S.init();
    state.user = S.user();
    renderAuthSlot();

    try {
      const community = await S.communityDeaths();
      if (community.length) {
        all = community.map(normalizeCommunity).concat(all)
          .sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (e) {
      console.warn("Не удалось загрузить записи сообщества", e);
    }

    renderAll();
    startLive();

    setInterval(() => {
      $("#updated-at").textContent = "только что";
    }, 30000);

    // лёгкая «жизнь» цифр в шапке
    setInterval(() => {
      const el = $("#per-minute");
      const value = Number(el.textContent.replace(",", ".")) || 0;
      el.textContent = Math.max(0.1, value + (Math.random() - 0.5) * 0.12).toFixed(2).replace(".", ",");
    }, 4000);
  }

  function normalizeCommunity(r) {
    const meta = D.classMeta(r.className) || {};
    const cause = D.causeMeta(r.causeKey) || {};
    return Object.assign({
      classColor: meta.color || "#8a8175",
      causeColor: cause.color || "#8a8175",
      ascendancy: meta.ascendancies ? meta.ascendancies[0] : "",
      source: "—",
      damage: "—",
      act: "—",
      note: ""
    }, r);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
