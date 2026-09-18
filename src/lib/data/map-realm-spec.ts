// PROTOTYPE Map 3.5: the agreed geography, from Søren's background spec of
// 18 September 2026 (section 9, "Machine-readable boundaries"). Map grid
// units: x 0 to 60, y 0 to about 32, y increasing downward.
//
// Realm polygons deliberately overshoot the island and are cut off by its
// coast. District borders are not part of the spec: map-realm-layout.ts works
// them out from the anchors.
//
// Where this departs from the spec, after Rob's reviews of 18 September:
//   - Advocacy is a small harbour of its own, not an anchorage off Policy's
//     coast: a cove just north-east of the castle town, with the edge of
//     Field infrastructure for its west shore, the north-west corner of
//     Policy and strategy for its south-east shore, and a quay of its own
//     land to the east. A short boardwalk joins it to the castle town.
//   - Field infrastructure stops at the cove (x = 30). Policy and strategy is
//     the middle band of the east side, running up east of the quay, and
//     Technical research the bottom one. The Media/Technical border slants,
//     so nothing lines up straight down the middle of the island.
//   - The road is a border between districts only in the Talent pipeline
//     (see `roads`), which puts Field-building north of it. East of the
//     crossroads there is a footpath calling at each district, not a road.
//   - The arrival harbour is on the west shore, in a bay, not the north-west.
//   - The Talent pipeline is a unit wider at its east end (its corners there
//     are (33, 15) and (33, 22)), to make room for the castle town.
// The coast makes up every difference in area, so the realms keep their
// shares of the land.

import type { RealmMapSpec } from './map-realm-layout'

export const MAP_35_SPEC: RealmMapSpec = {
  island: { cx: 30, cy: 17.1, rx: 27.3, ry: 13.3 },
  realms: {
    'Field infrastructure': [
      [0, 0],
      [30, 0],
      [30, 12],
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
      [37, 34],
      [0, 34],
    ],
    'Policy and strategy': [
      [33, 15],
      [34, 13],
      [36, 11],
      [40, 11],
      [40, -2],
      [64, -2],
      [64, 20.5],
      [33, 19.5],
    ],
    'Technical research': [
      [33, 19.5],
      [64, 20.5],
      [64, 34],
      [37, 34],
      [33, 22],
    ],
  },
  anchorage: {
    realmStartsWith: 'Advocacy',
    // The cove, the landing at its foot and the quay along its east shore.
    box: [
      [30, -2],
      [40, -2],
      [40, 11],
      [36, 11],
      [34, 13],
      [33, 15],
      [30, 12],
    ],
    water: [
      [30, -2],
      [36, -2],
      [36, 11],
      [34, 13],
      [31, 13],
      [30, 12],
    ],
  },
  districtAnchors: {
    'Tools, databases and research infrastructure': [11, 8.5],
    'Operations and services': [18.5, 6],
    'Hubs and coworking': [20.5, 10.5],
    'Grantmakers and donor advisory': [25, 6.5],
    'Venture capital and incubators': [27.5, 11.5],
    'Field-building and local groups': [7, 12],
    'Introductory learning': [14, 12.5],
    'Policy and governance programs': [21, 14.5],
    'Technical research programs': [16, 19],
    'Career support and placement': [28, 18],
    'Foundational and explanatory': [10, 24],
    'News and commentary': [20, 26],
    'Forums and online communities': [33, 29],
    'Grassroots campaigns': [36, 6],
    'Professional advocacy and communication': [33, 11.5],
    'Macrostrategy and forecasting': [36.5, 16.5],
    'Policy research and think tanks': [47.5, 9.5],
    'Governments and multi-stakeholder bodies': [41.5, 14.5],
    'Standards, assurance and verification': [47.5, 19],
    'Policy advocacy and lobbying': [53.5, 15],
    'Conceptual and foundations research': [39.5, 28.5],
    'Alignment and control': [37.5, 23],
    'Interpretability and model understanding': [47, 28.5],
    'Evaluations and threat research': [45.5, 23.5],
    'Capabilities research': [52, 24],
  },
  roads: [
    // In from the arrival bay to the castle town: the places a newcomer
    // starts from and the policy programs to the north, the technical
    // programs (by far the largest district) to the south.
    {
      realm: 'Talent pipeline',
      from: [3.5, 15],
      fromShore: true,
      settleFrom: true,
      to: [33, 18.5],
      left: [
        'Field-building and local groups',
        'Introductory learning',
        'Policy and governance programs',
      ],
      right: ['Technical research programs'],
    },
  ],
  blocks: {
    // The Career Castle of the classic map: the town at the end of the road,
    // filling the east end of the realm up to the crossroads.
    'Career support and placement': { seed: [33, 18.5] },
    // The Forum: four entries, one built landmark in the corner of Media
    // between the south coast and the border with Conceptual research.
    'Forums and online communities': { seed: [35.6, 30.5] },
  },
  // A walk round the east side at leisure: out through Policy and strategy,
  // back through Technical research.
  trail: [
    'Macrostrategy and forecasting',
    'Governments and multi-stakeholder bodies',
    'Policy research and think tanks',
    'Policy advocacy and lobbying',
    'Standards, assurance and verification',
    'Evaluations and threat research',
    'Capabilities research',
    'Interpretability and model understanding',
    'Conceptual and foundations research',
    'Alignment and control',
  ],
  // From the foot of the cove to the corner of the castle town.
  boardwalk: [
    [32.5, 13],
    [33, 15],
  ],
  coastFeatures: [
    // The arrival bay on the west shore, between two capes.
    { toward: [3.5, 15], depth: -0.24, width: 8, atArrival: true },
    { toward: [3, 8.5], depth: 0.07, width: 6 },
    { toward: [4, 22.5], depth: 0.07, width: 6 },
    // The east cape, Capabilities Cove and the Forum's headland.
    // The north-east corner falls away to the sea, so Policy and strategy
    // keeps to the middle of the east side.
    { toward: [56, 4], depth: -0.22, width: 13 },
    { toward: [58, 18], depth: 0.07, width: 6 },
    { toward: [54, 27], depth: -0.05, width: 3 },
    { toward: [31, 31], depth: 0.05, width: 5 },
  ],
  landmarks: {
    arrivalHarbour: [3.5, 15],
    crossroads: [33, 18.5],
    // Where the boardwalk leaves the castle town for the ships.
    departureHarbour: [33, 15],
    controlDam: [36, 21],
  },
}
