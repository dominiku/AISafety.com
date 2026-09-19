import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLORER_STATE,
  historyActionFor,
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
