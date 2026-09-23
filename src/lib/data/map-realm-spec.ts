// PROTOTYPE Map 3.5: the geography, in map grid units: x 0 to 60, y 0 to
// about 32, y increasing downward.
//
// The arrangement is Rob's second sketch, of 19 September 2026, drawn after
// Melissa's review of the first. Her point: Field infrastructure lay beside
// the start of the road, which said it matters mostly at the beginning of the
// journey, when it carries every stage of it. So it now lies along the south
// of the island, under the training country, the castle town and on to the
// edge of Technical research: the ground the rest stands on. To make room,
// Media and discourse moves to the north-west, Policy and strategy and
// Technical research move up the east side, and the Advocacy cove sits
// straight above the castle town.
//
// What is kept from Søren's background spec of 18 September and the first
// sketch: the Talent pipeline as a band running in from the west shore, with
// the road along the middle of it and the castle town (Career support) at
// its east end, in the very middle of the island, now as an uneven octagon
// the other realms' borders run out from like the spokes of a wheel; Policy and strategy
// and Technical research as the two bands running east from the castle, with
// the crossroads where their border meets it; Advocacy as a U of its own land
// around a small cove by the castle, with a boardwalk between them; footpaths,
// not roads, east of the castle; and the closed orgs in the south-west corner.
// The district anchors keep Søren's neighbors where the new borders allow.
//
// The districts expected to grow (video channels, in Foundational and
// explanatory) lie on the open coast, so the land can grow outward with them:
// nothing is held empty for them now.
//
// The borders between realms run in a few stretches at different angles, as
// the classic map's do: none is one long ruled line.
//
// Realm polygons overshoot the island and are cut off by its coast. District
// borders are not part of this: map-realm-layout.ts works them out from the
// anchors, and moves the coast in and out so every realm's land is in
// proportion to what it holds.

import type { Point, RealmMapSpec } from './map-realm-layout'

// The closed orgs' corner is drafted in the south-east of the frame. They
// keep their arrangement and move across as one group to the south-west
// corner, which the outline leaves as open sea below the Talent pipeline's
// shore and west of Field infrastructure's.
export const MAP_35_GRAVEYARD_MOVE: Point = [-48.5, 1]

// The castle town's ground: an octagon with its corners at the angles of a
// regular one but its sides of uneven length, so it does not look ruled. It is
// about two units across and sits around (0, 0); the layout scales it to the
// land the town needs. The Talent pipeline's polygon below ends in the same
// shape (this outline times 3.55, about the seed), so the town fills it.
const CASTLE_TOWN: Point[] = [
  [-0.28, -0.94],
  [0.62, -0.94],
  [1.04, -0.52],
  [1.04, 0.28],
  [0.3, 1.02],
  [-0.48, 1.02],
  [-0.98, 0.52],
  [-0.98, -0.24],
]

export const MAP_35_SPEC: RealmMapSpec = {
  // The castle town: every stretch of coast is in sight of it.
  island: { cx: 31.5, cy: 17.8, rx: 27, ry: 14 },
  // Clockwise from where Media meets the Talent pipeline on the west shore. It
  // runs straight across the mouth of the cove, and keeps clear of the
  // south-west corner of the frame.
  outline: [
    [4.6, 13.4],
    [2.6, 10.4],
    [2.6, 7],
    [5.5, 4.8],
    [10, 3.8],
    [15, 4.6],
    [21, 6.2],
    [26, 7],
    [27.4, 6.8],
    [28.8, 6.8],
    [34.6, 6.8],
    [36, 6.8],
    [37.4, 7.2],
    [43, 7.6],
    [48, 7.6],
    [52, 8.2],
    [55.4, 11],
    [56.8, 14.4],
    [56.6, 17.6],
    [57.6, 21.5],
    [56.4, 25.6],
    [54.4, 28],
    [50, 27.8],
    [46.6, 27.2],
    [44.2, 29.2],
    [39, 30.6],
    [33, 31.4],
    [27.5, 31.2],
    [22.5, 30.2],
    [17.8, 27.8],
    [14.6, 24.6],
    [13, 22.9],
    [9.6, 22.8],
    [6.2, 22.6],
    [5, 20],
    [5, 15],
  ],
  realms: {
    'Media and discourse': [
      [-2, -2],
      [26, -2],
      [25.2, 8.4],
      [26, 12.2],
      [28.4, 14.4],
      [22, 13.9],
      [15.5, 15],
      [9, 13.5],
      [2, 13.7],
      [-2, 13.7],
    ],
    // The band, and at its east end the castle town's octagon, which the
    // other realms' borders run out from.
    'Talent pipeline': [
      [-2, 13.7],
      [2, 13.7],
      [9, 13.5],
      [15.5, 15],
      [22, 13.9],
      [28.4, 14.4],
      [30.51, 14.46],
      [33.7, 14.46],
      [35.19, 15.95],
      [35.19, 18.79],
      [32.57, 21.42],
      [29.8, 21.42],
      [24.5, 22.5],
      [19, 21.2],
      [13, 22.8],
      [10.5, 27],
      [8, 36],
      [-2, 36],
    ],
    // Under the band and the castle town, as far as Technical research.
    'Field infrastructure': [
      [13, 22.8],
      [19, 21.2],
      [24.5, 22.5],
      [29.8, 21.42],
      [32.57, 21.42],
      [39.8, 23.1],
      [46.6, 26.6],
      [48, 36],
      [8, 36],
      [10.5, 27],
    ],
    'Policy and strategy': [
      [33.7, 14.46],
      [36.4, 13.4],
      [37.4, 10],
      [37.4, -2],
      [64, -2],
      [64, 17.8],
      [58, 17.4],
      [52.5, 18.6],
      [47, 17.1],
      [41, 18.7],
      [35.19, 17.8],
      [35.19, 15.95],
    ],
    'Technical research': [
      [35.19, 17.8],
      [41, 18.7],
      [47, 17.1],
      [52.5, 18.6],
      [58, 17.4],
      [64, 17.8],
      [64, 36],
      [48, 36],
      [46.6, 26.6],
      [39.8, 23.1],
      [32.57, 21.42],
      [35.19, 18.79],
    ],
  },
  anchorage: {
    realmStartsWith: 'Advocacy',
    // A small U of land and the cove in it, straight above the castle town,
    // sized for the 17 orgs it holds.
    box: [
      [26, -2],
      [37.4, -2],
      [37.4, 10],
      [36.4, 13.4],
      [33.7, 14.46],
      [30.51, 14.46],
      [28.4, 14.4],
      [26, 12.2],
      [25.2, 8.4],
    ],
    water: [
      [28.7, -2],
      [34.3, -2],
      [34.3, 11.4],
      [33.4, 12.4],
      [29.6, 12.4],
      [28.7, 11.4],
    ],
  },
  districtAnchors: {
    // Media: the port on the west shore, the beach along the north, and the
    // Forum in the corner by the cove.
    'Foundational and explanatory': [9, 8.5],
    'News and commentary': [18, 9.5],
    'Forums and online communities': [25.4, 11.6],
    'Professional advocacy and communication': [36, 10.4],
    'Grassroots campaigns': [27.4, 10.4],
    'Field-building and local groups': [8, 14.5],
    'Introductory learning': [14, 15],
    'Policy and governance programs': [22, 15.8],
    'Technical research programs': [16, 19.5],
    'Career support and placement': [31.5, 17.8],
    // Field infrastructure, west to east under the journey: what a newcomer
    // leans on first, then what careers and research lean on. The narrow
    // western tip goes to a district big enough to fill it (Operations), with
    // Hubs and Tools one above the other east of it.
    'Tools, databases and research infrastructure': [24.5, 28.4],
    'Operations and services': [18, 25],
    'Hubs and coworking': [24.5, 23.4],
    'Grantmakers and donor advisory': [34, 26.5],
    'Venture capital and incubators': [41.5, 26],
    'Macrostrategy and forecasting': [40.5, 15.3],
    'Governments and multi-stakeholder bodies': [40.5, 9.4],
    'Policy research and think tanks': [49, 12],
    'Standards, assurance and verification': [46.5, 16.2],
    'Policy advocacy and lobbying': [54.5, 14.5],
    'Alignment and control': [39.5, 20.6],
    'Evaluations and threat research': [49, 20],
    'Conceptual and foundations research': [45.5, 24.8],
    'Interpretability and model understanding': [54, 26.2],
    'Capabilities research': [55.8, 21.4],
  },
  roads: [
    // In from the arrival harbour to the west gate of the castle town, down
    // the middle of the band: the places a newcomer starts from and the policy
    // programs to the north, the technical programs (by far the largest
    // district) to the south.
    {
      realm: 'Talent pipeline',
      from: [5, 17.5],
      fromShore: true,
      settleFrom: true,
      to: [27.9, 17.8],
      // Long straight stretches with a few kinks at uneven spacing, as the
      // classic map's road runs: down toward the technical programs, along,
      // sharply up past the policy programs, and in to the gate.
      bends: [
        { at: 0.2, swing: -0.9 },
        { at: 0.46, swing: -1.1 },
        { at: 0.6, swing: 0.8 },
        { at: 0.85, swing: 0.4 },
      ],
      left: [
        'Field-building and local groups',
        'Introductory learning',
        'Policy and governance programs',
      ],
      right: ['Technical research programs'],
    },
  ],
  blocks: {
    // The Career Castle of the classic map, in the very middle of the island:
    // the hub of the wheel. The road runs in to it from the west, the
    // footpaths run out to the east, the boardwalk north to the cove, and
    // every realm but Media meets one of its eight sides. Its ground is the
    // Talent pipeline's.
    'Career support and placement': {
      seed: [31.5, 17.8],
      outline: CASTLE_TOWN,
    },
    // The Forum: four entries, one built landmark in the corner of Media
    // between the cove's land and the Talent pipeline.
    'Forums and online communities': { seed: [26, 12.2] },
  },
  // Out from the castle town at leisure, each in one easy line. Through Policy
  // and strategy: over Macrostrategy, through the think tanks and out to
  // Lobbying on the east tip, with the Governments district beside the way to
  // the north and Standards to the south, on the border with Evaluations.
  // Through Technical research: by Alignment, down through Conceptual research
  // and out to Capabilities, with Evaluations beside the way to the north and
  // Interpretability to the south.
  trails: [
    [
      'Career support and placement',
      'Macrostrategy and forecasting',
      'Policy research and think tanks',
      'Policy advocacy and lobbying',
    ],
    [
      'Career support and placement',
      'Alignment and control',
      'Conceptual and foundations research',
      'Capabilities research',
    ],
  ],
  // From the top of the castle town to the foot of the cove.
  boardwalk: [
    [31.5, 14.4],
    [31.5, 12.5],
  ],
  coastFeatures: [
    // The arrival harbour on the west shore.
    { toward: [5, 17.5], depth: -0.14, width: 7, atArrival: true },
  ],
  landmarks: {
    arrivalHarbour: [5, 17.5],
    crossroads: [35.19, 17.8],
    departureHarbour: [31.5, 14.46],
    controlDam: [38, 17.8],
  },
}
