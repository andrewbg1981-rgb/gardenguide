// Original cream line-art for the corners of wide screens (baseline: Styling).
// Drawn from simple repeated shapes — leaves, gum nuts, bracts — placed by code.
// Purely decorative: hidden from screen readers and from phones (see styles.css).

const leaf = (len: number, w: number) =>
  `M0 0 C ${w} ${len * 0.28}, ${w * 0.7} ${len * 0.78}, ${w * 0.18} ${len} ` +
  `C ${-w * 0.45} ${len * 0.74}, ${-w * 0.7} ${len * 0.3}, 0 0 Z`;
const midrib = (len: number, w: number) => `M0 2 Q ${w * 0.22} ${len * 0.55} ${w * 0.18} ${len - 2}`;

function Leaf({ x, y, angle, len, w }: { x: number; y: number; angle: number; len: number; w: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={leaf(len, w)} />
      <path d={midrib(len, w)} />
    </g>
  );
}

/** A gum nut: a goblet-shaped capsule with a rim and three valves, hanging on a stalk. */
function GumNut({ x, y, angle, s = 1 }: { x: number; y: number; angle: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${s})`}>
      <path d="M0 0 L0 14" />
      <path d="M-3 14 C -11 18, -13 32, -10 40 L 10 40 C 13 32, 11 18, 3 14 Z" />
      <ellipse cx="0" cy="40" rx="10" ry="4" />
      <path d="M0 40 L0 37 M0 40 L-6 42 M0 40 L6 42" />
    </g>
  );
}

/** Eucalyptus sprig with a gum-nut cluster, growing from the top-left corner. */
function Sprig() {
  const leaves = [
    { x: 38, y: 58, angle: -60, len: 92, w: 17 },
    { x: 56, y: 92, angle: 40, len: 104, w: 18 },
    { x: 84, y: 140, angle: -48, len: 110, w: 19 },
    { x: 104, y: 178, angle: 30, len: 118, w: 20 },
    { x: 140, y: 238, angle: -40, len: 100, w: 18 },
    { x: 156, y: 266, angle: 22, len: 96, w: 17 },
    { x: 186, y: 318, angle: -24, len: 86, w: 16 },
    { x: 20, y: 24, angle: 70, len: 80, w: 15 },
  ];
  return (
    <svg viewBox="0 0 320 440" aria-hidden="true" focusable="false">
      <path d="M2 0 C 40 60, 70 120, 120 210 S 190 330, 214 372" />
      {leaves.map((l, i) => <Leaf key={i} {...l} />)}
      <path d="M120 210 C 150 214, 178 220, 200 226" />
      <GumNut x={200} y={226} angle={-20} s={0.9} />
      <GumNut x={200} y={226} angle={-55} s={0.8} />
      <GumNut x={200} y={226} angle={15} s={0.85} />
      <path d="M214 372 C 232 380, 250 392, 262 404" />
      <GumNut x={262} y={404} angle={-35} s={0.7} />
      <GumNut x={262} y={404} angle={-5} s={0.75} />
    </svg>
  );
}

/** Waratah: a dome of curled florets cupped by a ring of long red-in-life bracts. */
function Waratah() {
  const florets: string[] = [];
  for (let row = 0; row < 7; row++) {
    const y = -18 - row * 11;
    const half = 34 - row * row * 0.75;        // narrower towards the top of the dome
    const n = Math.max(2, Math.round(half / 6));
    for (let i = 0; i <= n; i++) {
      const x = -half + (2 * half * i) / n + (row % 2 ? 3 : 0);
      florets.push(`M${x - 5} ${y + 3} Q ${x} ${y - 7} ${x + 5} ${y + 3}`);
    }
  }
  // Bracts fan out below and to the sides of the dome, longest at the sides.
  const bracts = Array.from({ length: 13 }, (_, i) => -114 + i * 19).map((a) => ({
    a, len: 46 + 26 * Math.sin((a * Math.PI) / 180) ** 2, w: 11,
  }));
  return (
    <svg viewBox="-120 -120 240 360" aria-hidden="true" focusable="false">
      <path d="M0 -10 C 4 60, -6 140, 2 236" />
      <Leaf x={0} y={90} angle={-58} len={96} w={16} />
      <Leaf x={-1} y={140} angle={52} len={88} w={15} />
      <Leaf x={1} y={190} angle={-40} len={78} w={14} />
      {bracts.map(({ a, len, w }) => (
        <path key={a} transform={`translate(0 -8) rotate(${a})`}
          d={`M0 0 C ${w} ${len * 0.35}, ${w * 0.4} ${len * 0.85}, 0 ${len} C ${-w * 0.4} ${len * 0.85}, ${-w} ${len * 0.35}, 0 0`} />
      ))}
      <path d="M-38 -10 C -40 -60, -20 -96, 0 -100 C 20 -96, 40 -60, 38 -10 Z" />
      {florets.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export function Flourishes() {
  return (
    <div className="flourishes" aria-hidden="true">
      <div className="flourish top-left"><Sprig /></div>
      <div className="flourish top-right"><Sprig /></div>
      <div className="flourish bottom-left"><Waratah /></div>
      <div className="flourish bottom-right"><Waratah /></div>
    </div>
  );
}
