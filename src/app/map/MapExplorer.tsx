'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import Icon from '@/components/Icon'
import ContributeButtons from '@/components/ContributeButtons'
import FilterDropdown from '@/components/FilterDropdown'
import ModeToggle from '@/components/ModeToggle'
import RelativeDate from '@/components/RelativeDate'
import SearchBar from '@/components/SearchBar'
import CardsViewTracker from '@/components/CardsViewTracker'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { isPlacedOnMap } from '@/lib/map-images'
import {
  DEFAULT_EXPLORER_STATE,
  EXPLORER_SORTS,
  matchesSearch,
  parseExplorerState,
  resultCountLabel,
  sortOrgs,
  writeExplorerState,
  type ExplorerSort,
} from '@/lib/map-explorer'
import type { MapOrg } from '@/lib/data/map'
import type { MapExplorerLink } from './D3Map'
import { mapAreaFor } from '@/lib/data/map-areas'
import MapListingDetails from './MapListingDetails'
import MapResultRow from './MapResultRow'
import styles from './page.module.css'

const D3Map = dynamic(() => import('./D3Map'), {
  ssr: false,
  loading: () => (
    <p className="paragraph-small color-teal-300">Loading map...</p>
  ),
})

const CATEGORIES = [
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
const STATUSES = ['Active', 'No longer active']
const DEFAULT_STATUSES = ['Active']

const SORT_LABELS: Record<ExplorerSort, string> = {
  best: 'Best match',
  name: 'Name A–Z',
  recent: 'Recently added',
}

// The chips' names in the query string. The status chip starts with Active
// ticked, so its URL form differs from its state: nothing for the default,
// 'any' for no ticks at all.
const FILTER_KEYS = ['category', 'status']
const NO_STATUS = 'any'

const COLLAPSED_STORAGE_KEY = 'map-list-collapsed'
const LIST_ID = 'map-explorer-list'
const LEGEND_ID = 'map-explorer-legend'
// The overlay on the map's left side: a 376px column, 16px in from the edge.
const OVERLAY_WIDTH = 408

const sameValues = (a: string[], b: string[]) =>
  a.length === b.length && a.every(value => b.includes(value))

const isSinglePane = () => window.matchMedia('(max-width: 991px)').matches

// useSearchParams lives in its own null-rendering leaf behind a Suspense
// boundary so it doesn't bail the statically-generated page out to client
// rendering (same arrangement as /events and /training).
function ParamSync({ onParams }: { onParams: (params: string) => void }) {
  const params = useSearchParams().toString()
  useLayoutEffect(() => {
    onParams(params)
  }, [params, onParams])
  return null
}

interface MapExplorerProps {
  orgs: MapOrg[]
  lastUpdatedIso: string | null
  suggestEntryLink: string
  suggestCorrectionLink: string
  // The prototype's UI work / IA work switch, drawn over the map.
  dataToggle: ReactNode
}

// The /map explorer: the map is the page, and everything else floats over its
// left side — search, filter chips, and then either the selected org's
// details or a drawer of results. Selecting (a pin or a row) opens details;
// nothing on the map itself leaves the site. The drawer is the accessible way
// to everything on the map; the map follows it.
export default function MapExplorer({
  orgs,
  lastUpdatedIso,
  suggestEntryLink,
  suggestCorrectionLink,
  dataToggle,
}: MapExplorerProps) {
  const [query, setQuery] = useState('')
  // What the list is filtered by: the text, once typing has paused.
  const [settledQuery, setSettledQuery] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES)
  const [sort, setSort] = useState<ExplorerSort>(DEFAULT_EXPLORER_STATE.sort)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  // The results drawer starts closed, so the first thing seen is the map.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  // ?tuning=1 shows the developers' tools: the zoom-tier panel and the
  // prototype's data source switch.
  const [tuning, setTuning] = useState(false)
  // Below the breakpoint there is one pane at a time.
  const [pane, setPane] = useState<'list' | 'map'>('list')
  // PROTOTYPE: which treatment of non-matching pins reads better is an open
  // question in the handover, so both can be tried.
  const [nonMatching, setNonMatching] = useState<'hide' | 'dim'>('dim')

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const mapApiRef = useRef<{ panTo: (id: string) => void }>({
    panTo: () => {},
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), 200)
    return () => window.clearTimeout(timer)
  }, [query])

  // ── Filtering ────────────────────────────────────────────────────────────
  // Magic-map decorations are never listed.
  const listed = useMemo(() => orgs.filter(org => !org.isMagic), [orgs])
  const mapOrgs = useMemo(() => orgs.filter(isPlacedOnMap), [orgs])

  const basePass = useCallback(
    (org: MapOrg) => matchesSearch(org, settledQuery),
    [settledQuery]
  )
  const groups = useMemo(
    () => ({
      category: {
        selected: categories,
        matches: (org: MapOrg, value: string) =>
          org.category
            .split(',')
            .map(c => c.trim())
            .includes(value),
      },
      status: {
        selected: statuses,
        matches: (org: MapOrg, value: string) =>
          value === 'Active'
            ? org.status === 'Active'
            : org.status !== 'Active',
      },
    }),
    [categories, statuses]
  )

  const shown = useMemo(
    () => sortOrgs(filterItems(listed, basePass, groups), sort, settledQuery),
    [listed, basePass, groups, sort, settledQuery]
  )
  // What the count is "of": everything with the ticked statuses, before the
  // search and the category chip narrow it. So the untouched page reads
  // "339 organizations", not "339 of 369".
  const total = useMemo(
    () => filterItems(listed, () => true, { status: groups.status }).length,
    [listed, groups]
  )
  const categoryCounts = useMemo(
    () =>
      optionCounts(
        filterItems(listed, basePass, groups, 'category'),
        CATEGORIES,
        groups.category.matches
      ),
    [listed, basePass, groups]
  )
  const statusCounts = useMemo(
    () =>
      optionCounts(
        filterItems(listed, basePass, groups, 'status'),
        STATUSES,
        groups.status.matches
      ),
    [listed, basePass, groups]
  )

  const showInactive = statuses.includes('No longer active')
  const isFiltered =
    query.trim() !== '' ||
    categories.length > 0 ||
    !sameValues(statuses, DEFAULT_STATUSES)
  const clearAll = () => {
    setQuery('')
    setSettledQuery('')
    setCategories([])
    setStatuses(DEFAULT_STATUSES)
  }

  // The count is announced once it has stopped changing, never per keystroke.
  const countLabel = resultCountLabel(shown.length, total)
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(countLabel), 500)
    return () => window.clearTimeout(timer)
  }, [countLabel])

  // ── Query string ─────────────────────────────────────────────────────────
  // Written with replaceState, never router.push: a push would refetch this
  // statically generated page and stack a history entry per keystroke.
  const lastWrittenRef = useRef<string | null>(null)
  const urlReadRef = useRef(false)
  useEffect(() => {
    // Not before the URL has been read, or a shared link would be wiped.
    if (!urlReadRef.current) return
    const url = new URL(window.location.href)
    const next = writeExplorerState(
      url.searchParams,
      {
        query: settledQuery,
        filters: {
          category: categories,
          status: sameValues(statuses, DEFAULT_STATUSES)
            ? []
            : statuses.length > 0
              ? statuses
              : [NO_STATUS],
        },
        sort,
        selected: selectedId,
        // Whether the drawer is open is this visitor's habit, not part of a
        // link: it is kept in their browser, never in the address.
        collapsed: false,
      },
      FILTER_KEYS
    ).toString()
    if (next === url.searchParams.toString()) return
    lastWrittenRef.current = next
    url.search = next
    // history.state is passed through: Next.js keeps its routing state there.
    window.history.replaceState(window.history.state, '', url)
  }, [settledQuery, categories, statuses, sort, selectedId])

  const readUrl = useCallback(
    (params: string) => {
      const first = !urlReadRef.current
      urlReadRef.current = true
      // Our own write coming back round — the state already holds it, and
      // re-reading it would trim a space the visitor is still typing after.
      if (params === lastWrittenRef.current) return
      const state = parseExplorerState(new URLSearchParams(params), FILTER_KEYS)
      setQuery(state.query)
      setSettledQuery(state.query)
      setCategories(
        (state.filters.category ?? []).filter(c => CATEGORIES.includes(c))
      )
      const urlStatuses = state.filters.status
      setStatuses(
        !urlStatuses
          ? DEFAULT_STATUSES
          : urlStatuses.includes(NO_STATUS)
            ? []
            : urlStatuses.filter(s => STATUSES.includes(s))
      )
      setSort(state.sort)
      const linked =
        state.selected && listed.some(org => org.id === state.selected)
          ? state.selected
          : null
      setSelectedId(linked)
      // On a phone a shared link lands on the map, with the details sheet
      // over it.
      if (linked && isSinglePane()) setPane('map')
      setTuning(new URLSearchParams(params).get('tuning') === '1')
      if (first) {
        // What this visitor chose last time. Storage can be blocked; the
        // drawer then simply starts closed.
        try {
          setDrawerOpen(localStorage.getItem(COLLAPSED_STORAGE_KEY) === '0')
        } catch {
          setDrawerOpen(false)
        }
      }
    },
    [listed]
  )

  // ── Results drawer ───────────────────────────────────────────────────────
  // Focus follows the toggle: opening lands on the search field, closing
  // stays on the pill that closed it.
  const focusAfterToggleRef = useRef(false)
  const toggleDrawer = () => {
    const next = !drawerOpen
    focusAfterToggleRef.current = next
    setDrawerOpen(next)
    setLegendOpen(false)
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '0' : '1')
    } catch {
      // Storage blocked: the choice just isn't remembered.
    }
  }
  useEffect(() => {
    if (!focusAfterToggleRef.current) return
    focusAfterToggleRef.current = false
    searchRef.current?.focus()
  }, [drawerOpen])

  // ── Selection ────────────────────────────────────────────────────────────
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])
  // A row is brought into view inside the drawer only: the page itself never
  // scrolls because something was selected.
  const showRow = (id: string) => {
    requestAnimationFrame(() => {
      const list = listRef.current
      const row = document.getElementById(id)
      if (!list || !row || !list.contains(row)) return
      const top = row.offsetTop - list.offsetTop
      if (top < list.scrollTop) list.scrollTop = top
      else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = top + row.offsetHeight - list.clientHeight
      }
    })
  }
  const select = useCallback((id: string) => {
    setSelectedId(id)
    setLegendOpen(false)
    // Below the breakpoint the details sheet sits over the map.
    if (isSinglePane()) setPane('map')
    // After the render, so the map pans clear of the details card.
    requestAnimationFrame(() => mapApiRef.current.panTo(id))
  }, [])
  const clearSelection = useCallback(() => {
    if (selectedIdRef.current) showRow(selectedIdRef.current)
    setSelectedId(null)
  }, [])

  // A shared link's pin is shown once the map is there to show it.
  const onMapReady = useCallback(() => {
    if (selectedIdRef.current) mapApiRef.current.panTo(selectedIdRef.current)
  }, [])

  const selected = useMemo(
    () => listed.find(org => org.id === selectedId) ?? null,
    [listed, selectedId]
  )
  const firstCategory = (org: MapOrg) => org.category.split(',')[0].trim()
  const selectedPlace = selected ? mapAreaFor(selected.category) : null
  const inSelectedPlace = useMemo(
    () =>
      selected
        ? listed.filter(
            org =>
              org.status === 'Active' &&
              firstCategory(org) === firstCategory(selected)
          )
        : [],
    [listed, selected]
  )

  const matchingIds = useMemo(
    () =>
      shown.length === listed.length ? null : new Set(shown.map(o => o.id)),
    [shown, listed]
  )
  const overlayOpen = selected !== null || drawerOpen
  const explorerLink = useMemo(
    (): MapExplorerLink => ({
      matchingIds,
      nonMatching,
      selectedId,
      highlightedId,
      onSelect: select,
      onClear: clearSelection,
      leftInset: overlayOpen && !isSinglePane() ? OVERLAY_WIDTH : 0,
      apiRef: mapApiRef,
      onReady: onMapReady,
    }),
    [
      matchingIds,
      nonMatching,
      selectedId,
      highlightedId,
      select,
      clearSelection,
      overlayOpen,
      onMapReady,
    ]
  )

  // The places the counted orgs stand in (closed orgs have a place of their
  // own, which counts only while they are shown).
  const areaCount = new Set(
    filterItems(listed, () => true, { status: groups.status }).map(org =>
      mapAreaFor(org.category)
    )
  ).size

  return (
    <>
      <Suspense fallback={null}>
        <ParamSync onParams={readUrl} />
      </Suspense>
      <div className={`container-wide ${styles['explorer-title-row']}`}>
        <h1 className={styles['explorer-title']}>
          Map of AI Existential Safety
        </h1>
        <p className="paragraph-small color-teal-300">
          {total} organizations in {areaCount} areas ·{' '}
          <button
            type="button"
            className={`color-teal-bright-300 underline cursor-pointer ${styles['explorer-clear']}`}
            aria-expanded={legendOpen}
            aria-controls={LEGEND_ID}
            onClick={() => setLegendOpen(open => !open)}
          >
            How to read the map
          </button>
        </p>
      </div>

      <div
        className={`container-wide ${styles.explorer}`}
        data-pane={pane}
        data-drawer={drawerOpen ? 'open' : 'closed'}
      >
        <div className={styles['explorer-pane-switch']}>
          <ModeToggle
            mode={pane}
            onChange={setPane}
            ariaLabel="Show the list or the map"
            tabs={[
              { value: 'list', icon: '/images/icons/list.svg', label: 'List' },
              { value: 'map', icon: '/images/icons/map.svg', label: 'Map' },
            ]}
          />
        </div>

        <section aria-label="Map" className={styles['explorer-map']}>
          <D3Map
            orgs={mapOrgs}
            suggestEntryUrl={suggestEntryLink}
            tuning={tuning}
            explorer={explorerLink}
          />
          {tuning && dataToggle}
          {!overlayOpen && (
            <aside
              id={LEGEND_ID}
              aria-label="How to read the map"
              className={`border-plus-fill ${styles['explorer-legend']}`}
              hidden={!legendOpen}
            >
              <p className="paragraph-small-bold padding-bottom-8px">
                How to read the map
              </p>
              <ul className="paragraph-xs color-teal-300">
                <li>Each place on the island is a category of work.</li>
                <li>A bigger logo marks a larger organization.</li>
                <li>Zooming in shows more organizations.</li>
                <li>Selecting a logo shows its details.</li>
              </ul>
            </aside>
          )}
        </section>

        {/* Over the map's left side: search and filters with the results
            drawer under them, or the selected org's details in their place. */}
        <div
          className={styles['explorer-overlay']}
          data-selected={selected ? 'true' : undefined}
        >
          <CardsViewTracker page="Map" />
          <div
            role="search"
            className={`${styles['explorer-search']} ${styles['explorer-controls']}`}
          >
            <span
              className={styles['explorer-search-icon']}
              aria-hidden="true"
            />
            <SearchBar
              className={styles['explorer-search-input']}
              value={query}
              onChange={setQuery}
              inputRef={searchRef}
              aria-label="Search organizations"
              placeholder={`Search ${total} organizations…`}
            />
          </div>

          <div
            className={`flex flex-wrap items-center gap-8px ${styles['explorer-controls']}`}
          >
            <FilterDropdown
              trackingPage="Map"
              title="Category"
              options={CATEGORIES}
              selected={categories}
              counts={categoryCounts}
              countLabel
              onToggle={value =>
                setCategories(current =>
                  current.includes(value)
                    ? current.filter(c => c !== value)
                    : [...current, value]
                )
              }
            />
            <button
              type="button"
              className={`border-plus-fill paragraph-small ${styles['explorer-pill']}${showInactive ? ` ${styles['explorer-pill-active']}` : ''}`}
              aria-pressed={showInactive}
              onClick={() =>
                setStatuses(showInactive ? DEFAULT_STATUSES : STATUSES)
              }
            >
              <Icon src="/images/icons/eye.svg" size={16} />
              Show inactive · {statusCounts['No longer active'] ?? 0}
            </button>
            <button
              type="button"
              className={`border-plus-fill paragraph-small ${styles['explorer-pill']}${drawerOpen ? ` ${styles['explorer-pill-active']}` : ''}`}
              aria-expanded={drawerOpen}
              aria-controls={LIST_ID}
              onClick={toggleDrawer}
            >
              <Icon src="/images/icons/list.svg" size={16} />
              List · {shown.length}
            </button>
            {isFiltered && (
              <button
                type="button"
                className={`border-plus-fill paragraph-small ${styles['explorer-pill']}`}
                onClick={clearAll}
              >
                <Icon src="/images/icons/x.svg" size={16} />
                Clear all
              </button>
            )}
          </div>
          {/* Announced apart from the visible count, so a screen reader hears
              it once typing stops instead of on every keystroke. */}
          <p role="status" className="visually-hidden">
            {announced}
          </p>

          {selected && (
            <MapListingDetails
              org={selected}
              place={selectedPlace}
              nearby={inSelectedPlace
                .filter(org => org.id !== selected.id)
                .slice(0, 3)}
              placeCount={inSelectedPlace.length}
              suggestCorrectionUrl={suggestCorrectionLink}
              onSelect={select}
              onSeeAllInPlace={() => {
                setCategories([firstCategory(selected)])
                setSelectedId(null)
                setDrawerOpen(true)
              }}
              onClose={clearSelection}
            />
          )}

          <section
            id={LIST_ID}
            aria-label="Organizations"
            className={`border-plus-fill drop-shadow-dark ${styles['explorer-drawer']}`}
            hidden={selected !== null}
          >
            <div className={styles['explorer-drawer-head']}>
              <p
                className={`paragraph-small color-teal-300 ${styles['explorer-count']}`}
              >
                {countLabel}
              </p>
              <label className="flex items-center gap-8px">
                <span className="visually-hidden">Sort by</span>
                <select
                  className={`text-field ${styles['explorer-sort']}`}
                  value={sort}
                  onChange={event =>
                    setSort(event.target.value as ExplorerSort)
                  }
                >
                  {EXPLORER_SORTS.map(option => (
                    <option key={option} value={option}>
                      {SORT_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {isFiltered && (
              <div className={styles['explorer-drawer-others']}>
                <span className="paragraph-xs color-teal-300">Other pins</span>
                <ModeToggle
                  mode={nonMatching}
                  onChange={setNonMatching}
                  ariaLabel="Pins that don't match"
                  tabs={[
                    {
                      value: 'dim',
                      icon: '/images/icons/eye.svg',
                      label: 'Dim',
                    },
                    {
                      value: 'hide',
                      icon: '/images/icons/x.svg',
                      label: 'Hide',
                    },
                  ]}
                />
              </div>
            )}

            <div ref={listRef} className={styles['explorer-drawer-list']}>
              {shown.length > 0 ? (
                <ul>
                  {shown.map(org => (
                    <li
                      key={org.id}
                      onMouseEnter={() => setHighlightedId(org.id)}
                      onMouseLeave={() => setHighlightedId(null)}
                      onFocus={() => setHighlightedId(org.id)}
                      onBlur={() => setHighlightedId(null)}
                    >
                      <MapResultRow
                        org={org}
                        selected={org.id === selectedId}
                        onSelect={() => select(org.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="padding-bottom-24px">
                  <p className="paragraph-small color-teal-300 padding-bottom-16px">
                    No organizations match.
                  </p>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={clearAll}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <ContributeButtons
                trackingPage="Map"
                suggestEntryUrl={suggestEntryLink}
                suggestCorrectionUrl={suggestCorrectionLink}
                noun="listing"
                airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrLojIEOsNCKg1BL"
              />
            </div>
          </section>
        </div>
      </div>
      {lastUpdatedIso && (
        <div className="container-wide padding-top-8px padding-bottom-40px">
          <RelativeDate
            iso={lastUpdatedIso}
            className="paragraph-xs color-teal-300"
          />
        </div>
      )}
    </>
  )
}
