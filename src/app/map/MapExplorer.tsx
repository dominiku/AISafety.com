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
import { placementsById } from '@/lib/placements'
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
import MapOrgCard from './MapOrgCard'
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

// The /map explorer: one column (search, filter chips, sort, cards) beside
// the map, with a toggle that hides the column. The column is the accessible
// way to everything on the map; the map follows it.
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
  const [collapsed, setCollapsed] = useState(false)
  // Below the breakpoint there is one pane at a time.
  const [pane, setPane] = useState<'list' | 'map'>('list')
  // PROTOTYPE: which treatment of non-matching pins reads better is an open
  // question in the handover, so both can be tried.
  const [nonMatching, setNonMatching] = useState<'hide' | 'dim'>('dim')

  const searchRef = useRef<HTMLInputElement>(null)
  const showListRef = useRef<HTMLButtonElement>(null)
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
  const placements = useMemo(() => placementsById(shown), [shown])

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
        collapsed,
      },
      FILTER_KEYS
    ).toString()
    if (next === url.searchParams.toString()) return
    lastWrittenRef.current = next
    url.search = next
    // history.state is passed through: Next.js keeps its routing state there.
    window.history.replaceState(window.history.state, '', url)
  }, [settledQuery, categories, statuses, sort, selectedId, collapsed])

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
      setSelectedId(
        state.selected && listed.some(org => org.id === state.selected)
          ? state.selected
          : null
      )
      if (state.collapsed) {
        setCollapsed(true)
      } else if (first) {
        // No say in the link: fall back to what this visitor chose last time.
        // Storage can be blocked; the list then simply starts open.
        try {
          setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1')
        } catch {
          setCollapsed(false)
        }
      } else {
        setCollapsed(false)
      }
    },
    [listed]
  )

  // A shared link's selected card is brought into view once it is drawn.
  const scrolledToSelectedRef = useRef(false)
  useEffect(() => {
    if (scrolledToSelectedRef.current || !selectedId) return
    scrolledToSelectedRef.current = true
    document.getElementById(selectedId)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  // ── Sidebar toggle ───────────────────────────────────────────────────────
  // Focus follows the toggle: collapsing lands on "Show list", expanding on
  // the search field.
  const focusAfterToggleRef = useRef(false)
  const toggleCollapsed = () => {
    const next = !collapsed
    focusAfterToggleRef.current = true
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Storage blocked: the choice just isn't remembered.
    }
  }
  useEffect(() => {
    if (!focusAfterToggleRef.current) return
    focusAfterToggleRef.current = false
    if (collapsed) showListRef.current?.focus()
    else searchRef.current?.focus()
  }, [collapsed])

  // ── List and map sync ────────────────────────────────────────────────────
  const scrollToCard = (id: string) => {
    // After the render that may have opened the list or switched the pane.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    })
  }
  const selectFromCard = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null)
      return
    }
    setSelectedId(id)
    mapApiRef.current.panTo(id)
  }
  const selectFromPin = useCallback((id: string) => {
    setSelectedId(id)
    // The card is where the org's details and its link are, so it has to be
    // on screen: open the list, or switch to it below the breakpoint.
    setCollapsed(false)
    if (isSinglePane()) setPane('list')
    scrollToCard(id)
  }, [])

  const matchingIds = useMemo(
    () =>
      shown.length === listed.length ? null : new Set(shown.map(o => o.id)),
    [shown, listed]
  )
  const explorerLink = useMemo(
    (): MapExplorerLink => ({
      matchingIds,
      nonMatching,
      selectedId,
      highlightedId,
      onSelect: selectFromPin,
      apiRef: mapApiRef,
    }),
    [matchingIds, nonMatching, selectedId, highlightedId, selectFromPin]
  )

  return (
    <>
      <Suspense fallback={null}>
        <ParamSync onParams={readUrl} />
      </Suspense>
      <div className="container-wide padding-top-24px padding-bottom-24px">
        <h1 className="padding-bottom-8px">Map of AI Existential Safety</h1>
        {lastUpdatedIso && (
          <RelativeDate
            iso={lastUpdatedIso}
            className="paragraph-small color-teal-300"
          />
        )}
      </div>

      <div
        className={`container-wide ${styles.explorer}${collapsed ? ` ${styles['explorer-collapsed']}` : ''}`}
        data-pane={pane}
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

        <section
          id={LIST_ID}
          ref={listRef}
          aria-label="Organizations"
          className={styles['explorer-list']}
        >
          <CardsViewTracker page="Map" />
          <div role="search" className="padding-bottom-16px">
            <SearchBar
              value={query}
              onChange={setQuery}
              inputRef={searchRef}
              aria-label="Search organizations"
              placeholder={`Search ${total} organizations…`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-8px padding-bottom-16px">
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
            <FilterDropdown
              trackingPage="Map"
              title="Status"
              options={STATUSES}
              selected={statuses}
              counts={statusCounts}
              countLabel
              onToggle={value =>
                setStatuses(current =>
                  current.includes(value)
                    ? current.filter(s => s !== value)
                    : [...current, value]
                )
              }
            />
            {isFiltered && (
              <button
                type="button"
                className={`paragraph-xs-bold color-teal-300 underline cursor-pointer ${styles['explorer-clear']}`}
                onClick={clearAll}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-16px padding-bottom-16px">
            <p className="paragraph-small color-teal-300">{countLabel}</p>
            {/* Announced apart from the visible count, so a screen reader
                hears it once typing stops instead of on every keystroke. */}
            <p role="status" className="visually-hidden">
              {announced}
            </p>
            <label className="flex items-center gap-8px">
              <span className="visually-hidden">Sort by</span>
              <select
                className={`text-field ${styles['explorer-sort']}`}
                value={sort}
                onChange={event => setSort(event.target.value as ExplorerSort)}
              >
                {EXPLORER_SORTS.map(option => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {shown.length > 0 ? (
            <ul className="flex flex-col gap-16px padding-bottom-24px">
              {shown.map(org => (
                <li
                  key={org.id}
                  onMouseEnter={() => setHighlightedId(org.id)}
                  onMouseLeave={() => setHighlightedId(null)}
                  onFocus={() => setHighlightedId(org.id)}
                  onBlur={() => setHighlightedId(null)}
                >
                  <MapOrgCard
                    org={org}
                    placement={placements.get(org.id)}
                    selected={org.id === selectedId}
                    onSelect={() => selectFromCard(org.id)}
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
        </section>

        <section aria-label="Map" className={styles['explorer-map']}>
          <button
            type="button"
            className={styles['explorer-edge-tab']}
            aria-expanded={!collapsed}
            aria-controls={LIST_ID}
            aria-label={collapsed ? 'Show list' : 'Hide list'}
            // Collapsed, the "Show list" button beside it is the accessible
            // control; two tab stops with one name would only be noise. The
            // tab stays for the mouse, where the button is easy to miss.
            aria-hidden={collapsed || undefined}
            tabIndex={collapsed ? -1 : undefined}
            onClick={toggleCollapsed}
          >
            <Icon
              src={
                collapsed
                  ? '/images/icons/arrow-right.svg'
                  : '/images/icons/arrow-left.svg'
              }
              size={16}
            />
          </button>
          {collapsed && (
            <button
              ref={showListRef}
              type="button"
              className={`button-primary ${styles['explorer-show-list']}`}
              aria-expanded={false}
              aria-controls={LIST_ID}
              onClick={toggleCollapsed}
            >
              Show list · {shown.length}
            </button>
          )}
          <D3Map
            orgs={mapOrgs}
            suggestEntryUrl={suggestEntryLink}
            explorer={explorerLink}
          />
          {dataToggle}
          {/* PROTOTYPE: try both treatments of pins that don't match. */}
          <div className={styles['explorer-nonmatching']}>
            <ModeToggle
              mode={nonMatching}
              onChange={setNonMatching}
              ariaLabel="Pins that don't match"
              tabs={[
                { value: 'dim', icon: '/images/icons/eye.svg', label: 'Dim' },
                { value: 'hide', icon: '/images/icons/x.svg', label: 'Hide' },
              ]}
            />
          </div>
        </section>
      </div>
    </>
  )
}
