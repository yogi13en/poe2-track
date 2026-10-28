/* ══════════════════════════════════════════════════════════════
   store.js — аккаунты, сессия и запись смертей.

   Работает в двух режимах:
   · local  — данные в localStorage браузера (демо, по умолчанию);
   · api    — реальный сервер (server.py): задайте
              window.POE2_CONFIG = { apiBase: "https://ваш-сервер/api" }
              в assets/js/config.js ПЕРЕД подключением этого файла.
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
  const MODE = API ? "api" : "local";
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

    // Запасной вариант для file:// (не secure context). Слабее, но не ломает демо.
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
  const store = {
    mode: MODE,

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
      if (MODE === "api") {
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
      if (MODE === "api") {
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

    /** Локально добавленные записи (или записи сообщества с сервера). */
    async communityDeaths() {
      if (MODE === "api") {
        try {
          const res = await api("/deaths?limit=500");
          return res.deaths || [];
        } catch (e) {
          return [];
        }
      }
      return localDeaths().sort((a, b) => b.timestamp - a.timestamp);
    },

    async addDeath(record) {
      if (!user) throw new Error("Сначала войдите в аккаунт.");
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
      const mine = localDeaths().filter((d) => user && d.authorId === user.id);
      return {
        submitted: mine.length,
        deepest: mine.reduce((m, d) => Math.max(m, d.level), 0)
      };
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
