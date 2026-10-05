# Project Context: Offline-First Multi-Hazard Decision Map (Bangkok)

> Working name: TBD. Status: concept, pre-prototype.
> Purpose of this file: single source of truth for humans and coding agents (Claude Code etc.). Read before making changes.

---

## 1. One-paragraph summary

A web map (PWA) for Bangkok that helps a person **decide where to go** during a disaster (earthquake, flood, fire, storm) and **train for it** in drill mode. It runs **local-first**: the device holds the map, the road graph, and the user's saved places, so routing and planning work with no network. When the network is up, it syncs fresh hazard data and user reports. Users can pin any road segment and set its status (open, restricted, blocked, unknown). The map is split into Bangkok sections so people download only the areas they need.

It is a **support and training tool, not an official warning or evacuation authority.** Official guidance (DDPM, BMA, school or workplace plan) always wins any conflict.

## 2. Goals and non-goals

**Goals**
- Offline route planning to the next checkpoint, safe place, or exit.
- Road-segment status that anyone can pin, with timestamp and source.
- One engine for many hazards via hazard profiles.
- Drill mode that scores decisions against good decisions.
- Works on phone first, desktop second.

**Non-goals (for now)**
- Replacing government alert systems.
- Live sensor networks or CCTV analysis.
- Real-time truth about hazards. We show last known state with age, never "live truth".
- User accounts, chat, social features.

## 3. Core concept: one engine, hazard profiles

Graph, layers, checkpoints, and scoring stay the same. Only **edge cost rules** and **safe-place definitions** change per hazard.

| Hazard | Avoid | Prefer | Notes |
|---|---|---|---|
| Earthquake | Elevators, damaged buildings, under bridges and overpasses, near glass | Open ground, assembly points, away from tall buildings | After shaking, expect aftershocks |
| Flood | Roads below depth threshold, underpasses, low-lying roads | High ground, elevated roads, upper floors | Depth data is sparse; mark unknown honestly |
| Fire | Smoke direction, elevators | Nearest safe exit, upwind | Building-scale more than city-scale |
| Storm / heat | Open exposure, trees, signage | Shelter in place, nearest sturdy building | |

**Safety guidance text must come from official sources** (DDPM, BMA, TMD, school safety officer) and be reviewed by a person who knows that hazard. Do not invent safety advice.

## 4. Architecture (local-first)

- **App:** PWA. Installable. Service worker caches app shell, fonts, tiles, data.
- **Storage:** IndexedDB (Dexie.js). Not localStorage. Request persistent storage; warn the user that browsers can still evict data (iOS Safari especially).
- **Map:** MapLibre GL JS with vector tiles in **PMTiles** (one file per section), OSM-derived.
- **Routing:** runs in the browser on a cached graph (Dijkstra or A*, optionally WASM). No server needed for routing.
- **Sync:** when online, pull hazard layers and pull/push road-status reports. Conflict rule v1: newest report wins, reports carry timestamps and expire.
- **Fonts:** self-host LINE Seed TH files so the UI works offline. Check the font license before shipping.
- **Server (minimal):** Postgres + PostGIS (Supabase works) for shared reports, plus static hosting for PMTiles and data packs.

**Stack suggestion:** TypeScript, React (or plain TS), MapLibre, PMTiles, Dexie, Workbox.

## 5. Map sections (Bangkok)

Hierarchy:
1. **City:** Bangkok (also include a buffer into Nonthaburi, Pathum Thani, Samut Prakan, Samut Sakhon, Nakhon Pathom, because evacuation does not stop at the city line).
2. **BMA zone groups:** 6 groups (Northern, Central, Southern, Eastern, Northern Thonburi, Southern Thonburi). Verify the grouping against BMA open data.
3. **Districts (khet):** 50. This is the **download unit**: each district = one offline pack.
4. **Sub-districts (khwaeng):** 180. Used for reports and statistics, not required for download.
5. **Custom section:** user-drawn polygon, for a school, a workplace, a neighborhood.

Rules:
- Each pack contains tiles, road graph, plotted points, and a version + date.
- Show pack size before download; show "downloaded / outdated / missing" per section.
- Routing across section borders must work when both packs are present; warn if the route enters a missing pack.
- First-run onboarding: pick home, work/school, and one family location, then download those sections.

## 6. Road pin-point and status

Every road is split into **segments** (graph edges, linked to an OSM way id). The user taps a road, the app snaps to the nearest segment, and a bottom sheet (phone) or side panel (desktop) opens.

**Status values:** `open` | `restricted` | `blocked` | `unknown`
**Reason (optional):** flooded, debris, collapsed, fire, crowded, police closure, other
**Optional measure:** flood depth in cm (bucketed: <10, 10-30, 30-60, >60)

Data model (sketch):

```
road_segment_status
  id, segment_id, osm_way_id, district_id
  status            open | restricted | blocked | unknown
  hazard            flood | quake | fire | storm | other
  reason, depth_cm
  source            official | user | model | sensor
  confidence        0..1
  reported_at, expires_at
  synced            bool  (false = only on this device)
```

Rules:
- **Every status shows its age** ("blocked, 40 min ago, user report").
- **Statuses expire** and fall back to `unknown`. Never present an old status as current.
- Official sources outrank user reports; multiple matching user reports raise confidence.
- Routing treats `blocked` as impassable, `restricted` as high cost, `unknown` as medium-high cost (configurable per hazard).
- Offline reports are stored locally and queued for sync.
- Abuse: rate-limit and flag reports that contradict official data; allow report removal.

## 7. What to plot (layers)

Use only **public, open data** (OpenStreetMap via Overpass, BMA open data, GISTDA, DDPM, RID, TMD, Air4Thai, official GTFS where available). Check each source's license and update frequency. Every layer stores `source`, `fetched_at`, and `license`.

**P0 (MVP)**

| Layer | Examples | Typical source |
|---|---|---|
| Roads + graph | all drivable and walkable roads, sois, bridges, underpasses | OSM |
| Road status | user/official pins | app |
| Shelters / assembly points | schools, temples, parks, stadiums, designated evacuation sites | DDPM, BMA, OSM |
| Hospitals / clinics | | OSM, MOPH |
| Rivers and canals | Chao Phraya, khlong network | OSM `waterway`, RID |
| Flood-prone zones / flood history | | BMA, GISTDA |
| 7-Eleven and convenience stores | 7-Eleven, FamilyMart, Lotus's Go Fresh | OSM `shop=convenience` |
| Supermarkets | Big C, Lotus's, Tops, Makro | OSM `shop=supermarket` |

**P1**

| Layer | Examples | Typical source |
|---|---|---|
| Rail | BTS, MRT, Airport Rail Link, SRT commuter and long-distance lines and stations | OSM, official GTFS |
| Bus | BMTA routes and stops | OSM, BMTA / open transit data |
| Boats and piers | Chao Phraya express boat, khlong boats, ferry piers | OSM |
| Fresh and wet markets | | OSM `amenity=marketplace` |
| Food supply hubs | wholesale markets (e.g. Talad Thai, Simummuang, Or Tor Kor, Pak Khlong Talat), cold storage, large distribution sites | OSM, official lists |
| Fuel | petrol stations, EV chargers | OSM |
| Water | pumping stations, flood gates, water treatment | BMA, MWA |
| Police / fire | stations | OSM |

**P2**

| Layer | Examples | Typical source |
|---|---|---|
| Military | public military areas, bases, helipads, hospitals | OSM `landuse=military` and public sources only |
| Power | substations | OSM `power=substation`, public sources only |
| Telecom, ports, airports, major bridges | | OSM |
| Pharmacies, banks/ATMs, shopping malls | | OSM |
| Elevation / low-lying areas | | DEM data |

**Military layer rules:** public data only. Do not add or infer anything not already public. Purpose is relief logistics, landing sites, shelter capacity, and **restricted-access areas to avoid routing into**. Not a targeting or intelligence tool. Same caution for power and other critical infrastructure: public info, no vulnerability detail.

**Layer UI rules:** layers are grouped (Access, Supply, Transit, Water, Safety, Critical infra). Toggle by icon. Each shows count, source, and age. Heavy layers load per section, not citywide.

## 8. Decision layer and drill mode

- **Drill mode:** run a scenario (e.g. "M6 earthquake, stairwell B blocked, 300 people in the corridor") on the same map. The user makes choices; the app compares to a reference decision and scores time, safety, and congestion.
- **Congestion-aware routing:** shortest path is not always best because everyone takes it. Model crowding on edges.
- **Research question:** *with stale and partial hazard data, how should a route planner trade off safety against uncertainty?* Test first in agent-based simulation (Python + Mesa) before building UI.
- Do not assume rational users in simulations: crowd-following, going back for belongings, and using the entry route are real behaviors.

## 9. UI / design system

**Reference:** the attached sci-fi cockpit display screenshot (black screen, thin white linework, dashed grid, small labels, boxed panels, red ABORT, amber dashed accent).

**Principles**
1. Black base, white contrast. No decoration.
2. **Type size is the hierarchy.** One weight only.
3. Line dividers and boxes. **Zero border radius, everywhere.**
4. Hover = background or color change only. **No outline, no shadow.**
5. Everything small and dense.
6. **Icons are the main navigation.**
7. Phone UI must be fully usable.

**Tokens**

```
--bg:        #000000
--fg:        #ffffff
--dim:       #8a8a8a      secondary text
--line:      #ffffff      strong divider / box border, 1px
--line-soft: #333333      subtle divider, 1px
--hover-bg:  #1a1a1a      hover background (or invert: bg #fff, fg #000 for primary)
--alert:     #ff2a1f      blocked, abort, danger
--warn:      #ffb000      restricted, caution (use dashed lines)
--radius:    0
--shadow:    none
```

**Typography**
- Font: **LINE Seed TH**, weight **400 only** (no bold). A thin weight may be used for display sizes 28px and up.
- Scale (px): 10, 11, 12, 14, 18, 28. Body default 12. Labels 10-11, uppercase, letter-spacing 0.06em. Numbers use tabular figures.
- Hierarchy comes from size and from `--fg` vs `--dim`, never from weight.
- Check Thai line-height (Thai needs more vertical room than Latin, about 1.5).

**Components**
- Boxes: 1px `--line` border, no radius, transparent or `--bg` fill.
- Dividers: 1px lines. Dashed lines for planned, unknown, or inactive things.
- Buttons: rectangular, icon-only where possible. Hover: bg changes. Active/selected: inverted (white bg, black icon).
- **Focus state (keyboard):** no outline per the style, so use **inverted colors or a bg change** for `:focus-visible`. Never leave focus invisible.
- Icons: thin stroke (1.25-1.5px), square caps, 16px visual size, consistent set (e.g. Lucide or a custom set). Every icon has `aria-label`, and a text tooltip on hover or long-press.

**Map styling (matches the reference)**
- Base: black. Roads: thin white lines. Water: dashed or dotted outlines, no fill.
- Grid overlay (optional): faint dashed lines like the reference.
- **Status must not rely on color alone.** Encode with line style too:
  - open: solid white
  - restricted: dashed amber
  - blocked: solid red with X ticks along the line
  - unknown: dotted gray
- Point layers use small distinct glyphs (square, triangle, cross), not colored blobs.
- Labels small (10px), white, with a black halo for legibility.

**Layout: desktop**
- **Top toolbar, icon-only:** layers, section picker, search, drill mode, offline status, settings.
- Left rail (icons): navigation (map, routes, saved places, reports, drills).
- Right panel (collapsible): details for the selected road or place.
- Bottom status bar (11px): coordinates, section, pack version, online/offline, data age.

**Layout: phone**
- Full-screen map.
- **Bottom icon bar** (4-5 icons): map, layers, routes, saved, more.
- **Bottom sheet** for road status and place details (drag up/down).
- Top strip: online/offline + data-age indicator only.
- Visual size stays small, but **touch hit areas are at least 44x44px** (pad the hit area, not the icon).
- One-hand reach: primary actions in the lower half of the screen.
- Test on small phones (360px wide) and with the system font size increased.

**Accessibility red flags to respect**
- Removing outlines and shadows is fine only because focus and hover are shown with color changes. Keep contrast at least 4.5:1 for text. `--dim` on black must still pass.
- Icon-only navigation hurts discoverability: first-run hint, tooltips, labels in the settings page.
- Small type: allow user font scaling; never lock zoom.

## 10. Build order

1. **Offline route prototype:** one place (your school), graph, PWA, airplane-mode test. This is the make-or-break step.
2. Road segments plus pin-and-status UI, stored locally.
3. Earthquake hazard profile, then flood.
4. Section system (Bangkok districts) with downloadable packs.
5. P0 layers, then P1.
6. Saved places and checkpoints ("save points"), stored locally.
7. Drill mode with scoring; agent-based simulation for research.
8. Online sync and shared reports; official data ingestion.
9. P2 layers.

## 11. Key risks (red team)

1. **Stale data causes bad decisions.** Mitigation: age on everything, expiry to `unknown`, no "live" wording.
2. **Wrong route = harm.** Mitigation: clear support-tool framing, official guidance first, reviewed hazard rules.
3. **Nothing works if packs were never downloaded.** Mitigation: onboarding download, "missing pack" warnings.
4. **Browser storage eviction and service worker bugs** can break offline mode. Mitigation: persistent storage request, repeated airplane-mode tests on real iOS and Android.
5. **Indoor positioning:** GPS fails inside buildings. Mitigation: manual location choice, QR codes at doors for school mode.
6. **Report abuse and false pins.** Mitigation: expiry, rate limits, confidence scoring, official override.
7. **Open data gaps in Thailand** (bus, flood depth, shelters). Check availability before promising a layer.
8. **Scope creep:** many layers, many hazards. Mitigation: P0 first, one hazard profile at a time.
9. **Sensitive layers (military, power):** public data only, no extra inference.
10. **"Disaster app for everything" is a crowded pitch.** Distinctive parts are offline decision support and drill scoring; lead with those.
11. **Icon-only UI and tiny type** can hurt usability, especially under stress. Test with real users, including a panic-like timed task.

## 12. Weekend tests

- **Offline test:** install the PWA, enable airplane mode, reload, compute a route to an exit.
- **Data test:** pull one district from OSM; count roads, shelters, 7-Elevens, and supermarkets; check the graph is connected.
- **Sim test:** 500 agents, shortest-path vs congestion-aware routing, compare total evacuation time.
- **UI test:** give a friend the phone and ask them to mark a road as blocked within 10 seconds, without help.

## 13. Open questions

- First target: one school, or all of Bangkok from day one? (Recommendation: one school, then expand by district.)
- Research paper or competition entry, or real app, or both?
- Which hazards first: earthquake + flood (recommended).
- Do we have permission and access to real school floor plans?
- Name and license for the project and data.
