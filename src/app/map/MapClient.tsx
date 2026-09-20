'use client'

import { useMemo, useState } from 'react'
import ModeToggle from '@/components/ModeToggle'
import MapExplorer from './MapExplorer'
import { isPlacedOnMap } from '@/lib/map-images'
import { CLASSIC_MAP_SCHEME } from '@/lib/data/map-areas'
import {
  buildRealmScheme,
  renameAreas,
  QUIET_REALM,
} from '@/lib/data/map-realms'
import { layoutRealmMap, type LayoutPin } from '@/lib/data/map-realm-layout'
import { MAP_35_GRAVEYARD_MOVE, MAP_35_SPEC } from '@/lib/data/map-realm-spec'
import { layoutHexMap } from '@/lib/data/map-hex-layout'
import {
  MAP_35_HEX_NAMES,
  MAP_35_HEX_SPEC,
  hexLogoRadius,
} from '@/lib/data/map-hex-spec'
import type { MapOrg } from '@/lib/data/map'
import styles from './page.module.css'

interface MapDataset {
  orgs: MapOrg[]
  suggestEntryLink: string
  suggestCorrectionLink: string
}

interface MapClientProps {
  // The site's real data — what everyone but the two people prototyping the
  // map actually sees.
  production: MapDataset
  // A collaborator's forked Airtable base, for experimenting with the map's
  // structure without touching production. Null when AIRTABLE_IA_FORK_TOKEN/
  // BASE_ID aren't configured in this environment — the toggle below just
  // doesn't render, and the page behaves exactly like the single-dataset map.
  iaWork: MapDataset | null
  lastUpdatedIso: string | null
}

type DataSource = 'production' | 'ia' | 'art' | 'hex'

// PROTOTYPE Map 3.5: an org placed by its District goes by that as its
// category, on the map and in the explorer, the way the classic map goes by
// the first Category. The explorer's Category chip then offers the districts.
function placedByDistrict(org: MapOrg): MapOrg {
  return { ...org, category: org.draft?.district ?? org.category }
}

// The explorer (search, filters and cards over the map) on every data source.
// The production map is the classic island; the prototype's sources bring
// their own layout, areas and categories, and the explorer follows them.
export default function MapClient({
  production,
  iaWork,
  lastUpdatedIso,
}: MapClientProps) {
  // 'ia' and 'art' are the same forked data and the same computed layout;
  // they differ only in how the backdrop is drawn (schematic or classic-style).
  // 'hex' is the same forked data on a board of hexagonal tiles.
  const [dataSource, setDataSource] = useState<DataSource>('production')
  const { orgs, suggestEntryLink, suggestCorrectionLink } =
    dataSource !== 'production' && iaWork ? iaWork : production
  const isIaWork = dataSource !== 'production' && iaWork !== null

  // Same rule /api/map-images uses, so the background preload warms exactly
  // the logos drawn here.
  const mapOrgs = useMemo(() => orgs.filter(isPlacedOnMap), [orgs])

  // PROTOTYPE Map 3.5: on IA_work the map places each org by its District, in
  // an area tree built from the Realm and District fields, and works out the
  // land, the regions and every position itself (map-realm-layout.ts) from
  // the rough draft positions in NewX/NewY. Map furniture stays where the
  // draft has it, off the land, and so do closed orgs, moved as one group. An
  // org with no realm, district or draft position yet keeps its classic spot.
  const realmMap = useMemo(() => {
    if (!isIaWork || dataSource === 'hex') return null
    const placed: LayoutPin[] = []
    const fixed: { x: number; y: number }[] = []
    // Closed orgs keep their draft arrangement but move as one, out of the
    // island's way (see MAP_35_GRAVEYARD_MOVE).
    const moved = (org: MapOrg) => {
      const quiet = org.draft?.realm === QUIET_REALM
      return {
        x:
          (org.draft?.x ?? null) === null
            ? null
            : org.draft!.x! + (quiet ? MAP_35_GRAVEYARD_MOVE[0] : 0),
        y:
          (org.draft?.y ?? null) === null
            ? null
            : org.draft!.y! + (quiet ? MAP_35_GRAVEYARD_MOVE[1] : 0),
      }
    }
    for (const org of mapOrgs) {
      const { realm, district } = org.draft ?? {}
      const { x, y } = moved(org)
      if (x === null || y === null) continue
      if (org.isMagic || !realm || !district || realm === QUIET_REALM) {
        fixed.push({ x, y })
      } else {
        placed.push({ id: org.id, realm, district, x, y, scale: org.scale })
      }
    }
    const layout = layoutRealmMap(placed, fixed, MAP_35_SPEC)
    // Every org, for the explorer's list; only those on the map move.
    const all = orgs.map(org => {
      if (!isPlacedOnMap(org)) return placedByDistrict(org)
      const at = layout.positions.get(org.id)
      return {
        ...placedByDistrict(org),
        x: at?.x ?? moved(org).x ?? org.x,
        y: at?.y ?? moved(org).y ?? org.y,
      }
    })
    const scheme = buildRealmScheme(
      all
        .filter(org => !org.isMagic)
        .map(org => ({
          realm: org.draft?.realm ?? null,
          district: org.draft?.district ?? null,
          x: org.x,
          y: org.y,
        }))
    )
    return { orgs: all, scheme, backdrop: layout }
  }, [isIaWork, dataSource, orgs, mapOrgs])

  // PROTOTYPE Map 3.5, "Hex work": the same orgs on a board of hexagonal
  // tiles (map-hex-spec.ts). Each stands in a fixed spot on a tile of its
  // District, the closed orgs on their islet; map furniture keeps its draft
  // place, off the land.
  const hexMap = useMemo(() => {
    if (!isIaWork || dataSource !== 'hex') return null
    const layout = layoutHexMap(
      MAP_35_HEX_SPEC,
      mapOrgs.flatMap(org =>
        org.isMagic || !org.draft?.district
          ? []
          : [
              {
                id: org.id,
                district: org.draft.district,
                radius: hexLogoRadius(org.scale),
                name: org.title,
              },
            ]
      )
    )
    if (layout.unplaced.length > 0) {
      console.warn(
        `Hex map: no tile has room for ${layout.unplaced.length} orgs; they keep their draft positions. Give their districts more tiles in map-hex-spec.ts.`,
        layout.unplaced
      )
    }
    const all = orgs.map(org => {
      if (!isPlacedOnMap(org)) return placedByDistrict(org)
      const at = layout.positions.get(org.id)
      return {
        ...placedByDistrict(org),
        x: at?.x ?? org.draft?.x ?? org.x,
        y: at?.y ?? org.draft?.y ?? org.y,
      }
    })
    const scheme = buildRealmScheme(
      all
        .filter(org => !org.isMagic)
        .map(org => ({
          realm: org.draft?.realm ?? null,
          district: org.draft?.district ?? null,
          x: org.x,
          y: org.y,
        }))
    )
    // The map's own names for the areas; the data keeps its plain ones.
    return { orgs: all, scheme: renameAreas(scheme, MAP_35_HEX_NAMES), layout }
  }, [isIaWork, dataSource, orgs, mapOrgs])

  const prototype = hexMap ?? realmMap
  // The prototype places orgs by District, so its Category chip offers the
  // districts. Closed orgs' own corner is the "Show inactive" switch's.
  const categoryOptions = useMemo(
    () =>
      prototype
        ? Object.keys(prototype.scheme.areaByCategory)
            .filter(district => district !== QUIET_REALM)
            .sort()
        : undefined,
    [prototype]
  )

  const dataToggle = iaWork && (
    <div className={styles['map-data-toggle']}>
      <ModeToggle
        mode={dataSource}
        onChange={setDataSource}
        ariaLabel="Map data source"
        tabs={[
          {
            value: 'production',
            icon: '/images/icons/map.svg',
            label: 'UI work',
          },
          {
            value: 'ia',
            icon: '/images/icons/table.svg',
            label: 'IA work',
          },
          {
            value: 'art',
            icon: '/images/icons/map.svg',
            label: 'Art work',
          },
          {
            value: 'hex',
            icon: '/images/icons/map.svg',
            label: 'Hex work',
          },
        ]}
      />
    </div>
  )

  return (
    <MapExplorer
      // A fresh explorer per data source: its filters, selection and map start
      // over, since the layouts share neither areas nor categories.
      key={dataSource}
      orgs={prototype?.orgs ?? orgs}
      scheme={prototype?.scheme ?? CLASSIC_MAP_SCHEME}
      categoryOptions={categoryOptions}
      realmBackdrop={realmMap?.backdrop}
      realmBackdropStyle={dataSource === 'art' ? 'art' : 'schematic'}
      hexBackdrop={hexMap?.layout}
      lastUpdatedIso={lastUpdatedIso}
      suggestEntryLink={suggestEntryLink}
      suggestCorrectionLink={suggestCorrectionLink}
      dataToggle={dataToggle}
    />
  )
}
