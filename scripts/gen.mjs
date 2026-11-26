// Writes assets/field.svg and assets/impact.svg: `node scripts/gen.mjs`.
// Same idea as alitarraf.dev's wordmark pool: rasterise the name in real type,
// then sample particles weighted by ink coverage. Chrome does the rasterising
// (headless, over CDP), so there are no npm deps. Fonts are embedded as base64
// because an SVG shown through <img> on GitHub cannot fetch anything.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const here = (p) => new URL(p, import.meta.url);
const font = (f) => readFileSync(here(`fonts/${f}`)).toString("base64");
const SANS_B64 = font("inter-tight.woff2"), MONO_B64 = font("jetbrains-mono.woff2");

const C = { ink: "#05060a", bone: "#f4f1ec", bone2: "#ddd9d2", bone3: "#a8a6a1", mute: "#7c7d86", mute2: "#55565e", ember: "#ff5a1f", lit: "#ff8347", deep: "#c23a0c" };
const SANS = `'Inter Tight', Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// ---------- sample the wordmark in Chrome ----------
async function sampleName({ W, H, x, base, maxW, text, count }) {
  const profile = join(tmpdir(), `gen-chrome-${process.pid}`);
  const ch = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    let tabs;
    for (let i = 0; i < 40 && !tabs; i++) {
      await new Promise((r) => setTimeout(r, 250));
      tabs = await fetch("http://127.0.0.1:9334/json").then((r) => r.json()).catch(() => null);
    }
    const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    const res = await new Promise((resolve) => {
      ws.onmessage = (e) => resolve(JSON.parse(e.data).result);
      const fn = async (o) => {
        const ff = new FontFace("Inter Tight", `url(data:font/woff2;base64,${o.b64})`, { weight: "100 900" });
        document.fonts.add(await ff.load());
        const S = 3, cv = document.createElement("canvas");
        cv.width = o.W * S; cv.height = o.H * S;
        const g = cv.getContext("2d");
        g.scale(S, S);
        let size = 260, font = () => `800 ${size}px 'Inter Tight'`;
        g.font = font(); g.letterSpacing = "-0.035em";
        size *= o.maxW / g.measureText(o.text).width; // fit the name to the measure
        g.font = font(); g.fillStyle = "#fff"; g.fillText(o.text, o.x, o.base);
        const px = g.getImageData(0, 0, cv.width, cv.height).data;
        let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
        const pts = [];
        for (let i = 0; pts.length < o.count && i < 4e6; i++) {
          const X = rnd() * o.W, Y = rnd() * o.H;
          const a = px[(((Y * S) | 0) * cv.width + ((X * S) | 0)) * 4 + 3] / 255;
          if (a > 0 && rnd() < a) pts.push([X, Y]); // coverage-weighted: soft edges sampled less
        }
        return JSON.stringify({ pts, size });
      };
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: `(${fn})(${JSON.stringify({ W, H, x, base, maxW, text, count, b64: SANS_B64 })})`, awaitPromise: true, returnByValue: true } }));
    });
    ws.close();
    if (!res?.result?.value) throw new Error("sampling failed: " + JSON.stringify(res).slice(0, 300));
    return JSON.parse(res.result.value);
  } finally {
    await new Promise((r) => { ch.once("exit", r); ch.kill(); });
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

// ---------- helpers ----------
let seed = 1048576;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const f = (n) => Math.round(n * 10) / 10;
// One <path> of zero-length round-capped segments per (colour, size): ~10 bytes a particle.
const dots = (pts, color, w, cls = "") => pts.length ? `<path${cls ? ` class="${cls}"` : ""} d="${pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join("")}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>` : "";
const fonts = `@font-face{font-family:'Inter Tight';font-weight:100 900;src:url(data:font/woff2;base64,${SANS_B64}) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:100 800;src:url(data:font/woff2;base64,${MONO_B64}) format('woff2')}`;

const frame = (w, h, body, css) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>${fonts}
${css}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }</style>
<defs>
  <radialGradient id="glow" cx="10%" cy="0%" r="75%"><stop offset="0" stop-color="${C.ember}" stop-opacity=".28"/><stop offset=".5" stop-color="${C.ember}" stop-opacity=".05"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/></radialGradient>
  <radialGradient id="cool" cx="100%" cy="100%" r="60%"><stop offset="0" stop-color="#6b5cff" stop-opacity=".08"/><stop offset="1" stop-color="#6b5cff" stop-opacity="0"/></radialGradient>
  <filter id="bloom" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="card"><rect width="${w}" height="${h}" rx="20"/></clipPath>
</defs>
<g clip-path="url(#card)">
<rect width="${w}" height="${h}" fill="${C.ink}"/><rect width="${w}" height="${h}" fill="url(#glow)"/><rect width="${w}" height="${h}" fill="url(#cool)"/>
${body}
</g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="19.5" fill="none" stroke="${C.bone}" stroke-opacity=".07"/>
</svg>
`;

// ---------- field.svg ----------
const W = 1200, H = 420, X0 = 88, BASE = 245, LAYERS = 8;
const { pts } = await sampleName({ W, H, x: X0, base: BASE, maxW: W - X0 * 2, text: "ALI TARRAF", count: 14000 });

// Colour temperature, like the sim: a slow band of heat runs through the letters.
const heat = (x, y) => 0.5 + 0.5 * Math.sin(x / 150 + Math.sin(y / 45) * 1.4 - 1.2);
const buckets = {}; // key: layer|color|size
const put = (k, p) => (buckets[k] ||= []).push(p);
for (const [x, y] of pts) {
  const h = heat(x, y), r = rnd();
  const color = r < h ** 6 * 0.75 ? (r < h ** 6 * 0.3 ? "lit" : "ember") : "bone";
  const size = rnd() < 0.1 ? 2.3 : rnd() < 0.45 ? 1.7 : 1.2;
  put(`${(rnd() * LAYERS) | 0}|${color}|${size}`, [x + gauss() * 0.4, y + gauss() * 0.4]);
}
// The ambient field: loose particles drifting around the wordmark, thicker near the glow.
const ambient = [];
for (let i = 0; i < 1400; i++) {
  const x = rnd() * W, y = rnd() * H;
  if (rnd() < 0.25 + 0.75 * Math.max(0, 1 - Math.hypot(x / W, y / H) * 1.1)) ambient.push([x, y]);
}

let layers = "";
for (let k = 0; k < LAYERS; k++) {
  const a = (k / LAYERS) * Math.PI * 2 + 0.4, d = 90 + (k % 3) * 40;
  let inner = "";
  for (const [key, list] of Object.entries(buckets)) {
    const [l, color, size] = key.split("|");
    if (+l === k) inner += dots(list, C[color], size, color === "bone" ? "" : "hot");
  }
  layers += `<g class="l" style="--x:${f(Math.cos(a) * d)}px;--y:${f(Math.sin(a) * d * 0.5)}px;--d:${f(0.06 * k)}s;--p:${f(5 + (k % 4) * 1.3)}s">${inner}</g>`;
}
const total = pts.length + ambient.length;

const field = frame(W, H, `
<g class="amb" opacity=".55">${dots(ambient.filter((_, i) => i % 5), C.bone3, 1.1)}${dots(ambient.filter((_, i) => !(i % 5)), C.ember, 1.4)}</g>
<g filter="url(#bloom)">${layers}</g>
<text class="t" x="${X0 + 4}" y="${BASE + 72}" font-family="${SANS}" font-size="30" font-weight="400" letter-spacing="-.3" fill="${C.bone2}">Senior Software Engineer, <tspan fill="${C.lit}">frontend architecture</tspan></text>
<g class="t m" font-family="${MONO}" font-size="13" fill="${C.mute}" letter-spacing=".5">
  <text x="${X0 + 4}" y="${H - 36}">Beirut, Lebanon</text>
  <text x="${W - X0}" y="${H - 36}" text-anchor="end"><tspan fill="${C.ember}">●</tspan> n = ${total.toLocaleString("en-US")} particles</text>
</g>`,
`.l { animation: in 2.2s ${EASE} var(--d) both, drift var(--p) ease-in-out calc(2.4s + var(--d)) infinite alternate; }
@keyframes in { from { transform: translate(var(--x), var(--y)) scale(1.06); opacity: 0; } }
@keyframes drift { to { transform: translate(calc(var(--x) * .012), calc(var(--y) * .02)); } }
.hot { animation: breathe 4.5s ease-in-out 2.4s infinite alternate; }
@keyframes breathe { to { opacity: .55; } }
.amb { animation: fade 3s ease 0.4s both; }
@keyframes fade { from { opacity: 0; } }
.t { animation: rise 1.4s ${EASE} 1.1s both; }
.m { animation-delay: 1.4s; }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }`);

// ---------- impact.svg: each delta is a streak of particles ----------
const IMPACT = [ // content.ts → impact, ranked
  [40, "down", "Latency", "Numbase Group"],
  [40, "down", "Load time", "Docclik"],
  [30, "up", "Scheduling efficiency", "Docclik"],
  [25, "up", "Reliability", "Skeldus"],
  [25, "up", "Platform performance", "Docclik"],
  [20, "up", "User retention", "Docclik"],
  [15, "down", "Downtime & bugs", "Skeldus"],
];
const IW = 1200, TOP = 78, ROW = 58, BX = 560, BMAX = 560, SEG = 14;
const IH = TOP + (IMPACT.length - 1) * ROW + 62;
const esc = (s) => s.replace(/&/g, "&amp;");

const rows = IMPACT.map(([v, dir, label, where], i) => {
  const y = TOP + i * ROW, len = (v / 40) * BMAX, cy = y - 8;
  const segs = Array.from({ length: SEG }, () => ({ bone: [], ember: [], lit: [] }));
  const n = Math.round(len * 2.4);
  for (let j = 0; j < n; j++) {
    const t = rnd() ** 0.8, x = BX + t * len; // denser toward the tip, where the number lands
    const pt = [x, cy + gauss() * (1.2 + t * 2.6)];
    const c = t > 0.86 ? "lit" : rnd() < 0.25 + t * 0.6 ? "ember" : "bone";
    segs[Math.min(SEG - 1, (t * SEG) | 0)][c].push(pt);
  }
  const streak = segs.map((s, k) => `<g class="s" style="--d:${f(0.5 + i * 0.1 + k * 0.045)}s">${dots(s.bone, C.bone3, 1.3)}${dots(s.ember, C.ember, 1.7)}${dots(s.lit, C.lit, 2.3)}</g>`).join("");
  return `<g font-family="${SANS}">
<text x="64" y="${y}" font-size="30" font-weight="600" letter-spacing="-1" fill="${C.bone}">${dir === "down" ? "−" : "+"}${v}<tspan font-size="20" fill="${C.bone3}">%</tspan></text>
<text x="168" y="${y - 2}" font-size="19" fill="${C.bone2}">${esc(label)}</text>
<text x="${BX - 24}" y="${y - 3}" text-anchor="end" font-family="${MONO}" font-size="12" letter-spacing=".4" fill="${C.mute}">${where}</text>
<line x1="${BX}" y1="${cy}" x2="${BX + BMAX}" y2="${cy}" stroke="${C.bone}" stroke-opacity=".05" stroke-dasharray="1 7" stroke-linecap="round"/>
<g filter="url(#bloom)">${streak}</g></g>`;
}).join("\n");

const impact = frame(IW, IH, rows,
`.s { animation: on .7s ${EASE} var(--d) both; }
@keyframes on { from { opacity: 0; transform: translateX(-10px); } }`);

mkdirSync(here("../assets/"), { recursive: true });
writeFileSync(here("../assets/field.svg"), field);
writeFileSync(here("../assets/impact.svg"), impact);
console.log(`field.svg: ${total} particles, ${(field.length / 1024) | 0} KB · impact.svg: ${(impact.length / 1024) | 0} KB`);
