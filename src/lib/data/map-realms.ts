// PROTOTYPE Map 3.5: the area tree built from the forked base's draft Realm
// and District fields, in place of the classic one-area-per-category list in
// map-areas.ts. A realm is a top-level area and its districts sit inside it;
// an org is placed by its District, the way the classic map places it by its
// first Category.
//
// The tree comes from the data, not from a list in code, so renaming,
// splitting or merging districts in Airtable shows up with no code change
// while the scheme is still being worked out. No area has an outline yet, so
// each label is drawn at the middle of its own pins.
//
// Dependency-free apart from map-areas, so it can be unit tested.

import type { MapArea, MapAreaScheme } from './map-areas'

export interface RealmPin {
  realm: string | null
  district: string | null
  x: number | null
  y: number | null
}

// Closed orgs keep their own corner. Its realm and district carry the same
// name, so it is one area, not a realm holding a single district, and like
// the classic Gone Graveyard it is not filled out on the zoomed-out map.
const QUIET_REALMS = ['No longer active']

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** The realm and district areas for these pins. Pins with no realm, district
 *  or position are left out, and so is an area none of whose pins is placed. */
export function buildRealmScheme(pins: RealmPin[]): MapAreaScheme {
  const placed = pins.filter(
    (p): p is { realm: string; district: string; x: number; y: number } =>
      !!p.realm && !!p.district && p.x !== null && p.y !== null
  )

  const areas: MapArea[] = []
  const areaByCategory: Record<string, string> = {}
  const labels = new Set<string>()

  const addArea = (
    label: string,
    inside: { x: number; y: number }[],
    extra: Partial<MapArea>
  ) => {
    labels.add(label)
    areas.push({
      label,
      x: round1(median(inside.map(p => p.x))),
      y: round1(median(inside.map(p => p.y))),
      ...extra,
    })
  }

  const realms = [...new Set(placed.map(p => p.realm))].sort()
  for (const realm of realms) {
    const inRealm = placed.filter(p => p.realm === realm)
    if (labels.has(realm)) {
      console.warn(`[map-realms] "${realm}" names two areas; second skipped`)
      continue
    }
    addArea(realm, inRealm, QUIET_REALMS.includes(realm) ? { quiet: true } : {})

    const districts = [...new Set(inRealm.map(p => p.district))].sort()
    for (const district of districts) {
      if (district === realm) {
        areaByCategory[district] = realm
        continue
      }
      if (labels.has(district)) {
        console.warn(
          `[map-realms] "${district}" names two areas; second skipped`
        )
        continue
      }
      addArea(
        district,
        inRealm.filter(p => p.district === district),
        { parent: realm }
      )
      areaByCategory[district] = district
    }
  }

  return { areas, areaByCategory }
}
