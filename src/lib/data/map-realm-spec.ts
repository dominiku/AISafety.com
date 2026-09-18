// PROTOTYPE Map 3.5: the agreed geography, from Søren's background spec of
// 18 September 2026 (section 9, "Machine-readable boundaries"). Map grid
// units: x 0 to 60, y 0 to about 32, y increasing downward.
//
// Realm polygons deliberately overshoot the island and are cut off by its
// coast. District borders are not part of the spec: map-realm-layout.ts works
// them out from the anchors.
//
// Where this departs from the spec, to suit the layout the site works out:
//   - A road is always a border between districts (see `roads`), so districts
//     are arranged on either side of the three roads out of the crossroads,
//     and some anchors are moved to suit. In Policy that puts Governments
//     north of the road to the Advocacy port with the think tanks, and
//     Macrostrategy and Standards south of it, next to Technical research.
//     In the Talent pipeline it puts Field-building north of the road.
//   - The arrival harbour is on the west shore, in a bay, not the north-west.
//   - The Talent pipeline is a unit wider at its east end (its corners there
//     are (33, 15) and (33, 22), not (33, 16) and (33, 21)), to make room for
//     the castle town at the crossroads.
//   - The Policy/Technical border starts at the crossroads (33, 18.5) and
//     runs to (64, 21.5), not (64, 17), so the land south of the Policy road
//     is not a thin wedge. The coast makes up every such difference, so the
//     realms keep their shares of the land.

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
      [64, 21.5],
      [33, 18.5],
      [33, 15],
      [38, 11],
    ],
    'Technical research': [
      [33, 18.5],
      [64, 21.5],
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
    'Hubs and coworking': [24.5, 10.5],
    'Grantmakers and donor advisory': [31.5, 7],
    'Venture capital and incubators': [33.5, 10.5],
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
    'Macrostrategy and forecasting': [42, 18],
    'Policy research and think tanks': [45, 9],
    'Governments and multi-stakeholder bodies': [39, 13.5],
    'Standards, assurance and verification': [50, 17.5],
    'Policy advocacy and lobbying': [53, 11.5],
    'Conceptual and foundations research': [35, 25],
    'Alignment and control': [37, 22],
    'Interpretability and model understanding': [45.5, 26.5],
    'Evaluations and threat research': [45, 20.5],
    'Capabilities research': [49, 24],
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
    // On through Policy to the Advocacy port, beside the anchorage. Lobbying
    // is on the shore north of the port, next to the advocacy ships.
    {
      realm: 'Policy and strategy',
      from: [33, 18.5],
      to: [56.3, 12.8],
      toShore: true,
      settleTo: true,
      left: [
        'Policy research and think tanks',
        'Governments and multi-stakeholder bodies',
        'Policy advocacy and lobbying',
      ],
      right: [
        'Macrostrategy and forecasting',
        'Standards, assurance and verification',
      ],
    },
    // South-east into Technical research, along the crest of the Control Dam
    // (Alignment and control lies across the road there), with threats and
    // capabilities to its north-east and theory to its south-west.
    // Interpretability lies across its far end, on the south-east shore.
    {
      realm: 'Technical research',
      from: [33, 18.5],
      to: [46.8, 30],
      toShore: true,
      settleTo: true,
      left: ['Evaluations and threat research', 'Capabilities research'],
      right: ['Conceptual and foundations research'],
    },
  ],
  blocks: {
    // The Career Castle of the classic map: the town at the end of the road,
    // filling the east end of the realm up to the crossroads.
    'Career support and placement': { seed: [33, 18.5] },
    // The Forum: four entries, one built landmark in the corner of Media
    // between the south coast and the border with Conceptual research.
    'Forums and online communities': { seed: [32.4, 30.5] },
    // Small and on an open stretch of shore, where a share of the open land
    // comes out as a strip along the coast: a village at the end of the road.
    'Interpretability and model understanding': { seed: [45.5, 26.5] },
  },
  coastFeatures: [
    // The arrival bay on the west shore, between two capes.
    { toward: [3.5, 15], depth: -0.24, width: 8 },
    { toward: [3, 8.5], depth: 0.07, width: 6 },
    { toward: [4, 22.5], depth: 0.07, width: 6 },
    // The Advocacy port, sheltered by a cape to its north.
    { toward: [56.3, 12.8], depth: -0.1, width: 5 },
    { toward: [52, 7], depth: 0.08, width: 5 },
    // The east cape, Capabilities Cove and the Forum's headland.
    { toward: [58, 19.5], depth: 0.07, width: 6 },
    { toward: [52, 26], depth: -0.09, width: 3 },
    { toward: [31, 31], depth: 0.05, width: 5 },
  ],
  landmarks: {
    arrivalHarbour: [3.5, 15],
    crossroads: [33, 18.5],
    departureHarbour: [56.3, 12.8],
    controlDam: [36, 21],
  },
}
