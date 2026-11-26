// Writes assets/field.svg and assets/impact.svg. Zero deps: `node scripts/gen.mjs`.
// Palette and numbers mirror alitarraf.dev (src/styles/tokens.css, src/content.ts).
import { writeFileSync, mkdirSync } from "node:fs";

const C = {
  ink: "#05060a", ink3: "#14171e", bone: "#f4f1ec", bone2: "#ddd9d2", bone3: "#a8a6a1",
  mute: "#7c7d86", mute2: "#55565e", ember: "#ff5a1f", emberLit: "#ff8347",
};
const SANS = `'Inter Tight', Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // --ease-out on the site

// Seeded RNG so regenerating produces the same file (clean diffs).
let seed = 1048576;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const f = (n) => +n.toFixed(1);

const frame = (w, h, body, css) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>${css}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }</style>
<defs>
  <radialGradient id="glow" cx="12%" cy="8%" r="70%"><stop offset="0" stop-color="${C.ember}" stop-opacity=".30"/><stop offset=".55" stop-color="${C.ember}" stop-opacity=".04"/><stop offset="1" stop-color="${C.ember}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="${C.bone}" fill-opacity=".06"/></pattern>
  <clipPath id="card"><rect width="${w}" height="${h}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#card)">
<rect width="${w}" height="${h}" fill="${C.ink}"/><rect width="${w}" height="${h}" fill="url(#glow)"/><rect width="${w}" height="${h}" fill="url(#grid)"/>
${body}
</g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="17.5" fill="none" stroke="${C.bone}" stroke-opacity=".08"/>
</svg>
`;

// ---------- field.svg: the name as a particle formation ----------
const GLYPHS = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  " ": Array(7).fill(".."),
};
const NAME = "ALI TARRAF";
const SUB = 2, PITCH = 9, R = 3.3; // each glyph pixel = 2x2 dots
const W = 1200, H = 360, X0 = 96, Y0 = 84;

const dots = [];
let col = 0;
for (const ch of NAME) {
  const g = GLYPHS[ch];
  g.forEach((row, gy) => [...row].forEach((px, gx) => {
    if (px !== "#") return;
    for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++)
      dots.push({ x: X0 + ((col + gx) * SUB + sx) * PITCH, y: Y0 + (gy * SUB + sy) * PITCH });
  }));
  col += g[0].length + 1;
}
const nameW = (col - 1) * SUB * PITCH;

const fieldDots = dots.map(({ x, y }) => {
  const a = rnd() * Math.PI * 2, d = 180 + rnd() * 520;
  const t = (x - X0) / nameW; // the field reforms as a wave sweeping left → right
  return `<circle cx="${x}" cy="${y}" r="${R}" style="--x:${f(Math.cos(a) * d)}px;--y:${f(Math.sin(a) * d * 0.45)}px;--d:${f(t * 0.9 + rnd() * 0.25)}s;--w:${f(t * 1.4)}s"/>`;
}).join("");

const field = frame(W, H, `
<g class="n" fill="${C.bone}">${fieldDots}</g>
<text class="s" x="${X0}" y="${Y0 + 7 * SUB * PITCH + 64}" font-family="${SANS}" font-size="30" letter-spacing="-.4" fill="${C.bone2}">Senior Software Engineer — <tspan fill="${C.emberLit}">Frontend Architecture</tspan></text>
<text class="p" x="${X0}" y="${H - 44}" font-family="${MONO}" font-size="17" fill="${C.mute}"><tspan fill="${C.ember}">ali@field</tspan>:~/beirut$ <tspan fill="${C.bone3}">open alitarraf.dev</tspan><tspan class="k" fill="${C.ember}"> █</tspan></text>`,
`
.n circle { animation: in 1.8s ${EASE} var(--d) both, wave 7s ease-in-out calc(2.6s + var(--w)) infinite; }
@keyframes in { from { transform: translate(var(--x), var(--y)); opacity: 0; } 30% { opacity: .5; } }
@keyframes wave { 0%, 16%, 100% { fill: ${C.bone}; } 6% { fill: ${C.emberLit}; } }
.s, .p { animation: rise 1.2s ${EASE} 1.3s both; }
.p { animation-delay: 1.6s; }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
.k { animation: blink 1.1s steps(1) 2.6s infinite; }
@keyframes blink { 50% { opacity: 0; } }`);

// ---------- impact.svg: the site's `impact` command ----------
const IMPACT = [ // content.ts → impact, ranked
  [40, "down", "Latency", "Numbase Group"],
  [40, "down", "Load time", "Docclik"],
  [30, "up", "Scheduling efficiency", "Docclik"],
  [25, "up", "Reliability", "Skeldus"],
  [25, "up", "Platform performance", "Docclik"],
  [20, "up", "User retention", "Docclik"],
  [15, "down", "Downtime & bugs", "Skeldus"],
];
const IW = 1200, ROW = 50, TOP = 104, BX = 640, BW = 500, BP = 10; // bar: 40% = 50 dots
const IH = TOP + IMPACT.length * ROW + 34;
const esc = (s) => s.replace(/&/g, "&amp;");

const rows = IMPACT.map(([v, dir, label, where], i) => {
  const y = TOP + i * ROW, n = Math.round((v / 40) * (BW / BP));
  const bar = Array.from({ length: n }, (_, k) =>
    `<circle cx="${BX + k * BP}" cy="${y - 6}" r="3.4" style="--d:${f(0.3 + i * 0.12 + k * 0.018)}s"/>`).join("");
  return `<text x="56" y="${y}" font-family="${MONO}" font-size="22" fill="${C.bone}">${dir === "down" ? "−" : "+"}${v}%</text>
<text x="160" y="${y}" font-family="${SANS}" font-size="20" fill="${C.bone2}">${esc(label)}</text>
<text x="420" y="${y}" font-family="${MONO}" font-size="15" fill="${C.mute}">${where}</text>
<g fill="${dir === "down" ? C.ember : C.emberLit}">${bar}</g>`;
}).join("\n");

const impact = frame(IW, IH, `
<text x="56" y="56" font-family="${MONO}" font-size="17" fill="${C.mute}"><tspan fill="${C.ember}">ali@field</tspan>:~$ <tspan fill="${C.bone3}">impact</tspan><tspan fill="${C.mute2}">   # measured deltas, ranked</tspan></text>
${rows}`,
`
circle { animation: on .5s ${EASE} var(--d) both; }
@keyframes on { from { opacity: 0; transform: translateX(-6px); } }`);

mkdirSync(new URL("../assets/", import.meta.url), { recursive: true });
writeFileSync(new URL("../assets/field.svg", import.meta.url), field);
writeFileSync(new URL("../assets/impact.svg", import.meta.url), impact);
console.log(`field.svg: ${dots.length} dots · impact.svg: ${IMPACT.length} rows`);
