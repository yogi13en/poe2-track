/* ══════════════════════════════════════════════════════════════
   player.js — кастомный Spotify-плеер поверх официального Embed API.
   Умеет: переключать треки, play/pause, перемотку, громкость,
   mute, перемешивание, выбор трека из списка и свои плейлисты
   (ссылка на плейлист/альбом/треки Spotify хранится в браузере).
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const BUILTIN = global.PoE_TRACKS || { tracks: [], playlistName: "Path of Exile 2", playlistUrl: "https://open.spotify.com" };
  const LS_SOURCES = "poe2track.playlists.v1";
  const LS_ACTIVE = "poe2track.playlist.active.v1";
  const MAX_SOURCES = 20;
  const MAX_TRACKS = 100;

  const el = {
    player: document.getElementById("player"),
    handle: document.getElementById("player-handle"),
    collapseLabel: document.getElementById("player-collapse-label"),
    embed: document.getElementById("spotify-embed"),
    fallback: document.getElementById("spotify-fallback"),
    fallbackLink: document.getElementById("spotify-fallback-link"),
    track: document.getElementById("player-track"),
    state: document.getElementById("player-state"),
    prev: document.getElementById("sp-prev"),
    next: document.getElementById("sp-next"),
    play: document.getElementById("sp-play"),
    shuffle: document.getElementById("sp-shuffle"),
    seek: document.getElementById("sp-seek"),
    elapsed: document.getElementById("sp-elapsed"),
    duration: document.getElementById("sp-duration"),
    mute: document.getElementById("sp-mute"),
    volume: document.getElementById("sp-volume"),
    volumeValue: document.getElementById("sp-volume-value"),
    list: document.getElementById("sp-tracklist"),
    listHint: document.getElementById("sp-list-hint"),
    source: document.getElementById("sp-source"),
    addPlaylist: document.getElementById("sp-add-playlist"),
    addPlaylistAlt: document.getElementById("sp-add-playlist-alt"),
    modal: document.getElementById("playlist-modal"),
    form: document.getElementById("playlist-form"),
    nameInput: document.querySelector("#playlist-form [name=\"name\"]"),
    linksInput: document.querySelector("#playlist-form [name=\"links\"]"),
    error: document.getElementById("playlist-error"),
    savedBox: document.getElementById("playlist-saved"),
    savedList: document.getElementById("playlist-saved-list")
  };

  if (!el.player) return;

  const ICON_PLAY = el.play.querySelector(".ic-play");
  const ICON_PAUSE = el.play.querySelector(".ic-pause");

  /* разбор ссылок Spotify — объявлено до чтения localStorage */
  const ID_RE = "[A-Za-z0-9]{22}";
  const URI_RE = new RegExp("^spotify:(track|episode|album|playlist|artist|show):(" + ID_RE + ")$", "i");
  const URL_RE = new RegExp("^https?://open\\.spotify\\.com/(?:[^/?#]+/)*(track|episode|album|playlist|artist|show)/(" + ID_RE + ")(?:[?#].*)?$", "i");
  const BARE_RE = new RegExp("^" + ID_RE + "$");

  const state = {
    sourceId: localStorage.getItem(LS_ACTIVE) || "builtin",
    sources: loadSources(),
    tracks: [],
    kind: "tracks",
    index: 0,
    controller: null,
    ready: false,
    playing: false,
    volume: Number(localStorage.getItem("poe2track.volume") || 0.7),
    lastVolume: 0.7,
    duration: 0,
    position: 0,
    dragging: false,
    pendingPlay: false,
    ended: false
  };

  /* ── форматирование ──────────────────────────────────────── */
  function mmss(ms) {
    if (!ms || ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function paintRange(input, pct) {
    input.style.setProperty("--p", Math.max(0, Math.min(100, pct)) + "%");
  }

  function entityLabel(kind) {
    if (kind === "album") return "Альбом Spotify";
    if (kind === "artist") return "Исполнитель Spotify";
    if (kind === "show") return "Подкаст Spotify";
    return "Плейлист Spotify";
  }

  function defaultName(kind) {
    if (kind === "album") return "Мой альбом";
    if (kind === "artist") return "Мой исполнитель";
    if (kind === "show") return "Мой подкаст";
    return "Мой плейлист";
  }

  /* ── свои плейлисты: хранилище ───────────────────────────── */
  function uid() {
    return "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function parseLink(text) {
    const value = String(text || "").trim().replace(/[)\],.;]+$/, "");
    if (!value) return null;
    let m = value.match(URI_RE);
    if (m) return { type: m[1].toLowerCase(), id: m[2] };
    m = value.match(URL_RE);
    if (m) return { type: m[1].toLowerCase(), id: m[2] };
    if (BARE_RE.test(value)) return { type: "track", id: value };
    return null;
  }

  /* строка вида «Название — Исполнитель | ссылка» или просто ссылка */
  function parseLine(line) {
    const raw = String(line || "").trim();
    if (!raw) return null;
    const cut = raw.lastIndexOf("|");
    let label = "";
    let link = raw;
    if (cut > 0) {
      label = raw.slice(0, cut).trim();
      link = raw.slice(cut + 1).trim();
    }
    const parsed = parseLink(link);
    if (!parsed) return null;

    let title = "";
    let artist = "";
    if (label) {
      const parts = label.split(/\s+[—–]\s+|\s+-\s+/);
      if (parts.length > 1) {
        artist = parts.pop().trim();
        title = parts.join(" — ").trim();
      } else {
        title = label;
      }
    }
    return {
      type: parsed.type,
      id: parsed.id,
      uri: "spotify:" + parsed.type + ":" + parsed.id,
      title: title.slice(0, 80),
      artist: artist.slice(0, 60)
    };
  }

  function sanitizeSource(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim().slice(0, 40);
    const id = String(raw.id || "").slice(0, 40) || uid();

    if (raw.kind === "collection") {
      const parsed = parseLink(raw.uri) || parseLink(raw.url);
      if (!parsed) return null;
      if (["playlist", "album", "artist", "show"].indexOf(parsed.type) < 0) return null;
      return {
        id: id,
        name: name || defaultName(parsed.type),
        kind: "collection",
        entity: parsed.type,
        uri: "spotify:" + parsed.type + ":" + parsed.id,
        url: "https://open.spotify.com/" + parsed.type + "/" + parsed.id
      };
    }

    if (raw.kind === "tracks" && Array.isArray(raw.tracks)) {
      const seen = new Set();
      const tracks = [];
      for (const t of raw.tracks) {
        if (!t || typeof t.uri !== "string") continue;
        const parsed = parseLink(t.uri);
        if (!parsed || (parsed.type !== "track" && parsed.type !== "episode")) continue;
        const uri = "spotify:" + parsed.type + ":" + parsed.id;
        if (seen.has(uri)) continue;
        seen.add(uri);
        tracks.push({
          uri: uri,
          title: String(t.title || "Трек " + (tracks.length + 1)).slice(0, 80),
          artist: String(t.artist || "").slice(0, 60),
          duration: Number(t.duration) || 0
        });
        if (tracks.length >= MAX_TRACKS) break;
      }
      if (!tracks.length) return null;
      return { id: id, name: name || "Мои треки", kind: "tracks", tracks: tracks };
    }
    return null;
  }

  function loadSources() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(LS_SOURCES) || "[]");
    } catch (e) {
      raw = [];
    }
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizeSource).filter(Boolean).slice(0, MAX_SOURCES);
  }

  function saveSources() {
    try {
      localStorage.setItem(LS_SOURCES, JSON.stringify(state.sources));
    } catch (e) {
      console.warn("Не удалось сохранить плейлисты", e);
    }
  }

  function builtinSource() {
    return {
      id: "builtin",
      name: BUILTIN.playlistName || "Path of Exile 2",
      kind: "tracks",
      builtin: true,
      url: BUILTIN.playlistUrl,
      tracks: (BUILTIN.tracks || []).map((t) => ({
        uri: t.uri,
        title: t.title,
        artist: t.artist,
        duration: t.duration
      }))
    };
  }

  function allSources() {
    return [builtinSource()].concat(state.sources);
  }

  function currentSource() {
    return allSources().find((s) => s.id === state.sourceId) || allSources()[0];
  }

  /* ── список источников и треков ──────────────────────────── */
  function renderSources() {
    if (!el.source) return;
    el.source.innerHTML = "";
    allSources().forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.builtin ? s.name + " · штатный" : s.name;
      el.source.appendChild(opt);
    });
    el.source.value = currentSource().id;
  }

  function renderTracklist() {
    const src = currentSource();
    el.list.innerHTML = "";

    if (src.kind === "collection") {
      const li = document.createElement("li");
      li.className = "tracklist__item tracklist__item--static";
      li.innerHTML =
        '<span class="tracklist__num">♪</span>' +
        '<span class="tracklist__meta"><b></b><small></small></span>';
      li.querySelector("b").textContent = src.name;
      li.querySelector("small").textContent = entityLabel(src.entity) + " · играет целиком";
      if (src.url) {
        const open = document.createElement("a");
        open.className = "tracklist__open";
        open.href = src.url;
        open.target = "_blank";
        open.rel = "noopener";
        open.title = "Открыть в Spotify";
        open.setAttribute("aria-label", "Открыть плейлист в Spotify");
        open.textContent = "↗";
        li.appendChild(open);
      }
      el.list.appendChild(li);
      if (el.listHint) {
        el.listHint.hidden = false;
        el.listHint.textContent = "Порядок треков листает сам Spotify. Кнопки ⏮ ⏭ работают для своих треков.";
      }
      markActive();
      return;
    }

    if (el.listHint) {
      el.listHint.hidden = true;
      el.listHint.textContent = "";
    }

    src.tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "tracklist__item";
      li.dataset.index = String(i);
      li.innerHTML =
        '<span class="tracklist__num">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="tracklist__meta"><b></b><small></small></span>' +
        '<span class="tracklist__dur">' + (t.duration ? mmss(t.duration) : "—") + "</span>";
      li.querySelector("b").textContent = t.title;
      li.querySelector("small").textContent = t.artist || "Spotify";
      li.addEventListener("click", () => selectTrack(i, true));
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTrack(i, true); }
      });
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      el.list.appendChild(li);
    });
    markActive();
  }

  function markActive() {
    const src = currentSource();

    if (src.kind === "collection") {
      el.track.textContent = src.name;
      el.state.textContent = entityLabel(src.entity) + " · Spotify";
      syncTransport();
      return;
    }

    [...el.list.children].forEach((li, i) => {
      li.classList.toggle("is-active", i === state.index);
    });
    const active = el.list.children[state.index];
    if (active && el.list.parentElement) {
      const wrap = el.list;
      const top = active.offsetTop - wrap.offsetTop;
      if (top < wrap.scrollTop || top + active.offsetHeight > wrap.scrollTop + wrap.clientHeight) {
        wrap.scrollTop = top - wrap.clientHeight / 2 + active.offsetHeight / 2;
      }
    }
    const track = state.tracks[state.index];
    if (track) {
      el.track.textContent = track.title;
      el.state.textContent = (track.artist ? track.artist + " · " : "") + src.name;
    } else {
      el.track.textContent = src.name;
      el.state.textContent = "Список пуст";
    }
    syncTransport();
  }

  /* в режиме плейлиста стрелки и перемешивание недоступны: треки листает Spotify */
  function syncTransport() {
    const collection = currentSource().kind === "collection";
    [el.prev, el.next, el.shuffle].forEach((btn) => {
      if (!btn) return;
      btn.disabled = collection;
    });
    const hint = collection ? "Переключение треков — в самом Spotify" : "Предыдущий трек";
    if (el.prev) el.prev.title = collection ? hint : "Предыдущий трек";
    if (el.next) el.next.title = collection ? hint : "Следующий трек";
    if (el.shuffle) el.shuffle.title = collection ? hint : "Перемешать";
  }

  /* ── создание контроллера ────────────────────────────────── */
  function boot(IFrameAPI) {
    clearTimeout(watchdog);
    const src = currentSource();
    const uri = src.kind === "collection" ? src.uri : (src.tracks[0] ? src.tracks[0].uri : "");
    if (!uri) return;
    try {
      const options = {
        uri: uri,
        width: el.embed.clientWidth || 340,
        height: 152
      };
      IFrameAPI.createController(el.embed, options, (controller) => {
        state.controller = controller;
        controller.addListener("ready", onReady);
        controller.addListener("playback_started", onPlaybackStarted);
        controller.addListener("playback_update", onUpdate);
        controller.addListener("playback_error", onError);
      });
    } catch (err) {
      console.warn("Spotify embed error", err);
      showFallback();
    }
  }

  function onReady() {
    state.ready = true;
    applyVolume(state.volume);
    if (typeof state.controller.setVolume !== "function") {
      el.player.classList.add("no-volume");
      el.volume.disabled = true;
      el.mute.disabled = true;
      el.volumeValue.textContent = "—";
      el.volume.title = "Громкость регулируется в самом плеере Spotify";
    }
    if (state.pendingPlay) {
      state.pendingPlay = false;
      try { state.controller.play(); } catch (e) { /* автоплей может быть запрещён */ }
    }
    sizeEmbedFrame();
  }

  function sizeEmbedFrame() {
    const frame = el.embed.querySelector("iframe");
    if (frame) {
      frame.style.width = "100%";
      frame.style.height = "152px";
      frame.style.border = "0";
      frame.setAttribute("title", "Spotify — " + currentSource().name);
      frame.setAttribute("loading", "lazy");
    }
  }

  function onPlaybackStarted(e) {
    const uri = e && e.data && e.data.playingURI;
    if (currentSource().kind === "tracks") {
      const found = state.tracks.findIndex((t) => t.uri === uri);
      if (found >= 0 && found !== state.index) {
        state.index = found;
        markActive();
      }
    }
    setPlaying(true);
  }

  function onUpdate(e) {
    if (!e || !e.data) return;
    const d = e.data;
    if (typeof d.duration === "number" && d.duration > 0) state.duration = d.duration;
    if (typeof d.position === "number") state.position = d.position;
    setPlaying(!d.isPaused);

    if (!state.dragging) {
      el.seek.value = String(state.duration ? Math.round((state.position / state.duration) * 1000) : 0);
      paintRange(el.seek, state.duration ? (state.position / state.duration) * 100 : 0);
    }
    el.elapsed.textContent = mmss(state.position);
    el.duration.textContent = mmss(state.duration);

    // конец трека → следующий (только для собственного списка треков)
    if (currentSource().kind === "tracks" && !d.isPaused && d.duration > 3000 &&
        d.position >= d.duration - 600 && !state.ended && state.tracks.length > 1) {
      state.ended = true;
      setTimeout(() => {
        state.ended = false;
        selectTrack((state.index + 1) % state.tracks.length, true);
      }, 900);
    }
    if (d.position < d.duration - 1500) state.ended = false;
  }

  function onError(e) {
    console.warn("Ошибка воспроизведения Spotify", e);
    el.state.textContent = "Трек недоступен — попробуйте другой";
  }

  /* ── управление треками ──────────────────────────────────── */
  function selectTrack(index, autoplay) {
    const src = currentSource();
    if (src.kind !== "tracks" || !state.tracks.length) return;

    state.index = (index + state.tracks.length) % state.tracks.length;
    const track = state.tracks[state.index];
    state.duration = track.duration || 0;
    state.position = 0;
    state.ended = false;
    markActive();
    el.seek.value = "0";
    paintRange(el.seek, 0);
    el.elapsed.textContent = "0:00";
    el.duration.textContent = state.duration ? mmss(state.duration) : "0:00";

    if (!state.controller) {
      state.pendingPlay = !!autoplay;
      return;
    }
    try {
      state.controller.loadEntity(track.uri);
    } catch (err) {
      console.warn("loadEntity не удался", err);
    }
    if (autoplay) {
      state.pendingPlay = true;
      // Embed сам начнёт проигрывание после клика; на случай раннего ready
      setTimeout(() => {
        if (state.pendingPlay && state.ready) {
          state.pendingPlay = false;
          try { state.controller.play(); } catch (e) { /* noop */ }
        }
      }, 700);
    }
    if (!el.player.dataset.open || el.player.dataset.open === "false") setOpen(true);
  }

  /* переключение источника: штатный плейлист или свой */
  function selectSource(id, autoplay) {
    const src = allSources().find((s) => s.id === id);
    if (!src) return;

    state.sourceId = src.id;
    localStorage.setItem(LS_ACTIVE, src.id);
    state.kind = src.kind;
    state.tracks = src.kind === "tracks" ? src.tracks.slice() : [];
    state.index = 0;
    state.duration = state.tracks[0] ? state.tracks[0].duration : 0;
    state.position = 0;
    state.ended = false;
    state.pendingPlay = false;

    if (el.source) el.source.value = src.id;
    renderTracklist();
    el.seek.value = "0";
    paintRange(el.seek, 0);
    el.elapsed.textContent = "0:00";
    el.duration.textContent = state.duration ? mmss(state.duration) : "0:00";

    const target = src.kind === "collection" ? src.uri : (state.tracks[0] ? state.tracks[0].uri : "");
    if (!target) return;

    if (!state.controller) {
      state.pendingPlay = !!autoplay;
      return;
    }
    try {
      state.controller.loadEntity(target);
    } catch (err) {
      console.warn("loadEntity не удался", err);
    }
    if (autoplay) {
      state.pendingPlay = true;
      setTimeout(() => {
        if (state.pendingPlay && state.ready) {
          state.pendingPlay = false;
          try { state.controller.play(); } catch (e) { /* noop */ }
        }
      }, 700);
    }
    if (!el.player.dataset.open || el.player.dataset.open === "false") setOpen(true);
  }

  function setPlaying(playing) {
    if (state.playing === playing) return;
    state.playing = playing;
    ICON_PLAY.hidden = playing;
    ICON_PAUSE.hidden = !playing;
    el.play.setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
    el.player.classList.toggle("is-paused", !playing);

    const src = currentSource();
    if (src.kind === "collection") {
      el.state.textContent = entityLabel(src.entity) + (playing ? " · играет" : " · пауза");
      return;
    }
    const track = state.tracks[state.index];
    el.state.textContent = track
      ? (track.artist ? track.artist + " · " : "") + (playing ? "играет" : "пауза")
      : src.name;
  }

  /* ── громкость ───────────────────────────────────────────── */
  function applyVolume(v) {
    if (!state.controller) return;
    if (typeof state.controller.setVolume === "function") {
      try { state.controller.setVolume(v); } catch (e) { /* noop */ }
    }
  }

  function updateVolumeUI() {
    const pct = Math.round(state.volume * 100);
    el.volume.value = String(pct);
    el.volumeValue.textContent = pct + "%";
    paintRange(el.volume, pct);
    el.mute.classList.toggle("is-muted", pct === 0);
    el.mute.setAttribute("aria-label", pct === 0 ? "Включить звук" : "Выключить звук");
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    if (state.volume > 0) state.lastVolume = state.volume;
    localStorage.setItem("poe2track.volume", String(state.volume));
    applyVolume(state.volume);
    updateVolumeUI();
  }

  /* ── коллапс ─────────────────────────────────────────────── */
  function setOpen(open) {
    el.player.dataset.open = open ? "true" : "false";
    el.handle.setAttribute("aria-expanded", open ? "true" : "false");
    el.collapseLabel.textContent = open ? "Свернуть" : "Развернуть";
    updatePlayerHeight();
    setTimeout(updatePlayerHeight, 120);
  }

  function updatePlayerHeight() {
    const h = el.player.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--player-h", Math.round(h) + "px");
  }

  /* ── fallback ────────────────────────────────────────────── */
  function showFallback() {
    el.fallback.hidden = false;
    el.embed.style.display = "none";
    el.state.textContent = "Плеер недоступен — откройте Spotify напрямую";
  }

  function notify(message) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const node = document.createElement("div");
    node.className = "toast toast--ok";
    node.textContent = message;
    box.appendChild(node);
    setTimeout(() => {
      node.classList.add("is-out");
      setTimeout(() => node.remove(), 320);
    }, 3200);
  }

  /* ── модалка «свой плейлист» ─────────────────────────────── */
  function setError(message) {
    if (!el.error) return;
    el.error.textContent = message;
    el.error.hidden = !message;
  }

  function renderSaved() {
    if (!el.savedBox || !el.savedList) return;
    el.savedList.innerHTML = "";
    el.savedBox.hidden = !state.sources.length;

    state.sources.forEach((s) => {
      const li = document.createElement("li");
      li.className = "playlist-saved__item";

      const meta = document.createElement("span");
      meta.className = "playlist-saved__meta";
      const name = document.createElement("b");
      name.textContent = s.name;
      const sub = document.createElement("small");
      sub.textContent = s.kind === "collection"
        ? entityLabel(s.entity)
        : s.tracks.length + " " + plural(s.tracks.length, "трек", "трека", "треков");
      meta.appendChild(name);
      meta.appendChild(sub);

      const load = document.createElement("button");
      load.type = "button";
      load.className = "btn btn--ghost btn--sm";
      load.textContent = "Загрузить";
      load.addEventListener("click", () => {
        selectSource(s.id, true);
        closePlaylistModal();
        notify("Загружен плейлист «" + s.name + "».");
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "playlist-saved__del";
      del.textContent = "✕";
      del.title = "Удалить";
      del.setAttribute("aria-label", "Удалить " + s.name);
      del.addEventListener("click", () => {
        state.sources = state.sources.filter((x) => x.id !== s.id);
        saveSources();
        if (state.sourceId === s.id) selectSource("builtin", state.playing);
        renderSources();
        renderSaved();
        notify("Плейлист удалён.");
      });

      li.appendChild(meta);
      li.appendChild(load);
      li.appendChild(del);
      el.savedList.appendChild(li);
    });
  }

  function openPlaylistModal() {
    if (!el.modal) return;
    el.form.reset();
    setError("");
    renderSaved();
    el.modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => { if (el.nameInput) el.nameInput.focus(); }, 40);
  }

  function closePlaylistModal() {
    if (!el.modal) return;
    el.modal.hidden = true;
    document.body.style.overflow = "";
  }

  function submitPlaylist(e) {
    e.preventDefault();
    setError("");

    const name = (el.nameInput ? el.nameInput.value : "").trim().slice(0, 40);
    const lines = (el.linksInput ? el.linksInput.value : "").split(/\r?\n/);

    const parsed = [];
    const badLines = [];
    lines.forEach((line, i) => {
      if (!line.trim()) return;
      const item = parseLine(line);
      if (item) parsed.push(item);
      else badLines.push(i + 1);
    });

    if (!parsed.length) {
      setError(badLines.length
        ? "Не удалось разобрать стр" + (badLines.length > 1 ? "оки " : "оку ") + badLines.join(", ") + ". Нужна ссылка вида open.spotify.com/… или spotify:…"
        : "Вставьте хотя бы одну ссылку Spotify.");
      return;
    }
    if (badLines.length) {
      setError("Пропущены непонятные строки: " + badLines.join(", ") + ". Исправьте их или удалите.");
      return;
    }
    if (state.sources.length >= MAX_SOURCES) {
      setError("Уже сохранено " + MAX_SOURCES + " плейлистов — удалите лишние.");
      return;
    }

    const collections = parsed.filter((p) => ["playlist", "album", "artist", "show"].indexOf(p.type) >= 0);
    const singles = parsed.filter((p) => p.type === "track" || p.type === "episode");

    if (collections.length && singles.length) {
      setError("Не смешивайте плейлист/альбом и отдельные треки: сохраните их двумя записями.");
      return;
    }
    if (collections.length > 1) {
      setError("За один раз добавляется один плейлист или альбом.");
      return;
    }

    let source;
    if (collections.length) {
      const c = collections[0];
      source = {
        id: uid(),
        name: name || defaultName(c.type),
        kind: "collection",
        entity: c.type,
        uri: c.uri,
        url: "https://open.spotify.com/" + c.type + "/" + c.id
      };
    } else {
      const seen = new Set();
      const tracks = singles
        .filter((s) => {
          if (seen.has(s.uri)) return false;
          seen.add(s.uri);
          return true;
        })
        .slice(0, MAX_TRACKS)
        .map((s, i) => ({
          uri: s.uri,
          title: s.title || "Трек " + (i + 1),
          artist: s.artist || "",
          duration: 0
        }));
      source = { id: uid(), name: name || "Мои треки", kind: "tracks", tracks: tracks };
    }

    state.sources = state.sources.concat(source);
    saveSources();
    renderSources();
    selectSource(source.id, true);
    closePlaylistModal();
    notify("Плейлист добавлен в плеер.");
  }

  /* ── wiring ──────────────────────────────────────────────── */
  let watchdog = setTimeout(() => {
    if (!state.ready) showFallback();
  }, 12000);

  el.prev.addEventListener("click", () => selectTrack(state.index - 1, true));
  el.next.addEventListener("click", () => selectTrack(state.index + 1, true));

  el.play.addEventListener("click", () => {
    if (!state.controller) {
      state.pendingPlay = true;
      return;
    }
    try { state.controller.togglePlay(); } catch (e) { /* noop */ }
    setPlaying(!state.playing);
  });

  el.shuffle.addEventListener("click", () => {
    if (currentSource().kind !== "tracks" || state.tracks.length < 2) return;
    let i = state.index;
    while (i === state.index) i = Math.floor(Math.random() * state.tracks.length);
    selectTrack(i, true);
  });

  el.seek.addEventListener("input", () => {
    state.dragging = true;
    const pct = Number(el.seek.value) / 10;
    paintRange(el.seek, pct);
    el.elapsed.textContent = mmss((pct / 100) * state.duration);
  });

  const commitSeek = () => {
    if (!state.dragging) return;
    state.dragging = false;
    if (!state.controller || !state.duration) return;
    const seconds = Math.floor((Number(el.seek.value) / 1000) * (state.duration / 1000));
    try { state.controller.seek(seconds); } catch (e) { /* noop */ }
  };
  el.seek.addEventListener("change", commitSeek);
  el.seek.addEventListener("pointerup", commitSeek);

  el.volume.addEventListener("input", () => {
    setVolume(Number(el.volume.value) / 100);
  });

  el.mute.addEventListener("click", () => {
    if (state.volume > 0) {
      state.lastVolume = state.volume;
      setVolume(0);
    } else {
      setVolume(state.lastVolume || 0.7);
    }
  });

  el.handle.addEventListener("click", () => {
    setOpen(el.player.dataset.open !== "true");
  });

  if (el.source) {
    el.source.addEventListener("change", () => selectSource(el.source.value, state.playing));
  }

  if (el.addPlaylist) {
    el.addPlaylist.addEventListener("click", openPlaylistModal);
  }

  if (el.addPlaylistAlt) {
    el.addPlaylistAlt.addEventListener("click", openPlaylistModal);
  }

  if (el.form) {
    el.form.addEventListener("submit", submitPlaylist);
  }

  if (el.modal) {
    el.modal.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", closePlaylistModal);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.modal && !el.modal.hidden) {
      closePlaylistModal();
      return;
    }
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
    if (e.code === "Space" && el.player.dataset.open === "true") {
      e.preventDefault();
      el.play.click();
    }
    if (e.altKey && e.code === "ArrowRight") { el.next.click(); }
    if (e.altKey && e.code === "ArrowLeft") { el.prev.click(); }
  });

  /* ── старт ───────────────────────────────────────────────── */
  const initial = currentSource();
  state.kind = initial.kind;
  state.tracks = initial.kind === "tracks" ? initial.tracks.slice() : [];
  state.duration = state.tracks[0] ? state.tracks[0].duration : 0;

  renderSources();
  renderTracklist();
  updateVolumeUI();
  paintRange(el.seek, 0);
  el.duration.textContent = state.duration ? mmss(state.duration) : "0:00";
  el.track.textContent = state.tracks[0] ? state.tracks[0].title : initial.name;
  el.state.textContent = initial.kind === "collection"
    ? entityLabel(initial.entity) + " · Spotify"
    : (state.tracks[0] ? (state.tracks[0].artist ? state.tracks[0].artist + " · " : "") + initial.name : "Загрузка…");
  el.fallbackLink.href = BUILTIN.playlistUrl || "https://open.spotify.com";

  const startOpen = window.innerWidth > 1180;
  setOpen(startOpen);
  new ResizeObserver(updatePlayerHeight).observe(el.player);
  window.addEventListener("resize", updatePlayerHeight);

  global.onSpotifyIframeApiReady = (IFrameAPI) => boot(IFrameAPI);

  const apiScript = document.createElement("script");
  apiScript.src = "https://open.spotify.com/embed/iframe-api/v1";
  apiScript.async = true;
  apiScript.onerror = showFallback;
  document.body.appendChild(apiScript);

  global.PoE = global.PoE || {};
  global.PoE.player = {
    selectTrack: selectTrack,
    selectSource: selectSource,
    addSource: openPlaylistModal,
    setVolume: setVolume,
    setOpen: setOpen,
    state: state
  };
})(window);
