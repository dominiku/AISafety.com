// PROTOTYPE Map 3.5, "Hex work" view: buildings drawn by code for districts
// whose working name is a building and which have no classic art: a capitol,
// a school and a forum, in the classic buildings' flat manner and colors
// (cream walls, orange roofs, dark brown doors and shadow sides).
//
// DESIGN REVIEW (Melissa): stand-ins until the artists draw them.

export type HexBuilding = 'capitol' | 'school' | 'forum'

const WALL = '#ffd1bc'
const WALL_SHADE = '#ffa777'
const ROOF = '#d53d00'
const ROOF_LIT = '#ff7c25'
const DARK = '#571f02'
const STEP = '#f6fbff'

/**
 * The building with the middle of its foot at x, y (map grid units) and
 * `width` wide; `g` is the pixels in a grid unit. Shapes are given in shares
 * of the width: across from -0.5 to 0.5, and up from the foot.
 */
export function buildingMarkup(
  kind: HexBuilding,
  x: number,
  y: number,
  width: number,
  g: number
): string {
  const w = width * g
  const px = (dx: number) => (x * g + dx * w).toFixed(1)
  const py = (up: number) => (y * g - up * w).toFixed(1)
  const rect = (
    left: number,
    bottom: number,
    across: number,
    up: number,
    fill: string
  ) =>
    `<rect x="${px(left)}" y="${py(bottom + up)}" width="${(across * w).toFixed(1)}" height="${(up * w).toFixed(1)}" fill="${fill}"/>`
  const poly = (points: [number, number][], fill: string) =>
    `<path d="M${points.map(([dx, up]) => `${px(dx)},${py(up)}`).join('L')}Z" fill="${fill}"/>`
  const columns = (
    from: number,
    to: number,
    count: number,
    bottom: number,
    up: number
  ) =>
    Array.from({ length: count }, (_, n) =>
      rect(
        from + ((to - from) * n) / (count - 1) - 0.016,
        bottom,
        0.032,
        up,
        WALL
      )
    ).join('')
  const flag = (dx: number, bottom: number) =>
    `<path d="M${px(dx)},${py(bottom)}V${py(bottom + 0.14)}" stroke="${DARK}" stroke-width="2"/>` +
    poly(
      [
        [dx, bottom + 0.14],
        [dx + 0.09, bottom + 0.115],
        [dx, bottom + 0.09],
      ],
      ROOF_LIT
    )

  if (kind === 'capitol') {
    return [
      // Steps, a wing to either side, and the portico between them.
      rect(-0.5, 0, 1, 0.04, STEP),
      rect(-0.46, 0.04, 0.92, 0.03, WALL_SHADE),
      rect(-0.44, 0.07, 0.88, 0.2, WALL),
      ...[-0.38, -0.3, 0.26, 0.34].map(dx => rect(dx, 0.12, 0.04, 0.09, DARK)),
      rect(-0.44, 0.27, 0.88, 0.035, ROOF),
      rect(-0.2, 0.07, 0.4, 0.22, DARK),
      columns(-0.18, 0.18, 6, 0.07, 0.22),
      rect(-0.22, 0.29, 0.44, 0.03, WALL),
      poly(
        [
          [-0.24, 0.32],
          [0, 0.43],
          [0.24, 0.32],
        ],
        WALL_SHADE
      ),
      // The drum and the dome, lit from the left, with its lantern and flag.
      rect(-0.13, 0.36, 0.26, 0.1, WALL),
      columns(-0.11, 0.11, 5, 0.36, 0.1).replaceAll(WALL, WALL_SHADE),
      `<path d="M${px(-0.15)},${py(0.46)}A${(0.15 * w).toFixed(1)},${(0.17 * w).toFixed(1)} 0 0 1 ${px(0.15)},${py(0.46)}Z" fill="${ROOF}"/>`,
      `<path d="M${px(-0.15)},${py(0.46)}A${(0.15 * w).toFixed(1)},${(0.17 * w).toFixed(1)} 0 0 1 ${px(0)},${py(0.63)}L${px(0)},${py(0.46)}Z" fill="${ROOF_LIT}"/>`,
      rect(-0.025, 0.62, 0.05, 0.05, WALL),
      flag(0, 0.67),
    ].join('')
  }

  if (kind === 'school') {
    return [
      // A long schoolhouse with a pitched roof, and a bell tower in the middle.
      rect(-0.46, 0, 0.92, 0.24, WALL),
      rect(0.2, 0, 0.26, 0.24, WALL_SHADE),
      ...[-0.38, -0.27, 0.19, 0.3].map(dx => rect(dx, 0.09, 0.06, 0.09, DARK)),
      poly(
        [
          [-0.5, 0.24],
          [-0.42, 0.38],
          [0.42, 0.38],
          [0.5, 0.24],
        ],
        ROOF
      ),
      poly(
        [
          [-0.5, 0.24],
          [-0.42, 0.38],
          [0, 0.38],
          [0, 0.24],
        ],
        ROOF_LIT
      ),
      rect(-0.12, 0, 0.24, 0.5, WALL),
      rect(0.04, 0, 0.08, 0.5, WALL_SHADE),
      poly(
        [
          [-0.055, 0],
          [-0.055, 0.12],
          [0, 0.16],
          [0.055, 0.12],
          [0.055, 0],
        ],
        DARK
      ),
      `<circle cx="${px(0)}" cy="${py(0.3)}" r="${(0.05 * w).toFixed(1)}" fill="${STEP}" stroke="${DARK}" stroke-width="2"/>`,
      `<path d="M${px(0)},${py(0.3)}V${py(0.335)}M${px(0)},${py(0.3)}H${px(0.025)}" stroke="${DARK}" stroke-width="1.6"/>`,
      rect(-0.07, 0.4, 0.14, 0.07, DARK),
      `<circle cx="${px(0)}" cy="${py(0.43)}" r="${(0.025 * w).toFixed(1)}" fill="${ROOF_LIT}"/>`,
      poly(
        [
          [-0.15, 0.5],
          [0, 0.68],
          [0.15, 0.5],
        ],
        ROOF
      ),
      poly(
        [
          [-0.15, 0.5],
          [0, 0.68],
          [0, 0.5],
        ],
        ROOF_LIT
      ),
      flag(0, 0.68),
    ].join('')
  }

  // The forum: a round of columns on a stepped floor, open to the sky, with
  // a speaker's stone in the middle.
  const ring = (up: number, rx: number, ry: number, fill: string) =>
    `<ellipse cx="${px(0)}" cy="${py(up)}" rx="${(rx * w).toFixed(1)}" ry="${(ry * w).toFixed(1)}" fill="${fill}"/>`
  const round = (count: number, from: number, to: number) =>
    Array.from({ length: count }, (_, n) => {
      const angle = from + ((to - from) * n) / (count - 1)
      const dx = Math.cos(angle) * 0.4
      const up = 0.13 - Math.sin(angle) * 0.13
      return (
        rect(dx - 0.02, up, 0.04, 0.3, n < count / 2 ? WALL : WALL_SHADE) +
        rect(dx - 0.03, up + 0.29, 0.06, 0.025, WALL_SHADE)
      )
    }).join('')
  return [
    ring(0.1, 0.5, 0.17, WALL_SHADE),
    ring(0.125, 0.46, 0.155, STEP),
    ring(0.15, 0.4, 0.13, WALL_SHADE),
    ring(0.16, 0.36, 0.115, WALL),
    // The far columns and their ring of stone, then the near ones over it.
    round(6, Math.PI * 1.1, Math.PI * 1.9),
    `<ellipse cx="${px(0)}" cy="${py(0.45)}" rx="${(0.42 * w).toFixed(1)}" ry="${(0.14 * w).toFixed(1)}" fill="none" stroke="${ROOF}" stroke-width="${(0.05 * w).toFixed(1)}"/>`,
    rect(-0.05, 0.15, 0.1, 0.07, ROOF_LIT),
    round(5, Math.PI * 0.12, Math.PI * 0.88),
    `<path d="M${px(-0.42)},${py(0.45)}A${(0.42 * w).toFixed(1)},${(0.14 * w).toFixed(1)} 0 0 0 ${px(0.42)},${py(0.45)}" fill="none" stroke="${ROOF_LIT}" stroke-width="${(0.05 * w).toFixed(1)}"/>`,
  ].join('')
}
