import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLORER_STATE,
  categoryFromSlug,
  categorySlug,
  fittedStatus,
  historyActionFor,
  pickedSort,
  shownSort,
  sortOptions,
  visibleRange,
  matchesSearch,
  normalizeText,
  parseExplorerState,
  resultCountLabel,
  searchRank,
  sortOrgs,
  writeExplorerState,
  type ExplorerOrg,
} from './map-explorer'

const org = (over: Partial<ExplorerOrg> & { title: string }): ExplorerOrg => ({
  tooltipTitle: over.title,
  shortName: null,
  description: '',
  category: '',
  dateAdded: null,
  ...over,
})

const fli = org({
  title: 'Future of Life Institute (FLI)',
  shortName: 'FLI',
  description: 'Steering transformative technology towards benefitting life.',
  category: 'Advocacy, Governance, Funding',
  dateAdded: '2023-01-10',
})
const cais = org({
  title: 'Center for AI Safety (CAIS)',
  shortName: 'CAIS',
  description: 'Conducting safety research and advocating for standards.',
  category: 'Empirical research, Advocacy',
  dateAdded: '2024-06-01',
})
const cafe = org({
  title: 'Café Søren',
  description: 'A life-sized example.',
  category: 'Blog',
})

describe('normalizeText', () => {
  it('drops case and accents', () => {
    expect(normalizeText('Café SØREN')).toBe('cafe soren')
  })
})

describe('matchesSearch', () => {
  it('matches everything when nothing is typed', () => {
    expect(matchesSearch(fli, '')).toBe(true)
    expect(matchesSearch(fli, '   ')).toBe(true)
  })

  it('looks in the name, the short name, the description and the categories', () => {
    expect(matchesSearch(fli, 'future of life')).toBe(true)
    expect(matchesSearch(fli, 'fli')).toBe(true)
    expect(matchesSearch(fli, 'transformative')).toBe(true)
    expect(matchesSearch(fli, 'governance')).toBe(true)
    expect(matchesSearch(fli, 'podcast')).toBe(false)
  })

  it('ignores case and accents, in either direction', () => {
    expect(matchesSearch(cafe, 'cafe soren')).toBe(true)
    expect(matchesSearch(cafe, 'CAFÉ')).toBe(true)
  })

  it('needs every word typed, in any order and any field', () => {
    expect(matchesSearch(fli, 'funding life')).toBe(true)
    expect(matchesSearch(fli, 'funding podcast')).toBe(false)
  })
})

describe('searchRank', () => {
  it('ranks name start, then name, then category, then description', () => {
    expect(searchRank(fli, 'future')).toBe(0)
    expect(searchRank(fli, 'FLI')).toBe(0)
    expect(searchRank(fli, 'life')).toBe(1)
    expect(searchRank(fli, 'governance')).toBe(2)
    expect(searchRank(fli, 'steering')).toBe(3)
  })
})

describe('sortOrgs', () => {
  const list = [fli, cais, cafe]

  it('best match with nothing typed keeps the order given', () => {
    expect(sortOrgs(list, 'best', '')).toEqual(list)
  })

  it('best match puts name matches above description matches', () => {
    // "life" is in FLI's name but only in the café's description.
    expect(sortOrgs([cafe, fli], 'best', 'life')).toEqual([fli, cafe])
  })

  it('name sorts A–Z ignoring accents and case', () => {
    expect(sortOrgs(list, 'name', '').map(o => o.title)).toEqual([
      'Café Søren',
      'Center for AI Safety (CAIS)',
      'Future of Life Institute (FLI)',
    ])
  })

  it('recent puts the newest first and undated orgs last', () => {
    expect(sortOrgs(list, 'recent', '')).toEqual([cais, fli, cafe])
  })

  it('does not reorder the list it was given', () => {
    const before = [...list]
    sortOrgs(list, 'name', '')
    expect(list).toEqual(before)
  })
})

describe('query string', () => {
  const keys = ['category', 'status']

  it('reads the defaults from a bare URL', () => {
    expect(parseExplorerState(new URLSearchParams(''), keys)).toEqual(
      DEFAULT_EXPLORER_STATE
    )
  })

  it('writes nothing for the default state', () => {
    expect(
      writeExplorerState(
        new URLSearchParams(''),
        DEFAULT_EXPLORER_STATE,
        keys
      ).toString()
    ).toBe('')
  })

  it('round-trips a full state', () => {
    const state = {
      query: 'safety',
      filters: {
        category: ['Blog', 'Training and education'],
        status: ['Active'],
      },
      sort: 'recent' as const,
      selected: 'rec123',
      collapsed: true,
    }
    const written = writeExplorerState(new URLSearchParams(''), state, keys)
    expect(parseExplorerState(written, keys)).toEqual(state)
  })

  it('reads and writes one value for a single-choice chip', () => {
    // An older shared link with two categories degrades to the first.
    const state = parseExplorerState(
      new URLSearchParams(
        'category=blog&category=funding&status=Active&status=No+longer+active'
      ),
      keys,
      ['category']
    )
    expect(state.filters.category).toEqual(['blog'])
    expect(state.filters.status).toEqual(['Active', 'No longer active'])
    const written = writeExplorerState(
      new URLSearchParams(''),
      { ...DEFAULT_EXPLORER_STATE, filters: { category: ['blog', 'funding'] } },
      keys,
      ['category']
    )
    expect(written.getAll('category')).toEqual(['blog'])
  })

  it('leaves params that are not its own alone, and replaces its own', () => {
    const written = writeExplorerState(
      new URLSearchParams('utm_source=newsletter&q=old&category=Blog'),
      { ...DEFAULT_EXPLORER_STATE, query: 'new' },
      keys
    )
    expect(written.get('utm_source')).toBe('newsletter')
    expect(written.get('q')).toBe('new')
    expect(written.getAll('category')).toEqual([])
  })

  it('falls back to the default for an unknown sort, and ignores unknown chips', () => {
    const state = parseExplorerState(
      new URLSearchParams('sort=sideways&region=Europe'),
      keys
    )
    expect(state.sort).toBe('best')
    expect(state.filters).toEqual({})
  })
})

describe('sort options', () => {
  it('offers Best match only while something is typed', () => {
    expect(sortOptions(false)).toEqual(['featured', 'name', 'recent'])
    expect(sortOptions(true)).toEqual(['best', 'featured', 'name', 'recent'])
  })
  it('shows the default as Featured until something is typed', () => {
    expect(shownSort('best', false)).toBe('featured')
    expect(shownSort('best', true)).toBe('best')
    expect(shownSort('name', false)).toBe('name')
  })
  it('stores Featured as the default when nothing is typed', () => {
    expect(pickedSort('featured', false)).toBe('best')
    expect(pickedSort('featured', true)).toBe('featured')
    expect(pickedSort('recent', false)).toBe('recent')
  })
  it('keeps the given order for Featured even with a search', () => {
    const list = [org({ title: 'Zeta fund' }), org({ title: 'Fund alpha' })]
    expect(sortOrgs(list, 'featured', 'fund').map(o => o.title)).toEqual([
      'Zeta fund',
      'Fund alpha',
    ])
  })
})

describe('category slugs', () => {
  const categories = ['Training and education', 'Blog', 'Research support']
  it('writes a category as a slug', () => {
    expect(categorySlug('Training and education')).toBe(
      'training-and-education'
    )
    expect(categorySlug('Blog')).toBe('blog')
  })
  it('reads a slug, or an older link with the plain name', () => {
    expect(categoryFromSlug('training-and-education', categories)).toBe(
      'Training and education'
    )
    expect(categoryFromSlug('Training and education', categories)).toBe(
      'Training and education'
    )
    expect(categoryFromSlug('nonsense', categories)).toBeNull()
  })
})

describe('visibleRange', () => {
  it('renders the rows in view plus a few either side', () => {
    expect(visibleRange(0, 640, 64, 339)).toEqual({ start: 0, end: 16 })
    expect(visibleRange(6400, 640, 64, 339)).toEqual({ start: 94, end: 116 })
  })
  it('never runs past the list', () => {
    expect(visibleRange(99999, 640, 64, 20)).toEqual({ start: 20, end: 20 })
    expect(visibleRange(0, 640, 64, 3)).toEqual({ start: 0, end: 3 })
  })
})

describe('fittedStatus', () => {
  it('counts the pins here and those elsewhere', () => {
    expect(fittedStatus('Training Town', 54, 8).rest).toBe(
      '54 pins here, 8 more in other areas'
    )
    expect(fittedStatus('Blog Beach', 1, 0).rest).toBe('1 pin here')
  })
})

describe('historyActionFor', () => {
  it('opens a card as a new history entry, so Back closes it', () => {
    expect(historyActionFor(null, 'recA', false)).toBe('push')
  })
  it('closes a card it opened by stepping back off that entry', () => {
    expect(historyActionFor('recA', null, true)).toBe('back')
  })
  it('closes a shared link’s card in place: there is no entry to go back to', () => {
    expect(historyActionFor('recA', null, false)).toBe('replace')
  })
  it('moves between orgs, and changes filters, in place', () => {
    expect(historyActionFor('recA', 'recB', true)).toBe('replace')
    expect(historyActionFor(null, null, false)).toBe('replace')
  })
})

describe('resultCountLabel', () => {
  it('reads "N of M" only when something is filtered out', () => {
    expect(resultCountLabel(369, 369)).toBe('369 organizations')
    expect(resultCountLabel(90, 369)).toBe('90 of 369 organizations')
    expect(resultCountLabel(1, 1)).toBe('1 organization')
  })
})
