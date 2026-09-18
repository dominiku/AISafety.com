// PROTOTYPE Map 3.5: the geography. It started from Søren's background spec
// of 18 September 2026 and now follows Rob's sketch of the same day ("map
// sketch.png"), traced into map grid units: x 0 to 60, y 0 to about 32, y
// increasing downward.
//
// The sketch in words: a tall western block with Field infrastructure on top,
// the Talent pipeline as a band through its middle and Media below; the
// castle town (Career support, still part of the Talent pipeline) as a square
// at the east end of that band, in the middle of the island; two bands
// running out east from the castle, Policy and strategy above Technical
// research; and north of Policy's near end a U of Advocacy land around a
// small cove beside the castle. The north-east is open sea.
//
// Realm polygons overshoot the island and are cut off by its coast. District
// borders are not part of this: map-realm-layout.ts works them out from the
// anchors, and moves the coast in and out so every realm's land is in
// proportion to what it holds.
//
// Still different from Søren's spec: Advocacy is a small harbour with land of
// its own, not an anchorage off Policy's coast; the arrival harbour is on the
// west shore; the road is a border inside the Talent pipeline, with
// Field-building north of it; east of the castle there are footpaths, not
// roads.

import type { RealmMapSpec } from './map-realm-layout'

export const MAP_35_SPEC: RealmMapSpec = {
  // The castle town: every stretch of coast is in sight of it.
  island: { cx: 30, cy: 18.5, rx: 27, ry: 13.5 },
  // Clockwise from where Field infrastructure meets the Talent pipeline on
  // the west shore. It runs straight across the mouth of the cove.
  outline: [
    [4.3, 12.5],
    [4.7, 10.7],
    [6.9, 8.4],
    [7.8, 6.7],
    [11.1, 5.3],
    [14.4, 3.5],
    [16.8, 5.5],
    [19.8, 6.5],
    [23.8, 6.7],
    [26.4, 7.8],
    [28.1, 10],
    [30.3, 8.2],
    [32.9, 8.2],
    [34, 9.4],
    [41.9, 11.7],
    [43.4, 11.7],
    [44.3, 13.6],
    [45.2, 16.1],
    [49, 13.2],
    [53, 13.8],
    [55.5, 16],
    [57.5, 18.5],
    [58.2, 23],
    [56, 25],
    [55, 29.7],
    [53.9, 32],
    [44.3, 32],
    [42.1, 30.8],
    [41, 29.5],
    [35.6, 28.9],
    [31.4, 29.5],
    [31.2, 30.6],
    [28.1, 31.8],
    [21.6, 31.2],
    [18.1, 28.7],
    [11.1, 28],
    [5.4, 27.5],
    [3.1, 25.8],
    [4.5, 22.9],
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
      [30, 15.5],
      [26.5, 15.5],
      [-2, 13],
    ],
    // The band, and the castle town at its east end.
    'Talent pipeline': [
      [-2, 13],
      [26.5, 15.5],
      [33, 15.5],
      [33, 21],
      [26.5, 21],
      [-2, 23.5],
    ],
    'Media and discourse': [
      [-2, 23.5],
      [26.5, 21],
      [28.5, 21],
      [29, 29.5],
      [30, 36],
      [-2, 36],
    ],
    'Policy and strategy': [
      [33, 15.5],
      [36, 16.5],
      [45.5, 16.5],
      [45.5, -2],
      [64, -2],
      [64, 24],
      [41, 23],
      [33, 21],
    ],
    'Technical research': [
      [28.5, 21],
      [33, 21],
      [41, 23],
      [64, 24],
      [64, 36],
      [30, 36],
      [29, 29.5],
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
      [33, 15.5],
      [30, 15.5],
      [30, 11.5],
      [28, 10],
    ],
    water: [
      [34, -2],
      [41.5, -2],
      [41.5, 13],
      [40.5, 15],
      [35, 15],
      [34, 13.5],
    ],
  },
  districtAnchors: {
    'Tools, databases and research infrastructure': [8, 11],
    'Operations and services': [13, 7.5],
    'Hubs and coworking': [18.5, 12],
    'Grantmakers and donor advisory': [22, 8],
    'Venture capital and incubators': [27, 13],
    'Field-building and local groups': [7, 15.5],
    'Introductory learning': [13.5, 16],
    'Policy and governance programs': [21, 16.5],
    'Technical research programs': [15, 20.5],
    'Career support and placement': [29.75, 18.25],
    'Foundational and explanatory': [10, 26],
    'News and commentary': [21, 26.5],
    'Forums and online communities': [27, 28],
    'Grassroots campaigns': [42, 13],
    'Professional advocacy and communication': [32, 12],
    'Macrostrategy and forecasting': [36.5, 19],
    'Policy research and think tanks': [49, 19.5],
    'Governments and multi-stakeholder bodies': [41.5, 18.5],
    'Standards, assurance and verification': [43.5, 22],
    'Policy advocacy and lobbying': [54.5, 21],
    'Conceptual and foundations research': [34, 28],
    'Alignment and control': [34, 23.5],
    'Interpretability and model understanding': [44, 30],
    'Evaluations and threat research': [43.5, 26],
    'Capabilities research': [51, 28],
  },
  roads: [
    // In from the arrival harbour to the west gate of the castle town: the
    // places a newcomer starts from and the policy programs to the north,
    // the technical programs (by far the largest district) to the south.
    {
      realm: 'Talent pipeline',
      from: [3.5, 18],
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
    // filling the east end of the band.
    'Career support and placement': { seed: [33, 18.25] },
    // The Forum: four entries, one built landmark in the corner of Media
    // between the south coast and the border with Conceptual research.
    'Forums and online communities': { seed: [28.9, 29.8] },
  },
  // Out from the castle town at leisure, as in the sketch: one path east
  // through Policy and strategy, one south-east through Technical research.
  trails: [
    [
      [33, 18.6],
      [36.5, 20.2],
      [40.5, 21.6],
      [44.5, 20.6],
      [49, 18.6],
      [51.5, 19.6],
      [53.8, 22],
    ],
    [
      [31, 21],
      [32.6, 24.6],
      [36, 27.2],
      [40.5, 27.4],
      [45.5, 25.9],
      [50, 27.2],
    ],
  ],
  // From the corner of the castle town to the foot of the cove.
  boardwalk: [
    [32.4, 15.6],
    [35.2, 14.7],
  ],
  coastFeatures: [
    // The arrival harbour on the west shore.
    { toward: [3.5, 18], depth: -0.14, width: 7, atArrival: true },
  ],
  landmarks: {
    arrivalHarbour: [3.5, 18],
    crossroads: [29.75, 18.25],
    departureHarbour: [33, 15.5],
    controlDam: [36, 22.5],
  },
}
