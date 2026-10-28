/* ══════════════════════════════════════════════════════════════
   player.js — кастомный Spotify-плеер поверх официального Embed API.
   Умеет: переключать треки, play/pause, перемотку, громкость,
   mute, перемешивание, выбор трека из списка.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const PLAYLIST = global.PoE_TRACKS || { tracks: [], playlistName: "Path of Exile 2", playlistUrl: "https://open.spotify.com" };
  const TRACKS = PLAYLIST.tracks;

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
    listCount: document.getElementById("sp-list-count")
  };

  if (!el.player) return;

  const ICON_PLAY = el.play.querySelector(".ic-play");
  const ICON_PAUSE = el.play.querySelector(".ic-pause");

  const state = {
    index: 0,
    controller: null,
    ready: false,
    playing: false,
    volume: Number(localStorage.getItem("poe2track.volume") || 0.7),
    lastVolume: 0.7,
    duration: TRACKS[0] ? TRACKS[0].duration : 0,
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

  function paintRange(input, pct) {
    input.style.setProperty("--p", Math.max(0, Math.min(100, pct)) + "%");
  }

  /* ── список треков ───────────────────────────────────────── */
  function renderTracklist() {
    el.list.innerHTML = "";
    el.listCount.textContent = TRACKS.length + " треков";
    TRACKS.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "tracklist__item";
      li.dataset.index = String(i);
      li.innerHTML =
        '<span class="tracklist__num">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="tracklist__meta"><b></b><small></small></span>' +
        '<span class="tracklist__dur">' + mmss(t.duration) + "</span>";
      li.querySelector("b").textContent = t.title;
      li.querySelector("small").textContent = t.artist;
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
    el.track.textContent = TRACKS[state.index].title;
    el.state.textContent = TRACKS[state.index].artist + " · " + PLAYLIST.playlistName;
  }

  /* ── создание контроллера ────────────────────────────────── */
  function boot(IFrameAPI) {
    clearTimeout(watchdog);
    try {
      const options = {
        uri: TRACKS[state.index].uri,
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
      frame.setAttribute("title", "Spotify — " + PLAYLIST.playlistName);
      frame.setAttribute("loading", "lazy");
    }
  }

  function onPlaybackStarted(e) {
    const uri = e && e.data && e.data.playingURI;
    const found = TRACKS.findIndex((t) => t.uri === uri);
    if (found >= 0 && found !== state.index) {
      state.index = found;
      markActive();
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

    // конец трека → следующий
    if (!d.isPaused && d.duration > 3000 && d.position >= d.duration - 600 && !state.ended) {
      state.ended = true;
      setTimeout(() => {
        state.ended = false;
        selectTrack((state.index + 1) % TRACKS.length, true);
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
    if (!TRACKS.length) return;
    state.index = (index + TRACKS.length) % TRACKS.length;
    const track = TRACKS[state.index];
    state.duration = track.duration;
    state.position = 0;
    state.ended = false;
    markActive();
    el.seek.value = "0";
    paintRange(el.seek, 0);
    el.elapsed.textContent = "0:00";
    el.duration.textContent = mmss(track.duration);

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

  function setPlaying(playing) {
    if (state.playing === playing) return;
    state.playing = playing;
    ICON_PLAY.hidden = playing;
    ICON_PAUSE.hidden = !playing;
    el.play.setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
    el.player.classList.toggle("is-paused", !playing);
    el.state.textContent = playing
      ? TRACKS[state.index].artist + " · играет"
      : TRACKS[state.index].artist + " · пауза";
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
    if (TRACKS.length < 2) return;
    let i = state.index;
    while (i === state.index) i = Math.floor(Math.random() * TRACKS.length);
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

  document.addEventListener("keydown", (e) => {
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
  renderTracklist();
  updateVolumeUI();
  paintRange(el.seek, 0);
  el.duration.textContent = mmss(state.duration);
  el.track.textContent = TRACKS.length ? TRACKS[0].title : PLAYLIST.playlistName;
  el.state.textContent = TRACKS.length ? TRACKS[0].artist + " · " + PLAYLIST.playlistName : "Загрузка…";
  el.fallbackLink.href = PLAYLIST.playlistUrl;

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
  global.PoE.player = { selectTrack, setVolume, setOpen, state };
})(window);
