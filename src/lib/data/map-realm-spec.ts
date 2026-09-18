// PROTOTYPE Map 3.5: the agreed geography, from Søren's background spec of
// 18 September 2026 (section 9, "Machine-readable boundaries"). Map grid
// units: x 0 to 60, y 0 to about 32, y increasing downward.
//
// Realm polygons deliberately overshoot the island and are cut off by its
// coast. District borders are not part of the spec: map-realm-layout.ts works
// them out from the anchors.
//
// Where this departs from the spec, to suit the layout the site works out:
//   - The Talent pipeline is a unit wider at its east end (its corners there
//     are (33, 15) and (33, 22), not (33, 16) and (33, 21)), to make room for
//     the castle town at the crossroads. The coast makes up the difference,
//     so the realms keep their shares of the land.
//   - The Policy/Technical border starts at the crossroads (33, 18.5), not
//     half a unit south of it, because the main road runs along it. The
//     departure harbour is where that border meets the east coast, a few
//     units south of the spec's (56.5, 14).
//   - The road is a border inside the Talent pipeline (see `roadside`), with
//     three districts north of it so neither side is a thin strip. Their
//     anchors are moved to suit; the spec had Field-building south of it.

import type { RealmMapSpec } from './map-realm-layout'

export const MAP_35_SPEC: RealmMapSpec = {
  island: { cx: 30, cy: 17.1, rx: 27.3, ry: 13.3 },
  realms: {
    'Field infrastructure': [
      [0, 0],
      [36, 0],
      [38, 11],
      [33, 15],
      [2, 8],
      [0, 8],
    ],
    'Talent pipeline': [
      [0, 8],
      [2, 8],
      [33, 15],
      [33, 22],
      [2, 21],
      [0, 21],
    ],
    'Media and discourse': [
      [0, 21],
      [2, 21],
      [33, 22],
      [32, 34],
      [0, 34],
    ],
    'Policy and strategy': [
      [36, 0],
      [64, 0],
      [64, 17],
      [33, 18.5],
      [33, 15],
      [38, 11],
    ],
    'Technical research': [
      [33, 18.5],
      [64, 17],
      [64, 34],
      [32, 34],
      [33, 22],
    ],
  },
  anchorage: {
    realmStartsWith: 'Advocacy',
    box: [
      [46, 3.5],
      [62, 3.5],
      [62, 13.5],
      [46, 13.5],
    ],
  },
  districtAnchors: {
    'Tools, databases and research infrastructure': [13, 8.7],
    'Operations and services': [22, 6.5],
    'Hubs and coworking': [26, 12],
    'Grantmakers and donor advisory': [31.5, 7],
    'Venture capital and incubators': [35, 12],
    'Field-building and local groups': [7, 12],
    'Introductory learning': [14, 12.5],
    'Policy and governance programs': [21, 14.5],
    'Technical research programs': [16, 19],
    'Career support and placement': [28, 18],
    'Foundational and explanatory': [10, 24],
    'News and commentary': [20, 26],
    'Forums and online communities': [28, 28.5],
    'Grassroots campaigns': [51, 6],
    'Professional advocacy and communication': [56, 10.5],
    'Macrostrategy and forecasting': [37, 15.5],
    'Policy research and think tanks': [46, 11],
    'Governments and multi-stakeholder bodies': [41, 17.8],
    'Standards, assurance and verification': [48.5, 16.5],
    'Policy advocacy and lobbying': [54, 14],
    'Conceptual and foundations research': [34, 27.5],
    'Alignment and control': [38, 22.5],
    'Interpretability and model understanding': [41, 27],
    'Evaluations and threat research': [45, 20.5],
    'Capabilities research': [49, 24],
  },
  // Walking the road from the arrival harbour: the places a newcomer starts
  // from and the policy programs to the north, the technical programs (by far
  // the largest district) to the south, and the castle town at its end.
  roadside: {
    realm: 'Talent pipeline',
    north: [
      'Field-building and local groups',
      'Introductory learning',
      'Policy and governance programs',
    ],
    south: ['Technical research programs'],
  },
  blocks: {
    // The Career Castle of the classic map: a town at the end of the road,
    // its east gate on the crossroads.
    'Career support and placement': { at: [33, 18.5], align: [-1, 0] },
    // The Forum: four entries, one built landmark on the south coast, up
    // against the border with Conceptual research.
    'Forums and online communities': { at: [32.4, 28.5], align: [-1, 0] },
  },
  eastRoadToward: [64, 17],
  shipsRoadVia: [
    'Macrostrategy and forecasting',
    'Policy research and think tanks',
  ],
  landmarks: {
    arrivalHarbour: [6, 11],
    crossroads: [33, 18.5],
    departureHarbour: [57.2, 17.4],
    controlDam: [36, 21],
  },
}
