// PROTOTYPE Map 3.5, "Art work" view: where a realm's terrain details go (the
// mountains of the research country, the shells of the shoreline, the grass
// of the plains): in the gaps the org logos leave, the same every time the map
// is drawn.

export interface ScatterSpot {
  x: number
  y: number
  // Grid units of clear ground around the spot, up to `maxRoom`.
  room: number
  // A fixed number from 0 to 1 for the spot, to pick a variant with.
  roll: number
}

export interface ScatterOptions {
  // Grid units between one spot and the next, before each is nudged.
  spacing: number
  // A spot needs this much clear ground, and is told of no more than maxRoom.
  minRoom: number
  maxRoom: number
}

// A fixed pseudo-random number from 0 to 1 for a pair of whole numbers.
function roll(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Spots on a nudged grid over `extent` that lie in the area (and stay in it
 * `minRoom` to every side, so nothing straddles a border or the coast) and
 * keep `minRoom` clear of everything in `keepOff`.
 */
export function scatterSpots(
  inArea: (x: number, y: number) => boolean,
  keepOff: { x: number; y: number; radius: number }[],
  extent: { width: number; height: number },
  { spacing, minRoom, maxRoom }: ScatterOptions
): ScatterSpot[] {
  const spots: ScatterSpot[] = []
  const columns = Math.ceil(extent.width / spacing)
  const rows = Math.ceil(extent.height / spacing)
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const x = (column + 0.15 + 0.7 * roll(column, row)) * spacing
      const y = (row + 0.15 + 0.7 * roll(row + 57, column + 13)) * spacing
      const inside =
        inArea(x, y) &&
        inArea(x - minRoom, y) &&
        inArea(x + minRoom, y) &&
        inArea(x, y - minRoom) &&
        inArea(x, y + minRoom)
      if (!inside) continue
      let room = maxRoom
      for (const thing of keepOff) {
        room = Math.min(
          room,
          Math.hypot(thing.x - x, thing.y - y) - thing.radius
        )
        if (room < minRoom) break
      }
      if (room < minRoom) continue
      spots.push({ x, y, room, roll: roll(column + 101, row + 211) })
    }
  }
  return spots
}
