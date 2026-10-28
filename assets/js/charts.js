/* ══════════════════════════════════════════════════════════════
   charts.js — рукописные SVG-графики без внешних библиотек
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const nf = new Intl.NumberFormat("ru-RU");

  function svgEl(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) {
      if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  function text(x, y, str, cls, extra) {
    const t = svgEl("text", Object.assign({ x, y, class: cls }, extra || {}));
    t.textContent = str;
    return t;
  }

  function defs() {
    const d = svgEl("defs");

    const bar = svgEl("linearGradient", { id: "barGrad", x1: "0", y1: "0", x2: "1", y2: "0" });
    bar.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#8f2f26" }));
    bar.appendChild(svgEl("stop", { offset: "55%", "stop-color": "#c9a761" }));
    bar.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#ecd9ab" }));
    d.appendChild(bar);

    const area = svgEl("linearGradient", { id: "areaGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
    area.appendChild(svgEl("stop", { offset: "0%", "stop-color": "rgba(201,167,97,0.30)" }));
    area.appendChild(svgEl("stop", { offset: "100%", "stop-color": "rgba(201,167,97,0)" }));
    d.appendChild(area);

    return d;
  }

  /* ── горизонтальные бары (локации / классы) ──────────────── */
  function bars(container, rows, opts) {
    const o = Object.assign({ rowH: 38, showSub: true }, opts || {});
    o.width = Math.max(320, Math.round(container.clientWidth || o.width || 640));
    container.innerHTML = "";
    const height = rows.length * o.rowH + 8;
    const svg = svgEl("svg", {
      viewBox: `0 0 ${o.width} ${height}`,
      role: "presentation"
    });
    svg.appendChild(defs());

    const max = Math.max(1, ...rows.map((r) => r.value));
    const labelW = o.labelW || 190;
    const valueW = 46;
    const trackX = labelW;
    const trackW = o.width - labelW - valueW;

    rows.forEach((row, i) => {
      const y = i * o.rowH;
      const g = svgEl("g", { class: "bar-row" });

      g.appendChild(text(0, y + 15, row.label, "bar-row__label"));
      if (o.showSub && row.sub) {
        g.appendChild(text(0, y + 27, row.sub, "bar-row__sub"));
      }

      g.appendChild(svgEl("rect", {
        class: "bar-row__track",
        x: trackX, y: y + 8, width: trackW, height: 9, rx: 0
      }));

      const w = Math.max(3, (row.value / max) * trackW);
      g.appendChild(svgEl("rect", {
        class: "bar-row__fill",
        x: trackX, y: y + 8, width: 0, height: 9, rx: 0
      }));

      // анимация роста
      const fill = g.querySelector(".bar-row__fill");
      requestAnimationFrame(() => {
        fill.style.transition = "width .9s cubic-bezier(.22,.61,.36,1)";
        fill.style.transitionDelay = (i * 45) + "ms";
        fill.setAttribute("width", w);
      });

      g.appendChild(text(o.width - 2, y + 16, nf.format(row.value), "bar-row__value", { "text-anchor": "end" }));

      const title = svgEl("title");
      title.textContent = `${row.label}: ${nf.format(row.value)}`;
      g.appendChild(title);

      svg.appendChild(g);
    });

    container.appendChild(svg);
  }

  /* ── пончик ──────────────────────────────────────────────── */
  function donut(container, rows, centerLabel, centerValue) {
    container.innerHTML = "";
    const size = 168;
    const r = 62;
    const cx = size / 2;
    const cy = size / 2;
    const stroke = 15;
    const C = 2 * Math.PI * r;

    const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}` });
    svg.appendChild(svgEl("circle", {
      cx, cy, r, fill: "none",
      stroke: "rgba(255,255,255,0.045)",
      "stroke-width": stroke
    }));

    const total = rows.reduce((s, x) => s + x.value, 0) || 1;
    let offset = 0;

    rows.forEach((row, i) => {
      const frac = row.value / total;
      const dash = Math.max(0, frac * C - 1.5);
      const circle = svgEl("circle", {
        class: "donut-slice",
        cx, cy, r,
        fill: "none",
        stroke: row.color,
        "stroke-width": stroke,
        "stroke-dasharray": `0 ${C}`,
        "stroke-dashoffset": -offset,
        transform: `rotate(-90 ${cx} ${cy})`,
        "stroke-linecap": "butt"
      });

      const title = svgEl("title");
      title.textContent = `${row.label}: ${nf.format(row.value)} (${(frac * 100).toFixed(1)}%)`;
      circle.appendChild(title);
      svg.appendChild(circle);

      requestAnimationFrame(() => {
        circle.style.transition = "stroke-dasharray .9s cubic-bezier(.22,.61,.36,1)";
        circle.style.transitionDelay = (i * 60) + "ms";
        circle.setAttribute("stroke-dasharray", `${dash} ${C - dash}`);
      });

      offset += frac * C;
    });

    svg.appendChild(text(cx, cy - 1, centerValue, "donut-center__value"));
    svg.appendChild(text(cx, cy + 14, centerLabel, "donut-center__label"));

    container.appendChild(svg);
  }

  function legend(container, rows, total) {
    container.innerHTML = "";
    rows.forEach((row) => {
      const li = document.createElement("li");
      li.className = "legend__item";
      const pct = total ? (row.value / total) * 100 : 0;
      li.innerHTML =
        `<span class="legend__swatch" style="background:${row.color}"></span>` +
        `<span class="legend__name">${escapeHtml(row.label)}</span>` +
        `<span class="legend__val">${pct.toFixed(1).replace(".", ",")}%</span>`;
      container.appendChild(li);
    });
  }

  /* ── линия по часам ──────────────────────────────────────── */
  function hourLine(container, bins) {
    container.innerHTML = "";
    const W = Math.max(360, Math.round(container.clientWidth || 900));
    const H = 190;
    const padL = 26;
    const padR = 12;
    const padT = 18;
    const padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = Math.max(1, ...bins);
    const stepX = innerW / (bins.length - 1);

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` });
    svg.appendChild(defs());

    for (let i = 0; i <= 3; i++) {
      const y = padT + (innerH / 3) * i;
      svg.appendChild(svgEl("line", {
        class: "line-grid", x1: padL, x2: W - padR, y1: y, y2: y
      }));
      svg.appendChild(text(padL - 6, y + 3, nf.format(Math.round(max - (max / 3) * i)), "line-axis", { "text-anchor": "end" }));
    }

    const pts = bins.map((v, i) => [padL + i * stepX, padT + innerH - (v / max) * innerH]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const areaPath = `${line} L ${padL + innerW} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

    svg.appendChild(svgEl("path", { class: "line-area", d: areaPath, opacity: 0 }));
    svg.appendChild(svgEl("path", { class: "line-path", d: line }));

    const areaNode = svg.querySelector(".line-area");
    const lineNode = svg.querySelector(".line-path");
    requestAnimationFrame(() => {
      areaNode.style.transition = "opacity .8s ease .3s";
      areaNode.setAttribute("opacity", "1");
      const len = lineNode.getTotalLength ? lineNode.getTotalLength() : 1000;
      lineNode.style.strokeDasharray = len;
      lineNode.style.strokeDashoffset = len;
      lineNode.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)";
      requestAnimationFrame(() => { lineNode.style.strokeDashoffset = 0; });
    });

    pts.forEach((p, i) => {
      if (i % 3 !== 0) return;
      svg.appendChild(svgEl("circle", { class: "line-dot", cx: p[0], cy: p[1], r: 2.4 }));
      svg.appendChild(text(p[0], H - 8, String(i).padStart(2, "0"), "line-axis", { "text-anchor": "middle" }));
    });

    // подсветка пика
    const peak = bins.indexOf(max);
    if (peak >= 0) {
      const p = pts[peak];
      svg.appendChild(svgEl("circle", {
        cx: p[0], cy: p[1], r: 3.6,
        fill: "#d3402f", stroke: "#f0c9a6", "stroke-width": "1"
      }));
      svg.appendChild(text(p[0], p[1] - 10, "пик", "line-axis", { "text-anchor": "middle", fill: "#d3402f" }));
    }

    container.appendChild(svg);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  global.PoE = global.PoE || {};
  global.PoE.charts = { bars, donut, legend, hourLine, escapeHtml };
})(window);
