# GardenGuide v4 — Requirements (draft A)

v4 is GardenGuide fitted to one garden and one user: a holiday-home garden at
Skenes Creek, Victoria. It sits between v1 (task rhythm, delivered) and the v10
vision (a tool for any gardener). v2 and v3 are the stepping stones (see Roadmap).

Each requirement names the challenge(s) it addresses (C-xx). A requirement is
*verified* when an automated test cites its ID, or — for screens and content —
when it has been checked by hand and noted here.

---

## 1. Principles

These govern every requirement below and every later design decision.

| ID | Principle |
|---|---|
| P-01 | **Open loop.** GardenGuide offers guidance when asked. It never requires data entry to be useful: with nothing entered beyond the plant database, every screen still works. Any input (ticks, photos, notes, soil readings) is optional and adds value without becoming an obligation. |
| P-02 | **No nagging.** No notifications, reminders, streaks or prompts to log. The app is opened when the user chooses. |
| P-03 | **Plain, neutral language.** Guidance is specific and factual ("Cut back by up to one third, after flowering"), without a familiar or encouraging tone. |
| P-04 | **One user, two devices.** A PC for planning; a phone in the garden, which must work without a network connection. |
| P-05 | **Advice shows its basis.** Plant guidance records where it came from and how confident it is, so solid advice can be told from best guesses. |
| P-06 | **Most tasks may lapse.** Routine tasks expire on their own if not done. Only tasks whose omission is a likely cause of plant failure persist (TK-02). |

## 2. Challenges (from the owner's experience)

| ID | Challenge |
|---|---|
| C-01 | New plants failed even though the same plants grow well elsewhere in the suburb. |
| C-02 | Costly losses from underestimating exposure: cacti on a deck failed from coastal rain, cold and wind despite good sun. |
| C-03 | Uncertainty about how hard to prune, and whether to remove spent flowers. |
| C-04 | Maintenance timing not tracked; tending depends on asking the right question at the right time. |
| C-05 | Soil conditions likely underestimated; pH untested; terms such as "sandy" or "well-drained" have no practical meaning yet. |
| C-06 | Spacing misjudged at planting (sunflowers planted too close, then thinned). |
| C-07 | Harvest storage misjudged (passionfruit spoiled before use). |
| C-08 | Composting unknown: what to compost (e.g. grass clippings), and where to apply it without harming existing plants. |
| C-09 | Arriving at the holiday home unsure what to do next. Visits are intermittent, so short task windows can be missed entirely. |
| C-10 | Planning and imagining the future garden is a major source of enjoyment. |

## 3. Site context

Fixed facts about the garden. They are used as defaults and to derive zone
properties; the user is not asked to enter them.

| ID | Fact |
|---|---|
| SC-01 | Location: Skenes Creek, Victoria (Otway coast), about 150 m from the ocean. Southern hemisphere; months are Victorian months (D-07). |
| SC-02 | Exposure: strong southerly winds and north-westerlies; salt-laden coastal air. |
| SC-03 | Orientation: on the site plan, north points to the top-left at 45°. So the top edge faces north-east, the left side north-west and the bottom south-west. |
| SC-04 | Fall: the front yard (left, north-west) is about 5 m higher than the backyard (right, south-east). |
| SC-05 | Irrigation: a watering system serves the tree ferns, elkhorn and staghorns only. All other plants rely on rain. |
| SC-06 | Visit pattern: weekends about every 2 weeks in the warmer months, about every 6 weeks in winter, and most of the school holidays. |
| SC-07 | Garden themes (loose, not prescriptive): Floral (front yard), Shade, Tropical, Vegetable, Fruit (backyard), plus pot groups on the decks. |

## 4. Requirements

Status: **v2**, **v3** or **v4** is the version expected to deliver it. Type: **Shall** (needed) or **Should** (wanted, may slip).

### 4.1 Knowledge base (KB)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| KB-01 | The plant database shall be extended with, per plant: pruning tolerance (KB-02), deadheading (yes/no + reason), mature height and width, planting spacing, exposure tolerances (wind, salt, frost, waterlogging, dry spells), soil preferences (pH range, texture, drainage), nutrient sensitivity (e.g. phosphorus), harvest signs and storage life where relevant, and the zone the plant is in. | Shall | v2 | C-01–C-07 |
| KB-02 | **Pruning tolerance** shall state how hard a plant can be cut without lasting harm, in three levels: *light* (tips and spent growth only; do not cut into old bare wood), *moderate* (up to about one third), *hard* (can be cut back heavily or to old wood to renew). Each level is shown with the specific rule for that plant. | Shall | v2 | C-03 |
| KB-03 | Each task shall carry: how to do it, how much (where relevant), materials needed (for the shopping list, PL-01), and the consequence of missing it. | Shall | v2 | C-03, C-04 |
| KB-04 | Each task shall be classed **critical** (missing it is a likely cause of decline or loss, or loses a season) or **routine**, with a one-line reason. | Shall | v2 | C-04, P-06 |
| KB-05 | Each guidance value shall record its source and a confidence level (P-05). | Shall | v2 | C-04 |
| KB-06 | The database shall continue to be edited only in the spreadsheet and converted to JSON (existing rule), with new tabs for Zones and Wishlist. | Shall | v2 | — |

### 4.2 Zones and map (ZN)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| ZN-01 | The garden shall be divided into named zones (SC-07), including deck pot groups as **container** zones. | Shall | v2 | C-01, C-02 |
| ZN-02 | A map screen shall show the site plan with zone outlines. Selecting a zone lists its plants and their current tasks. | Shall | v2 | C-09, C-10 |
| ZN-03 | Each zone shall record: sun (aspect and approximate hours, summer and winter), wind and salt exposure, irrigation (yes/no), and soil (pH, texture, drainage; "unknown" allowed). Values are pre-filled from site context (SC-01–SC-05) and can be refined. | Shall | v2 | C-01, C-02, C-05 |
| ZN-04 | GardenGuide should offer an optional soil survey guide per zone: pH test kit, jar test (texture), percolation test (drainage). It explains what each result means for planting and stores dated results if entered. It is never required (P-01). | Should | v4 | C-05 |
| ZN-05 | Zone outlines should be editable in the app. Until then they are drawn from the owner's plan. | Should | v4 | C-10 |

### 4.3 Tasks (TK) — revises v1 task logic

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| TK-01 | Routine tasks shall behave as in v1: active within the active period, expiring automatically once more than a month past their window (TL-01, TL-03). | Shall | v2 | P-06 |
| TK-02 | Critical tasks (KB-04) shall stay on the list after their window closes, until marked complete or dismissed by the user. Dismissal is logged. | Shall | v2 | C-04, C-09 |
| TK-03 | The task list shall be ordered: overdue critical, then critical due now, then routine due now, then upcoming. Within each group, v1 ordering applies (D-08). | Shall | v2 | C-09 |
| TK-04 | Each task shall show its how / how much guidance and consequence (KB-03) on request, without leaving the list. | Shall | v2 | C-03 |
| TK-05 | Tasks whose window closes within a **look-ahead horizon** shall be marked "do this visit". The horizon defaults from the visit pattern (SC-06): 2 weeks October–April, 6 weeks May–September. It can be changed in settings but is never asked for. | Shall | v3 | C-09 |
| TK-06 | The list shall be filterable by zone. | Should | v2 | C-09 |

### 4.4 Visit planner and shopping list (PL)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| PL-01 | A shopping list shall suggest materials for tasks within the horizon (KB-03), grouped as hardware or nursery. The user can add items manually and tick items as bought. Suggested items the user removes stay removed for that task window. | Shall | v3 | C-09 |
| PL-02 | A "before leaving" view shall list checks that protect the garden until the next visit: irrigation working, ripe produce that will not keep (KB-01 storage life), staking, mulching where due. It is guidance only; nothing needs ticking. | Shall | v3 | C-07, C-09 |
| PL-03 | Planting guidance for non-irrigated zones shall advise planting at the start of a long stay (e.g. school holidays) when the plant needs regular watering to establish. | Shall | v3 | C-01, C-06 |

### 4.5 Photos (PH)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| PH-01 | The user can attach photos to a plant from the phone camera or files. Each photo is dated automatically; a caption is optional. | Shall | v4 | C-01 |
| PH-02 | A plant's photos shall be viewable as a dated timeline. | Shall | v4 | C-10 |
| PH-03 | Photos shall be stored in a form usable by future image-based features (e.g. issue identification, v5+). | Should | v4 | — |

### 4.6 Wishlist and suitability (WL)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| WL-01 | The user can keep a wishlist of plants, each with an intended zone. | Shall | v4 | C-10 |
| WL-02 | Each wishlist plant shall show a suitability rating for its intended zone: *suitable*, *marginal*, *unsuitable* or *unknown*. Reasons are stated, e.g. "Zone is exposed to salt wind; plant has low salt tolerance" or "Soil pH unknown — see soil survey". | Shall | v4 | C-01, C-02, C-05 |
| WL-03 | Suitability shall include establishment: a plant that needs regular watering to establish is marginal in a non-irrigated zone unless planted at the start of a long stay (PL-03). | Shall | v4 | C-01 |
| WL-04 | Spacing guidance shall be given for planting: mature width, recommended spacing, and plants per metre of bed. | Shall | v4 | C-06 |
| WL-05 | A wishlist plant can be moved into the garden once its profile is in the plant database. | Shall | v4 | C-10 |

### 4.7 Soil and compost guidance (SO)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| SO-01 | Reference guidance shall describe a composting method that tolerates visits several weeks apart, including what to add and avoid (e.g. grass clippings: thin layers, mixed with dry material; not if treated with herbicide). | Should | v4 | C-08 |
| SO-02 | Per-zone guidance shall state where compost and fertiliser should and should not be applied, based on the plants in the zone (e.g. no phosphorus-rich feeding near Proteaceae such as waratah). | Shall | v4 | C-05, C-08 |

### 4.8 Devices and data (DV)

| ID | Requirement | Type | Status | Challenges |
|---|---|---|---|---|
| DV-01 | GardenGuide shall work on a PC browser and a phone, including offline in the garden (as v1). | Shall | v2 | P-04 |
| DV-02 | The user can export all personal data (ticks, log, lists, settings) to a file and import it again. | Shall | v2 | P-04 |
| DV-03 | Personal data shall be kept in step between the PC and the phone without manual export. The method is an architecture decision for v3. | Shall | v3 | P-04 |
| DV-04 | Storage shall support photos (larger than localStorage allows), e.g. IndexedDB behind the storage module (D-09). | Shall | v4 | — |

## 5. Deliberately held back (v5 and later)

| Item | Reason |
|---|---|
| Visit calendar entry | Data entry burden (P-01). TK-05's horizon gives most of the benefit without it. |
| Plant outcome records, zone scorecards, visit diary, harvest log | Logging burden (P-01). Dated photos (PH) capture much of the same history passively. |
| Seed-raising guidance (germination difficulty, sowing method) | Held by the owner for now. |
| Dream map / future-garden layout and seasonal flowering view | Held by the owner for now. |
| User tiers (beginner/advanced) | Single user. |
| Climate data lookup by location | Site context (SC) covers one garden. Needed for other users. |
| Photo-based issue identification (AI) | Builds on PH-03. |
| Auto-assumed routine tasks (v10) | Replaced for v4 by expiry of routine tasks and persistence of critical ones (P-06). |
| "Precious plant" flag | Left to the owner's discretion. |

## 6. Changes to v1 requirements

| v1 ID | Change |
|---|---|
| TL-03 | Now applies to routine tasks only. Critical tasks persist (TK-02). |
| TL-02 | Ordering now groups by criticality first (TK-03). |
| LG-02 | Adds a third log status: `dismissed` (critical task deliberately dropped, TK-02). Needs a design-baseline change to D-05. |
| ST-01 | Extended by DV-02–DV-04. |

## 7. Roadmap

| Version | Theme | Contents |
|---|---|---|
| v1 ✅ | Rhythm | Active tasks, log, offline phone app |
| v2 | Know the garden | KB-01–06, ZN-01–03, TK-01–04 and TK-06, DV-01–02. Starts with the spreadsheet schema, then drafting plant profiles for review, then the map and task guidance. |
| v3 | Plan the visit | TK-05, PL-01–03, DV-03 (sync decision) |
| v4 | Grow with confidence | PH-01–03, WL-01–05, ZN-04–05, SO-01–02, DV-04 |

## 8. Open questions

| ID | Question |
|---|---|
| Q-01 | Sync method for DV-03 (e.g. a file in OneDrive, or a small hosted service). Decide at the start of v3. |
| Q-02 | Sun hours per zone: estimate from the plan and orientation (SC-03), or observe on site once. |
| Q-03 | Which current plants live in which zone. Needed to fill KB-01 "zone". |
