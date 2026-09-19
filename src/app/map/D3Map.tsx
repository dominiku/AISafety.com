'use client'

// @refresh reset — d3 pipeline is inside useEffect; force remount on edit.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as d3 from 'd3'
import MapControls from '@/components/MapControls'
import MapSearch, { NO_MAP_SEARCH_CONTROL } from './MapSearch'
import MapTuningPanel from './MapTuningPanel'
import type { MapSearchControl } from './MapSearch'
import { trackListingClick, trackListingHover } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import { positionTooltip } from '@/lib/mapTooltip'
import { MAP_BACKGROUND_URL } from '@/lib/map-images'
import {
  CLASSIC_MAP_SCHEME,
  categoriesForMapArea,
  categoryForMapArea,
  isInQuietMapArea,
  mapAreaBounds,
  mapAreaDepth,
  mapAreaHasChildren,
  mapAreaPath,
  primaryCategory,
  type MapArea,
  type MapAreaScheme,
} from '@/lib/data/map-areas'
import {
  DEFAULT_ZOOM_TIER_CONFIG,
  REFERENCE_SCREEN_SCALE,
  countOverlaps,
  labelMapScale,
  labelScaleCap,
  labelShowsAt,
  layoutPins,
  pinMapScale,
  pinPositionAt,
  type MapFocus,
  type MapObstacle,
  type PinLayout,
  type TierPin,
} from '@/lib/data/map-zoom-tiers'
import { drawRealmBackdrop, type RealmBackdrop } from './realmBackdrop'
import styles from './page.module.css'

interface MapOrg {
  id: string
  title: string
  tooltipTitle: string
  shortName: string | null
  description: string
  category: string
  link: string
  mapLogo: string | null
  x: number | null
  y: number | null
  scale: string | null
  isMagic?: boolean
}

interface D3MapProps {
  orgs: MapOrg[]
  suggestEntryUrl: string
  // The areas drawn and the rule placing orgs in them. The classic map unless
  // the Map 3.5 prototype passes its realms and districts.
  scheme?: MapAreaScheme
  // PROTOTYPE Map 3.5: the island, realms and districts worked out for that
  // layout. When given, they are drawn in place of the island art.
  realmBackdrop?: RealmBackdrop
  // The zoom-tier tuning panel is a developer's tool: off unless asked for.
  tuning?: boolean
  // The explorer column beside the map (MapExplorer). When given, the map
  // follows the column: it shows the column's matches, marks its selection,
  // and a pin click selects the org's card instead of opening its site. The
  // map's own search box and title are left to the column and the page.
  explorer?: MapExplorerLink
}

export interface MapExplorerLink {
  // Ids of the orgs the column's search and filters match; null = all.
  matchingIds: Set<string> | null
  // What becomes of the pins that don't match (both are being tested).
  nonMatching: 'hide' | 'dim'
  // Orgs taken off the map altogether, whatever `nonMatching` says: closed
  // orgs while "Show inactive" is off. null = none.
  hiddenIds: Set<string> | null
  // The place names are buttons: each toggles its category in the column's
  // filter, and the Gone Graveyard's toggles "Show inactive".
  activeCategories: string[]
  onToggleCategory: (category: string) => void
  showInactive: boolean
  onToggleInactive: () => void
  // The place the view is fitted to (exactly one category is filtered by),
  // or null for the whole island.
  fitArea: string | null
  // While something is typed in the search, every match shows, even one the
  // zoom tiers would hold back.
  showEveryMatch: boolean
  selectedId: string | null
  // The result row being hovered or focused.
  highlightedId: string | null
  onSelect: (id: string) => void
  // A click on bare map, or Esc: nothing is selected any more.
  onClear: () => void
  // Pixels of the map's left side covered by the overlay (search, details
  // card, results drawer). A pin is brought to the middle of what is left.
  leftInset: number
  // The same for the top (a phone's floating search) and the bottom (a
  // phone's details sheet).
  topInset: number
  bottomInset: number
  // Filled in by the map: bring a pin to the middle of the free view, and
  // put the keyboard's focus on a pin (false when it is not showing).
  apiRef: MutableRefObject<{
    panTo: (id: string) => void
    focusPin: (id: string) => boolean
  }>
  // Called once apiRef is filled in, so a shared link's pin can be shown.
  onReady?: () => void
}

// Map constants from WebFlow
const MAP_WIDTH = 2485
const MAP_HEIGHT = 1355
const PADDING_FACTOR = 1.1
const PADDED_WIDTH = MAP_WIDTH * PADDING_FACTOR
const PADDED_HEIGHT = MAP_HEIGHT * PADDING_FACTOR
const GRID_SIZE = MAP_WIDTH / 60

// Logo size scales (handle both cases)
const SIZE_TO_SCALE: Record<string, number> = {
  small: 0.4,
  Small: 0.4,
  medium: 0.6,
  Medium: 0.6,
  large: 0.8,
  Large: 0.8,
}
const BASE_LOGO_SIZE = 64
const LOGO_GLOBAL_SCALE = 1.0

// Grid units of breathing room around an area framed from the search, so
// edge pins and their name labels are not cut off. A landmark with no pins of
// its own gets a wider frame, to show what surrounds it.
const AREA_FRAME_MARGIN = 2
// PROTOTYPE zoom tiers: a picked area's pins show from this share of the zoom
// it is framed at.
const FOCUS_MARGIN = 0.85
const LANDMARK_FRAME_MARGIN = 6
const REALM_SUB_LABEL_ZOOM = 1.5
// PROTOTYPE explorer: when the column's search and filters leave this many
// matches or fewer, every one of them shows at any zoom — having asked for a
// dozen orgs, a visitor should not have to zoom in to find five of them. Past
// this the zoom tiers thin them as usual, or the map would crowd again.
const EXPLORER_SHOW_ALL_MAX = 60
// The explorer's selected pin is drawn this much bigger than its neighbors.
const SELECTED_PIN_SCALE = 1.25
// Closed orgs carry this as their first category; it places them in the Gone
// Graveyard.
const INACTIVE_CATEGORY = 'No longer active'
// Screen pixels kept clear when the view is fitted to a place: breathing room
// at the sides, and the status line along the bottom.
// Explorer: a pin can be clicked or tapped within at least this many screen
// pixels, however small it is drawn (WCAG 2.5.8), and on a phone the smallest
// pin is drawn at least MOBILE_MIN_PIN_PX across.
const MIN_HIT_PX = 24
const MOBILE_MIN_PIN_PX = 26
// Explorer, on a phone: pins carry no names at the resting view; they all do
// from this many times closer in.
const MOBILE_LABEL_ZOOM = 1.6
// Explorer, on a phone: the island is fitted to the pane's width and hung this
// far below its top, clear of the floating search, not centered in the tall
// pane; and a selected pin is shown from at least this zoom, where its
// neighbors can be told apart.
const PHONE_FIT_TOP_PX = 76
const PHONE_PIN_ZOOM = 3.5
const FIT_SIDE_ROOM = 48
const FIT_BOTTOM_ROOM = 112

export default function D3Map({
  orgs,
  suggestEntryUrl,
  scheme = CLASSIC_MAP_SCHEME,
  realmBackdrop,
  tuning = true,
  explorer,
}: D3MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The d3 pipeline below reads the column's state through this ref, and is
  // told to redraw through applyExplorerRef, so a filter or a selection never
  // rebuilds the whole map.
  const explorerRef = useRef(explorer)
  const applyExplorerRef = useRef(() => {})
  const hasExplorer = explorer !== undefined
  useEffect(() => {
    explorerRef.current = explorer
    applyExplorerRef.current()
  }, [explorer])
  const tooltipRef = useRef<HTMLDivElement>(null)
  // Zoom actions live in the d3 pipeline inside useEffect; the buttons reach
  // them through this ref.
  const controlsRef = useRef({
    zoomIn: () => {},
    zoomOut: () => {},
    reset: () => {},
  })
  // Search fly-to lives in the d3 pipeline for the same reason the zoom
  // buttons do — the zoom behavior only exists inside the effect below.
  // Filled in by MapSearch: lets the map shut the search on a bare-map tap,
  // and lets ESC reach the search before it reaches the view reset.
  const searchControlRef = useRef<MapSearchControl>(NO_MAP_SEARCH_CONTROL)
  const searchRef = useRef<{
    flyTo: (org: {
      id: string
      x: number | null
      y: number | null
      scale: string | null
    }) => void
    flyToArea: (area: MapArea) => void
    clearHighlight: () => void
  }>({
    flyTo: () => {},
    flyToArea: () => {},
    clearHighlight: () => {},
  })
  // Magic-map decorations and unlinked furniture rows (e.g. "Last updated")
  // render as pins but shouldn't be findable.
  const searchOrgs = useMemo(
    () =>
      orgs.filter(
        org =>
          !org.isMagic &&
          org.link &&
          org.link !== '#' &&
          org.x !== null &&
          org.y !== null
      ),
    [orgs]
  )
  // The d3 pipeline below tears down and rebuilds whenever `orgs` changes
  // identity — which preview mode's auto-refresh does on every data change
  // and tab focus. Keeping the last zoom transform here lets the rebuild
  // restore the viewport instead of jumping back to the zoomed-out default.
  const savedTransformRef = useRef<d3.ZoomTransform | null>(null)

  // PROTOTYPE zoom tiers. The tuning panel edits the config; the d3 pipeline
  // reads it through the ref and is told to re-apply it, so moving a slider
  // does not rebuild the map.
  // PROTOTYPE Map 3.5: 31 realm and district names do not fit the resting
  // view, so that layout starts with districts named only once zoomed in.
  const [tierConfig, setTierConfig] = useState(() =>
    realmBackdrop
      ? { ...DEFAULT_ZOOM_TIER_CONFIG, subLabelZoom: REALM_SUB_LABEL_ZOOM }
      : DEFAULT_ZOOM_TIER_CONFIG
  )
  const [showAreaCounts, setShowAreaCounts] = useState(true)
  const tierConfigRef = useRef(tierConfig)
  const applyTiersRef = useRef(() => {})
  const tierReadoutRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    tierConfigRef.current = tierConfig
    applyTiersRef.current()
  }, [tierConfig])

  useEffect(() => {
    if (!containerRef.current || orgs.length === 0) return

    // Clear any existing SVG
    d3.select(containerRef.current).select('svg').remove()

    // translateZ + backface-visibility promote the SVG to its own
    // compositor layer in WebKit, avoiding tile re-rasterization flicker
    // during pinch/wheel zoom on macOS.
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${PADDED_WIDTH} ${PADDED_HEIGHT}`)
      // Under the navbar the map hangs from the top of the viewport; in the
      // explorer's pane it sits in the middle.
      .attr(
        'preserveAspectRatio',
        hasExplorer ? 'xMidYMid meet' : 'xMidYMin meet'
      )
      .style('transform', 'translateZ(0)')
      .style('backface-visibility', 'hidden')

    // Create main group with offset
    const offsetX = (PADDED_WIDTH - MAP_WIDTH) / 2
    const offsetY = (PADDED_HEIGHT - MAP_HEIGHT) / 20
    const svgGroup = svg
      .append('g')
      .attr('transform', `translate(${offsetX}, ${offsetY})`)

    // Read live so behavior adapts when the viewport is resized (e.g.
    // dev tools mobile mode toggled after load).
    const isMobile = () => window.innerWidth < 768
    // The explorer's one-pane layout (the site's one breakpoint).
    const isSinglePane = () => window.matchMedia('(max-width: 991px)').matches
    const maxZoom = isMobile() ? 25 : 8

    // Tracks which org's tooltip is currently shown from a mobile tap, so
    // the next tap can switch to a different pin or dismiss on outside tap.
    let tappedOrgId: string | null = null

    // Pending hover-analytics dwell. A desktop hover only counts once the
    // cursor has rested on a listing for 500 ms — the timer is canceled on
    // early leave (and on zoom start, via hideTooltip) so drive-by mouse
    // passes across the map don't record.
    let hoverTimer: ReturnType<typeof setTimeout> | null = null

    function cancelHoverTimer() {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer)
        hoverTimer = null
      }
    }

    // The explorer's hover tooltip (WCAG 1.4.13). It stands beside its pin
    // rather than following the cursor, so the pointer can move onto it
    // without it going away (a short grace covers the gap between the two);
    // it stays until the pointer leaves both; and Esc dismisses it. A click
    // on it selects the org, like the pin.
    let tooltipHideTimer: ReturnType<typeof setTimeout> | null = null
    const cancelTooltipHide = () => {
      if (tooltipHideTimer !== null) clearTimeout(tooltipHideTimer)
      tooltipHideTimer = null
    }
    const scheduleTooltipHide = () => {
      cancelTooltipHide()
      tooltipHideTimer = setTimeout(hideTooltip, 200)
    }
    const tooltipShowing = () =>
      tooltipRef.current?.style.visibility === 'visible'
    const showExplorerTooltip = (org: MapOrg, pin: SVGElement) => {
      const tt = tooltipRef.current
      const container = containerRef.current
      const disc = pin.querySelector('circle')
      if (!tt || !container || !disc) return
      cancelTooltipHide()
      const category = primaryCategory(org.category)
      const place = mapAreaPath(category ?? '', scheme).at(-1)
      tt.querySelector('strong')!.textContent = org.tooltipTitle
      tt.querySelector('span')!.textContent = [category, place]
        .filter(Boolean)
        .join(' · ')
      tt.setAttribute('data-listing-id', org.id)
      // Above the pin's disc, or below its name where there is no room.
      const bounds = container.getBoundingClientRect()
      const discRect = disc.getBoundingClientRect()
      const pinRect = pin.getBoundingClientRect()
      const gap = 6
      const above = discRect.top - gap - tt.offsetHeight
      const top = above >= bounds.top + 2 ? above : pinRect.bottom + gap
      const center = discRect.left + discRect.width / 2
      const left = Math.min(
        Math.max(center - tt.offsetWidth / 2, bounds.left + 2),
        bounds.right - tt.offsetWidth - 2
      )
      tt.style.left = `${left}px`
      tt.style.top = `${top}px`
      tt.style.visibility = 'visible'
      tt.style.opacity = '1'
    }

    function hideTooltip() {
      cancelHoverTimer()
      cancelTooltipHide()
      if (tooltipRef.current) {
        tooltipRef.current.style.visibility = 'hidden'
        tooltipRef.current.style.opacity = '0'
        tooltipRef.current.removeAttribute('data-link-url')
        tooltipRef.current.removeAttribute('data-link-title')
        tooltipRef.current.removeAttribute('data-listing-id')
        tooltipRef.current.removeAttribute('data-area')
      }
      tappedOrgId = null
    }

    // Gates the hover handlers below. Mutating `pointer-events` on
    // svgGroup (the previous approach) invalidates its compositor layer
    // in Mac WebKit and causes visible flicker mid-zoom.
    let isZooming = false
    // PROTOTYPE zoom tiers: filled in once the pins exist, further down.
    let appliedK = -1
    let applyPins: (k: number) => void = () => {}
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, maxZoom])
      .on('zoom', event => {
        if (!isZooming) {
          // First real movement — set in `zoom`, not `start`, because
          // `start` fires on mousedown and would suppress link clicks.
          isZooming = true
          hideTooltip()
        }
        const newX = event.transform.x + offsetX
        const newY = event.transform.y + offsetY
        svgGroup.attr(
          'transform',
          `translate(${newX}, ${newY}) scale(${event.transform.k})`
        )
        savedTransformRef.current = event.transform
        // A pan leaves pin sizes and visibility alone; only a zoom changes them.
        if (event.transform.k !== appliedK) applyPins(event.transform.k)
      })
      .on('end', () => {
        isZooming = false
      })

    svg.call(zoom)

    // Mobile: a tap on bare map closes the search. On desktop the field
    // already collapses when it loses focus, but a touch tap never blurs it
    // — the d3 gesture handlers swallow that. Pins and their labels live
    // inside <a>, so taps on a listing are left to their own handler, and a
    // pan does not reach here because the drag cancels the synthetic click.
    svg.on('click.mapsearch', event => {
      if (!isMobile()) return
      if ((event.target as Element | null)?.closest('a')) return
      searchControlRef.current.close()
    })

    // The view "Zoom to fit" returns to. Under the navbar that is the whole
    // padded canvas. In the explorer's pane the illustration itself fills the
    // pane (its width, or its height where that binds first), in the middle:
    // the canvas's sea margin would only make the island smaller.
    const fitTransform = () => {
      const node = svg.node()
      if (!hasExplorer || !node) return d3.zoomIdentity
      const { width, height } = node.getBoundingClientRect()
      if (width === 0 || height === 0) return d3.zoomIdentity
      const unit = Math.min(width / PADDED_WIDTH, height / PADDED_HEIGHT)
      const k = Math.min(
        width / (MAP_WIDTH * unit),
        height / (MAP_HEIGHT * unit)
      )
      // The pane's top edge in viewBox units (the viewBox is centered in it).
      const paneTop = PADDED_HEIGHT / 2 - height / 2 / unit
      return d3.zoomIdentity
        .translate(
          PADDED_WIDTH / 2 - offsetX - (k * MAP_WIDTH) / 2,
          isSinglePane()
            ? paneTop + PHONE_FIT_TOP_PX / unit - offsetY
            : PADDED_HEIGHT / 2 - offsetY - (k * MAP_HEIGHT) / 2
        )
        .scale(k)
    }
    svg.call(zoom.transform, savedTransformRef.current ?? fitTransform())

    // A click on bare map lets go of the explorer's selection. Pins and their
    // labels live inside <a>; a pan does not reach here because the drag
    // cancels the synthetic click.
    svg.on('click.explorer', event => {
      if ((event.target as Element | null)?.closest('a, [data-area]')) return
      explorerRef.current?.onClear()
    })

    // Prevent wheel events over the map from zooming the whole page
    // (once D3's zoom hits its scaleExtent limit, the browser would
    // otherwise handle the event as a page zoom or scroll).
    const svgNode = svg.node()!
    const preventPageZoom = (e: WheelEvent) => e.preventDefault()
    svgNode.addEventListener('wheel', preventPageZoom, { passive: false })

    // Shared clip-path for all logo circles. Using objectBoundingBox units so
    // a single definition works for every logo regardless of its size.
    const LOGO_CLIP_ID = 'logo-circle-clip'
    const defs = svg.append('defs')
    defs
      .append('clipPath')
      .attr('id', LOGO_CLIP_ID)
      .attr('clipPathUnits', 'objectBoundingBox')
      .append('circle')
      .attr('cx', 0.5)
      .attr('cy', 0.5)
      .attr('r', 0.5)

    // Add background image. PROTOTYPE Map 3.5: the island art was painted for
    // the classic positions, so the realm layout brings its own schematic.
    if (realmBackdrop) {
      drawRealmBackdrop(
        svgGroup,
        defs,
        realmBackdrop,
        GRID_SIZE,
        MAP_WIDTH,
        MAP_HEIGHT
      )
    } else {
      svgGroup
        .append('image')
        .attr('xlink:href', MAP_BACKGROUND_URL)
        .attr('width', MAP_WIDTH)
        .attr('height', MAP_HEIGHT)
        .attr('x', 0)
        .attr('y', 0)
    }

    // Add main title
    const titleX = 30 * GRID_SIZE
    const titleY = 2.5 * GRID_SIZE
    // Beside the explorer column the page shows the title as its real <h1>.
    if (!hasExplorer)
      svgGroup
        .append('text')
        .attr('x', titleX)
        .attr('y', titleY)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-weight', 400)
        .attr('font-size', 72)
        .style('letter-spacing', '-2.16px')
        .attr('fill', '#fff')
        .text('Map of AI Existential Safety')

    // Add area labels
    const AREA_PILL_FILL = 'rgba(27, 43, 62, 0.6)'
    const labelScale = 1.75
    const baseFontSize = 14
    const basePadX = 14
    const basePadY = 7
    const finalFontSize = baseFontSize * labelScale
    const finalPadX = basePadX * labelScale
    const finalPadY = basePadY * labelScale

    // Each label's group, the point it is drawn from, and its pill measured
    // from that point: kept so a search pick can pulse it, and (PROTOTYPE zoom
    // tiers) so a zoom can resize it and pins can slide off it.
    const areaPills = new Map<
      string,
      {
        group: d3.Selection<SVGGElement, unknown, null, undefined>
        text: d3.Selection<SVGTextElement, unknown, null, undefined>
        rect: d3.Selection<SVGRectElement, unknown, null, undefined>
        // What the name reads at rest, and how many pins stand there.
        restingText: string
        count: number
        // Explorer: the "+N" badge after the name, for the pins of this place
        // that only show closer in. null where the name is no button.
        badge: {
          group: d3.Selection<SVGGElement, unknown, null, undefined>
          rect: d3.Selection<SVGRectElement, unknown, null, undefined>
          text: d3.Selection<SVGTextElement, unknown, null, undefined>
          count: number
        } | null
        // Explorer: the category the name toggles (null: it is no button).
        category: string | null
        anchorX: number
        anchorY: number
        x: number
        y: number
        width: number
        height: number
        depth: number
        isParent: boolean
      }
    >()

    // PROTOTYPE: with most pins hidden at the resting view, the count on an
    // area's label says how much there is to find by zooming in.
    const areaCount = (label: string) => {
      const categories = categoriesForMapArea(label, scheme)
      return orgs.filter(org => {
        if (org.isMagic || org.x === null || org.y === null) return false
        const primary = primaryCategory(org.category)
        return primary !== null && categories.includes(primary)
      }).length
    }

    // Explorer: the pill behind a place's name is as wide as the name and its
    // "+N" badge, so it is laid out again whenever either changes.
    const layoutAreaPill = (label: string) => {
      const pill = areaPills.get(label)
      const box = pill?.text.node()?.getBBox()
      if (!pill || !box) return
      let width = box.width + finalPadX * 2
      const badge = pill.badge
      if (badge) {
        badge.group.style('display', badge.count > 0 ? 'inline' : 'none')
        if (badge.count > 0) {
          badge.text.text(`+${badge.count}`)
          const textBox = badge.text.node()?.getBBox()
          const badgeWidth = (textBox?.width ?? 0) + finalPadX
          const badgeHeight = box.height + finalPadY * 0.5
          const left = box.x + box.width + finalPadX * 0.6
          const middle = box.y + box.height / 2
          badge.rect
            .attr('x', left)
            .attr('y', middle - badgeHeight / 2)
            .attr('width', badgeWidth)
            .attr('height', badgeHeight)
            .attr('rx', badgeHeight / 2)
          badge.text.attr('x', left + badgeWidth / 2).attr('y', middle)
          width = left + badgeWidth + finalPadX * 0.5 - (box.x - finalPadX)
        }
      }
      pill.rect.attr('x', box.x - finalPadX).attr('width', width)
    }

    scheme.areas.forEach(({ label, x, y }) => {
      const pinCount = areaCount(label)
      const count = showAreaCounts ? pinCount : 0
      const xPos = x * GRID_SIZE
      const yPos = y * GRID_SIZE
      // Explorer: an umbrella area (Research Range) is a caption over its
      // children; every other name is a button for its category.
      const isCaption = hasExplorer && mapAreaHasChildren(label, scheme)
      const category = hasExplorer ? categoryForMapArea(label, scheme) : null

      const labelGroup = svgGroup
        .append('g')
        .attr('class', 'mapFade')
        .attr('transform', `translate(${xPos}, ${yPos})`)
        .style('user-select', 'none')
        .style('pointer-events', 'none')

      const textEl = labelGroup
        .append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-weight', 600)
        .attr('font-size', finalFontSize)
        .style('letter-spacing', '-0.01em')
        .attr('fill', '#fff')
        .text(count > 0 ? `${label} · ${count}` : label)
      if (isCaption) {
        textEl
          .text(label.toUpperCase())
          .attr('font-size', finalFontSize * 0.8)
          .attr('fill-opacity', 0.75)
          .style('letter-spacing', '0.12em')
      }
      if (category !== null && !isCaption) {
        const activate = () => {
          const link = explorerRef.current
          if (!link) return
          if (category === INACTIVE_CATEGORY) link.onToggleInactive()
          else link.onToggleCategory(category)
        }
        labelGroup
          .attr('data-area', label)
          .attr('role', 'button')
          .attr('tabindex', 0)
          .style('pointer-events', 'auto')
          .style('cursor', 'pointer')
          .on('click', activate)
          .on('keydown', (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            activate()
          })
      }

      const badgeGroup =
        category !== null && !isCaption
          ? labelGroup.append('g').style('display', 'none')
          : null

      const bbox = textEl.node()?.getBBox()
      if (bbox) {
        const rectEl = labelGroup
          .insert('rect', 'text')
          .attr('x', bbox.x - finalPadX)
          .attr('y', bbox.y - finalPadY)
          .attr('width', bbox.width + finalPadX * 2)
          .attr('height', bbox.height + finalPadY * 2)
          .attr('rx', (bbox.height + finalPadY * 2) / 2)
          .attr('ry', (bbox.height + finalPadY * 2) / 2)
          .attr('fill', isCaption ? 'transparent' : AREA_PILL_FILL)
        areaPills.set(label, {
          group: labelGroup,
          text: textEl,
          rect: rectEl,
          restingText: textEl.text(),
          count: pinCount,
          badge: badgeGroup
            ? {
                group: badgeGroup,
                rect: badgeGroup.append('rect').attr('fill', 'var(--teal-900)'),
                text: badgeGroup
                  .append('text')
                  .attr('text-anchor', 'middle')
                  .attr('dominant-baseline', 'central')
                  .attr('font-family', 'Inter, sans-serif')
                  .attr('font-weight', 700)
                  .attr('font-size', finalFontSize * 0.8)
                  .attr('fill', '#fff'),
                count: 0,
              }
            : null,
          category: isCaption ? null : category,
          anchorX: xPos,
          anchorY: yPos,
          depth: mapAreaDepth(label, scheme),
          isParent: mapAreaHasChildren(label, scheme),
          x: bbox.x - finalPadX,
          y: bbox.y - finalPadY,
          width: bbox.width + finalPadX * 2,
          height: bbox.height + finalPadY * 2,
        })
        // Pins slide off the name's box: it is measured with a two-figure
        // badge in place, so a badge is not drawn under a pin.
        const pill = areaPills.get(label)
        if (pill?.badge) {
          pill.badge.count = 88
          layoutAreaPill(label)
          pill.width = Number(pill.rect.attr('width'))
          pill.badge.count = 0
          layoutAreaPill(label)
        }
      }
    })

    // PROTOTYPE Map 3.5: the ground a pin may slide over is its own district,
    // where the layout has borders. A pin standing outside any district
    // (closed orgs, map furniture) is free, as on the classic map.
    const districtGround = (org: MapOrg) => {
      if (!realmBackdrop || org.x === null || org.y === null) return undefined
      const district = realmBackdrop.districtAt(org.x, org.y)
      if (district === null) return undefined
      return (px: number, py: number) =>
        realmBackdrop.districtAt(px / GRID_SIZE, py / GRID_SIZE) === district
    }

    // PROTOTYPE zoom tiers: every pin's group and footprint, so a zoom can
    // resize the pins and show or hide them.
    const pins: {
      tier: TierPin
      group: d3.Selection<SVGGElement, unknown, null, undefined>
      // The pin's name under its disc, and (explorer) the transparent square
      // that keeps it clickable however small it is drawn.
      label: d3.Selection<SVGGElement, unknown, null, undefined>
      hit: d3.Selection<SVGRectElement, unknown, null, undefined> | null
      // The pin's focusable element and the pill behind its name, which the
      // explorer's selection restyles.
      link: SVGElement | null
      labelRect: d3.Selection<SVGRectElement, unknown, null, undefined>
    }[] = []

    // Render organization logos
    orgs.forEach(org => {
      if (org.x === null || org.y === null) return

      const xPos = org.x * GRID_SIZE
      const yPos = org.y * GRID_SIZE

      // Calculate logo size based on scale (matching WebFlow)
      const rawScale = SIZE_TO_SCALE[org.scale || 'Medium'] || 0.6
      const iconSize = BASE_LOGO_SIZE * rawScale * LOGO_GLOBAL_SCALE
      const padding = 2
      const contentSize = iconSize - 2 * padding

      // Create item group with translate, then link inside (matching Webflow structure)
      const itemGroup = svgGroup
        .append('g')
        .attr('class', 'mapFade')
        .attr('transform', `translate(${xPos}, ${yPos})`)
      // QA: Items with no real link (e.g. "Last updated") should render
      // on the map but not be clickable
      const hasLink = org.link && org.link !== '#'
      // First category only — orgs can carry several ("Funding, Resource"),
      // but the dashboard groups map hovers/clicks by a single area. May be
      // '' for uncategorized items, which analytics receives as undefined.
      const firstCategory = org.category.split(',')[0].trim()
      const linkEl = itemGroup
        .append(hasLink ? 'a' : 'g')
        .attr('class', 'mapItem')
      if (hasLink) {
        linkEl
          .attr('xlink:href', withUtm(org.link, 'Map'))
          .attr('target', '_blank')
          .attr('rel', 'noopener noreferrer')
          .style('cursor', 'pointer')
          .on('click', event => {
            // In the explorer a pin selects its org, on a phone too (the
            // details sheet has the link); nothing on the map opens a site.
            // (Not tracked as a listing click: nothing was opened.)
            if (explorerRef.current) {
              event.preventDefault()
              hideTooltip()
              explorerRef.current.onSelect(org.id)
              return
            }
            // Mobile: first tap shows the tooltip instead of opening the
            // link. Second tap of the tooltip itself opens it. Matches the
            // pattern used on the /communities map.
            if (isMobile()) {
              event.preventDefault()
              const tt = tooltipRef.current
              const container = containerRef.current
              if (!tt || !container) return
              // Only a tap on a DIFFERENT pin (re)opens the tooltip — a
              // repeat tap on the already-open pin just repositions it below.
              // Same guard as the /communities map, and it's what keeps the
              // hover count honest: one open gesture, one recorded hover.
              if (tappedOrgId !== org.id) {
                tt.querySelector('strong')!.textContent = org.tooltipTitle
                tt.querySelector('span')!.textContent = org.description
                tt.setAttribute('data-link-url', org.link)
                tt.setAttribute('data-link-title', org.title)
                // Stash id + area too, so the tooltip's second-tap click can
                // report them — the tooltip click handler has no org in scope.
                tt.setAttribute('data-listing-id', org.id)
                tt.setAttribute('data-area', firstCategory)
                tt.style.visibility = 'visible'
                tt.style.opacity = '1'
                tappedOrgId = org.id
                // A mobile "hover" is the first tap that opens the tooltip —
                // there's no cursor to dwell, so it counts immediately.
                // (hasLink is guaranteed: this handler only exists on links.)
                trackListingHover(
                  'Map',
                  org.title,
                  org.link,
                  org.id,
                  firstCategory || undefined
                )
              }
              positionTooltip(event.clientX, event.clientY, tt, container, {
                minLeftMargin: 20,
              })
              return
            }
            trackListingClick(
              'Map',
              org.title,
              org.link,
              org.id,
              undefined,
              'map',
              firstCategory || undefined
            )
            // Clicking a pin leaves the browser's focus ring on the link, and
            // it is still sitting there when you come back from the tab that
            // opened. A mouse click does not need a focus ring. detail > 0
            // means a real pointer click, so a keyboard Enter on a focused
            // pin keeps its ring and the user keeps their place.
            if (event.detail > 0) {
              ;(event.currentTarget as SVGElement | null)?.blur?.()
            }
          })
      }

      // Beside the explorer column a pin is a button named after its org.
      // It is kept out of the tab order: 369 pins in map order make no sane
      // keyboard route, and the card list reaches every one of them.
      if (hasLink && hasExplorer) {
        linkEl
          .attr('role', 'button')
          .attr('aria-label', org.tooltipTitle)
          .attr('tabindex', -1)
      }

      // White circle background
      linkEl
        .append('circle')
        .attr('r', iconSize / 2)
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('fill', '#fff')

      // Logo image — single SVG <image> clipped to a circle. The browser
      // fetches/decodes the logo exactly once; preserveAspectRatio handles
      // the aspect-fit math that used to require a separate `new Image()`.
      if (org.mapLogo) {
        const logoImg = linkEl
          .append('image')
          .attr('href', org.mapLogo)
          .attr('width', contentSize)
          .attr('height', contentSize)
          .attr('x', -contentSize / 2)
          .attr('y', -contentSize / 2)
          .attr('preserveAspectRatio', 'xMidYMid meet')
          .attr('clip-path', `url(#${LOGO_CLIP_ID})`)

        // On load failure, swap in the orange fallback circle.
        logoImg.on('error', () => {
          logoImg.remove()
          linkEl
            .append('circle')
            .attr('r', contentSize / 2)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('fill', '#f70')
        })
      } else {
        linkEl
          .append('circle')
          .attr('r', contentSize / 2)
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('fill', 'red')
      }

      // Add label below logo
      const labelName = org.shortName || org.title
      const labelOffset = 11 * rawScale * 1.5
      const labelY = iconSize / 2 + labelOffset
      const fontSize = 6 * rawScale * 1.5

      const labelG = linkEl
        .append('g')
        .attr('transform', `translate(0, ${labelY})`)

      const textEl = labelG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Inter, sans-serif')
        .attr('font-weight', 600)
        .attr('font-size', fontSize)
        .style('letter-spacing', '-0.02em')
        .attr('fill', '#000')
        .text(labelName)

      // Get text bounding box and add background pill
      const bbox = textEl.node()?.getBBox()
      if (bbox) {
        const padX = 6 * rawScale * 1.5
        const padY = 3 * rawScale * 1.5
        const rectW = bbox.width + padX * 2
        const rectH = bbox.height + padY * 2

        const labelRect = labelG
          .insert('rect', 'text')
          .attr('x', -rectW / 2)
          .attr('y', -rectH / 2)
          .attr('width', rectW)
          .attr('height', rectH)
          .attr('rx', rectH / 2)
          .attr('ry', rectH / 2)
          .attr('fill', '#fff')

        textEl.attr('y', bbox.height * 0.35)

        // QA: Add an invisible bridge rect for a more forgiving hover zone so the
        // tooltip doesn't disappear when the cursor is between logo and label.
        const bridgeW = Math.max(iconSize, rectW)
        const bridgeH = (iconSize + rectH) / 2 + labelOffset
        linkEl
          .append('rect')
          .attr('x', -bridgeW / 2)
          .attr('y', 0)
          .attr('width', bridgeW)
          .attr('height', bridgeH)
          .attr('fill', 'transparent')
          .lower()

        pins.push({
          group: itemGroup,
          label: labelG,
          hit:
            hasLink && hasExplorer
              ? linkEl.append('rect').attr('fill', 'transparent').lower()
              : null,
          link: linkEl.node() as SVGElement | null,
          labelRect,
          tier: {
            id: org.id,
            title: org.title,
            scale: org.scale,
            // Every area the pin is in, outermost first. Map furniture
            // (Merch, Last updated) belongs to none.
            regions: org.isMagic
              ? []
              : mapAreaPath(primaryCategory(org.category) ?? '', scheme),
            quiet: isInQuietMapArea(
              primaryCategory(org.category) ?? '',
              scheme
            ),
            x: xPos,
            y: yPos,
            // PROTOTYPE Map 3.5: a sliding pin keeps inside its own district.
            within: districtGround(org),
            halfWidth: bridgeW / 2,
            top: -iconSize / 2,
            bottom: labelY + rectH / 2,
          },
        })
      }

      // Tooltip events with smart edge-detection positioning
      linkEl
        .on('mouseenter', event => {
          if (isMobile()) return
          if (isZooming) return
          // Arm the hover dwell — only for real listings (furniture rows
          // like "Last updated" show a tooltip but never record a hover).
          if (hasLink) {
            cancelHoverTimer()
            hoverTimer = setTimeout(() => {
              hoverTimer = null
              trackListingHover(
                'Map',
                org.title,
                org.link,
                org.id,
                firstCategory || undefined
              )
            }, 500)
          }
          const tt = tooltipRef.current
          const container = containerRef.current
          if (!tt || !container) return
          if (explorerRef.current) {
            showExplorerTooltip(org, event.currentTarget as SVGElement)
            return
          }
          // QA: Use tooltipTitle ('Long name') not title ('Long name for cards')
          // so bracketed acronyms like "(CARMA)" don't appear in the tooltip
          tt.querySelector('strong')!.textContent = org.tooltipTitle
          tt.querySelector('span')!.textContent = org.description
          tt.style.visibility = 'visible'
          tt.style.opacity = '1'
          positionTooltip(event.clientX, event.clientY, tt, container)
        })
        .on('mousemove', event => {
          if (isMobile()) return
          if (isZooming) return
          // The explorer's tooltip stays by its pin, where it can be reached.
          if (explorerRef.current) return
          const tt = tooltipRef.current
          const container = containerRef.current
          if (!tt || !container) return
          positionTooltip(event.clientX, event.clientY, tt, container)
        })
        .on('mouseleave', () => {
          // Leaving before the dwell elapses means it wasn't a real hover.
          cancelHoverTimer()
          if (isMobile()) return
          if (explorerRef.current) {
            scheduleTooltipHide()
            return
          }
          if (tooltipRef.current) {
            tooltipRef.current.style.visibility = 'hidden'
            tooltipRef.current.style.opacity = '0'
          }
        })
    })

    // PROTOTYPE zoom tiers. z is the zoom the tier rules work in: screen
    // pixels per map pixel against a reference desktop, so a phone at rest
    // counts as further out than a desktop at rest.
    let screenScaleAtRest = REFERENCE_SCREEN_SCALE
    const measureScreenScale = () => {
      const rect = svgNode.getBoundingClientRect()
      // A map that is not laid out yet (a hidden tab, mid-resize) measures
      // zero; keep the last real measurement until it is.
      if (rect.width === 0 || rect.height === 0) return
      screenScaleAtRest = Math.min(
        rect.width / PADDED_WIDTH,
        rect.height / PADDED_HEIGHT
      )
    }
    const zoomOf = (k: number) =>
      (k * screenScaleAtRest) / REFERENCE_SCREEN_SCALE
    // Explorer, on a phone: no pin is drawn under MOBILE_MIN_PIN_PX across,
    // so the Small and Medium ones are drawn up to it (see applyPins). For
    // the layout to keep them apart all the same, every pin there takes up
    // the room of a Large one.
    const phoneFloor = () => hasExplorer && isMobile()
    const largeDisc = BASE_LOGO_SIZE * SIZE_TO_SCALE.Large
    const tierForLayout = (tier: TierPin): TierPin => {
      if (!phoneFloor()) return tier
      const grow = largeDisc / (-tier.top * 2)
      return {
        ...tier,
        halfWidth: tier.halfWidth * grow,
        top: tier.top * grow,
        bottom: tier.bottom * grow,
      }
    }
    // Pins slide off the area names; the names themselves never move.
    const obstacles: MapObstacle[] = [...areaPills.values()].map(pill => ({
      x: pill.anchorX + pill.x,
      y: pill.anchorY + pill.y,
      width: pill.width,
      height: pill.height,
      anchorX: pill.anchorX,
      anchorY: pill.anchorY,
      depth: pill.depth,
      isParent: pill.isParent,
    }))
    const labelCap = labelScaleCap(obstacles)
    let layout: PinLayout | null = null
    // A pin picked from the search shows even if its tier is still hidden.
    let forcedPinId: string | null = null
    // An area picked from the search shows all its pins once framed.
    let focus: MapFocus | null = null
    // Map furniture (Merch, Last updated) is never in the column's list, so
    // a filter must not take it off the map.
    const furnitureIds = new Set(
      orgs
        .filter(org => org.isMagic || !org.link || org.link === '#')
        .map(org => org.id)
    )
    const goneFromMap = (id: string) =>
      explorerRef.current?.hiddenIds?.has(id) === true
    const matchesExplorer = (id: string) => {
      const matching = explorerRef.current?.matchingIds
      return !matching || matching.has(id) || furnitureIds.has(id)
    }
    applyPins = (k: number) => {
      appliedK = k
      if (!layout) return
      const config = tierConfigRef.current
      const z = zoomOf(k)
      const s = pinMapScale(z, config)
      // Explorer: screen pixels per unit of a pin's own drawing, for the
      // square that keeps it clickable; and which pins carry names here.
      const phone = isMobile()
      const floorPx = phoneFloor() ? MOBILE_MIN_PIN_PX : 0
      const namesOnPhone = k >= fitTransform().k * MOBILE_LABEL_ZOOM
      // Pins held back at this zoom, by the place they stand in.
      const heldBack = new Map<string, number>()
      const labelScale = labelMapScale(z, config, labelCap)
      for (const pill of areaPills.values()) {
        pill.group
          .attr(
            'transform',
            `translate(${pill.anchorX}, ${pill.anchorY}) scale(${labelScale})`
          )
          .classed('mapFadeHidden', !labelShowsAt(pill, z, config))
      }
      // The pins on screen, where they are drawn, for the panel's readout.
      const showing: TierPin[] = []
      let largeHeldBack = 0
      const link = explorerRef.current
      const showAllMatches =
        !!link?.matchingIds && link.matchingIds.size <= EXPLORER_SHOW_ALL_MAX
      for (const { tier, group, label, hit } of pins) {
        const matches = matchesExplorer(tier.id)
        // A hidden non-match has no place in the layout (see applyTiers).
        if (
          goneFromMap(tier.id) ||
          (!matches && link?.nonMatching === 'hide')
        ) {
          group.classed('mapFadeHidden', true).classed('mapDimmed', false)
          continue
        }
        const revealed =
          ((showAllMatches || link?.showEveryMatch === true) &&
            !!link?.matchingIds?.has(tier.id)) ||
          (layout.reveal.get(tier.id) ?? 0) <= z
        const at = pinPositionAt(layout, tier.id, z)
        if (revealed) showing.push({ ...tier, ...at })
        else if (tier.scale === 'Large') largeHeldBack++
        const isSelected = tier.id === link?.selectedId
        const disc = -tier.top * 2
        // A phone's floor: the scale at which this disc is floorPx across.
        const floored = Math.max(s, floorPx / (disc * screenScaleAtRest * k))
        const size = isSelected ? floored * SELECTED_PIN_SCALE : floored
        const pinUnitPx = screenScaleAtRest * k * size
        if (link) {
          const showing = revealed || isSelected || tier.id === forcedPinId
          const place = tier.regions.at(-1)
          if (!showing && matches && place) {
            heldBack.set(place, (heldBack.get(place) ?? 0) + 1)
          }
          // Names: on a desktop the Large and Medium pins carry theirs (the
          // layout has kept room for them) and the Small ones join in once
          // the map is close enough for them all to show; on a phone none do
          // at the resting view and all do closer in. The selected pin
          // always does.
          const named =
            isSelected ||
            (phone
              ? namesOnPhone
              : tier.scale !== 'Small' || z >= config.smallZoom)
          label.style('display', named ? 'inline' : 'none')
          if (hit) {
            const side = Math.max(disc, MIN_HIT_PX / (pinUnitPx || 1))
            hit
              .attr('x', -side / 2)
              .attr('y', -side / 2)
              .attr('width', side)
              .attr('height', side)
          }
        }
        group
          .attr('transform', `translate(${at.x}, ${at.y}) scale(${size})`)
          .classed(
            'mapFadeHidden',
            !revealed && tier.id !== forcedPinId && tier.id !== link?.selectedId
          )
          .classed('mapDimmed', !matches)
      }
      if (link) {
        for (const [place, pill] of areaPills) {
          if (!pill.badge || pill.category === null) continue
          const count = heldBack.get(place) ?? 0
          if (count !== pill.badge.count) {
            pill.badge.count = count
            layoutAreaPill(place)
          }
          const about = `${place}, ${pill.count} organizations`
          const more =
            count > 0 ? `, ${count} more pins appear when you zoom in` : ''
          pill.group.attr(
            'aria-label',
            pill.category === INACTIVE_CATEGORY
              ? `Show inactive organizations (${about})`
              : `Filter by ${pill.category} (${about}${more})`
          )
        }
      }
      if (tierReadoutRef.current) {
        const { pairs, onObstacles } = countOverlaps(
          showing,
          obstacles,
          z,
          config
        )
        tierReadoutRef.current.textContent =
          `Zoom ${z.toFixed(2)} · ${showing.length} of ${pins.length} pins · ` +
          `${largeHeldBack} Large held back · ${pairs} overlapping pairs · ` +
          `${onObstacles} on an area name`
      }
    }
    // Working the layout out takes a few hundred milliseconds, so a slider
    // being dragged or a window being resized waits for a pause.
    let tierTimer: ReturnType<typeof setTimeout> | null = null
    const applyTiers = () => {
      if (tierTimer !== null) clearTimeout(tierTimer)
      tierTimer = null
      measureScreenScale()
      // Pins the explorer column has filtered out and hidden leave the
      // layout, so the ones that remain get the room: eight matches all show
      // at rest, where eight among 369 would mostly be held back.
      const hiding = explorerRef.current?.nonMatching === 'hide'
      layout = layoutPins(
        pins
          .filter(
            pin =>
              !goneFromMap(pin.tier.id) &&
              (!hiding || matchesExplorer(pin.tier.id))
          )
          .map(pin => tierForLayout(pin.tier)),
        obstacles,
        tierConfigRef.current,
        zoomOf(1),
        focus
      )
      applyPins(d3.zoomTransform(svgNode).k)
    }
    applyTiers()
    const scheduleTiers = () => {
      if (tierTimer !== null) clearTimeout(tierTimer)
      tierTimer = setTimeout(applyTiers, 120)
    }
    applyTiersRef.current = scheduleTiers
    // The resting zoom depends on the map's size on screen, and the layout
    // depends on the resting zoom.
    const tierResizeObserver = new ResizeObserver(scheduleTiers)
    tierResizeObserver.observe(svgNode)

    // Setup zoom controls
    const resetView = () => {
      svg
        .transition()
        .duration(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 500
        )
        .call(zoom.transform, fitTransform())
    }
    controlsRef.current = {
      zoomIn: () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5)
      },
      zoomOut: () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.75)
      },
      reset: resetView,
    }

    // Search: fly the viewport to a pin and pulse a ring around it — or, for
    // an area, frame it and pulse its label. The highlight sits inside
    // svgGroup so it pans/zooms with the map; non-scaling-stroke keeps its
    // line width constant at any zoom.
    let removeHighlight: (() => void) | null = null
    const clearHighlight = () => {
      removeHighlight?.()
      removeHighlight = null
      if (forcedPinId !== null) {
        forcedPinId = null
        applyPins(appliedK)
      }
      if (focus !== null) {
        focus = null
        scheduleTiers()
      }
    }
    // Mobile pins are tiny at rest, so land closer in.
    const pinZoom = () => (isMobile() ? 8 : 3.5)
    // Centers map point (px, py) in the rendered viewBox area at zoom k: the
    // group transform places map point p at viewBox coordinate
    // t + offset + k*p.
    const flyToPoint = (
      px: number,
      py: number,
      k: number,
      leftInset = 0,
      topInset = 0,
      bottomInset = 0
    ) => {
      // The overlay covers the map's left side: the middle of what is left
      // lies half its width to the right, in viewBox units. The same goes
      // for what a phone's search and details sheet cover, top and bottom.
      const { width, height } = svgNode.getBoundingClientRect()
      const unit = Math.min(width / PADDED_WIDTH, height / PADDED_HEIGHT) || 1
      const shift = Math.min(leftInset, width / 2) / 2 / unit
      const covered = Math.min(topInset + bottomInset, height * 0.8)
      const shiftY =
        topInset + bottomInset > 0
          ? ((covered / (topInset + bottomInset)) * (topInset - bottomInset)) /
            2 /
            unit
          : 0
      svg
        .transition()
        // Someone who asked for less motion gets the new view at once.
        .duration(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 800
        )
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(
              PADDED_WIDTH / 2 + shift - offsetX - k * px,
              PADDED_HEIGHT / 2 + shiftY - offsetY - k * py
            )
            .scale(k)
        )
    }
    // Explorer: fit the view to one place, in what the overlay leaves free.
    // Its pins all show once framed, as for an area picked from the search.
    const fitToArea = (label: string, leftInset: number) => {
      const area = scheme.areas.find(a => a.label === label)
      if (!area) return
      const categories = categoriesForMapArea(label, scheme)
      const areaPins: { x: number; y: number }[] = []
      for (const org of orgs) {
        if (org.isMagic || org.x === null || org.y === null) continue
        const primary = primaryCategory(org.category)
        if (!primary || !categories.includes(primary)) continue
        if (goneFromMap(org.id) || !matchesExplorer(org.id)) continue
        areaPins.push({ x: org.x, y: org.y })
      }
      const bounds = mapAreaBounds(area, areaPins)
      const frameWidth =
        (bounds.maxX - bounds.minX + AREA_FRAME_MARGIN * 2) * GRID_SIZE
      const frameHeight =
        (bounds.maxY - bounds.minY + AREA_FRAME_MARGIN * 2) * GRID_SIZE
      const { width, height } = svgNode.getBoundingClientRect()
      const unit = Math.min(width / PADDED_WIDTH, height / PADDED_HEIGHT) || 1
      const freeWidth = Math.max(width - leftInset - FIT_SIDE_ROOM, 200)
      const topInset = explorerRef.current?.topInset ?? 0
      const freeHeight = Math.max(height - FIT_BOTTOM_ROOM - topInset, 200)
      // Never further out than the whole island, never closer than a pin.
      const k = Math.max(
        fitTransform().k,
        Math.min(
          freeWidth / (frameWidth * unit),
          freeHeight / (frameHeight * unit),
          pinZoom()
        )
      )
      measureScreenScale()
      focus = { areas: [label], fromZoom: zoomOf(k) * FOCUS_MARGIN }
      applyTiers()
      flyToPoint(
        ((bounds.minX + bounds.maxX) / 2) * GRID_SIZE,
        ((bounds.minY + bounds.maxY) / 2) * GRID_SIZE,
        k,
        leftInset,
        topInset
      )
    }

    searchRef.current = {
      clearHighlight,
      flyToArea: area => {
        clearHighlight()
        // The area's pins: the same first-category rule that names the area
        // an org is drawn in. Decorations are not part of any area.
        const categories = categoriesForMapArea(area.label, scheme)
        const areaPins: { x: number; y: number }[] = []
        for (const org of orgs) {
          if (org.isMagic || org.x === null || org.y === null) continue
          const primary = primaryCategory(org.category)
          if (!primary || !categories.includes(primary)) continue
          areaPins.push({ x: org.x, y: org.y })
        }
        const bounds = mapAreaBounds(area, areaPins)
        const margin =
          areaPins.length > 0 ? AREA_FRAME_MARGIN : LANDMARK_FRAME_MARGIN
        const width = (bounds.maxX - bounds.minX + margin * 2) * GRID_SIZE
        const height = (bounds.maxY - bounds.minY + margin * 2) * GRID_SIZE
        // Fit the frame in view, never closer than a pin pick lands and never
        // further out than the resting view.
        const fitK = Math.max(
          1,
          Math.min(PADDED_WIDTH / width, PADDED_HEIGHT / height, pinZoom())
        )
        // PROTOTYPE zoom tiers: a picked area shows all its pins. They are
        // due from just short of the framing zoom, so a small zoom out does
        // not drop them at once but a real one thins the area like any
        // other. Any that still cannot fit at the framing zoom pull the view
        // in to the zoom where they can.
        measureScreenScale()
        focus = { areas: [area.label], fromZoom: zoomOf(fitK) * FOCUS_MARGIN }
        applyTiers()
        let revealZ = 0
        for (const { tier } of pins) {
          if (tier.regions.includes(area.label)) {
            revealZ = Math.max(revealZ, layout?.reveal.get(tier.id) ?? 0)
          }
        }
        const revealK =
          (revealZ * REFERENCE_SCREEN_SCALE * 1.001) / screenScaleAtRest
        const k = Math.min(Math.max(fitK, revealK), maxZoom)
        flyToPoint(
          ((bounds.minX + bounds.maxX) / 2) * GRID_SIZE,
          ((bounds.minY + bounds.maxY) / 2) * GRID_SIZE,
          k
        )
        const pill = areaPills.get(area.label)
        if (!pill) return
        // The pulse is an outline that swells away from the label's pill. It
        // lives in the label's own group so it is resized along with it.
        const outline = pill.group
          .append('rect')
          .attr('fill', 'none')
          .attr('stroke', 'var(--white)')
          .attr('stroke-width', 3.5)
          .attr('vector-effect', 'non-scaling-stroke')
          .style('pointer-events', 'none')
        const outlineAt = (by: number) => ({
          x: pill.x - by,
          y: pill.y - by,
          width: pill.width + by * 2,
          height: pill.height + by * 2,
          rx: pill.height / 2 + by,
        })
        const resting = outlineAt(4)
        const swollen = outlineAt(18)
        outline
          .attr('x', resting.x)
          .attr('y', resting.y)
          .attr('width', resting.width)
          .attr('height', resting.height)
          .attr('rx', resting.rx)
        removeHighlight = () => {
          outline.interrupt()
          outline.remove()
        }
        let growing = true
        const pulse = () => {
          const to = growing ? swollen : resting
          outline
            .transition()
            .duration(600)
            .ease(d3.easeSinInOut)
            .attr('x', to.x)
            .attr('y', to.y)
            .attr('width', to.width)
            .attr('height', to.height)
            .attr('rx', to.rx)
            .attr('stroke-opacity', growing ? 0.3 : 0.9)
            .on('end', () => {
              growing = !growing
              pulse()
            })
        }
        pulse()
      },
      flyTo: org => {
        if (org.x === null || org.y === null) return
        clearHighlight()
        const px = org.x * GRID_SIZE
        const py = org.y * GRID_SIZE
        // PROTOTYPE zoom tiers: show the pin whatever its tier, and draw the
        // ring inside the pin's own group so it is resized along with it.
        forcedPinId = org.id
        applyPins(appliedK)
        flyToPoint(px, py, pinZoom())
        const rawScale = SIZE_TO_SCALE[org.scale || 'Medium'] || 0.6
        const r = (BASE_LOGO_SIZE * rawScale) / 2 + 10
        const pinGroup = pins.find(pin => pin.tier.id === org.id)?.group
        const ring = (pinGroup ?? svgGroup)
          .append('circle')
          .attr('cx', pinGroup ? 0 : px)
          .attr('cy', pinGroup ? 0 : py)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', 'var(--white)')
          .attr('stroke-width', 3.5)
          .attr('vector-effect', 'non-scaling-stroke')
          .style('pointer-events', 'none')
        removeHighlight = () => {
          ring.interrupt()
          ring.remove()
        }
        let growing = true
        const pulse = () => {
          ring
            .transition()
            .duration(600)
            .ease(d3.easeSinInOut)
            .attr('r', growing ? r * 1.7 : r)
            .attr('stroke-opacity', growing ? 0.3 : 0.9)
            .on('end', () => {
              growing = !growing
              pulse()
            })
        }
        pulse()
      },
    }

    // The explorer column's selection and hover: a ring inside the pin's own
    // group, so it moves and resizes with the pin. The selected pin's ring is
    // solid; a hovered or focused card's pin gets a lighter one.
    const orgById = new Map(orgs.map(org => [org.id, org]))
    let explorerRings: d3.Selection<
      SVGCircleElement,
      unknown,
      null,
      undefined
    >[] = []
    const drawExplorerRing = (
      id: string,
      width: number,
      opacity: number,
      selected = false
    ) => {
      const group = pins.find(pin => pin.tier.id === id)?.group
      const org = orgById.get(id)
      if (!group || !org) return
      const rawScale = SIZE_TO_SCALE[org.scale || 'Medium'] || 0.6
      if (selected) {
        // The selected pin's halo, under its ring.
        explorerRings.push(
          group
            .insert('circle', ':first-child')
            .attr('r', (BASE_LOGO_SIZE * rawScale) / 2 + 14)
            .attr(
              'fill',
              'color-mix(in srgb, var(--teal-bright-400) 32%, transparent)'
            )
            .style('pointer-events', 'none')
        )
      }
      explorerRings.push(
        group
          .append('circle')
          .attr('r', (BASE_LOGO_SIZE * rawScale) / 2 + 6)
          .attr('fill', 'none')
          .attr('stroke', selected ? 'var(--teal-bright-400)' : 'var(--white)')
          .attr('stroke-width', width)
          .attr('stroke-opacity', opacity)
          .attr('vector-effect', 'non-scaling-stroke')
          .style('pointer-events', 'none')
      )
      // Above its neighbors, so the ring is not cut by an overlapping pin.
      group.raise()
    }
    let appliedMatching: Set<string> | null | undefined
    let appliedMode: string | undefined
    let appliedSelected: string | null | undefined
    let appliedCategories: string[] | undefined
    let appliedShowInactive: boolean | undefined
    let appliedHidden: Set<string> | null | undefined
    let appliedFit: string | null | undefined
    const applyExplorer = () => {
      const link = explorerRef.current
      if (!link) return
      explorerRings.forEach(ring => ring.remove())
      explorerRings = []
      if (link.highlightedId && link.highlightedId !== link.selectedId) {
        drawExplorerRing(link.highlightedId, 2, 0.6)
      }
      if (link.selectedId) drawExplorerRing(link.selectedId, 3.5, 1, true)
      if (
        link.selectedId !== appliedSelected ||
        link.activeCategories !== appliedCategories ||
        link.showInactive !== appliedShowInactive
      ) {
        // A place's name takes the active colors while its category is
        // filtered by, or the selected pin stands there. The Gone Graveyard's
        // is dashed and says "hidden" while closed orgs are off the map.
        const selectedOrg = link.selectedId
          ? orgById.get(link.selectedId)
          : undefined
        const selectedArea = selectedOrg
          ? mapAreaPath(primaryCategory(selectedOrg.category) ?? '', scheme).at(
              -1
            )
          : undefined
        for (const [label, pill] of areaPills) {
          if (pill.category === null) continue
          const isGraveyard = pill.category === INACTIVE_CATEGORY
          const pressed = isGraveyard
            ? link.showInactive
            : link.activeCategories.includes(pill.category)
          const active = (pressed && !isGraveyard) || label === selectedArea
          const dashed = isGraveyard && !link.showInactive
          pill.text
            .text(dashed ? `${label} · hidden` : pill.restingText)
            .attr(
              'fill',
              active ? 'var(--teal-900)' : dashed ? 'var(--teal-300)' : '#fff'
            )
          // The name may have changed length: the pill follows it.
          layoutAreaPill(label)
          pill.rect
            .attr('fill', active ? 'var(--teal-bright-400)' : AREA_PILL_FILL)
            .attr('stroke', dashed ? 'var(--teal-300)' : 'none')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', dashed ? '8 6' : null)
          pill.group.attr('aria-pressed', pressed)
        }
        // The selected pin's name is outlined, so that it can be told from
        // its place's name when the two (both teal then) overlap.
        for (const pin of pins) {
          const isSelected = pin.tier.id === link.selectedId
          pin.labelRect
            .attr('fill', isSelected ? 'var(--teal-bright-400)' : '#fff')
            .attr('stroke', isSelected ? 'var(--teal-900)' : 'none')
            .attr('vector-effect', 'non-scaling-stroke')
        }
      }
      const filterChanged =
        link.matchingIds !== appliedMatching ||
        link.nonMatching !== appliedMode ||
        link.hiddenIds !== appliedHidden
      if (
        filterChanged &&
        (link.nonMatching === 'hide' ||
          appliedMode === 'hide' ||
          link.hiddenIds !== appliedHidden)
      ) {
        // Hidden pins leave the layout, so it has to be worked out again:
        // at once, because a pin coming back cannot be drawn without its
        // place in it. (This also redraws the pins.)
        applyTiers()
      } else if (filterChanged || link.selectedId !== appliedSelected) {
        applyPins(appliedK)
      }
      if (link.fitArea !== appliedFit) {
        if (link.fitArea) fitToArea(link.fitArea, link.leftInset)
        else if (appliedFit) {
          // The filter has gone: back to the whole island.
          focus = null
          scheduleTiers()
          resetView()
        }
      }
      appliedMatching = link.matchingIds
      appliedMode = link.nonMatching
      appliedSelected = link.selectedId
      appliedCategories = link.activeCategories
      appliedShowInactive = link.showInactive
      appliedHidden = link.hiddenIds
      appliedFit = link.fitArea
    }
    applyExplorerRef.current = applyExplorer
    applyExplorer()
    if (explorerRef.current) {
      explorerRef.current.apiRef.current = {
        panTo: id => {
          const org = orgById.get(id)
          if (!org || org.x === null || org.y === null) return
          // Keep the visitor's zoom unless it is too far out to tell the pin
          // from its neighbors.
          const k = Math.max(
            d3.zoomTransform(svgNode).k,
            isSinglePane() ? PHONE_PIN_ZOOM : 2
          )
          const at = layout?.positions.has(id)
            ? pinPositionAt(layout, id, zoomOf(k))
            : { x: org.x * GRID_SIZE, y: org.y * GRID_SIZE }
          const link = explorerRef.current
          flyToPoint(
            at.x,
            at.y,
            k,
            link?.leftInset ?? 0,
            link?.topInset ?? 0,
            link?.bottomInset ?? 0
          )
        },
        focusPin: id => {
          const pin = pins.find(({ tier }) => tier.id === id)
          if (!pin?.link || pin.group.classed('mapFadeHidden')) return false
          pin.link.focus({ preventScroll: true })
          return document.activeElement === pin.link
        },
      }
      explorerRef.current.onReady?.()
    }

    // ESC resets the view, same as the recenter button. Skip while typing in
    // a form field — ESC there shouldn't yank the map.
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      )
        return
      // An open search gets ESC first. Clicking a listing on the map takes
      // focus out of the field but leaves the box open, and ESC then has to
      // still mean "close the search", not "reset the view".
      if (searchControlRef.current.isOpen()) {
        searchControlRef.current.escape()
        return
      }
      // In the explorer ESC first dismisses the hover tooltip, then lets go of
      // the selection; the view is reset only when there is neither.
      if (explorerRef.current && tooltipShowing()) {
        hideTooltip()
        return
      }
      if (explorerRef.current?.selectedId) {
        explorerRef.current.onClear()
        return
      }
      resetView()
    }
    document.addEventListener('keydown', handleEscKey)

    // Mobile: tapping the tooltip opens the stashed link in a new tab.
    const handleTooltipClick = (e: MouseEvent) => {
      const tt = tooltipRef.current
      if (!tt) return
      if (explorerRef.current) {
        const id = tt.getAttribute('data-listing-id')
        hideTooltip()
        if (id) explorerRef.current.onSelect(id)
        e.stopPropagation()
        return
      }
      const link = tt.getAttribute('data-link-url')
      const title = tt.getAttribute('data-link-title')
      if (link && link !== '#') {
        if (title)
          trackListingClick(
            'Map',
            title,
            link,
            // Stashed by the first tap — this handler has no org in scope.
            tt.getAttribute('data-listing-id') || undefined,
            undefined,
            'map',
            tt.getAttribute('data-area') || undefined
          )
        hideTooltip()
        window.open(withUtm(link, 'Map'), '_blank')
      }
      e.stopPropagation()
    }

    // Mobile: tapping outside any pin or the tooltip dismisses the tooltip.
    const handleDocumentClick = (e: MouseEvent) => {
      if (tappedOrgId === null) return
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.mapItem')) return
      if (tooltipRef.current && tooltipRef.current.contains(target)) return
      hideTooltip()
    }

    const tooltipEl = tooltipRef.current
    if (tooltipEl) tooltipEl.addEventListener('click', handleTooltipClick)
    if (tooltipEl && hasExplorer) {
      tooltipEl.addEventListener('mouseenter', cancelTooltipHide)
      tooltipEl.addEventListener('mouseleave', scheduleTooltipHide)
    }
    document.addEventListener('click', handleDocumentClick)

    const container = containerRef.current
    return () => {
      // A pending hover dwell must not fire after unmount.
      cancelHoverTimer()
      // The ring is removed with the SVG; the fns must not outlive the zoom
      // behavior they close over.
      searchRef.current = {
        flyTo: () => {},
        flyToArea: () => {},
        clearHighlight: () => {},
      }
      svgNode.removeEventListener('wheel', preventPageZoom)
      tierResizeObserver.disconnect()
      if (tierTimer !== null) clearTimeout(tierTimer)
      applyTiersRef.current = () => {}
      applyExplorerRef.current = () => {}
      if (tooltipEl) tooltipEl.removeEventListener('click', handleTooltipClick)
      if (tooltipEl) {
        tooltipEl.removeEventListener('mouseenter', cancelTooltipHide)
        tooltipEl.removeEventListener('mouseleave', scheduleTooltipHide)
      }
      cancelTooltipHide()
      document.removeEventListener('click', handleDocumentClick)
      document.removeEventListener('keydown', handleEscKey)
      if (container) {
        d3.select(container).select('svg').remove()
      }
    }
  }, [orgs, showAreaCounts, scheme, realmBackdrop, hasExplorer])

  return (
    <>
      <div ref={containerRef} className={styles['map-container']} />

      <MapControls
        className={styles['map-controls']}
        onZoomIn={() => controlsRef.current.zoomIn()}
        onZoomOut={() => controlsRef.current.zoomOut()}
        onReset={() => controlsRef.current.reset()}
      />

      {tuning && (
        <MapTuningPanel
          className={styles['map-tuning']}
          config={tierConfig}
          onChange={setTierConfig}
          showAreaCounts={showAreaCounts}
          onShowAreaCounts={setShowAreaCounts}
          readoutRef={tierReadoutRef}
        />
      )}

      {/* Beside the explorer column the search lives in the column. */}
      {!hasExplorer && (
        <MapSearch
          className={styles['map-search']}
          orgs={searchOrgs}
          scheme={scheme}
          suggestEntryUrl={suggestEntryUrl}
          controlRef={searchControlRef}
          onPick={org => searchRef.current.flyTo(org)}
          onPickArea={area => searchRef.current.flyToArea(area)}
          onClear={() => searchRef.current.clearHighlight()}
        />
      )}

      {/* Tooltip — always in DOM for measuring, visibility toggled via ref */}
      <div
        ref={tooltipRef}
        className={`${styles['map-tooltip']}${hasExplorer ? ` ${styles['map-tooltip-explorer']}` : ''}`}
        style={{ visibility: 'hidden', opacity: 0 }}
        role={hasExplorer ? 'tooltip' : undefined}
      >
        <strong></strong>
        <span></span>
        {hasExplorer && <small>Click for details</small>}
      </div>
    </>
  )
}
