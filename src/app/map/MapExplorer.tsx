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
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import Icon from '@/components/Icon'
import ContributeButtons from '@/components/ContributeButtons'
import FilterDropdown from '@/components/FilterDropdown'
import RelativeDate from '@/components/RelativeDate'
import SearchBar from '@/components/SearchBar'
import CardsViewTracker from '@/components/CardsViewTracker'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { isPlacedOnMap } from '@/lib/map-images'
import {
  DEFAULT_EXPLORER_STATE,
  categoryFromSlug,
  categorySlug,
  fittedStatus,
  historyActionFor,
  matchesSearch,
  parseExplorerState,
  pickedSort,
  resultCountLabel,
  shownSort,
  sortOptions,
  sortOrgs,
  visibleRange,
  writeExplorerState,
  type ExplorerSort,
} from '@/lib/map-explorer'
import type { MapOrg } from '@/lib/data/map'
import type { MapExplorerLink } from './D3Map'
import { mapAreaFor } from '@/lib/data/map-areas'
import MapListCard from './MapListCard'
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
  featured: 'Featured',
  name: 'Name A–Z',
  recent: 'Recently added',
}

// The chips' names in the query string. The status chip starts with Active
// ticked, so its URL form differs from its state: nothing for the default,
// 'any' for no ticks at all.
const FILTER_KEYS = ['category', 'status']
// Category is one choice at a time, so the address carries at most one.
const SINGLE_FILTER_KEYS = ['category']
const NO_STATUS = 'any'

// Marks the history entry made by opening a details card.
const CARD_ENTRY_KEY = 'mapCard'
// Whether this visitor left the results drawer open ('1') or closed ('0').
// (Not the earlier explorer's 'map-list-collapsed': its column started open,
// and a value left over from it would open the drawer over the map.)
const DRAWER_STORAGE_KEY = 'map-drawer-open'
// Set once a phone's visitor has moved the map: the hint has done its work.
const DRAG_HINT_STORAGE_KEY = 'map-drag-hint-seen'
// A search with this many hits on the map, or fewer, fits the view to them.
const SEARCH_FIT_MAX_HITS = 12
const LIST_ID = 'map-explorer-list'
const LEGEND_ID = 'map-explorer-legend'
// Every row of the results drawer is this tall, which is what lets only the
// rows in view be rendered (.result-row in page.module.css). A phone's list
// is cards: 184px and the 12px between them (.list-card).
const ROW_HEIGHT = 64
const CARD_ROW_HEIGHT = 196
// A phone's map: what the floating search covers at the top, and the details
// sheet at the bottom (.details-card).
const PHONE_TOP_INSET = 72
const SHEET_HEIGHT = 372
// The overlay on the map's left side: a 376px column, 24px in from the pane's
// edge (which on a desktop is the window's) and 16px clear of what is fitted
// beside it. (.explorer-overlay in page.module.css.)
const OVERLAY_WIDTH = 416

const sameValues = (a: string[], b: string[]) =>
  a.length === b.length && a.every(value => b.includes(value))

const SINGLE_PANE_QUERY = '(max-width: 991px)'
const isSinglePane = () => window.matchMedia(SINGLE_PANE_QUERY).matches
const subscribeToSinglePane = (onChange: () => void) => {
  const query = window.matchMedia(SINGLE_PANE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

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
  // Below the breakpoint there is one pane at a time, and the map comes
  // first: the list is a button away.
  const [pane, setPane] = useState<'list' | 'map'>('map')
  const singlePane = useSyncExternalStore(
    subscribeToSinglePane,
    isSinglePane,
    () => false
  )
  // A phone's map keeps the filter pills behind a button in the search field.
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The drawer's list is one Tab stop: the arrow keys move this row about.
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  // A phone's "Drag to explore", until the map has been moved once.
  const [dragHint, setDragHint] = useState(false)

  const explorerRootRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<HTMLUListElement>(null)
  const legendToggleRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listPillRef = useRef<HTMLButtonElement>(null)
  const paneButtonRef = useRef<HTMLButtonElement>(null)
  const selectedIdRef = useRef<string | null>(null)
  // The org whose card has just closed: focus goes back to where it was
  // opened from, once the render without the card has happened.
  const closedIdRef = useRef<string | null>(null)
  const mapApiRef = useRef<MapExplorerLink['apiRef']['current']>({
    panTo: () => {},
    focusPin: () => false,
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

  // One way to change the category filter, for the Category pill and the
  // place names on the map. It is one category at a time: picking another
  // takes the place of the last, and picking the current one again clears it.
  // (`categories` stays a list, of one at most, for the filter counts.) A
  // category picked opens the results drawer, where its matches are listed.
  const toggleCategory = useCallback(
    (value: string) => {
      const picking = categories[0] !== value
      setCategories(picking ? [value] : [])
      if (picking) {
        setDrawerOpen(true)
        setLegendOpen(false)
      }
    },
    [categories]
  )
  const toggleInactive = useCallback(() => {
    setStatuses(current =>
      current.includes('No longer active') ? DEFAULT_STATUSES : STATUSES
    )
  }, [])

  // "Show inactive" is one switch for the whole map, so its count is every
  // closed org, whatever else is filtered by.
  const inactiveTotal = useMemo(
    () => listed.filter(org => org.status !== 'Active').length,
    [listed]
  )
  // Typing a search opens the drawer, where its hits are listed, and lets go
  // of a selected org, whose card would be standing in the drawer's place.
  const typeQuery = (value: string) => {
    setQuery(value)
    if (value.trim() === '') return
    setDrawerOpen(true)
    setLegendOpen(false)
    setSelectedId(null)
  }

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

  const hasQuery = settledQuery.trim() !== ''
  // With exactly one category filtered by, the map is fitted to its place.
  const fitArea = categories.length === 1 ? mapAreaFor(categories[0]) : null

  // The count is announced once it has stopped changing, never per keystroke.
  const countLabel = resultCountLabel(shown.length, total)
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    const label = fitArea
      ? `${countLabel}. Map fitted to ${fitArea}.`
      : countLabel
    const timer = window.setTimeout(() => setAnnounced(label), 500)
    return () => window.clearTimeout(timer)
  }, [countLabel, fitArea])

  // ── Query string ─────────────────────────────────────────────────────────
  // Written with the History API, never router.push, which would refetch this
  // statically generated page. Everything is written in place, bar one thing:
  // opening a details card makes a history entry, so that Back closes it.
  const lastWrittenRef = useRef<string | null>(null)
  const urlReadRef = useRef(false)
  // Closing a card steps back off the entry it made; what comes round in that
  // popstate is our own doing, not a link to read.
  const steppingBackRef = useRef(false)
  const [historyTick, setHistoryTick] = useState(0)
  useEffect(() => {
    const onPopState = () => {
      if (steppingBackRef.current) {
        steppingBackRef.current = false
        lastWrittenRef.current = new URL(
          window.location.href
        ).searchParams.toString()
        // Whatever else changed with the close (a category from "See all")
        // still has to be written, now onto the entry stepped back to.
        setHistoryTick(tick => tick + 1)
      } else {
        // Back or Forward by the visitor: the address is there to be read,
        // even if it is one this page wrote earlier.
        lastWrittenRef.current = null
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    // Not before the URL has been read, or a shared link would be wiped; and
    // not while stepping back, when the address is about to change anyway.
    if (!urlReadRef.current || steppingBackRef.current) return
    const url = new URL(window.location.href)
    const next = writeExplorerState(
      url.searchParams,
      {
        query: settledQuery,
        filters: {
          category: categories.map(categorySlug),
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
      FILTER_KEYS,
      SINGLE_FILTER_KEYS
    ).toString()
    if (next === url.searchParams.toString()) return
    const action = historyActionFor(
      url.searchParams.get('org'),
      selectedId,
      window.history.state?.[CARD_ENTRY_KEY] === true
    )
    if (action === 'back') {
      steppingBackRef.current = true
      window.history.back()
      return
    }
    lastWrittenRef.current = next
    url.search = next
    if (action === 'push') {
      // Next.js adds its own routing state to a pushed entry.
      window.history.pushState({ [CARD_ENTRY_KEY]: true }, '', url)
    } else {
      // history.state is passed through: Next.js keeps its routing state there.
      window.history.replaceState(window.history.state, '', url)
    }
  }, [settledQuery, categories, statuses, sort, selectedId, historyTick])

  const readUrl = useCallback(
    (params: string) => {
      const first = !urlReadRef.current
      urlReadRef.current = true
      // Our own write coming back round — the state already holds it, and
      // re-reading it would trim a space the visitor is still typing after.
      if (params === lastWrittenRef.current) return
      const state = parseExplorerState(
        new URLSearchParams(params),
        FILTER_KEYS,
        SINGLE_FILTER_KEYS
      )
      setQuery(state.query)
      setSettledQuery(state.query)
      if (state.query.trim() !== '') {
        setDrawerOpen(true)
        setLegendOpen(false)
      }
      const linkedCategories = (state.filters.category ?? [])
        .map(value => categoryFromSlug(value, CATEGORIES))
        .filter((c): c is string => c !== null)
      setCategories(linkedCategories)
      // A link to a category shows its list, as picking one here does.
      if (linkedCategories.length > 0) {
        setDrawerOpen(true)
        setLegendOpen(false)
      }
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
      // Back has closed a card, or Forward has opened one again.
      if (!linked) closedIdRef.current = selectedIdRef.current
      else requestAnimationFrame(() => mapApiRef.current.panTo(linked))
      setSelectedId(linked)
      // On a phone a shared link lands on the map, with the details sheet
      // over it.
      if (linked && isSinglePane()) setPane('map')
      if (linked) setLegendOpen(false)
      setTuning(new URLSearchParams(params).get('tuning') === '1')
      if (first) {
        // What this visitor chose last time. Storage can be blocked; the
        // drawer then simply starts closed.
        try {
          if (localStorage.getItem(DRAWER_STORAGE_KEY) === '1') {
            setDrawerOpen(true)
            setLegendOpen(false)
          }
          setDragHint(localStorage.getItem(DRAG_HINT_STORAGE_KEY) !== '1')
        } catch {
          // Storage blocked: the drawer keeps to what the link asked for.
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
      localStorage.setItem(DRAWER_STORAGE_KEY, next ? '1' : '0')
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
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])
  // Only the drawer's rows in view are rendered: 339 rows at once made a list
  // 22,000px tall that nobody sees. What is in view is worked out from the
  // list's own scroll position and height.
  const [listView, setListView] = useState({ top: 0, height: 0 })
  const measureList = useCallback(() => {
    const list = listRef.current
    if (!list) return
    setListView(view =>
      view.top === list.scrollTop && view.height === list.clientHeight
        ? view
        : { top: list.scrollTop, height: list.clientHeight }
    )
  }, [])
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(measureList)
    observer.observe(list)
    return () => observer.disconnect()
  }, [measureList])
  // Until it has been measured (the drawer is closed), a screenful's worth.
  const rowHeight = singlePane ? CARD_ROW_HEIGHT : ROW_HEIGHT
  const rows = visibleRange(
    listView.top,
    listView.height || 800,
    rowHeight,
    shown.length
  )
  const rowHeightRef = useRef(rowHeight)
  useEffect(() => {
    rowHeightRef.current = rowHeight
  }, [rowHeight])

  const shownRef = useRef(shown)
  useEffect(() => {
    shownRef.current = shown
  }, [shown])
  // The row that gets the keyboard's focus once it has been rendered.
  const focusRowRef = useRef<string | null>(null)
  // A row is brought into view inside the drawer only: the page itself never
  // scrolls because something was selected. False when there is no such row
  // on screen (the drawer is closed, or the org is filtered out).
  const showRow = useCallback(
    (id: string, toTop = false) => {
      const list = listRef.current
      const index = shownRef.current.findIndex(org => org.id === id)
      if (!list || list.offsetParent === null || index < 0) return false
      const height = rowHeightRef.current
      const top = index * height
      if (toTop || top < list.scrollTop) list.scrollTop = top
      else if (top + height > list.scrollTop + list.clientHeight) {
        list.scrollTop = top + height - list.clientHeight
      }
      measureList()
      return true
    },
    [measureList]
  )
  // A new search, filter or sort is a new list: it is read from its top. (A
  // selection is not: the list keeps its place for when the card closes.)
  useEffect(() => {
    const list = listRef.current
    if (!list || list.scrollTop === 0) return
    list.scrollTop = 0
    measureList()
  }, [settledQuery, categories, statuses, sort, measureList])

  // The drawer's list is a listbox: one Tab stop, and the arrow keys move the
  // active row, which the map shows off as it does a hovered one.
  const activateRow = useCallback(
    (id: string | null) => {
      setActiveRowId(id)
      setHighlightedId(id)
      if (id) showRow(id)
    },
    [showRow]
  )
  const onRowsKeyDown = (event: React.KeyboardEvent) => {
    if (shown.length === 0) return
    const at = shown.findIndex(org => org.id === activeRowId)
    let to: number | null = null
    if (event.key === 'ArrowDown') to = Math.min(at + 1, shown.length - 1)
    else if (event.key === 'ArrowUp') to = Math.max(at - 1, 0)
    else if (event.key === 'Home') to = 0
    else if (event.key === 'End') to = shown.length - 1
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (at >= 0) select(shown[at].id)
      return
    } else return
    event.preventDefault()
    activateRow(shown[to].id)
  }
  useEffect(() => {
    const id = focusRowRef.current
    if (!id) return
    focusRowRef.current = null
    rowsRef.current?.focus({ preventScroll: true })
    activateRow(id)
  })
  const select = useCallback((id: string) => {
    setSelectedId(id)
    setLegendOpen(false)
    // Below the breakpoint the details sheet sits over the map.
    if (isSinglePane()) setPane('map')
    // After the render, so the map pans clear of the details card.
    requestAnimationFrame(() => mapApiRef.current.panTo(id))
  }, [])
  // A phone's list: a tapped card is marked, and stays in the list; its
  // "Show on map" goes over to the map, where the details sheet opens.
  const showInList = useCallback(() => {
    setPane('list')
    const id = selectedIdRef.current
    // Once the list is on screen.
    if (id) requestAnimationFrame(() => showRow(id, true))
  }, [showRow])
  const clearSelection = useCallback(() => {
    closedIdRef.current = selectedIdRef.current
    setSelectedId(null)
  }, [])
  useEffect(() => {
    const id = closedIdRef.current
    if (selectedId !== null || !id) return
    closedIdRef.current = null
    // The drawer comes back with the card gone: the org's row is the place
    // to carry on from. With no drawer it is the pin, and if the pin is not
    // showing at this zoom, the pill that opens the list.
    if (showRow(id)) focusRowRef.current = id
    else if (!mapApiRef.current.focusPin(id)) listPillRef.current?.focus()
  }, [selectedId, showRow])

  // Esc inside the map hands the keyboard back to the button that lists
  // everything on it: the List pill, or on a phone the list button.
  const leaveMap = useCallback(() => {
    const pill = listPillRef.current
    ;(pill && pill.offsetParent !== null
      ? pill
      : paneButtonRef.current
    )?.focus()
  }, [])

  // The legend sits over the map's corner: it makes way for the keyboard.
  const closeLegend = useCallback(() => setLegendOpen(false), [])
  // Closed from inside (its close button, or Esc): the focus goes back to
  // the link that opened it.
  const dismissLegend = () => {
    setLegendOpen(false)
    legendToggleRef.current?.focus()
  }

  // A phone's hint has done its work the first time the map is moved.
  const dragHintRef = useRef(dragHint)
  useEffect(() => {
    dragHintRef.current = dragHint
  }, [dragHint])
  const onUserMove = useCallback(() => {
    if (!dragHintRef.current) return
    dragHintRef.current = false
    setDragHint(false)
    try {
      localStorage.setItem(DRAG_HINT_STORAGE_KEY, '1')
    } catch {
      // Storage blocked: the hint comes back next visit.
    }
  }, [])

  // What floats over the map, for its place names to keep clear of.
  const overlayRects = useCallback(
    () =>
      [
        // The zoom buttons are the map's own, so they are found by class.
        ...(explorerRootRef.current?.querySelectorAll<HTMLElement>(
          `[data-map-cover], .${styles['map-controls']}`
        ) ?? []),
      ]
        .filter(element => element.offsetParent !== null)
        .map(element => element.getBoundingClientRect()),
    []
  )

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
  // The orgs standing in the same place: on the map, by their first category.
  // The same rule as the count in the place name's tooltip (areaCount in
  // D3Map), so "See all 10" and "Blog Beach, 10 organizations" agree.
  const inSelectedPlace = useMemo(
    () =>
      selected
        ? listed.filter(
            org =>
              isPlacedOnMap(org) &&
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
  // Closed orgs are off the map, not dimmed, until "Show inactive" is on.
  const hiddenIds = useMemo(
    () =>
      showInactive
        ? null
        : new Set(
            listed.filter(org => org.status !== 'Active').map(org => org.id)
          ),
    [listed, showInactive]
  )
  const fitted = useMemo(() => {
    if (!fitArea) return null
    const onMap = shown.filter(isPlacedOnMap)
    const here = onMap.filter(org => mapAreaFor(org.category) === fitArea)
    return fittedStatus(fitArea, here.length, onMap.length - here.length)
  }, [fitArea, shown])
  // A search with a handful of hits on the map: the view is fitted to them.
  const fitIds = useMemo(() => {
    if (!hasQuery) return null
    const onMap = shown.filter(isPlacedOnMap)
    return onMap.length > 0 && onMap.length <= SEARCH_FIT_MAX_HITS
      ? onMap.map(org => org.id)
      : null
  }, [hasQuery, shown])
  const overlayOpen = selected !== null || drawerOpen
  const overlayKey = [
    drawerOpen,
    legendOpen,
    selectedId,
    categories.length,
    isFiltered,
    filtersOpen,
    pane,
    singlePane,
    fitArea,
  ].join('|')
  const explorerLink = useMemo(
    (): MapExplorerLink => ({
      matchingIds,
      hiddenIds,
      activeCategories: categories,
      onToggleCategory: toggleCategory,
      showInactive,
      onToggleInactive: toggleInactive,
      fitArea,
      showEveryMatch: hasQuery,
      fitIds,
      overlayRects,
      overlayKey,
      onUserMove,
      selectedId,
      highlightedId,
      onSelect: select,
      onClear: clearSelection,
      onLeaveMap: leaveMap,
      onKeyboardMove: closeLegend,
      leftInset: overlayOpen && !singlePane ? OVERLAY_WIDTH : 0,
      topInset: singlePane ? PHONE_TOP_INSET : 0,
      bottomInset: singlePane && selectedId ? SHEET_HEIGHT : 0,
      apiRef: mapApiRef,
      onReady: onMapReady,
    }),
    [
      matchingIds,
      hiddenIds,
      categories,
      toggleCategory,
      showInactive,
      toggleInactive,
      fitArea,
      hasQuery,
      fitIds,
      overlayRects,
      overlayKey,
      onUserMove,
      selectedId,
      highlightedId,
      select,
      clearSelection,
      leaveMap,
      closeLegend,
      overlayOpen,
      singlePane,
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
            ref={legendToggleRef}
            onClick={() => setLegendOpen(open => !open)}
            onKeyDown={event => {
              if (event.key === 'Escape' && legendOpen) setLegendOpen(false)
            }}
          >
            How to read the map
          </button>
        </p>
      </div>

      <div
        ref={explorerRootRef}
        className={`container-wide ${styles.explorer}`}
        data-pane={pane}
        data-drawer={drawerOpen ? 'open' : 'closed'}
        data-sheet={selected ? 'open' : undefined}
        data-filters={filtersOpen || categories.length > 0 ? 'open' : undefined}
      >
        {/* Over the map's left side: search and filters with the results
            drawer under them, or the selected org's details in their place. */}
        <div
          className={styles['explorer-overlay']}
          data-selected={selected ? 'true' : undefined}
        >
          <CardsViewTracker page="Map" />
          <div
            data-map-cover
            className={`${styles['explorer-search-row']} ${styles['explorer-controls']}`}
          >
            <div role="search" className={styles['explorer-search']}>
              <span
                className={styles['explorer-search-icon']}
                aria-hidden="true"
              />
              <SearchBar
                className={styles['explorer-search-input']}
                value={query}
                onChange={typeQuery}
                inputRef={searchRef}
                aria-label="Search organizations"
                placeholder={`Search ${total} organizations…`}
              />
              {/* A phone's map: the filter pills wait behind this button. */}
              <button
                type="button"
                className={styles['explorer-filter-button']}
                aria-label="Filters"
                aria-expanded={filtersOpen || categories.length > 0}
                onClick={() => setFiltersOpen(open => !open)}
              >
                <Icon src="/images/icons/filter-alt-2.svg" size={16} />
              </button>
            </div>
            {/* A phone shows the map or the list; this goes to the other. */}
            <button
              type="button"
              className={`border-plus-fill ${styles['explorer-pane-button']}`}
              aria-label={pane === 'map' ? 'Show the list' : 'Show the map'}
              ref={paneButtonRef}
              onClick={() => {
                // With an org selected the list opens at its card.
                if (pane === 'list') setPane('map')
                else if (selectedId) showInList()
                else setPane('list')
              }}
            >
              <Icon
                src={
                  pane === 'map'
                    ? '/images/icons/list.svg'
                    : '/images/icons/map.svg'
                }
                size={16}
              />
            </button>
          </div>

          <div
            data-map-cover
            className={`flex flex-wrap items-center gap-8px ${styles['explorer-controls']} ${styles['explorer-pills']}`}
          >
            {/* One pill says which category is picked ("Category: Blog"). */}
            <FilterDropdown
              trackingPage="Map"
              title="Category"
              options={CATEGORIES}
              selected={categories}
              counts={categoryCounts}
              single
              onToggle={toggleCategory}
              optionNote={mapAreaFor}
              onClear={() => setCategories([])}
            />
            <button
              type="button"
              className={`border-plus-fill paragraph-small ${styles['explorer-pill']}${showInactive ? ` ${styles['explorer-pill-active']}` : ''}`}
              aria-pressed={showInactive}
              onClick={toggleInactive}
            >
              <Icon src="/images/icons/eye.svg" size={16} />
              Show inactive · {inactiveTotal}
            </button>
            {/* A phone has the list button beside the search instead. */}
            {!singlePane && (
              <button
                type="button"
                className={`border-plus-fill paragraph-small ${styles['explorer-pill']}${drawerOpen ? ` ${styles['explorer-pill-active']}` : ''}`}
                aria-expanded={drawerOpen}
                aria-controls={LIST_ID}
                ref={listPillRef}
                onClick={toggleDrawer}
              >
                <Icon src="/images/icons/list.svg" size={16} />
                List · {shown.length}
              </button>
            )}
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
              onShowInList={showInList}
              onSeeAllInPlace={() => {
                setCategories([firstCategory(selected)])
                setSelectedId(null)
                setDrawerOpen(true)
                setLegendOpen(false)
              }}
              onClose={clearSelection}
            />
          )}

          <section
            id={LIST_ID}
            data-map-cover
            aria-label="Organizations"
            className={`border-plus-fill drop-shadow-dark ${styles['explorer-drawer']}`}
            hidden={selected !== null && !singlePane}
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
                  value={shownSort(sort, hasQuery)}
                  onChange={event =>
                    setSort(
                      pickedSort(event.target.value as ExplorerSort, hasQuery)
                    )
                  }
                >
                  {sortOptions(hasQuery).map(option => (
                    <option key={option} value={option}>
                      {SORT_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              ref={listRef}
              className={styles['explorer-drawer-list']}
              onScroll={measureList}
            >
              {shown.length > 0 ? (
                <ul
                  ref={rowsRef}
                  className={styles['explorer-rows']}
                  style={{ height: shown.length * rowHeight }}
                  // On a desktop the rows are a listbox, one Tab stop with the
                  // arrow keys inside it; a phone's cards hold links, so they
                  // stay a plain list.
                  {...(singlePane
                    ? {}
                    : {
                        role: 'listbox',
                        'aria-label': 'Organizations',
                        tabIndex: 0,
                        'aria-activedescendant':
                          activeRowId &&
                          shown
                            .slice(rows.start, rows.end)
                            .some(org => org.id === activeRowId)
                            ? activeRowId
                            : undefined,
                        onKeyDown: onRowsKeyDown,
                        // Reached with the keyboard (a click focuses the
                        // list too, and must not scroll it from under the
                        // pointer): carry on from the active row.
                        onFocus: event => {
                          if (!event.currentTarget.matches(':focus-visible'))
                            return
                          activateRow(
                            activeRowId &&
                              shown.some(org => org.id === activeRowId)
                              ? activeRowId
                              : (shown[0]?.id ?? null)
                          )
                        },
                        onBlur: () => setHighlightedId(null),
                      })}
                >
                  {shown.slice(rows.start, rows.end).map((org, offset) => (
                    <li
                      key={org.id}
                      style={{ top: (rows.start + offset) * rowHeight }}
                      aria-setsize={shown.length}
                      aria-posinset={rows.start + offset + 1}
                      onMouseEnter={() => setHighlightedId(org.id)}
                      onMouseLeave={() => setHighlightedId(null)}
                      {...(singlePane
                        ? {}
                        : {
                            id: org.id,
                            role: 'option',
                            'aria-selected': org.id === selectedId,
                            onClick: () => select(org.id),
                          })}
                    >
                      {singlePane ? (
                        <MapListCard
                          org={org}
                          selected={org.id === selectedId}
                          onSelect={() => setSelectedId(org.id)}
                          onShowOnMap={() => select(org.id)}
                        />
                      ) : (
                        <MapResultRow
                          org={org}
                          selected={org.id === selectedId}
                          active={org.id === activeRowId}
                        />
                      )}
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
        {/* After the overlay in the page, though under it on screen: Tab
            goes search, pills, list, then the map. */}
        <section aria-label="Map" className={styles['explorer-map']}>
          <D3Map
            orgs={mapOrgs}
            suggestEntryUrl={suggestEntryLink}
            tuning={tuning}
            explorer={explorerLink}
          />
          {tuning && dataToggle}
          {/* Always in the page, shown or not, so the link that opens it has
              something to point at. Opening the drawer or a card closes it. */}
          <div
            id={LEGEND_ID}
            data-map-cover
            role="note"
            aria-label="How to read the map"
            className={`border-plus-fill ${styles['explorer-legend']}`}
            hidden={!legendOpen}
            onKeyDown={event => {
              if (event.key !== 'Escape') return
              event.stopPropagation()
              dismissLegend()
            }}
          >
            <button
              type="button"
              className={`${styles['details-close']} ${styles['explorer-legend-close']}`}
              aria-label="Close how to read the map"
              onClick={dismissLegend}
            >
              <Icon src="/images/icons/x.svg" size={16} />
            </button>
            <p className="paragraph-small-bold padding-bottom-8px">
              How to read the map
            </p>
            <ul className="paragraph-xs color-teal-300">
              <li>Place names are categories: select one to filter the map.</li>
              <li>
                Bigger logos are larger organizations; zooming in shows more.
              </li>
              <li>
                Keyboard: Tab to the map, arrow keys between organizations,
                Enter for details.
              </li>
            </ul>
          </div>
          {singlePane && pane === 'map' && dragHint && !selected && (
            <p
              className={`border-plus-fill paragraph-xs color-teal-300 ${styles['explorer-drag-hint']}`}
            >
              Drag to explore
            </p>
          )}
          {fitted && !selected && (
            <p
              data-map-cover
              className={`border-plus-fill drop-shadow-dark paragraph-small color-teal-300 ${styles['explorer-fitted']}`}
              data-overlay={overlayOpen ? 'open' : undefined}
            >
              <Icon src="/images/icons/scan.svg" size={16} />
              <span>
                Map fitted to{' '}
                <strong className="color-white">{fitted.place}</strong> ·{' '}
                {fitted.rest}
              </span>
            </p>
          )}
        </section>
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
