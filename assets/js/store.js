/* ══════════════════════════════════════════════════════════════
   store.js — аккаунты, сессия и запись смертей.

   Работает в трёх режимах:
   · local  — всё в localStorage браузера (по умолчанию);
   · cloud  — общая статистика на Supabase: записи видят все,
              аккаунты остаются локальными (см. assets/js/config.js);
   · api    — свой сервер (server.py): window.POE2_CONFIG.apiBase.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const K = {
    users: "poe2track.users.v1",
    session: "poe2track.session.v1",
    deaths: "poe2track.deaths.v1"
  };

  const cfg = global.POE2_CONFIG || {};
  const API = (cfg.apiBase || "").replace(/\/$/, "");
  const SB = cfg.supabase && cfg.supabase.url ? {
    url: cfg.supabase.url.replace(/\/$/, ""),
    key: cfg.supabase.anonKey || ""
  } : null;
  const MODE = SB ? "cloud" : API ? "api" : "local";
  // в облаке аккаунты по-прежнему локальные: общими должны быть смерти, а не пароли
  const LOCAL_AUTH = MODE !== "api";
  const listeners = new Set();
  let user = null;

  /* ── утилиты хранилища ───────────────────────────────────── */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("localStorage недоступен", e);
    }
  }

  function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function b64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  /* ── хеширование пароля ──────────────────────────────────── */
  async function hashPassword(password, saltB64) {
    const enc = new TextEncoder();
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));

    if (global.crypto && global.crypto.subtle) {
      const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
        key,
        256
      );
      return "pbkdf2$120000$" + b64(bits);
    }

    // Запасной вариант для file:// (не secure context). Слабее, но работает без HTTPS.
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    const data = enc.encode(password + saltB64);
    for (let round = 0; round < 5000; round++) {
      for (let i = 0; i < data.length; i++) {
        h1 ^= data[i] + round;
        h1 = Math.imul(h1, 0x01000193) >>> 0;
        h2 ^= h1;
        h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
      }
    }
    return "fnv-fallback$" + h1.toString(16) + h2.toString(16);
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  /* ── API транспорт ───────────────────────────────────────── */
  async function api(path, options) {
    const opts = Object.assign({ headers: {} }, options || {});
    opts.headers["Content-Type"] = "application/json";
    const session = readJSON(K.session, null);
    if (session && session.token) opts.headers["Authorization"] = "Bearer " + session.token;

    const res = await fetch(API + path, opts);
    let payload = null;
    try { payload = await res.json(); } catch (e) { /* пустой ответ */ }
    if (!res.ok) throw new Error((payload && payload.error) || "Ошибка сервера (" + res.status + ")");
    return payload;
  }

  /* ── Supabase (общая статистика) ─────────────────────────── */
  async function sb(path, options) {
    const opts = Object.assign({ headers: {} }, options || {});
    opts.headers["apikey"] = SB.key;
    opts.headers["Authorization"] = "Bearer " + SB.key;
    opts.headers["Content-Type"] = "application/json";
    opts.headers["Accept"] = "application/json";

    const res = await fetch(SB.url + path, opts);
    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (e) { payload = null; }
    if (!res.ok) {
      const msg = payload && (payload.message || payload.hint || payload.error_description);
      throw new Error(msg || "Supabase ответил " + res.status);
    }
    return payload;
  }

  const SB_COLUMNS = "id,char_name,class_name,ascendancy,level,area,act,cause_key,cause,source," +
    "damage,league,hardcore,note,author,author_id,created_at";

  function rowToRecord(r) {
    return {
      id: r.id,
      charName: r.char_name,
      className: r.class_name,
      ascendancy: r.ascendancy || "",
      level: r.level,
      area: r.area,
      act: r.act,
      causeKey: r.cause_key,
      cause: r.cause,
      source: r.source || "",
      damage: r.damage || "—",
      league: r.league,
      hardcore: !!r.hardcore,
      timestamp: new Date(r.created_at).getTime(),
      community: true,
      author: r.author || "",
      authorId: r.author_id || "",
      note: r.note || ""
    };
  }

  function recordToRow(rec) {
    return {
      char_name: String(rec.charName || "").slice(0, 32),
      class_name: rec.className,
      ascendancy: rec.ascendancy || null,
      level: Math.max(1, Math.min(100, Number(rec.level) || 1)),
      area: rec.area,
      act: rec.act,
      cause_key: rec.causeKey,
      cause: rec.cause,
      source: (rec.source || "").slice(0, 48),
      damage: rec.damage || null,
      league: rec.league,
      hardcore: !!rec.hardcore,
      note: (rec.note || "").slice(0, 500),
      author: (user && user.name) || null,
      author_id: (user && user.id) || null
    };
  }

  /* ── локальный бэкенд ────────────────────────────────────── */
  function localUsers() { return readJSON(K.users, []); }

  async function localRegister({ email, password, name }) {
    const users = localUsers();
    const normalized = email.trim().toLowerCase();
    if (!validEmail(normalized)) throw new Error("Похоже, e-mail введён с ошибкой.");
    if (password.length < 6) throw new Error("Пароль должен быть не короче 6 символов.");
    if (users.some((u) => u.email === normalized)) throw new Error("На этот e-mail уже зарегистрирован охотник.");

    const salt = randomHex(16);
    const hash = await hashPassword(password, btoa(salt));
    const account = {
      id: "u_" + randomHex(6),
      email: normalized,
      name: (name || "").trim() || normalized.split("@")[0],
      salt,
      hash,
      createdAt: Date.now()
    };
    users.push(account);
    writeJSON(K.users, users);
    return startLocalSession(account);
  }

  async function localLogin({ email, password }) {
    const normalized = email.trim().toLowerCase();
    const users = localUsers();
    const account = users.find((u) => u.email === normalized);
    if (!account) throw new Error("Охотник с таким e-mail не найден.");
    const hash = await hashPassword(password, btoa(account.salt));
    if (hash !== account.hash) throw new Error("Неверный пароль. Попробуйте ещё раз.");
    return startLocalSession(account);
  }

  function startLocalSession(account) {
    const session = { token: "local_" + randomHex(8), userId: account.id, createdAt: Date.now() };
    writeJSON(K.session, session);
    user = publicUser(account);
    emit();
    return user;
  }

  function publicUser(account) {
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      createdAt: account.createdAt,
      mode: MODE
    };
  }

  function localDeaths() { return readJSON(K.deaths, []); }

  /* ── публичный API ───────────────────────────────────────── */
  let shared = [];   // последняя загруженная порция общих записей (облако/сервер)

  const store = {
    mode: MODE,
    isShared: MODE !== "local",

    async init() {
      if (MODE === "api") {
        const session = readJSON(K.session, null);
        if (session && session.token) {
          try {
            const me = await api("/me");
            user = me.user;
          } catch (e) {
            localStorage.removeItem(K.session);
            user = null;
          }
        }
      } else {
        const session = readJSON(K.session, null);
        if (session && session.userId) {
          const account = localUsers().find((u) => u.id === session.userId);
          user = account ? publicUser(account) : null;
        }
      }
      emit();
      return user;
    },

    user() { return user; },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    async register({ email, password, name }) {
      if (!LOCAL_AUTH) {
        const res = await api("/register", {
          method: "POST",
          body: JSON.stringify({ email, password, name })
        });
        writeJSON(K.session, res.session);
        user = res.user;
        emit();
        return user;
      }
      return localRegister({ email, password, name });
    },

    async login({ email, password }) {
      if (!LOCAL_AUTH) {
        const res = await api("/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        writeJSON(K.session, res.session);
        user = res.user;
        emit();
        return user;
      }
      return localLogin({ email, password });
    },

    async logout() {
      if (MODE === "api") {
        try { await api("/logout", { method: "POST" }); } catch (e) { /* игнорируем */ }
      }
      localStorage.removeItem(K.session);
      user = null;
      emit();
    },

    /** Общие записи: Supabase, server.py или localStorage. */
    async communityDeaths() {
      if (MODE === "cloud") {
        const rows = await sb("/rest/v1/deaths?select=" + SB_COLUMNS +
          "&order=created_at.desc&limit=1000");
        shared = (rows || []).map(rowToRecord);
        return shared;
      }
      if (MODE === "api") {
        try {
          const res = await api("/deaths?limit=500");
          shared = res.deaths || [];
          return shared;
        } catch (e) {
          return [];
        }
      }
      shared = localDeaths().sort((a, b) => b.timestamp - a.timestamp);
      return shared;
    },

    async addDeath(record) {
      if (!user) throw new Error("Сначала войдите в аккаунт.");

      if (MODE === "cloud") {
        const rows = await sb("/rest/v1/deaths?select=" + SB_COLUMNS, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(recordToRow(record))
        });
        const saved = rows && rows[0] ? rowToRecord(rows[0]) : null;
        if (saved) shared = [saved].concat(shared.filter((r) => r.id !== saved.id));
        return saved || Object.assign({}, record, { id: "tmp" + Date.now(), community: true });
      }

      if (MODE === "api") {
        const res = await api("/deaths", { method: "POST", body: JSON.stringify(record) });
        return res.death;
      }

      const list = localDeaths();
      const entry = Object.assign({}, record, {
        id: "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        author: user.name,
        authorId: user.id,
        community: true,
        timestamp: Date.now()
      });
      list.push(entry);
      writeJSON(K.deaths, list);
      return entry;
    },

    /** Сводка по аккаунту для меню. */
    stats() {
      const source = MODE === "api" || MODE === "cloud" ? shared : localDeaths();
      const mine = source.filter((d) => user && (d.authorId === user.id || d.author === user.name));
      return {
        submitted: mine.length,
        deepest: mine.reduce((m, d) => Math.max(m, d.level), 0)
      };
    },

    /** Однократный перенос записей, сделанных до подключения облака. */
    async migrateLocalDeaths() {
      if (MODE !== "cloud" || !user) return 0;
      const pending = localDeaths();
      if (!pending.length) return 0;
      let moved = 0;
      for (const rec of pending) {
        try {
          await this.addDeath(rec);
          moved++;
        } catch (e) {
          break;
        }
      }
      writeJSON(K.deaths, moved === pending.length ? [] : pending.slice(moved));
      return moved;
    }
  };

  function emit() {
    listeners.forEach((fn) => {
      try { fn(user); } catch (e) { console.error(e); }
    });
  }

  global.PoE = global.PoE || {};
  global.PoE.store = store;
})(window);
