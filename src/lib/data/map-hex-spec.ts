// PROTOTYPE Map 3.5, "Hex work" view: the geography, as a board of hexagonal
// tiles. This file is meant to be edited by hand.
//
// HOW TO READ THE TILE MAP
// Each token is one tile, and the tiles lie as the tokens do, with one thing
// to keep in mind: every second column (the 2nd, 4th, 6th... token of a row)
// sits half a tile LOWER than the ones beside it, as the columns of a
// honeycomb do.
//   ..    open sea
//   Gm    a tile of the district with the letters Gm (see the districts
//         below). Lower-case letters are features, not districts: cv the
//         cove, hb the harbor, mt the peak, kp the castle's keep.
// Every painted tile is land (takeAllTiles below), so the coast is exactly
// what is painted here: keep it smooth, with no single tile sticking out, and
// paint each district about as many tiles as its logos need (a tile holds
// about one large logo, two medium or four small; the render script's need
// report gives the count). The two rows at the top are left to the sea for
// the map's title. Logos fill a
// district from its most inland tile (the one nearest the castle) outward.
// With takeAllTiles off, a district takes only as many tiles as its logos
// need and the rest stay sea until the day they are needed.
// A sign after the letters marks the tile:
//   Gm~   the RIVER runs through the tile. The river is every tile marked ~,
//         joined up from the highest one downhill; where marked tiles branch,
//         the river parts (the delta); where a marked tile is on the coast,
//         the river runs out to sea. It may never run uphill.
//   Gm=   the ROAD runs through the tile, joined up the same way.
//   Gm!   the district's LANDMARK stands here, and no logos.
// River, road and landmark tiles are always land.
//
// HEIGHTS belong to districts, not to tiles: a district is one plateau, all
// its tiles at one height and with no border between them, so districts are
// told apart by the step between them, their rim and their tone. Give
// neighboring districts different heights. In levels: 1 is low ground (the
// delta, the beaches), 2 to 3 ordinary land, 4 and up the mountains; halves
// are fine.
//
// THE SCALE comes from the castle: Career support is the keep and the six
// tiles round it, which between them hold its 13 logos. That sets the size of
// a tile (about one large logo, two medium or four small ones), and the rest
// of the map follows from it.
//
// The arrangement follows Rob's second sketch (see map-realm-spec.ts): the
// castle in the very middle, and a realm out from each of its six sides: the
// Advocacy cove to the north, Policy and strategy to the north-east,
// Technical research (the mountains) to the south-east, Field infrastructure
// to the south and along under everything, the Talent pipeline with its road
// to the south-west, and Media and discourse with the delta to the
// north-west. The closed orgs have an islet of their own in the south-west
// corner.

import type { HexMapSpec } from './map-hex-layout'
import { QUIET_REALM } from './map-realms'

// prettier-ignore
const TILES = `
# 0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17  18
  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..
  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..
  ..  ..  Fo  Fo~ Fo  Ne~ Ne  Ne  Ne  Gr  ..  Pa  Go  Go  Th  Th  Th  Lo  ..
  ..  ..  Fo  Fo~ Fo~ Ne~ Ne  Ne  Fr  Gr  cv! Pa  Pa  Go  Th  Th! Th  Lo  ..
  ..  ..  Fo~ Fo! Fo  Ne  Ne~ Ne~ Fr  Gr  cv  Pa  Ma  Ma  Ma! St  Lo  ..  ..
  ..  In! In  In  Fb  Pp  Pp  Pp  Fr~ Ca~ Ca  Ca  Ma  Ma  St  Ev  Ev  mt~ ..
  ..  hb  hb  In= Fb= Pp= Pp= Tp= Tp= Ca= kp  Ca~ Al~ Al~ Al  Ev~ Ev~ Ip  ..
  ..  In  hb  In  Fb  Tp  Tp! Tp  Tp  Hu  Ca  Gm  Al  Al  Al~ Co  Ip  Ip! ..
  ..  ..  In  Tp  Tp  Tp  Tp  Op  Hu  Gm  Gm  Gm  Gm  Co  Co  Co! Cp  Cp! ..
  Gy! Gy  ..  ..  ..  Op  Op  To  Hu  Gm  Gm! Gm  Gm  Co  Co  Cp  Cp  ..  ..
  Gy  Gy  Gy  ..  ..  ..  ..  ..  To  To  Gm  Gm  Vc  Vc  ..  ..  ..  ..  ..
  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..
`

export const MAP_35_HEX_SPEC: HexMapSpec = {
  // Sizes are in map grid units (the map is 60 wide).
  view: { size: 2.05, squash: 0.66, lift: 0.4, origin: [2.33, 2.6] },
  tiles: TILES,
  // prettier-ignore
  districts: [
    { code: 'Fo', district: 'Foundational and explanatory', realm: 'Media and discourse', height: 1,
      landmark: { symbol: 'beach-camp', width: 1.9, height: 2.05 } },
    { code: 'Ne', district: 'News and commentary', realm: 'Media and discourse', height: 1.5 },
    { code: 'Fr', district: 'Forums and online communities', realm: 'Media and discourse', height: 2.5 },
    { code: 'Gr', district: 'Grassroots campaigns', realm: 'Advocacy and public engagement', height: 1 },
    { code: 'Pa', district: 'Professional advocacy and communication', realm: 'Advocacy and public engagement', height: 1.5 },
    // The landing: the arms of a sheltered harbor, where the road starts.
    { code: 'In', district: 'Introductory learning', realm: 'Talent pipeline', height: 0.5,
      landmark: { symbol: 'lighthouse', width: 1, height: 1.8 } },
    { code: 'Fb', district: 'Field-building and local groups', realm: 'Talent pipeline', height: 1.5 },
    { code: 'Pp', district: 'Policy and governance programs', realm: 'Talent pipeline', height: 2 },
    { code: 'Tp', district: 'Technical research programs', realm: 'Talent pipeline', height: 2.5,
      landmark: { symbol: 'training-town', width: 3, height: 2.54 } },
    // The castle: the six tiles round the keep, whatever its logos need.
    { code: 'Ca', district: 'Career support and placement', realm: 'Talent pipeline', height: 3, minTiles: 6, overWater: true },
    { code: 'Op', district: 'Operations and services', realm: 'Field infrastructure', height: 1.5 },
    { code: 'Hu', district: 'Hubs and coworking', realm: 'Field infrastructure', height: 1 },
    { code: 'To', district: 'Tools, databases and research infrastructure', realm: 'Field infrastructure', height: 0.5 },
    { code: 'Gm', district: 'Grantmakers and donor advisory', realm: 'Field infrastructure', height: 1.5,
      landmark: { symbol: 'forest', width: 2.6, height: 2.15 } },
    { code: 'Vc', district: 'Venture capital and incubators', realm: 'Field infrastructure', height: 1 },
    { code: 'Go', district: 'Governments and multi-stakeholder bodies', realm: 'Policy and strategy', height: 2 },
    { code: 'Ma', district: 'Macrostrategy and forecasting', realm: 'Policy and strategy', height: 3.5,
      landmark: { symbol: 'summit', width: 3, height: 1.9 } },
    { code: 'Th', district: 'Policy research and think tanks', realm: 'Policy and strategy', height: 2.5,
      landmark: { symbol: 'grove', width: 3, height: 1.93 } },
    { code: 'St', district: 'Standards, assurance and verification', realm: 'Policy and strategy', height: 3 },
    { code: 'Lo', district: 'Policy advocacy and lobbying', realm: 'Policy and strategy', height: 2 },
    { code: 'Al', district: 'Alignment and control', realm: 'Technical research', height: 4 },
    { code: 'Ev', district: 'Evaluations and threat research', realm: 'Technical research', height: 5 },
    { code: 'Co', district: 'Conceptual and foundations research', realm: 'Technical research', height: 4.5,
      landmark: { symbol: 'cave', width: 1.7, height: 1.63 } },
    { code: 'Ip', district: 'Interpretability and model understanding', realm: 'Technical research', height: 5.5,
      landmark: { symbol: 'range', width: 2.8, height: 1.98 } },
    { code: 'Cp', district: 'Capabilities research', realm: 'Technical research', height: 6, walled: true,
      landmark: { symbol: 'skull-mountain', width: 2.6, height: 2.25 } },
    // The closed orgs: sunken ships, on open water off the south-west coast.
    { code: 'Gy', district: QUIET_REALM, realm: QUIET_REALM, height: 0, sunken: true,
      landmark: { symbol: 'sailboat', width: 1.7, height: 1.4 } },
  ],
  // prettier-ignore
  features: [
    // The cove: water inside the coast, between the two arms of Advocacy.
    { code: 'cv', kind: 'water', height: 0,
      landmark: { symbol: 'boats', width: 3.4, height: 1.26 } },
    // The harbor the road starts from: a bay between the arms of the landing.
    { code: 'hb', kind: 'water', height: 0 },
    // The high peak the river rises on.
    { code: 'mt', kind: 'scenery', realm: 'Technical research', height: 7 },
    // The castle's keep, level with the six tiles of Career support round it.
    // The castle is larger than the keep's tile; the river circles it as a
    // moat through the middles of those six tiles, and the road ends at its
    // bridge. Career support's logos may stand over the moat.
    { code: 'kp', kind: 'keep', realm: 'Talent pipeline', height: 3,
      landmark: { symbol: 'castle', width: 5, height: 3.12 } },
  ],
  river: { width: 0.85, branch: 0.78 },
  road: { width: 0.55 },
  // For now every painted tile is land, so the coast is as smooth as it is
  // painted. To give a district room to grow, paint more tiles for it.
  takeAllTiles: true,
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

// WORKING NAMES, not final: what the map calls each realm and district. The
// data fields keep their plain names (Realm "Technical research", District
// "Alignment and control"); these labels are separate and can change without
// touching the data. Names that describe a position (Landing, Pier,
// Escarpment) only hold while the layout does, so they are frozen last.
// prettier-ignore
export const MAP_35_HEX_NAMES: Record<string, string> = {
  'Talent pipeline': 'Pipeline Path',
  'Field infrastructure': 'Support Shoreline',
  // Or "Media Moor"; this map draws a delta.
  'Media and discourse': 'Discourse Delta',
  'Advocacy and public engagement': 'Advocacy Anchorage',
  'Policy and strategy': 'Policy Plains',
  'Technical research': 'Research Range',
  [QUIET_REALM]: 'Gone Graveyard',

  'Field-building and local groups': 'Community Commons',
  'Introductory learning': 'Learning Landing',
  'Technical research programs': 'Fellowship Fields',
  'Policy and governance programs': 'Statecraft School',
  // Or "Career Crossing".
  'Career support and placement': 'Career Castle',

  'Tools, databases and research infrastructure': 'Toolshed Terrace',
  'Operations and services': 'Service Station',
  'Hubs and coworking': 'Hub Hamlet',
  'Grantmakers and donor advisory': 'Grant Grove',
  'Venture capital and incubators': 'Venture Valley',

  'Foundational and explanatory': 'Foundation Forest',
  'News and commentary': 'Commentary Coast',
  'Forums and online communities': 'The Forum',

  'Grassroots campaigns': 'Campaign Cutters',
  'Professional advocacy and communication': 'Persuasion Pier',

  'Macrostrategy and forecasting': 'Foresight Foothills',
  'Policy research and think tanks': 'Think-Tank Town',
  // Or "Parliament Plaza".
  'Governments and multi-stakeholder bodies': 'Capitol Court',
  'Standards, assurance and verification': 'Verification Vale',
  // Or "Legislation Lookout".
  'Policy advocacy and lobbying': 'Lobby Landing',

  'Alignment and control': 'Control Dam',
  'Evaluations and threat research': 'Evaluation Escarpment',
  // Or "Interpretability Inlet".
  'Interpretability and model understanding': 'Circuit Cove',
  'Conceptual and foundations research': 'Theory Thicket',
  'Capabilities research': 'Capabilities Cove',
}
