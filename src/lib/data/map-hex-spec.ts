// PROTOTYPE Map 3.5, "Hex work" view: the geography, as a board of hexagonal
// tiles. This file is meant to be edited by hand.
//
// HOW TO READ THE TILE MAP
// Each token is one tile, and the tiles lie as the tokens do, with one thing
// to keep in mind: every second column (the 2nd, 4th, 6th... token of a row)
// sits half a tile LOWER than the ones beside it, as the columns of a
// honeycomb do.
//   ..    open sea
//   Gm2   the district with the letters Gm (see DISTRICTS below), and the
//         2nd tile that district takes up.
// A district fills its tile 1 first, then 2, and so on, and takes only as
// many as its logos need. Tiles it does not need yet are planned growth: they
// stay sea until the day they are needed. So number a district's tiles from
// the inland ones outward to the coast, and the island grows at its edges.
// Lower-case tokens (cv1, mt1) are features, not districts: see FEATURES.
//
// HEIGHTS belong to districts, not to tiles: a district is one plateau, all
// its tiles at one height and with no border between them, so districts are
// told apart by the step between them, their rim and their tone. Give
// neighboring districts different heights. In levels: 1 is low ground (the
// delta, the beaches), 2 to 3 ordinary land, 3.5 and up the mountains; halves
// are fine. The river may never run uphill.
//
// The arrangement follows Rob's second sketch (see map-realm-spec.ts): the
// castle (Career support) in the very middle, and one realm across each of
// its six sides: the Advocacy cove to the north, Policy and strategy to the
// north-east, Technical research (the mountains) to the south-east, Field
// infrastructure to the south and along under everything, the Talent
// pipeline with its road to the south-west, and Media and discourse with the
// delta to the north-west. The closed orgs have an islet of their own in the
// south-west corner.

import type { HexMapSpec } from './map-hex-layout'
import { QUIET_REALM } from './map-realms'

// prettier-ignore
const TILES = `
# 0    1    2    3    4    5    6    7    8    9    10   11   12
  ..   Fo6  Ne8  Ne7  ..   ..   ..   ..   Go2  Th5  ..   ..   ..
  Fo4  Fo2  Ne5  Ne4  Ne6  Gr2  ..   Pa2  Go1  Th2  Th3  Th4  ..
  Fo3  Fo1  Ne3  Ne2  Fr2  Gr1  cv1  Pa1  Ma3  Th1  Lo2  Lo3  ..
  Fo5  Fb1  Fb2  Pp1  Ne1  Fr1  cv2  Ma1  Ma2  St1  Lo1  mt1  ..
  ..   In2  In1  Pp2  Tp1  Ca2  Ca1  Al1  Al2  Al3  Ev1  Cp1  Cp2
  ..   ..   Tp4  Tp3  Tp2  Ca3  Gm1  Gm3  Al4  Co1  Ev2  Ip1  ..
  Gy1  ..   Tp5  Op1  Op2  Hu1  Gm2  Gm4  Vc1  Co2  Co3  ..   ..
  Gy2  Gy3  ..   ..   To1  To2  Gm5  Gm6  Vc2  ..   Co4  ..   ..
`

export const MAP_35_HEX_SPEC: HexMapSpec = {
  // Big tiles to start with: a small district is one tile. Sizes are in map
  // grid units (the map is 60 wide).
  view: { size: 2.85, squash: 0.66, lift: 0.42, origin: [4.35, 2.9] },
  tiles: TILES,
  // prettier-ignore
  districts: [
    { code: 'Fo', district: 'Foundational and explanatory', realm: 'Media and discourse', height: 1 },
    { code: 'Ne', district: 'News and commentary', realm: 'Media and discourse', height: 1.5 },
    { code: 'Fr', district: 'Forums and online communities', realm: 'Media and discourse', height: 2 },
    { code: 'Gr', district: 'Grassroots campaigns', realm: 'Advocacy and public engagement', height: 1 },
    { code: 'Pa', district: 'Professional advocacy and communication', realm: 'Advocacy and public engagement', height: 1.5 },
    { code: 'Fb', district: 'Field-building and local groups', realm: 'Talent pipeline', height: 1 },
    { code: 'In', district: 'Introductory learning', realm: 'Talent pipeline', height: 1.5 },
    { code: 'Pp', district: 'Policy and governance programs', realm: 'Talent pipeline', height: 2 },
    { code: 'Tp', district: 'Technical research programs', realm: 'Talent pipeline', height: 2.5 },
    { code: 'Ca', district: 'Career support and placement', realm: 'Talent pipeline', height: 3 },
    { code: 'Op', district: 'Operations and services', realm: 'Field infrastructure', height: 1.5 },
    { code: 'Hu', district: 'Hubs and coworking', realm: 'Field infrastructure', height: 1 },
    { code: 'To', district: 'Tools, databases and research infrastructure', realm: 'Field infrastructure', height: 0.5 },
    { code: 'Gm', district: 'Grantmakers and donor advisory', realm: 'Field infrastructure', height: 1.5 },
    { code: 'Vc', district: 'Venture capital and incubators', realm: 'Field infrastructure', height: 1 },
    { code: 'Go', district: 'Governments and multi-stakeholder bodies', realm: 'Policy and strategy', height: 2 },
    { code: 'Ma', district: 'Macrostrategy and forecasting', realm: 'Policy and strategy', height: 3 },
    { code: 'Th', district: 'Policy research and think tanks', realm: 'Policy and strategy', height: 2.5 },
    { code: 'St', district: 'Standards, assurance and verification', realm: 'Policy and strategy', height: 2 },
    { code: 'Lo', district: 'Policy advocacy and lobbying', realm: 'Policy and strategy', height: 1.5 },
    { code: 'Al', district: 'Alignment and control', realm: 'Technical research', height: 3.5 },
    { code: 'Ev', district: 'Evaluations and threat research', realm: 'Technical research', height: 4.5 },
    { code: 'Co', district: 'Conceptual and foundations research', realm: 'Technical research', height: 4 },
    { code: 'Ip', district: 'Interpretability and model understanding', realm: 'Technical research', height: 3.5 },
    { code: 'Cp', district: 'Capabilities research', realm: 'Technical research', height: 5 },
    { code: 'Gy', district: QUIET_REALM, realm: QUIET_REALM, height: 1 },
  ],
  features: [
    // The cove: water inside the coast, between the two arms of Advocacy.
    { code: 'cv', kind: 'water', height: 0 },
    // The high peak the river rises on.
    { code: 'mt', kind: 'scenery', realm: 'Technical research', height: 6 },
  ],
  // prettier-ignore
  landmarks: [
    { tile: 'Ca1', symbol: 'castle', width: 3.4, height: 2.12, logos: 'none' },
    { tile: 'Tp1', symbol: 'training-town', width: 3.7, height: 3.1, logos: 'none' },
    { tile: 'Gm2', symbol: 'forest', width: 2.8, height: 2.3, logos: 'around' },
    { tile: 'Th1', symbol: 'grove', width: 3.2, height: 2.05, logos: 'around' },
    { tile: 'Ma3', symbol: 'summit', width: 3.4, height: 2.1, logos: 'around' },
    { tile: 'Ip1', symbol: 'range', width: 3.1, height: 2.2, logos: 'around' },
    { tile: 'Co2', symbol: 'cave', width: 1.9, height: 1.8, logos: 'around' },
    { tile: 'Cp1', symbol: 'skull-mountain', width: 2.9, height: 2.5, logos: 'around' },
    { tile: 'Fo1', symbol: 'beach-camp', width: 2.1, height: 2.3, logos: 'around' },
    { tile: 'Fb1', symbol: 'lighthouse', width: 1.1, height: 2, logos: 'around' },
    { tile: 'cv1', symbol: 'boats', width: 4.2, height: 1.55, logos: 'none' },
    { tile: 'Gy1', symbol: 'gravestones', width: 3.6, height: 1.7, logos: 'around' },
  ],
  paths: [
    // The road: in from the arrival harbour on the west shore, through the
    // places a newcomer starts from, past the training town, and over the
    // moat to the castle.
    {
      kind: 'road',
      width: 0.58,
      tiles: ['Fb1', 'In1', 'Pp1', 'Tp1', 'Ca2', 'Ca1'],
      enter: 'SW',
    },
    // The river: down from the high peak in the east (it falls toward the
    // viewer off the peak and again off the Evaluations plateau), through the
    // research country, round the
    // castle as its moat, and out through Media.
    {
      kind: 'river',
      width: 0.46,
      tiles: ['mt1', 'Ev1', 'Al3', 'Al2', 'Al1', 'Ca1', 'Fr1', 'Ne1', 'Ne2'],
    },
    // The delta: the river parts again and again on its way to the sea.
    { kind: 'river', width: 0.3, tiles: ['Ne2', 'Ne3', 'Fo2'], exit: 'NW' },
    { kind: 'river', width: 0.3, tiles: ['Ne2', 'Ne4'], exit: 'N' },
    { kind: 'river', width: 0.24, tiles: ['Ne3', 'Ne5'], exit: 'N' },
  ],
  moat: 'Ca1',
}

// District codes whose tiles are an island of their own, not part of the
// main land.
export const MAP_35_HEX_ISLETS = ['Gy']

// How far a logo reaches from its middle, in map grid units, by its Scale
// field: the pin sizes D3Map draws (64 px times 0.4, 0.6 or 0.8, on a grid of
// about 41.4 px).
export function hexLogoRadius(scale: string | null): number {
  const size = (scale ?? 'Medium').toLowerCase()
  return size === 'large' ? 0.62 : size === 'small' ? 0.31 : 0.46
}
