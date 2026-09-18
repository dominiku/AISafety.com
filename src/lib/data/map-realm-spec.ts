// PROTOTYPE Map 3.5: the agreed geography, from Søren's background spec of
// 18 September 2026 (section 9, "Machine-readable boundaries"). Map grid
// units: x 0 to 60, y 0 to about 32, y increasing downward.
//
// Realm polygons deliberately overshoot the island and are cut off by its
// coast. Their straight edges are the spec's own and are sized so each realm's
// share of the land matches its share of the entries. District borders are not
// part of the spec: map-realm-layout.ts works them out from the anchors.

import type { RealmMapSpec } from './map-realm-layout'

export const MAP_35_SPEC: RealmMapSpec = {
  island: { cx: 30, cy: 17.1, rx: 27.3, ry: 13.3 },
  realms: {
    'Field infrastructure': [
      [0, 0],
      [36, 0],
      [38, 11],
      [33, 16],
      [2, 8],
      [0, 8],
    ],
    'Talent pipeline': [
      [0, 8],
      [2, 8],
      [33, 16],
      [33, 21],
      [2, 21],
      [0, 21],
    ],
    'Media and discourse': [
      [0, 21],
      [2, 21],
      [33, 21],
      [32, 34],
      [0, 34],
    ],
    'Policy and strategy': [
      [36, 0],
      [64, 0],
      [64, 17],
      [33, 19],
      [33, 16],
      [38, 11],
    ],
    'Technical research': [
      [33, 19],
      [64, 17],
      [64, 34],
      [32, 34],
      [33, 21],
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
    'Field-building and local groups': [8, 16],
    'Introductory learning': [11, 11.5],
    'Policy and governance programs': [19, 13.5],
    'Technical research programs': [19, 18],
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
  landmarks: {
    arrivalHarbour: [6, 11],
    crossroads: [33, 18.5],
    departureHarbour: [56.5, 14],
    controlDam: [36, 21],
  },
}
