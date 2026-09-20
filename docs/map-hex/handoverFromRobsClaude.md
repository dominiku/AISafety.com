# Map 4.0 handover: reply from Rob's Claude

From: Rob's Claude Code session. To: Søren and Søren's Claude session.
Date: Sunday 20 September 2026. Reply to `whatIsNeededFromRobsClaude.md`.

**The one thing to know first:** the background is not an edited Illustrator file. It is drawn by code in the website repo, as an SVG, from a small hand-editable tile map. The map is an isometric board of hexagonal tiles. To change the geography you edit a text grid and re-run a script. Everything is on branch `map3.5-hex` on Dom's `vps` remote.

## 1. Corrections to sections 2 and 3

### Section 2 (what Søren has)

- **NewX and NewY do not need regenerating for this map.** The hex view ignores them. It reads only Realm, District and Scale from the fork, and packs each district's logos onto that district's tiles itself. So the art and the org coordinates cannot disagree. Rob intends to place logos by hand later; that would be a new step (see Open questions).
- **The layout is neither v2 nor v3.** It began from the spec, was re-traced from Rob's own sketch on 18 September, changed after Melissa's review on 19 September, and was then rebuilt on a hex grid. See "Deviations" under 4C.
- **"Decisions already made": these are drawn differently, and you should treat each as open rather than settled either way:**
  - Field infrastructure (Support Shoreline) runs along the SOUTH coast, not the north. Reason: Melissa's review on 19 September. Beside the start of the road it read as "only for the start of the journey"; along the south it lies under every realm. The board is also seen from the south, so low beach in front hides nothing, while low ground at the back would be hidden by the mountains.
  - Advocacy is a cove (Advocacy Anchorage) cut into the NORTH coast straight above the castle, with moored boats and one ship leaving, not ships off the east coast. Reason: Rob's sketch; it puts Advocacy beside the castle and gives it a road.
  - Gone Graveyard is in the SOUTH-WEST corner, drawn as a ships' graveyard on open water (gravestones from the original map plus wrecks), not the south-east. Reason: the south-east is the Research Range's high ground.
  - Capabilities is a walled high plateau (working name Capabilities Crag), not a cove. It reuses the original skull-mountain art, ringed by dark peaks.
  - There is one road from the arrival harbor to the castle, and at the castle's north-east side it splits three ways (to Persuasion Pier, to Think-Tank Town, to the cave in Theory Thermals). Rob asked for this crossroads on 20 September. It departs from "one main road that forks, no other roads" only in having three branches.
  - Drawn as decided: arrival harbor with lighthouse on the west tip (a lit beam on an arriving ship, no flag yet), Career Castle at the centre, Control Dam (a reservoir with a masonry dam and spillway), The Forum as a Roman forum, compass rose in the north-east corner round the four map buttons, west to east as newcomer to practitioner.
  - "Fewer mountains": mountains are now only in the Research Range.
- **Working names differ from your list in places.** Theory Thicket became Theory Thermals (Rob: nothing grows that thick that high; it is hot springs where the river rises). The full current list is in the data block in section 4.
- **District counts:** the render snapshot (published, not hidden, with a District) has 373 records: 369 with a District (339 on land, 30 in the graveyard), all placed, plus the 4 map buttons. These are live counts, so lower than your Airtable counts, which include pipeline entries. Counts per district are in the data block.

### Section 3 (what you believe about Rob's side)

1. Unknown to me whether Rob and Dom tested editing the `.ai`. In my sessions no `.ai` file was ever opened or edited. Rob confirms: Claude generated the SVG; it can be pulled into Illustrator or Figma when needed.
2. Neither v2 nor v3 (see above).
3. What was produced: TypeScript code that generates the background as an SVG string, a text tile map, tests, render scripts, and exports (SVG, PNG, JSON).
4. Location: branch `map3.5-hex` on the `vps` remote (`https://git-aisafety.domhome.priv.pl/aisafety.git`). Ask Dom for access if you do not have it.
5. Feasibility outcome: a prototype good enough to judge the idea and brief Damien, yes, entirely with Claude. Finished illustration, no (see 4D).
6. **Wrong.** All of the work is website code, behind a toggle on `/map`. The Airtable is untouched: the site only reads the fork.

## 2. Answers

### A. Files

- Everything is in the repo on `vps/map3.5-hex`. **The single current best is `docs/map-hex/hex-map-bare.svg`** (background only, no logos, 2485 x 1355 px, about 770 KB). `hex-map-current.svg/.png` is the same with white discs where logos go.
- The editable source is the code and the tile map, not a drawing file: see the manifest.
- Original art: `public/images/map-1.5.1.svg` (the classic map as SVG, already in the repo) and `public/images/map.webp`. The landmark sprite `public/images/map35-landmarks.svg` was lifted from `map-1.5.1.svg` by script, one `<symbol>` per landmark; Melissa's art inside it is never edited. I have no `.ai` or Photoshop files.
- Scripts: `scripts/map-hex/`. There are no saved prompts; the working rules learnt along the way are in section 2E and 2D.

### B. Structure of the art

- Original `.ai`: unknown. I only ever saw the exported `map-1.5.1.svg`, which is vector throughout.
- New file: one SVG, all vector, no raster. It has no named layers; it is drawn in this order: sea (faint honeycomb, shallows following the coast), then land level by level from the lowest plateau up (cliff faces, ground as one outline per district, flat cover such as fields, rim, dark border, river and road pieces, falls, bridges), then standing art back to front (trees, houses, hills, dunes, landmarks, buildings, peaks), then boats, compass, title.
- Reused from the classic map: palette, castle, lighthouse, forest, training town, cave, range, skull mountain, gravestones, sailboat, rowboat, houses, cottages, trees, compass. New and code-drawn: tiles and cliffs, river, moat, road, ramps, bridges, dam and spillway, reservoir, volcano and lava, hot springs and geysers, escarpment, beaches, stilt village, thatch houses, palms, dunes, hills, reeds, fishing village, farmsteads, capitol, school, forum, piers, wrecks, light beam, wakes.
- Every district has ground and most have cover. Without a distinctive drawing of their own: Campaign Cutters, Community Commons, Verification Vale, Hub Hamlet (plain hamlet houses), Service Sands beyond palms and huts.
- Coordinate mapping: map units are x 0 to 60, y 0 to 32, y downward, the same frame as the Airtable x / y. The SVG is 2485 px wide, so 1 unit = 41.42 px. The island is NOT the spec's ellipse. It is whatever tiles are painted: land spans x 0.3 to 56.7, y 3.9 to 28.4. Tile size (middle to corner) is 2.05 units, set by the castle: the keep plus six tiles hold Career support's 13 logos.

### C. Boundaries as data

- They exist: `docs/map-hex/hex-map-geography.json`, regenerated by `node scripts/map-hex/export.mjs <out.json>`. In map units it holds: the tile map; every land tile (column, row, district code, height, center, six corners); per district its tiles, anchor, height, logo count and border as line segments; per realm its districts and anchor; landmarks; buildings; road and river centre lines with widths; river mouths, piers, the road's start; spring, bridges, dams, lake; ships; and every logo's computed position.
- All positions are "as drawn": the board is tilted and high ground is lifted up the page by height x 0.4 units. A district at height 4 is drawn 1.6 units higher than its flat-board place.
- Realm borders are not stored separately: a realm is the union of its districts.
- Version: neither v2 nor v3. Deviations from the spec, with reasons, are in section 1. One more: Evaluations and threat research has no tiles of its own. Its logos stand on the leaning rock face of the escarpment at the front of Control Dam's ground (`onSlopesOf: 'Al'`). This also makes it a border home between two districts, as the spec wanted for hybrids.

### D. What Claude could and could not do

- Worked well: all geometry (hex grid, heights, cliffs, occlusion), packing logos into districts with no overlaps, rivers and roads joined up from marked tiles, tests that fail when a logo has no room, quick what-if changes (swap two districts, give one a tile), simple flat objects in the classic style (houses, trees, piers, boats, a dam), reuse of the original art as symbols.
- Poor or slow: anything that must look hand-illustrated (the volcano, thermal pools, waterfalls, the escarpment took many rounds and are still plain); organic shapes (a natural lake shore was abandoned for a whole-tile reservoir); visual seams at tile joins, which took a renderer rewrite (the fix: draw anything that belongs to a region as one shape, never tile by tile); scale of objects (first tries were far too big; a tree is 0.5 x 1.0 units, a house about 1.0 x 1.3). Claude cannot judge a picture at a glance: every change needs a render and a zoomed crop.
- Tool chain: Node 20, `npm install`, nothing else. No Illustrator, Inkscape or paid tool. Renders use `sharp` and `jiti`, already in the repo's dependencies. Figma was tried through a community bridge plugin and is not needed.
- Hours left to a prototype worth showing Damien: it can be shown now. 4 to 8 hours would cover: confirm or move the contested placements in section 1, hand-place logos in crowded districts, the start flag, tooltips. Leave to Damien: all illustration polish, the tile edges and cliffs' look, the color tones per district (all flagged in code as placeholders for Melissa), waterfalls, terrain texture.

### E. How to resume

Setup, once:

```bash
git clone https://git-aisafety.domhome.priv.pl/aisafety.git && cd aisafety && git checkout map3.5-hex && npm install
```

Make one change and re-export (no credentials needed; the scripts use the snapshot `scripts/map-hex/orgs.json`):

1. Open `src/lib/data/map-hex-spec.ts`. The grid at the top is the map: two letters per tile, `..` is sea, every second column sits half a tile lower. The file's header explains the marks (`~` river, `=` road, `!` landmark, `^` escarpment, `#` bridge). To move a border, change a tile's letters. Heights, covers and names are in the list below the grid.
2. Check room: `node scripts/map-hex/need.mjs`. The last line must be `{}` (no district short of room).
3. Render: `node scripts/map-hex/render.mjs out.png` (add `--bare` for no logos, `--labels` for tile names, `--crop x,y,w,h` in pixels of the 2485-wide image). It writes `out.svg` beside the PNG: that SVG is the export.
4. Zoom in on a spot: `node scripts/map-hex/zoom.mjs out.svg zoom.png x,y,w,h 4` (keep the scale at 5 or less).
5. Boundaries: `node scripts/map-hex/export.mjs docs/map-hex/hex-map-geography.json`.
6. Tests: `npx vitest run src/lib/data/map-hex`. They include "room for every logo" against the real spec.
7. Other tools: `crowd.mjs` (share of each district's ground under logos), `sym.mjs <symbol> out.png` (one landmark with a grid, to read off points), `fetch.mjs orgs.json` (refresh the snapshot; needs `AIRTABLE_IA_FORK_TOKEN` and `AIRTABLE_IA_FORK_BASE_ID` in `.env.local`, from Dom or Rob).

In the browser: `npm run dev`, open `/map`, choose "Hex work". This tab needs the two fork variables above; without them only the production map shows.

The four tabs on `/map` are development scaffolding: "UI work" is the production map and data (must stay unchanged), "IA work" is the abstract realm layout, "Art work" the first classic-style island; both are superseded by "Hex work". Hex still imports the palette, themes and scatter from `realmArtBackdrop.ts` and the names helper from `map-realms.ts`, so those files cannot simply be deleted. Reducing the toggle to production and hex is a small, separate clean-up and has not been done.

Known problems, dead ends, half-finished:

- Dead ends, do not retry: a natural-shaped reservoir; a road that fades out; a road over the dam; tile-sized piers; beaches sloping out past the tiles; an inset stilt platform; per-tile seam patches; decorative bulges on road edges.
- Constraint to respect: high ground hides part of the tile behind it (to the north), which takes logo room there. Keep the Range's back row at height 5 or lower; check `need.mjs` after every repaint. Anything in the northern sea must clear the title (x 19.3 to 40.7, down to y 3.45).
- Open: no start flag yet; no tooltips; four tabs cramped on narrow screens; the Forum's three tiles are full; Theory Thermals is crowded (more scenery needs more tiles); the delta's river is faint on its mint ground; escarpment and volcano slopes lean past their tiles on purpose; the unused `+` pier-deck mark and `road.fades` remain in the code; mobile not looked at; zoom tiers are switched off in the hex view.
- Not production-ready: it is a prototype behind a toggle, reading a forked base. It is not merged to `main` and should not be without review by Bryce and Melissa.

### F. Availability

Rob has limited availability until November, but checks Discord and is fine with short questions and small updates there. He would like to see the map before it goes to Damien. He is also open to trying to build a **map editor** in future (paint tiles, set heights, drag logos, in the browser, instead of editing the text grid); the tile map format was designed so that this is possible.

## 3. File manifest

| File                                                           | Format       | Purpose                                                                                   | Location                                             | Status                            |
| -------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------- |
| `src/lib/data/map-hex-spec.ts`                                 | TypeScript   | THE geography: tile map, districts, heights, covers, features, working names. Hand-edited | repo, `map3.5-hex`                                   | current                           |
| `src/lib/data/map-hex.ts` (+ test)                             | TypeScript   | Hex maths, tilt and lift, tile-map reader                                                 | repo                                                 | current                           |
| `src/lib/data/map-hex-layout.ts` (+ test)                      | TypeScript   | Logo packing, river, road, moat, lake, piers, ships, `districtAt`                         | repo                                                 | current                           |
| `src/app/map/hexBackdrop.ts`                                   | TypeScript   | Draws the SVG                                                                             | repo                                                 | current                           |
| `src/app/map/hexFeatures.ts`, `hexBuildings.ts`                | TypeScript   | Individual drawings (volcano, dam, houses, capitol...)                                    | repo                                                 | current                           |
| `src/app/map/realmArtBackdrop.ts`, `src/lib/data/map-art-*.ts` | TypeScript   | Art work view; hex reuses its palette and scatter                                         | repo                                                 | superseded, still needed          |
| `src/lib/data/map-realm-*.ts`, `src/app/map/realmBackdrop.ts`  | TypeScript   | IA work view (polygons, v-spec descendants)                                               | repo                                                 | superseded                        |
| `public/images/map35-landmarks.svg`                            | SVG sprite   | Classic landmarks as symbols                                                              | repo                                                 | current                           |
| `public/images/map-1.5.1.svg`, `map.webp`                      | SVG, WebP    | The classic map                                                                           | repo                                                 | reference                         |
| `scripts/map-hex/*.mjs`                                        | Node scripts | render, need, crowd, zoom, sym, crop, fetch, export                                       | repo                                                 | current                           |
| `scripts/map-hex/orgs.json`                                    | JSON         | Snapshot of the fork's published orgs (19 September)                                      | repo                                                 | current, refresh with `fetch.mjs` |
| `docs/map-hex/hex-map-bare.svg` / `.png`                       | SVG, PNG     | **Current best background**, no logos                                                     | repo                                                 | draft (prototype)                 |
| `docs/map-hex/hex-map-current.svg` / `.png`                    | SVG, PNG     | Same with logo discs                                                                      | repo                                                 | draft                             |
| `docs/map-hex/hex-map-geography.json`                          | JSON         | Boundaries, anchors, paths, positions in map units                                        | repo                                                 | current                           |
| `docs/map-hex/handoverFromRobsClaude.md`                       | Markdown     | This file                                                                                 | repo                                                 | final                             |
| branches `map3.5-art`, `map3.5-explorer`, `map3.5-mapfirst`    | git          | Earlier views and Dom's explorer UI work                                                  | Rob's laptop only (explorer work is on `vps/map3.5`) | superseded / separate             |

## 4. Data blocks

View: tile size 2.05 (middle to corner), squash 0.66, lift 0.4 units per level, tile 0,0 drawn at (2.33, 2.6). Board 19 columns x 12 rows, flat-topped hexes, odd columns half a tile lower.

Tile map (columns 0 to 18, rows 0 to 11):

```
# 0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17  18
  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..
  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  Th  ..  ..  ..
  ..  ..  Ne  Ne~ Ne  Fo~ Fo  Fo  Fo  Gr  cv  cv  Go  Go  Th  Th= Th  ..  ..
  ..  ..  Ne  Ne~ Ne~ Fo~ Fo! Fo  Fr  Gr  cv  Pa  Ma  Go= Th= Th! Lo  Lo  ..
  ..  ..  Ne~ Ne  Ne  Fo  Fo~ Fo~ Fr  Gr  Pa= Pa= Ma  Ma= Ma  St  Lo  ..  ..
  ..  In! In  In  Fb  Pp  Pp  Tp  Fr~ Ca~ Ca  Ca= Ma= Ma  St  Co  Co  cr  ..
  ..  hb  hb  In= Fb= Pp= Pp= Tp= Tp= Ca= kp  Ca~ Al= Al= Al  Co  Ip  Ip  ..
  ..  In  hb  In  Fb  Tp  Tp  Tp  Tp  Hu  Ca  Al~ Al~ Al# Co~ Co  Co  Cp  ..
  ..  ..  In  Tp  Tp  Tp  Tp  Hu  Hu  Gm  Gm  Vc  Vc~ Al= Co= Co! Cp  Cp! ..
  Gy  Gy  ..  ..  Op  Op  Op  Op  Gm  Gm  Gm  Gm  Vc  Al^ Al^ Gm  Cp  ..  ..
  Gy  Gy! Gy  ..  ..  ..  ..  To  To  To  Gm  Gm  Gm  Gm  Gm  ..  ..  ..  ..
  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..  ..
```

Features: `cv` cove (Advocacy Anchorage), `hb` arrival harbor, `kp` castle keep, `cr` volcano crater. Reservoir: tiles 12,7 and 11,7.

Realms (anchor = mean of district anchors, map units, as drawn):

```json
[
  {
    "realm": "Media and discourse",
    "name": "Discourse Delta",
    "anchor": [19.96, 10.03],
    "districts": ["Fo", "Ne", "Fr"]
  },
  {
    "realm": "Advocacy and public engagement",
    "name": "Advocacy Anchorage",
    "anchor": [32.57, 10.69],
    "districts": ["Gr", "Pa"]
  },
  {
    "realm": "Talent pipeline",
    "name": "Pipeline Path",
    "anchor": [19.33, 16.61],
    "districts": ["In", "Fb", "Pp", "Tp", "Ca"]
  },
  {
    "realm": "Field infrastructure",
    "name": "Support Shoreline",
    "anchor": [29.49, 23.45],
    "districts": ["Op", "Hu", "To", "Gm", "Vc"]
  },
  {
    "realm": "Policy and strategy",
    "name": "Policy Plains",
    "anchor": [46, 9.76],
    "districts": ["Go", "Ma", "Th", "St", "Lo"]
  },
  {
    "realm": "Technical research",
    "name": "Research Range",
    "anchor": [49.05, 17.37],
    "districts": ["Al", "Ev", "Co", "Ip", "Cp"]
  },
  {
    "realm": "No longer active",
    "name": "Gone Graveyard",
    "anchor": [4.79, 25.57],
    "districts": ["Gy"]
  }
]
```

Districts (h = height in levels; n = logos in the 19 September snapshot; tiles as [column,row]):

```json
[
  {
    "code": "Fo",
    "district": "Foundational and explanatory",
    "name": "Foundation Forest",
    "h": 1.5,
    "n": 24,
    "anchor": [21.39, 9.5],
    "tiles": [
      [6, 2],
      [8, 2],
      [5, 2],
      [7, 2],
      [6, 3],
      [5, 3],
      [7, 3],
      [6, 4],
      [5, 4],
      [7, 4]
    ]
  },
  {
    "code": "Ne",
    "district": "News and commentary",
    "name": "Commentary Coast",
    "h": 1,
    "n": 30,
    "anchor": [11.55, 9.62],
    "tiles": [
      [2, 2],
      [4, 2],
      [3, 2],
      [2, 3],
      [4, 3],
      [3, 3],
      [2, 4],
      [4, 4],
      [3, 4]
    ]
  },
  {
    "code": "Fr",
    "district": "Forums and online communities",
    "name": "The Forum",
    "h": 2.5,
    "n": 4,
    "anchor": [26.93, 10.97],
    "tiles": [
      [8, 3],
      [8, 4],
      [8, 5]
    ]
  },
  {
    "code": "Gr",
    "district": "Grassroots campaigns",
    "name": "Campaign Cutters",
    "h": 1,
    "n": 8,
    "anchor": [30, 10.4],
    "tiles": [
      [9, 2],
      [9, 3],
      [9, 4]
    ]
  },
  {
    "code": "Pa",
    "district": "Professional advocacy and communication",
    "name": "Persuasion Pier",
    "h": 2.5,
    "n": 9,
    "anchor": [35.13, 10.97],
    "tiles": [
      [11, 3],
      [10, 4],
      [11, 4]
    ]
  },
  {
    "code": "In",
    "district": "Introductory learning",
    "name": "Learning Landing",
    "h": 0.5,
    "n": 10,
    "anchor": [8.92, 17.63],
    "tiles": [
      [2, 5],
      [1, 5],
      [3, 5],
      [3, 6],
      [1, 7],
      [3, 7],
      [2, 8]
    ]
  },
  {
    "code": "Fb",
    "district": "Field-building and local groups",
    "name": "Community Commons",
    "h": 1.5,
    "n": 7,
    "anchor": [14.63, 16.06],
    "tiles": [
      [4, 5],
      [4, 6],
      [4, 7]
    ]
  },
  {
    "code": "Pp",
    "district": "Policy and governance programs",
    "name": "Statecraft School",
    "h": 2,
    "n": 10,
    "anchor": [19.24, 15.27],
    "tiles": [
      [6, 5],
      [5, 5],
      [6, 6],
      [5, 6]
    ]
  },
  {
    "code": "Tp",
    "district": "Technical research programs",
    "name": "Fellowship Fields",
    "h": 2.5,
    "n": 30,
    "anchor": [20.78, 18.64],
    "tiles": [
      [7, 5],
      [8, 6],
      [7, 6],
      [6, 7],
      [8, 7],
      [5, 7],
      [7, 7],
      [4, 8],
      [6, 8],
      [3, 8],
      [5, 8]
    ]
  },
  {
    "code": "Ca",
    "district": "Career support and placement",
    "name": "Career Castle",
    "h": 3,
    "n": 13,
    "anchor": [33.08, 15.46],
    "tiles": [
      [10, 5],
      [9, 5],
      [11, 5],
      [9, 6],
      [11, 6],
      [10, 7]
    ]
  },
  {
    "code": "Op",
    "district": "Operations and services",
    "name": "Service Sands",
    "h": 1,
    "n": 11,
    "anchor": [19.24, 23.88],
    "tiles": [
      [4, 9],
      [6, 9],
      [5, 9],
      [7, 9]
    ]
  },
  {
    "code": "Hu",
    "district": "Hubs and coworking",
    "name": "Hub Hamlet",
    "h": 1,
    "n": 8,
    "anchor": [26.93, 20.95],
    "tiles": [
      [9, 7],
      [8, 8],
      [7, 8]
    ]
  },
  {
    "code": "To",
    "district": "Tools, databases and research infrastructure",
    "name": "Toolshed Terrace",
    "h": 1.4,
    "n": 9,
    "anchor": [26.93, 26.26],
    "tiles": [
      [8, 10],
      [7, 10],
      [9, 10]
    ]
  },
  {
    "code": "Gm",
    "district": "Grantmakers and donor advisory",
    "name": "Donor Dunes",
    "h": 1,
    "n": 28,
    "anchor": [36.15, 24.46],
    "tiles": [
      [10, 8],
      [9, 8],
      [8, 9],
      [10, 9],
      [9, 9],
      [11, 9],
      [15, 9],
      [10, 10],
      [12, 10],
      [14, 10],
      [11, 10],
      [13, 10]
    ]
  },
  {
    "code": "Vc",
    "district": "Venture capital and incubators",
    "name": "Venture Valley",
    "h": 2,
    "n": 9,
    "anchor": [38.2, 21.72],
    "tiles": [
      [12, 8],
      [11, 8],
      [12, 9]
    ]
  },
  {
    "code": "Go",
    "district": "Governments and multi-stakeholder bodies",
    "name": "Capitol Court",
    "h": 3,
    "n": 6,
    "anchor": [41.28, 7.65],
    "tiles": [
      [12, 2],
      [13, 2],
      [13, 3]
    ]
  },
  {
    "code": "Ma",
    "district": "Macrostrategy and forecasting",
    "name": "Foresight Foothills",
    "h": 3.5,
    "n": 19,
    "anchor": [41.28, 11.36],
    "tiles": [
      [12, 3],
      [12, 4],
      [14, 4],
      [13, 4],
      [12, 5],
      [13, 5]
    ]
  },
  {
    "code": "Th",
    "district": "Policy research and think tanks",
    "name": "Think-Tank Town",
    "h": 2.5,
    "n": 23,
    "anchor": [47.94, 7.26],
    "tiles": [
      [15, 1],
      [14, 2],
      [16, 2],
      [15, 2],
      [14, 3],
      [15, 3]
    ]
  },
  {
    "code": "St",
    "district": "Standards, assurance and verification",
    "name": "Verification Vale",
    "h": 3,
    "n": 6,
    "anchor": [46.92, 12.53],
    "tiles": [
      [15, 4],
      [14, 5]
    ]
  },
  {
    "code": "Lo",
    "district": "Policy advocacy and lobbying",
    "name": "Lobby Landing",
    "h": 2,
    "n": 11,
    "anchor": [52.56, 10],
    "tiles": [
      [16, 3],
      [17, 3],
      [16, 4]
    ]
  },
  {
    "code": "Al",
    "district": "Alignment and control",
    "name": "Control Dam",
    "h": 4,
    "n": 21,
    "anchor": [41.62, 18.58],
    "tiles": [
      [12, 6],
      [14, 6],
      [13, 6],
      [12, 7],
      [11, 7],
      [13, 7],
      [13, 8],
      [14, 9],
      [13, 9]
    ]
  },
  {
    "code": "Ev",
    "district": "Evaluations and threat research",
    "name": "Evaluation Escarpment",
    "h": 4,
    "n": 10,
    "anchor": null,
    "tiles": [],
    "onSlopesOf": "Al (the leaning faces of tiles 13,9 and 14,9)"
  },
  {
    "code": "Co",
    "district": "Conceptual and foundations research",
    "name": "Theory Thermals",
    "h": 5,
    "n": 21,
    "anchor": [48.45, 16.71],
    "tiles": [
      [16, 5],
      [15, 5],
      [15, 6],
      [14, 7],
      [16, 7],
      [15, 7],
      [14, 8],
      [15, 8]
    ]
  },
  {
    "code": "Ip",
    "district": "Interpretability and model understanding",
    "name": "Circuit Crater",
    "h": 6.5,
    "n": 6,
    "anchor": [53.07, 14.65],
    "tiles": [
      [16, 6],
      [17, 6]
    ]
  },
  {
    "code": "Cp",
    "district": "Capabilities research",
    "name": "Capabilities Crag",
    "h": 6,
    "n": 6,
    "anchor": [53.07, 19.53],
    "tiles": [
      [17, 7],
      [16, 8],
      [17, 8],
      [16, 9]
    ]
  },
  {
    "code": "Gy",
    "district": "No longer active",
    "name": "Gone Graveyard",
    "h": 0,
    "n": 30,
    "anchor": [4.79, 25.57],
    "tiles": [
      [0, 9],
      [1, 9],
      [0, 10],
      [2, 10],
      [1, 10]
    ]
  }
]
```

Landmarks and key points (map units, as drawn; a landmark's point is the middle of its foot):

```json
{
  "castle": [33.08, 14.63],
  "lighthouse": [5.4, 15.12],
  "arrivingShip": [7.46, 17.83],
  "roadStartsAtHarborPier": [10.02, 18.42],
  "forest": [20.78, 8.68],
  "forumBuilding": [26.93, 11.24],
  "school": [17.7, 15.1],
  "capitol": [42.3, 7.67],
  "thinkTankTown": [48, 9.26],
  "persuasionPierHead": [33.08, 10.8],
  "lobbyLandingPier": [56.14, 11.39],
  "departingShip": [36.45, 5.6],
  "coveMouth": [33.85, 6.7],
  "riverSpring": [45.38, 17],
  "cave": [48.45, 20.43],
  "skullMountain": [54.61, 19.72],
  "riverMouths": [
    [17.7, 7.29],
    [11.55, 7.29],
    [6.94, 12.56]
  ],
  "gravestones": [5.4, 26.83],
  "compassRound": "the four map buttons, x 52.9 to 55.2, y 1.4 to 3.7",
  "title": "centred on x 30, y 3.1"
}
```

Road: harbor pier, east along row 6 (tiles 3,6 to 9,6), to the castle; out of ring tile 11,5 and three ways: north 11,4 then 10,4 to Persuasion Pier; north-east 12,5, 13,4, 13,3, 14,3, 15,2 into Think-Tank Town from the north; south-east 12,6, 13,6, 13,7 (bridge), 13,8, 14,9, then north to 14,8 and the cave. River: spring at 14,7, then 13,7, reservoir 12,7 and 11,7; out north by 11,6 into the moat, and over the spillway south into Venture Valley's oasis 12,8; from the moat north-west by 9,5 and 8,5 through The Forum, Foundation Forest and Commentary Coast to three mouths. Full centre lines are in `hex-map-geography.json` (`roads`, `river`).

## 5. Open questions for Søren

1. **Support Shoreline north or south?** The stakeholder decision says north; the map has it south (reasons in section 1). On this board, north would put low beach behind higher land, where the viewer cannot see it, so moving it means re-planning heights. Who decides?
2. **Advocacy cove (north, beside the castle) or ships off the east coast?** And with it, the "departure harbour on the east coast": at present the east coast has only Lobby Landing's pier.
3. **Gone Graveyard south-west or south-east?**
4. **Do you still need NewX / NewY?** The site computes positions. If logos are to be hand-placed, we need to agree where those coordinates live (new Airtable fields, written by a future editor) and that they are "as drawn" map units.
5. **Secondary districts / hybrids on borders:** the hex packing does not use the secondary district. It could pull a hybrid org toward the shared edge; not built.
6. **The spec's island ellipse and "areas resizable later":** the hex board replaces the ellipse. Resizing is repainting tiles; growth is painting more coast tiles. Is that acceptable as the answer to "reserve space for growth"?
7. **The 40 records with no Realm or District and the pipeline entries:** the snapshot only includes Publish? checked and Hide? unchecked. Unpublished pipeline orgs are not given room yet.
8. **Names:** which of the changed working names (Theory Thermals, Capabilities Crag, Circuit Crater, Donor Dunes, Service Sands, Venture Valley, Commentary Coast, Learning Landing) do you accept? Several names describe the drawing, so they should be frozen after the geography.

## 6. Resume prompt

```
You are continuing the AISafety.com "Map 4.0" prototype (also called Map 3.5). Repo: the AISafety.com Next.js site, branch map3.5-hex. Read CLAUDE.md first, then docs/map-hex/handoverFromRobsClaude.md, then the header comment of src/lib/data/map-hex-spec.ts.

What exists: on /map, a "Hex work" tab draws the field map as an isometric board of hexagonal tiles, generated as SVG by code. Geography is the hand-editable tile map in src/lib/data/map-hex-spec.ts (two letters per tile; marks ~ river, = road, ! landmark, ^ escarpment, # bridge). Layout logic (logo packing, river, road, moat, lake) is in src/lib/data/map-hex-layout.ts with vitest tests; drawing is in src/app/map/hexBackdrop.ts, hexFeatures.ts, hexBuildings.ts. Org data comes from a forked Airtable base (read only); scripts use the snapshot scripts/map-hex/orgs.json, so no credentials are needed to render.

How to work:
- After every change to the spec run: node scripts/map-hex/need.mjs (the last line must be {}), then node scripts/map-hex/render.mjs out.png, and LOOK at the picture. For detail use zoom.mjs at 4x on the exact spot. Then npx vitest run src/lib/data/map-hex.
- Regenerate docs/map-hex/ (render.mjs with and without --bare, export.mjs) when the geography changes.
- The board is seen from the south: high ground hides the tile behind it and takes logo room there.
- Anything belonging to a region (ground, fields, lake, border) is drawn as ONE shape over the whole plateau, never pieced from tiles. Shore and decks keep to the hex outlines; the escarpment and volcano lean past theirs on purpose.
- Stay in the classic map's palette and hand: flat, face-on, fantasy (not modern) buildings; a tree is 0.5 x 1.0 map units, a house about 1.0 x 1.3. Look at public/images/map.webp before drawing something new. Never edit the art inside public/images/map35-landmarks.svg.
- Keep everything behind the "Hex work" toggle; the "UI work" tab is production and must not change. All color choices are placeholders flagged for Melissa (designer). Explain changes in plain English; one thing at a time, with a picture after each step.
- Do not push to the vps remote or touch the Airtable without asking.

My task now: <describe the change, e.g. "move Support Shoreline to the north coast" or "give Theory Thermals two more tiles">
```
