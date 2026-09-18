// PROTOTYPE Map 3.5: the geography, in map grid units: x 0 to 60, y 0 to
// about 32, y increasing downward.
//
// It is Søren's background spec of 18 September 2026 (section 9,
// "Machine-readable boundaries") wherever Rob's sketch of the same day ("map
// sketch.png") does not say otherwise:
//   - From Søren: the Talent pipeline as a band that widens to the north-west
//     (his (2, 8) to (33, 16) along its north side, eased to start at (2, 10.4)
//     so Field infrastructure keeps a blunt west end; (2, 21) to (33, 21)
//     along its south), Media's border with Technical research (his (33, 21)
//     to (32, 34), started at (31, 21) so Technical research meets the castle),
//     the crossroads at (33, 18.5), and the district anchors, moved only as
//     far as the borders below make them.
//   - From the sketch: the castle town (Career support, still part of the
//     Talent pipeline) as a block at the east end of the band, in the middle
//     of the island; Policy and strategy as the band running east from it and
//     Technical research as the band below; Advocacy as a U of its own land
//     around a small cove beside the castle, where Søren has ships off
//     Policy's coast; Field infrastructure stopping at that cove; open sea in
//     the north-east; and the outline of the island.
//   - Neither: the road is a border inside the Talent pipeline, with
//     Field-building north of it so neither side is a thin strip, and the
//     arrival harbour slides along the west shore to balance the two sides.
//     East of the castle there are footpaths, not roads.
//
// Realm polygons overshoot the island and are cut off by its coast. District
// borders are not part of this: map-realm-layout.ts works them out from the
// anchors, and moves the coast in and out so every realm's land is in
// proportion to what it holds.

import type { Point, RealmMapSpec } from './map-realm-layout'

// The closed orgs' corner is drafted in the south-east of the frame, where
// the sketch has Technical research's coast. They keep their arrangement and
// move across as one group to the south-west corner, off Media's coast, which
// is drawn back there to make room (see the outline).
export const MAP_35_GRAVEYARD_MOVE: Point = [-48.5, 1]

export const MAP_35_SPEC: RealmMapSpec = {
  // The castle town: every stretch of coast is in sight of it.
  island: { cx: 30, cy: 18.5, rx: 27, ry: 13.5 },
  // Clockwise from where Field infrastructure meets the Talent pipeline on
  // the west shore. It runs straight across the mouth of the cove, and keeps
  // clear of the south-west corner of the frame.
  outline: [
    [4.4, 10.6],
    [4.6, 7],
    [7.5, 5],
    [11.1, 4.4],
    [14.4, 3.5],
    [16.8, 5.5],
    [19.8, 6.5],
    [23.8, 6.7],
    [26.4, 7.8],
    [28.1, 10],
    [30.3, 8],
    [33, 8],
    [34, 8.6],
    [41.9, 9.4],
    [44, 9.4],
    [45, 12],
    [46, 13.2],
    [49, 12.4],
    [53, 13],
    [55.5, 15.5],
    [57.5, 19],
    [57.8, 23.8],
    [54, 24.2],
    [55, 29.7],
    [53.9, 32],
    [44.3, 32],
    [42.1, 31.4],
    [38, 31],
    [33, 31],
    [31.2, 31.2],
    [28.1, 31.8],
    [21.6, 31.2],
    [17, 30.4],
    [14.5, 27.4],
    [12.5, 25.4],
    [6, 25],
    [3.4, 23.6],
    [3.1, 20.8],
    [5, 16.9],
    [4.1, 13.6],
  ],
  realms: {
    'Field infrastructure': [
      [-2, -2],
      [28, -2],
      [28, 10],
      [30, 11.5],
      [30, 15.2],
      [2, 10.4],
      [-2, 10],
    ],
    // The band, and the castle town at its east end.
    'Talent pipeline': [
      [-2, 10],
      [2, 10.4],
      [30, 15.2],
      [33, 16],
      [33, 21],
      [2, 21],
      [-2, 21],
    ],
    'Media and discourse': [
      [-2, 21],
      [2, 21],
      [31, 21],
      [32, 36],
      [-2, 36],
    ],
    'Policy and strategy': [
      [33, 16],
      [36, 16.5],
      [45.5, 16.5],
      [45.5, -2],
      [64, -2],
      [64, 25.2],
      [41, 23],
      [33, 21],
    ],
    'Technical research': [
      [31, 21],
      [33, 21],
      [41, 23],
      [64, 25.2],
      [64, 36],
      [32, 36],
    ],
  },
  anchorage: {
    realmStartsWith: 'Advocacy',
    // The U of land and the cove in it.
    box: [
      [28, -2],
      [45.5, -2],
      [45.5, 16.5],
      [36, 16.5],
      [33, 16],
      [30, 15.2],
      [30, 11.5],
      [28, 10],
    ],
    water: [
      [34, -2],
      [41.5, -2],
      [41.5, 13],
      [40.5, 14],
      [35, 14],
      [34, 13],
    ],
  },
  districtAnchors: {
    'Tools, databases and research infrastructure': [11, 8],
    'Operations and services': [17.5, 6.5],
    'Hubs and coworking': [21, 10.5],
    'Grantmakers and donor advisory': [25, 7.5],
    'Venture capital and incubators': [27.5, 12.5],
    'Field-building and local groups': [7, 12.5],
    'Introductory learning': [12.5, 13.5],
    'Policy and governance programs': [20, 14.5],
    'Technical research programs': [16, 18.5],
    'Career support and placement': [28, 18],
    'Foundational and explanatory': [10, 23.5],
    'News and commentary': [21, 26.5],
    'Forums and online communities': [28, 28.5],
    'Grassroots campaigns': [42, 13],
    'Professional advocacy and communication': [32, 12],
    'Macrostrategy and forecasting': [36.5, 18.5],
    'Policy research and think tanks': [49, 16],
    'Governments and multi-stakeholder bodies': [41, 18.3],
    'Standards, assurance and verification': [45.5, 21],
    'Policy advocacy and lobbying': [54.5, 19.5],
    'Conceptual and foundations research': [34.5, 28],
    'Alignment and control': [37, 23.5],
    'Interpretability and model understanding': [41.5, 28],
    'Evaluations and threat research': [46, 25.5],
    'Capabilities research': [51.5, 27.5],
  },
  roads: [
    // In from the arrival harbour to the west gate of the castle town, down
    // the middle of the band: the places a newcomer starts from and the policy
    // programs to the north, the technical programs (by far the largest
    // district) to the south.
    {
      realm: 'Talent pipeline',
      from: [3.5, 14.5],
      fromShore: true,
      settleFrom: true,
      to: [26.5, 18.25],
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
    // filling the east end of the band up to the crossroads.
    'Career support and placement': { seed: [33, 18.5] },
    // The Forum: four entries, one built landmark in the corner of Media
    // between the south coast and the border with Conceptual research.
    'Forums and online communities': { seed: [31.6, 30.5] },
  },
  // Out from the castle town at leisure: one path east through Policy and
  // strategy, one south-east through Technical research, each winding from
  // one side of its realm to the other.
  trails: [
    [
      'Career support and placement',
      'Macrostrategy and forecasting',
      'Governments and multi-stakeholder bodies',
      'Standards, assurance and verification',
      'Policy research and think tanks',
      'Policy advocacy and lobbying',
    ],
    [
      'Career support and placement',
      'Conceptual and foundations research',
      'Alignment and control',
      'Interpretability and model understanding',
      'Capabilities research',
      'Evaluations and threat research',
    ],
  ],
  // From the corner of the castle town to the foot of the cove.
  boardwalk: [
    [32.4, 15.8],
    [35.2, 13.9],
  ],
  coastFeatures: [
    // The arrival harbour on the west shore.
    { toward: [3.5, 14.5], depth: -0.14, width: 7, atArrival: true },
  ],
  landmarks: {
    arrivalHarbour: [3.5, 14.5],
    crossroads: [33, 18.5],
    departureHarbour: [33, 16],
    controlDam: [36, 21],
  },
}
