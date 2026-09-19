// PROTOTYPE Map 3.5, "Art work" view: which pieces of the classic island art
// stand in which district of the computed layout, and where in the district.
//
// The art itself is public/images/map35-landmarks.svg: one <symbol> per
// landmark, lifted from the classic map (public/images/map-1.5.1.svg) without
// the old base plates and road stubs. The pairing of old art and new district
// follows the "Map region names and symbolism" proposal and is for Melissa,
// Bryce and Søren to decide.

export interface ArtLandmark {
  // The symbol's id in the landmarks sprite.
  symbol: string
  // Size on the map, in grid units.
  width: number
  height: number
  // The District field value it belongs to.
  district: string
  // A town's landmark stands in the middle of its block whatever is there;
  // any other looks for the emptiest spot.
  center?: boolean
}

export const MAP_35_ART_LANDMARKS: ArtLandmark[] = [
  {
    symbol: 'castle',
    width: 6.5,
    height: 4.1,
    district: 'Career support and placement',
    center: true,
  },
  {
    symbol: 'training-town',
    width: 6.6,
    height: 5.6,
    district: 'Technical research programs',
  },
  {
    symbol: 'forest',
    width: 5.9,
    height: 4.9,
    district: 'Grantmakers and donor advisory',
  },
  {
    symbol: 'forest',
    width: 2.6,
    height: 2.2,
    district: 'Venture capital and incubators',
  },
  {
    symbol: 'grove',
    width: 7,
    height: 4.5,
    district: 'Policy research and think tanks',
  },
  {
    symbol: 'summit',
    width: 5.2,
    height: 3.3,
    district: 'Macrostrategy and forecasting',
  },
  {
    // The mountain lake the river rises at, in the far south-east.
    symbol: 'range',
    width: 4,
    height: 2.8,
    district: 'Interpretability and model understanding',
  },
  {
    symbol: 'cave',
    width: 2.8,
    height: 2.6,
    district: 'Conceptual and foundations research',
  },
  {
    symbol: 'skull-mountain',
    width: 4.8,
    height: 4.1,
    district: 'Capabilities research',
  },
  {
    symbol: 'beach-camp',
    width: 5.3,
    height: 5.7,
    district: 'News and commentary',
  },
]

export interface PlacedLandmark {
  symbol: string
  // The middle of the landmark, and its size, in grid units.
  x: number
  y: number
  width: number
  height: number
}

const STEP = 0.5
// The part of a landmark's box that has to stand on land: the art rarely
// fills its corners.
const FOOTPRINT = 0.8

/**
 * Where each landmark stands. A landmark keeps all of its footprint on land,
 * and within that takes the spot in its district farthest from the pins (the
 * org logos drawn over it), from the landmarks already placed and from the
 * `avoid` points, leaning toward keeping its footprint inside its own
 * district. A district with no room for it at all gets no landmark.
 */
export function placeLandmarks(
  landmarks: ArtLandmark[],
  districtAt: (x: number, y: number) => string | null,
  pins: { x: number; y: number }[],
  extent: { width: number; height: number },
  avoid: { x: number; y: number; radius: number }[] = []
): PlacedLandmark[] {
  const cells = new Map<string, [number, number][]>()
  for (let x = 0; x <= extent.width; x += STEP) {
    for (let y = 0; y <= extent.height; y += STEP) {
      const district = districtAt(x, y)
      if (district === null) continue
      const cell = cells.get(district) ?? []
      cell.push([x, y])
      cells.set(district, cell)
    }
  }

  const placed: PlacedLandmark[] = []
  for (const landmark of landmarks) {
    const cell = cells.get(landmark.district)
    if (!cell) continue
    const halfW = (landmark.width * FOOTPRINT) / 2
    const halfH = (landmark.height * FOOTPRINT) / 2
    const footprint = (x: number, y: number) =>
      [-1, 0, 1].flatMap(i =>
        [-1, 0, 1].map(j => districtAt(x + i * halfW, y + j * halfH))
      )
    const center: [number, number] = [
      cell.reduce((sum, p) => sum + p[0], 0) / cell.length,
      cell.reduce((sum, p) => sum + p[1], 0) / cell.length,
    ]

    let best: [number, number] | null = null
    let bestScore = -Infinity
    for (const [x, y] of cell) {
      const under = footprint(x, y)
      if (under.some(district => district === null)) continue
      const strays = under.filter(d => d !== landmark.district).length
      let score: number
      if (landmark.center) {
        score = -Math.hypot(x - center[0], y - center[1])
      } else {
        score = Infinity
        for (const pin of pins) {
          score = Math.min(score, Math.hypot(pin.x - x, pin.y - y))
        }
        for (const other of placed) {
          const reach = (other.width + landmark.width) / 2
          score = Math.min(score, Math.hypot(other.x - x, other.y - y) - reach)
        }
        for (const spot of avoid) {
          score = Math.min(
            score,
            Math.hypot(spot.x - x, spot.y - y) - spot.radius
          )
        }
        score -= strays * 0.4
      }
      if (score > bestScore) {
        bestScore = score
        best = [x, y]
      }
    }
    if (!best) continue
    placed.push({
      symbol: landmark.symbol,
      x: best[0],
      y: best[1],
      width: landmark.width,
      height: landmark.height,
    })
  }
  return placed
}
