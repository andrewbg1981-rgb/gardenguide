// ZN-02 / D-15: zone outlines on the site plan, traced from the owner's coloured
// zone drawing (Nov 2026). Coordinates are pixels on public/site-plan.png
// (2304 × 913). Until zones can be drawn in the app (ZN-05), they live here.
// A zone may have several rectangles (e.g. Shade runs along the boundary in two parts).

export const PLAN_WIDTH = 2304;
export const PLAN_HEIGHT = 913;

export interface Rect { x: number; y: number; w: number; h: number }

const r = (x1: number, y1: number, x2: number, y2: number): Rect => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

/** Drawn in this order: later shapes sit on top (decks over beds). */
/** labelAt: where to centre the name when the default (middle of the largest rectangle) would collide. */
export const ZONE_SHAPES: { zoneId: string; rects: Rect[]; colour: string; labelAt?: { x: number; y: number } }[] = [
  { zoneId: 'floral', rects: [r(48, 42, 582, 898)], colour: 'var(--wattle)' },
  { zoneId: 'shade', rects: [r(611, 41, 1330, 239), r(1343, 31, 1714, 229)], colour: 'var(--silver-gum)' },
  { zoneId: 'tropical', rects: [r(609, 294, 1186, 440)], colour: 'var(--sky)', labelAt: { x: 900, y: 426 } },
  { zoneId: 'vegetable', rects: [r(1210, 269, 1589, 441)], colour: 'var(--silver-gum)' },
  { zoneId: 'fruit', rects: [r(1750, 28, 2286, 905)], colour: 'var(--banksia)' },
  { zoneId: 'front_deck', rects: [r(591, 456, 702, 753)], colour: 'var(--text)' },
  { zoneId: 'middle_deck', rects: [r(730, 268, 1070, 410)], colour: 'var(--text)', labelAt: { x: 900, y: 330 } },
  { zoneId: 'back_deck', rects: [r(1437, 466, 1602, 718)], colour: 'var(--text)' },
  { zoneId: 'quarter_deck', rects: [r(1598, 253, 1733, 457)], colour: 'var(--text)' },
];

/** SC-03: north points to the top-left of the plan at 45°. */
export const NORTH_DEGREES = -45;
