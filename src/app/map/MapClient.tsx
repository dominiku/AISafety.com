'use client'

import { useSearchParams } from 'next/navigation'
import {
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
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

// The map's views, in the order the switch shows them; the first one there is
// for is the default. Each is linkable by its slug: /map?view=hex. To add a
// view, add it here and teach the layout code below what it draws. A view of
// the forked base is only there where the fork's credentials are.
interface MapView {
  id: DataSource
  slug: string
  label: string
  icon: string
  fork: boolean
}
const MAP_VIEWS: MapView[] = [
  {
    id: 'hex',
    slug: 'hex',
    label: 'Hex work',
    icon: '/images/icons/map.svg',
    fork: true,
  },
  {
    id: 'production',
    slug: 'ui',
    label: 'UI work',
    icon: '/images/icons/map.svg',
    fork: false,
  },
  {
    id: 'ia',
    slug: 'ia',
    label: 'IA work',
    icon: '/images/icons/table.svg',
    fork: true,
  },
  {
    id: 'art',
    slug: 'art',
    label: 'Art work',
    icon: '/images/icons/map.svg',
    fork: true,
  },
]
const VIEW_PARAM = 'view'

// useSearchParams lives in its own null-rendering leaf behind a Suspense
// boundary so it doesn't bail the statically-generated page out to client
// rendering (the explorer reads its own params the same way).
function ViewParamSync({ onView }: { onView: (slug: string | null) => void }) {
  const slug = useSearchParams().get(VIEW_PARAM)
  useLayoutEffect(() => {
    onView(slug)
  }, [slug, onView])
  return null
}

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
  const views = useMemo(
    () => MAP_VIEWS.filter(view => !view.fork || iaWork !== null),
    [iaWork]
  )
  const defaultView = views[0]
  const [dataSource, setDataSource] = useState<DataSource>(defaultView.id)
  // The address names the view (?view=hex); a slug for a view not here, or
  // none, means the default. The default is left out of the address, so the
  // bare /map keeps its bare URL.
  const readView = useCallback(
    (slug: string | null) => {
      const view = views.find(v => v.slug === slug) ?? defaultView
      setDataSource(view.id)
    },
    [views, defaultView]
  )
  const chooseView = (id: DataSource) => {
    setDataSource(id)
    const view = views.find(v => v.id === id) ?? defaultView
    const url = new URL(window.location.href)
    if (view === defaultView) url.searchParams.delete(VIEW_PARAM)
    else url.searchParams.set(VIEW_PARAM, view.slug)
    // In place, as the explorer writes its own params: history.state is
    // passed through, since Next.js keeps its routing state there.
    window.history.replaceState(window.history.state, '', url)
  }
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

  // One view alone (no fork) needs no switch.
  const dataToggle = views.length > 1 && (
    <div className={styles['map-data-toggle']}>
      <ModeToggle
        mode={dataSource}
        onChange={chooseView}
        ariaLabel="Map view"
        tabs={views.map(view => ({
          value: view.id,
          icon: view.icon,
          label: view.label,
        }))}
      />
    </div>
  )

  return (
    <>
      <Suspense fallback={null}>
        <ViewParamSync onView={readView} />
      </Suspense>
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
    </>
  )
}
