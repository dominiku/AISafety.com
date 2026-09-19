// Pure logic for the /map explorer column: what a search matches, how the
// list is ordered, and how the column's state is written to and read from
// the query string. No dependencies, so it can be unit tested on its own.
// (Which options combine with OR and which with AND is lib/filter-counts.)

export interface ExplorerOrg {
  title: string
  tooltipTitle: string
  shortName: string | null
  description: string
  // Comma-joined, as Airtable gives it: "Governance, Advocacy".
  category: string
  dateAdded: string | null
}

/** Lowercased with accents removed, so "Søren" is found by "soren" and
 *  "café" by "cafe". */
export function normalizeText(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      // Letters NFD leaves whole.
      .replace(/ø/gi, 'o')
      .replace(/æ/gi, 'ae')
      .replace(/ß/g, 'ss')
      .toLowerCase()
  )
}

function searchTerms(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean)
}

const names = (org: ExplorerOrg) =>
  [org.title, org.shortName ?? '', org.tooltipTitle].map(normalizeText)

/**
 * Whether an org matches a search. Every word typed has to appear somewhere
 * in its names, description or categories, so "governance fund" narrows
 * rather than widens. An empty search matches everything.
 */
export function matchesSearch(org: ExplorerOrg, query: string): boolean {
  const terms = searchTerms(query)
  if (terms.length === 0) return true
  const haystack = [
    ...names(org),
    normalizeText(org.description),
    normalizeText(org.category),
  ].join('\n')
  return terms.every(term => haystack.includes(term))
}

/**
 * How good a match is, lower is better: a name starting with the search,
 * then a name containing it, then a category, then only the description.
 * Same idea as the map's own search box, where a starting match wins.
 */
export function searchRank(org: ExplorerOrg, query: string): number {
  const q = normalizeText(query).trim()
  if (!q) return 0
  const orgNames = names(org)
  if (orgNames.some(name => name.startsWith(q))) return 0
  if (orgNames.some(name => name.includes(q))) return 1
  if (normalizeText(org.category).includes(q)) return 2
  return 3
}

export const EXPLORER_SORTS = ['best', 'name', 'recent'] as const
export type ExplorerSort = (typeof EXPLORER_SORTS)[number]

/**
 * The list in the chosen order. Never reorders in place.
 * - best: by searchRank, ties keep the order given (the site's own order).
 *   With nothing typed that is simply the order given.
 * - name: A–Z, ignoring case and accents.
 * - recent: newest Date added first; orgs with no date go last.
 */
export function sortOrgs<T extends ExplorerOrg>(
  orgs: T[],
  sort: ExplorerSort,
  query: string
): T[] {
  const indexed = orgs.map((org, index) => ({ org, index }))
  if (sort === 'name') {
    indexed.sort(
      (a, b) =>
        normalizeText(a.org.title).localeCompare(normalizeText(b.org.title)) ||
        a.index - b.index
    )
  } else if (sort === 'recent') {
    indexed.sort((a, b) => {
      const [da, db] = [a.org.dateAdded, b.org.dateAdded]
      if (da === db) return a.index - b.index
      if (!da) return 1
      if (!db) return -1
      // ISO dates compare correctly as text.
      return da < db ? 1 : -1
    })
  } else {
    indexed.sort(
      (a, b) =>
        searchRank(a.org, query) - searchRank(b.org, query) || a.index - b.index
    )
  }
  return indexed.map(({ org }) => org)
}

// ─── Query string ───────────────────────────────────────────────────────────

export interface ExplorerState {
  query: string
  // Selected options per filter chip, keyed by the chip's URL name
  // ('category', 'status'…).
  filters: Record<string, string[]>
  sort: ExplorerSort
  // The selected org's record id, or null.
  selected: string | null
  collapsed: boolean
}

export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  query: '',
  filters: {},
  sort: 'best',
  selected: null,
  collapsed: false,
}

const RESERVED_PARAMS = ['q', 'sort', 'org', 'list']

/**
 * Read the column's state from a query string. `filterKeys` are the chips
 * this page has; anything else in the URL (utm tags and so on) is ignored,
 * and an unknown sort falls back to the default. A chip's options are
 * repeated params (?category=Blog&category=Funding), so an option name may
 * hold any character.
 */
export function parseExplorerState(
  params: URLSearchParams,
  filterKeys: string[]
): ExplorerState {
  const sort = params.get('sort')
  const filters: Record<string, string[]> = {}
  for (const key of filterKeys) {
    const values = params.getAll(key).filter(Boolean)
    if (values.length > 0) filters[key] = values
  }
  return {
    query: params.get('q') ?? '',
    filters,
    sort: (EXPLORER_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as ExplorerSort)
      : DEFAULT_EXPLORER_STATE.sort,
    selected: params.get('org') || null,
    collapsed: params.get('list') === 'hidden',
  }
}

/**
 * Write the state onto a query string, leaving every param that isn't the
 * explorer's alone. Defaults are left out, so the untouched page keeps its
 * bare URL.
 */
export function writeExplorerState(
  params: URLSearchParams,
  state: ExplorerState,
  filterKeys: string[]
): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of [...RESERVED_PARAMS, ...filterKeys]) next.delete(key)
  const query = state.query.trim()
  if (query) next.set('q', query)
  for (const key of filterKeys) {
    for (const value of state.filters[key] ?? []) next.append(key, value)
  }
  if (state.sort !== DEFAULT_EXPLORER_STATE.sort) next.set('sort', state.sort)
  if (state.selected) next.set('org', state.selected)
  if (state.collapsed) next.set('list', 'hidden')
  return next
}

/**
 * How a change of selection reaches the browser's history, so that Back
 * closes a details card the visitor opened on this page:
 * - push: a card opens where none was, as a new entry.
 * - back: that same card closes, by stepping off the entry it made. Only
 *   when the entry is ours (`entryIsCard`): a shared link's card has no
 *   earlier entry on this page to step back to.
 * - replace: everything else (another org, a filter, a shared link closing).
 */
export function historyActionFor(
  currentOrg: string | null,
  nextOrg: string | null,
  entryIsCard: boolean
): 'push' | 'replace' | 'back' {
  if (!currentOrg && nextOrg) return 'push'
  if (currentOrg && !nextOrg && entryIsCard) return 'back'
  return 'replace'
}

/** "90 of 412 organizations", or "412 organizations" when nothing is
 *  filtered out. Also what the live region announces. */
export function resultCountLabel(shown: number, total: number): string {
  const noun = total === 1 ? 'organization' : 'organizations'
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`
}
