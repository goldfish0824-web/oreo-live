/* OREO Live — 先生からのスタンプの絵（生徒画面と参観者用ページで使う）
 * 先生がインクで押すはんこのように描く：二重の丸、上に英語の弧、まん中に絵、下に日本語、いちばん下の弧に先生の名前。
 * 種類（id）と文言は config.js の STAMPS。インクの色と絵はここで決める。
 *
 *   OREO_STAMP.html("clear", { who: "田中", seed: "…", size: 108, pressed: true })
 *     who     押した先生の名前（「先生」は付けて描く）。なければ ★ を描く
 *     seed    傾きを決める文字列（同じ seed なら毎回同じ傾き）
 *     size    px
 *     mini    true なら丸と絵だけ（参観者用ページのボタン用。文字は小さすぎて読めないので描かない）
 *     ghost   true なら灰色の薄いはんこ（まだ押していない）
 *     pressed true なら「ポン」と押す動き
 *     ink     false ならインクのかすれを付けない（たくさん並ぶところで軽くする）
 */
(function () {
  const C = window.OREO_CONFIG || {};
  const INK = { clear: "#cf3b28", reasons: "#6a3fbd", growth: "#17844c" };
  const GHOST = "#aaa596";

  // 絵（インク1色。中心 0,0 の ±17 くらいに収める）
  const ICON = {
    // 吹き出し（伝わる英語）
    clear:
      '<path d="M-10 -12 H10 A6 6 0 0 1 16 -6 V1 A6 6 0 0 1 10 7 H-2 L-10 14 V7 A6 6 0 0 1 -16 1 V-6 A6 6 0 0 1 -10 -12 Z" fill="none" stroke-width="3.4" stroke-linejoin="round"/>' +
      '<circle cx="-7" cy="-2.5" r="2.3"/><circle cx="0" cy="-2.5" r="2.3"/><circle cx="7" cy="-2.5" r="2.3"/>',
    // 電球（理由がいいね）
    reasons:
      '<path d="M-5 6 C-5 2 -10 -1 -10 -6 A10 10 0 1 1 10 -6 C10 -1 5 2 5 6 Z" fill="none" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M-5 10 H5 M-3.5 13.5 H3.5" fill="none" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M-3 -2 L0 2 L3 -2" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M-15 -14 L-12.5 -11.5 M15 -14 L12.5 -11.5 M-17 -4 H-14 M17 -4 H14" fill="none" stroke-width="2.4" stroke-linecap="round"/>',
    // 芽（成長が感じられます）
    growth:
      '<path d="M0 14 V-3" fill="none" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M0 1 C-3 -8 -11 -10 -16 -7 C-13 0 -6 3 0 1 Z"/>' +
      '<path d="M0 -3 C3 -13 11 -16 16 -13 C14 -5 7 -1 0 -3 Z"/>' +
      '<path d="M-11 14 H11" fill="none" stroke-width="2.6" stroke-linecap="round"/>',
  };

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hash = (t) => {
    let h = 2166136261;
    for (const ch of String(t)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  let uid = 0;

  // インクのかすれ（ふちの揺れと、ところどころ薄いところ）。ページに1回だけ置く
  function ensureDefs() {
    if (document.getElementById("oreoInk")) return;
    const box = document.createElement("div");
    box.innerHTML =
      '<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>' +
      '<filter id="oreoInk" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="warp"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="rough"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="grain"/>' +
      '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.35" result="mask"/>' +
      '<feComposite in="rough" in2="mask" operator="in"/>' +
      "</filter></defs></svg>";
    (document.body || document.documentElement).appendChild(box.firstChild);
  }

  function svg(id, o) {
    const def = (C.STAMPS || []).find((x) => x.id === id) || { ja: "", en: "" };
    const color = o.ghost ? GHOST : INK[id] || INK.clear;
    const icon = ICON[id] || ICON.clear;
    const n = ++uid;
    const ring =
      `<circle cx="60" cy="60" r="55" fill="none" stroke-width="${o.mini ? 6 : 4.2}"/>` +
      `<circle cx="60" cy="60" r="${o.mini ? 46 : 49.5}" fill="none" stroke-width="${o.mini ? 2.2 : 1.4}"/>`;
    let body;
    if (o.mini) {
      body = `<g transform="translate(60 60) scale(1.75)">${icon}</g>`;
    } else {
      const lines = def.lines || [def.ja];
      const two = lines.length > 1;
      const ja = two
        ? `<text x="60" y="75" font-size="12.5">${esc(lines[0])}</text><text x="60" y="89" font-size="12.5">${esc(lines[1])}</text>`
        : `<text x="60" y="83" font-size="13.5">${esc(lines[0])}</text>`;
      const who = o.who ? `${o.who}先生` : "★ ★ ★";
      // 名前が長いときは、弧の長さに収まるように縮める
      const whoFit = [...who].length > 6 ? ` textLength="62" lengthAdjust="spacingAndGlyphs"` : "";
      body =
        `<path id="oreoArcT${n}" d="M20.5 60 A39.5 39.5 0 0 1 99.5 60" fill="none" stroke="none"/>` +
        `<path id="oreoArcB${n}" d="M16.5 60 A43.5 43.5 0 0 0 103.5 60" fill="none" stroke="none"/>` +
        `<text font-size="8.6" font-weight="800" letter-spacing="0.9" stroke="none" style="font-family:var(--font-en)"><textPath href="#oreoArcT${n}" startOffset="50%" text-anchor="middle">${esc(String(def.en || "").toUpperCase())}</textPath></text>` +
        `<g transform="translate(60 ${two ? 45 : 48})">${icon}</g>` +
        `<g font-weight="900" text-anchor="middle" stroke-width="0.7" stroke-linejoin="round" style="font-family:var(--stamp-font)">${ja}</g>` +
        `<text font-size="${o.who ? 10 : 8}" font-weight="800" stroke-width="0.35" style="font-family:var(--stamp-font)"><textPath href="#oreoArcB${n}" startOffset="50%" text-anchor="middle"${o.who ? whoFit : ""}>${esc(who)}</textPath></text>`;
    }
    const filter = o.ink !== false && !o.ghost ? ' filter="url(#oreoInk)"' : "";
    return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g fill="${color}" stroke="${color}"${filter}>${ring}${body}</g></svg>`;
  }

  function html(id, opts) {
    const o = opts || {};
    if (o.ink !== false && !o.ghost) ensureDefs();
    const h = hash(o.seed != null ? o.seed : id);
    const r = o.mini ? ((h % 13) - 6) : ((h % 19) - 9); // 傾き（度）
    const def = (C.STAMPS || []).find((x) => x.id === id) || { ja: "" };
    const title = o.title != null ? o.title : o.who ? `${o.who}先生から：${def.ja}` : def.ja;
    const size = o.size || 100;
    return `<span class="oreo-stamp${o.pressed ? " pressed" : ""}${o.ghost ? " ghost" : ""}" style="--r:${r}deg;width:${size}px;height:${size}px"${title ? ` title="${esc(title)}" role="img" aria-label="${esc(title)}"` : ""}>${svg(id, o)}</span>`;
  }

  window.OREO_STAMP = { html, ink: INK };
})();
