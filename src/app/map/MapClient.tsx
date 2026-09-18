'use client'

import dynamic from 'next/dynamic'
import Icon from '@/components/Icon'
import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import RelativeDate from '@/components/RelativeDate'
import ModeToggle from '@/components/ModeToggle'
import MapOrgCard from './MapOrgCard'
import SearchBar from '@/components/SearchBar'
import { trackCardsButtonClick } from '@/lib/analytics'
import CardsViewTracker from '@/components/CardsViewTracker'
import { placementsById } from '@/lib/placements'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { isPlacedOnMap } from '@/lib/map-images'
import { CLASSIC_MAP_SCHEME } from '@/lib/data/map-areas'
import { buildRealmScheme, QUIET_REALM } from '@/lib/data/map-realms'
import { layoutRealmMap, type LayoutPin } from '@/lib/data/map-realm-layout'
import { MAP_35_SPEC } from '@/lib/data/map-realm-spec'
import { SITE_PAGES } from '@/lib/site-pages'
import styles from './page.module.css'

const D3Map = dynamic(() => import('./D3Map'), {
  ssr: false,
  loading: () => (
    <div
      className={styles['map-container']}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p className="paragraph-small color-teal-300">Loading map...</p>
    </div>
  ),
})

const categories = [
  'Advocacy',
  'Blog',
  'Capabilities research',
  'Career support',
  'Conceptual research',
  'Empirical research',
  'Forecasting',
  'Funding',
  'Governance',
  'Newsletter',
  'Podcast',
  'Research support',
  'Resource',
  'Strategy',
  'Training and education',
  'Video',
]

interface MapOrg {
  id: string
  title: string
  tooltipTitle: string
  shortName: string | null
  description: string
  category: string
  status: string
  logo: string | null
  mapLogo: string | null
  link: string
  x: number | null
  y: number | null
  scale: string | null
  isMagic: boolean
  // PROTOTYPE Map 3.5: the draft placement, on IA_work records only.
  draft?: {
    x: number | null
    y: number | null
    realm: string | null
    district: string | null
  }
}

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

export default function MapClient({
  production,
  iaWork,
  lastUpdatedIso,
}: MapClientProps) {
  const [dataSource, setDataSource] = useState<'production' | 'ia'>(
    'production'
  )
  const { orgs, suggestEntryLink, suggestCorrectionLink } =
    dataSource === 'ia' && iaWork ? iaWork : production

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const mapWrapperRef = useRef<HTMLDivElement>(null)

  // Each org's slot in the list below the map, stamped onto a list click so the
  // dashboard can tie clicks to position. (Clicks on the map itself are
  // geographic, not ranked, so they carry no slot.)
  const placements = useMemo(() => placementsById(orgs), [orgs])

  const scrollToCards = () => {
    if (!mapWrapperRef.current) return

    // Surface the shareable /map#cards link (issue #226). replaceState rather
    // than setting location.hash: the latter jump-scrolls instantly, fighting
    // the animation below, and would stack a history entry per click.
    const url = new URL(window.location.href)
    url.hash = 'cards'
    window.history.replaceState(window.history.state, '', url)

    const mapRect = mapWrapperRef.current.getBoundingClientRect()
    const scrollTarget = window.scrollY + mapRect.bottom

    // QA: Custom scroll animation matching the live site — the browser's
    // native smooth scroll starts too quickly and feels too slow overall.
    // Uses quadratic ease-out for a snappier feel with a 500ms duration.
    const startPos = window.scrollY
    const distance = scrollTarget - startPos
    const duration = 500
    const startTime = performance.now()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      if (elapsed < duration) {
        const progress = elapsed / duration
        const easeOut = 1 - Math.pow(1 - progress, 2)
        window.scrollTo(0, startPos + distance * easeOut)
        requestAnimationFrame(step)
      } else {
        window.scrollTo(0, scrollTarget)
      }
    }

    requestAnimationFrame(step)
  }

  // Magic-map decorations are never listed; search applies on top.
  const basePass = useCallback(
    (org: MapOrg) => {
      if (org.isMagic) return false
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        org.title.toLowerCase().includes(query) ||
        org.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      category: {
        selected: selectedCategories,
        matches: (org: MapOrg, value: string) =>
          org.category
            .split(',')
            .map(c => c.trim())
            .includes(value),
      },
      status: {
        selected: [
          ...(showActive ? ['Active'] : []),
          ...(showInactive ? ['No longer active'] : []),
        ],
        matches: (org: MapOrg, value: string) =>
          value === 'Active'
            ? org.status === 'Active'
            : org.status !== 'Active',
      },
    }),
    [selectedCategories, showActive, showInactive]
  )

  const filteredOrgs = useMemo(
    () => filterItems(orgs, basePass, groups),
    [orgs, basePass, groups]
  )

  // Same rule /api/map-images uses, so the background preload warms exactly
  // the logos drawn here.
  const mapOrgs = useMemo(() => orgs.filter(isPlacedOnMap), [orgs])

  // PROTOTYPE Map 3.5: on IA_work the map places each org by its District, in
  // an area tree built from the Realm and District fields, and works out the
  // land, the regions and every position itself (map-realm-layout.ts) from
  // the rough draft positions in NewX/NewY. Closed orgs and map furniture stay
  // where the draft has them, off the land. An org with no realm, district or
  // draft position yet keeps its classic spot. The cards below the map are
  // unchanged.
  const isIaWork = dataSource === 'ia' && iaWork !== null
  const realmMap = useMemo(() => {
    if (!isIaWork) return null
    const placed: LayoutPin[] = []
    const fixed: { x: number; y: number }[] = []
    for (const org of mapOrgs) {
      const { x, y, realm, district } = org.draft ?? {}
      if (x == null || y == null) continue
      if (org.isMagic || !realm || !district || realm === QUIET_REALM) {
        fixed.push({ x, y })
      } else {
        placed.push({ id: org.id, realm, district, x, y, scale: org.scale })
      }
    }
    const layout = layoutRealmMap(placed, fixed, MAP_35_SPEC)
    const orgs = mapOrgs.map(org => {
      const at = layout.positions.get(org.id)
      return {
        ...org,
        category: org.draft?.district ?? org.category,
        x: at?.x ?? org.draft?.x ?? org.x,
        y: at?.y ?? org.draft?.y ?? org.y,
      }
    })
    const scheme = buildRealmScheme(
      orgs
        .filter(org => !org.isMagic)
        .map(org => ({
          realm: org.draft?.realm ?? null,
          district: org.draft?.district ?? null,
          x: org.x,
          y: org.y,
        }))
    )
    return {
      orgs,
      scheme,
      backdrop: { layout, landmarks: MAP_35_SPEC.landmarks },
    }
  }, [isIaWork, mapOrgs])

  const categoryCounts = useMemo(
    () =>
      optionCounts(
        filterItems(orgs, basePass, groups, 'category'),
        categories,
        groups.category.matches
      ),
    [orgs, basePass, groups]
  )

  const statusCounts = useMemo(
    () =>
      optionCounts(
        filterItems(orgs, basePass, groups, 'status'),
        ['Active', 'No longer active'],
        groups.status.matches
      ),
    [orgs, basePass, groups]
  )

  const savedScrollY = useRef<number | null>(null)

  const toggleCategory = (category: string) => {
    savedScrollY.current = window.scrollY
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
    } else {
      setSelectedCategories([...selectedCategories, category])
    }
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredOrgs])

  return (
    <>
      {/* The map is the page, so its heading is for screen readers and
          search engines only; every other page shows its <h1>. */}
      <h1 className="visually-hidden">{SITE_PAGES.map.title}</h1>
      <div className="padding-bottom-24px">
        <div ref={mapWrapperRef} className={styles['map-wrapper']}>
          <D3Map
            // A fresh map per data source: the view and the tuning panel
            // start over, since the two layouts share neither.
            key={dataSource}
            orgs={realmMap?.orgs ?? mapOrgs}
            scheme={realmMap?.scheme ?? CLASSIC_MAP_SCHEME}
            realmBackdrop={realmMap?.backdrop}
            suggestEntryUrl={suggestEntryLink}
          />
          {iaWork && (
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
                ]}
              />
            </div>
          )}
          <button
            onClick={() => {
              trackCardsButtonClick('Map', 'View cards')
              scrollToCards()
            }}
            className={`button-primary ${styles['scroll-button']}`}
          >
            View cards
            <Icon
              src="/images/icons/arrow-down.svg"
              className="color-teal-bright-400"
            />
          </button>
        </div>
      </div>

      <div id="cards" className="container-default">
        <CardsViewTracker page="Map" />
        {lastUpdatedIso && (
          <RelativeDate
            iso={lastUpdatedIso}
            className="padding-bottom-24px paragraph-small color-teal-300"
          />
        )}
        <h2 className="width-7-col padding-bottom-56px">
          An overview of the key{' '}
          <span className="color-light-teal">
            organizations, programs, and other resources
          </span>{' '}
          in the AI safety space.
        </h2>

        <div className="flex gap-56px">
          <div className="width-9-col">
            <div className="padding-bottom-40px">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search listings by name or description"
              />
            </div>

            <div className="collection-list padding-bottom-16px">
              {filteredOrgs.map(org => (
                <MapOrgCard
                  key={org.id}
                  org={org}
                  placement={placements.get(org.id)}
                />
              ))}
              {filteredOrgs.length === 0 && (
                <p className="paragraph-small color-teal-300">Nothing found.</p>
              )}
            </div>
          </div>

          <div className="hide-mobile width-3-col">
            <FilterSidebar>
              <FilterGroup
                trackingPage="Map"
                title="Category"
                options={categories}
                selected={selectedCategories}
                counts={categoryCounts}
                onToggle={toggleCategory}
              />
              <FilterGroup
                trackingPage="Map"
                title="Status"
                options={['Active', 'No longer active']}
                selected={[
                  ...(showActive ? ['Active'] : []),
                  ...(showInactive ? ['No longer active'] : []),
                ]}
                counts={statusCounts}
                onToggle={status => {
                  savedScrollY.current = window.scrollY
                  if (status === 'Active') setShowActive(!showActive)
                  else setShowInactive(!showInactive)
                }}
              />
            </FilterSidebar>
            <ContributeButtons
              trackingPage="Map"
              suggestEntryUrl={suggestEntryLink}
              suggestCorrectionUrl={suggestCorrectionLink}
              noun="listing"
              airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrLojIEOsNCKg1BL"
            />
          </div>
        </div>
      </div>
    </>
  )
}
