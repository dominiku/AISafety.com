// Named regions on the Field map (/map), keyed by org category.
//
// An org's logo is drawn in the region for its FIRST category only:
// "Governance, Advocacy, Conceptual research" → Governance Grove, not Advocacy
// Anchorage. Later categories are secondary tags and don't place the org
// anywhere. This file has no dependencies so both the chatbot catalog (server)
// and the system prompt can import it without pulling in the Airtable client.
export const MAP_AREA_BY_CATEGORY: Record<string, string> = {
  Advocacy: 'Advocacy Anchorage',
  Blog: 'Blog Beach',
  'Capabilities research': 'Capabilities Cove',
  'Career support': 'Career Castle',
  'Conceptual research': 'Conceptual Cliffs',
  'Empirical research': 'Empirical Escarpment',
  Forecasting: 'Forecasting Falls',
  Funding: 'Funding Forest',
  Governance: 'Governance Grove',
  Newsletter: 'Newsletter Nook',
  Podcast: 'Podcast Port',
  'Research support': 'Support Shoreline',
  Resource: 'Resource Rock',
  Strategy: 'Strategy Summit',
  'Training and education': 'Training Town',
  Video: 'Video Vista',
  'No longer active': 'Gone Graveyard',
}

export interface MapArea {
  label: string
  // Where the label is drawn, in map grid units (the same units as a pin's
  // x and y). It marks the label only: an area has no outline of its own.
  x: number
  y: number
}

// Every area label drawn on /map. 'Research Range' has no category of its
// own: it is the umbrella over the research areas (UMBRELLA_AREAS below).
export const MAP_AREAS: MapArea[] = [
  { label: 'Conceptual Cliffs', x: 46, y: 5.5 },
  { label: 'Resource Rock', x: 3.5, y: 8 },
  { label: 'Support Shoreline', x: 13, y: 6.7 },
  { label: 'Newsletter Nook', x: 15.8, y: 14.5 },
  { label: 'Video Vista', x: 23, y: 5.6 },
  { label: 'Funding Forest', x: 29.2, y: 7 },
  { label: 'Governance Grove', x: 37.7, y: 5.5 },
  { label: 'Strategy Summit', x: 34.8, y: 19 },
  { label: 'Research Range', x: 45.3, y: 15.9 },
  { label: 'Training Town', x: 22.2, y: 17.2 },
  { label: 'Empirical Escarpment', x: 53.5, y: 16 },
  { label: 'Podcast Port', x: 9.5, y: 20.5 },
  { label: 'Blog Beach', x: 15, y: 25.8 },
  { label: 'Forecasting Falls', x: 39.2, y: 23.8 },
  { label: 'Career Castle', x: 30.5, y: 29.4 },
  { label: 'Advocacy Anchorage', x: 8, y: 31 },
  { label: 'Capabilities Cove', x: 45, y: 27.1 },
  { label: 'Gone Graveyard', x: 56, y: 30 },
]

const CATEGORY_BY_MAP_AREA: Record<string, string> = Object.fromEntries(
  Object.entries(MAP_AREA_BY_CATEGORY).map(([category, area]) => [
    area,
    category,
  ])
)

/** The one category whose pins are drawn in an area, or null for an umbrella
 *  area, which has none of its own. */
export function categoryForMapArea(label: string): string | null {
  return CATEGORY_BY_MAP_AREA[label] ?? null
}

// An umbrella area spans other areas: its listings are theirs, and a search
// pick frames them all together.
const UMBRELLA_AREAS: Record<string, string[]> = {
  'Research Range': [
    'Conceptual research',
    'Empirical research',
    'Capabilities research',
  ],
}

/** Every category whose pins count as inside an area: its own, or for an
 *  umbrella area the categories it spans. */
export function categoriesForMapArea(label: string): string[] {
  const own = categoryForMapArea(label)
  return own ? [own] : (UMBRELLA_AREAS[label] ?? [])
}

// Words people type for an area that neither its name nor its category holds.
// They rank with the category.
const EXTRA_SEARCH_WORDS: Record<string, string[]> = {
  'Gone Graveyard': ['Inactive'],
}

/**
 * Areas matching a map search, best first. An area is found by its name
 * ("blog" → Blog Beach) and by its category ("research support" → Support
 * Shoreline, whose name shares no word with it). As with listings, a field
 * starting with the query outranks a mid-word match; within each, a match on
 * the name (what is printed on the map) outranks one on the category.
 */
export function searchMapAreas(query: string): MapArea[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const ranked: MapArea[][] = [[], [], [], []]
  for (const area of MAP_AREAS) {
    const name = area.label.toLowerCase()
    const others = [
      categoryForMapArea(area.label) ?? '',
      ...(EXTRA_SEARCH_WORDS[area.label] ?? []),
    ].map(f => f.toLowerCase())
    if (name.startsWith(q)) ranked[0].push(area)
    else if (others.some(f => f.startsWith(q))) ranked[1].push(area)
    else if (name.includes(q)) ranked[2].push(area)
    else if (others.some(f => f.includes(q))) ranked[3].push(area)
  }
  return ranked.flat()
}

export interface MapBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// A pin further from the area's middle than this many times the typical
// distance is left out of the frame.
const STRAY_PIN_FACTOR = 3

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Which pins sit far from the rest of their area on purpose: further from
 * the area's middle than STRAY_PIN_FACTOR times the typical distance. True
 * marks a stray. Works in any unit.
 */
export function strayPins(pins: { x: number; y: number }[]): boolean[] {
  if (pins.length === 0) return []
  const cx = median(pins.map(p => p.x))
  const cy = median(pins.map(p => p.y))
  const distances = pins.map(p => Math.hypot(p.x - cx, p.y - cy))
  const limit = median(distances) * STRAY_PIN_FACTOR
  return distances.map(d => d > limit)
}

/**
 * The box a search pick frames for an area, in grid units: the area's label
 * plus its pins (the ones whose FIRST category places them there). A few pins
 * sit far from their area on purpose; those strays are left out so one of
 * them can't stretch the frame across half the map. With no pins the box is
 * just the label point.
 */
export function mapAreaBounds(
  area: MapArea,
  pins: { x: number; y: number }[]
): MapBounds {
  const stray = strayPins(pins)
  const kept = pins.filter((_, i) => !stray[i])
  const xs = [area.x, ...kept.map(p => p.x)]
  const ys = [area.y, ...kept.map(p => p.y)]
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

/** First entry of an org's comma-joined category list, or null. */
export function primaryCategory(category: string): string | null {
  const first = category.split(',')[0]?.trim()
  return first || null
}

/** Field map region an org is drawn in — decided by its first category. */
export function mapAreaFor(category: string): string | null {
  const primary = primaryCategory(category)
  if (!primary) return null
  const area = MAP_AREA_BY_CATEGORY[primary]
  if (!area) {
    console.warn(
      `[map-areas] No Field map area for category "${primary}" — add it to MAP_AREA_BY_CATEGORY`
    )
    return null
  }
  return area
}
