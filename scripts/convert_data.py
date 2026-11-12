"""Convert the GardenGuide plant database spreadsheet into data/plants.json.

The spreadsheet has separate tabs for Plants, Tasks, Zones and Wishlist.
Columns are found by their header names, so they can be reordered or widened
freely. Every problem is reported with its tab and row, not just the first.

Usage:  npm run convert-data
Needs:  Python 3 and openpyxl. Install openpyxl once with:
          Windows:        py -m pip install openpyxl
          Linux / macOS:  python3 -m pip install openpyxl
"""

import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ModuleNotFoundError:
    sys.exit("openpyxl is not installed. Install it once with:\n"
             "  Windows:        py -m pip install openpyxl\n"
             "  Linux / macOS:  python3 -m pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source" / "GardenGuide plant database.xlsx"
OUTPUT = ROOT / "data" / "plants.json"
SCHEMA_VERSION = 2

TASK_TYPES = {"pruning", "fertilising", "watering", "planting"}
LEVEL = {"low", "moderate", "high"}
FROST = {"tender", "light", "hardy"}
PRUNING = {"light", "moderate", "hard"}
TEXTURE = {"sandy", "loam", "clay", "any", "potting mix", "epiphytic"}
DRAINAGE = {"sharp", "good", "moist", "wet-tolerant"}
CONFIDENCE = {"high", "medium", "low"}
EXPOSURE = {"sheltered", "moderate", "exposed"}


class Problems(list):
    """Collects every problem found, so the user sees them all at once."""


def text(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def number(v, where, field, problems):
    if v is None or str(v).strip() == "":
        return None
    try:
        return float(v) if not float(v).is_integer() else int(float(v))
    except (TypeError, ValueError):
        problems.append(f"{where}: {field} must be a number (found {v!r})")
        return None


def choice(v, allowed, where, field, problems, required=False):
    s = text(v)
    if s is None:
        if required:
            problems.append(f"{where}: {field} is required")
        return None
    s = s.lower()
    if s not in allowed:
        problems.append(f"{where}: {field} '{s}' is not one of {', '.join(sorted(allowed))}")
        return None
    return s


def yes_no(v, where, field, problems, required=False):
    s = choice(v, {"yes", "no"}, where, field, problems, required)
    return None if s is None else s == "yes"


def parse_ph(v, where, problems):
    """'5.0-7.0 (colour depends on pH)' -> {'min': 5.0, 'max': 7.0, 'note': '...'}"""
    s = text(v)
    if s is None:
        return None
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:\((.*)\))?", s)
    if not m:
        problems.append(f"{where}: cannot read soil pH {s!r} (expected e.g. '5.5-6.5')")
        return None
    ph = {"min": float(m.group(1)), "max": float(m.group(2))}
    if m.group(3):
        ph["note"] = m.group(3).strip()
    return ph


def parse_months(v, where, problems):
    """'9, 10, 11' -> [9, 10, 11]  (kept in spreadsheet order)"""
    try:
        months = [int(float(p)) for p in str(v).split(",") if p.strip()]
    except ValueError:
        problems.append(f"{where}: cannot read months {v!r} (expected e.g. '11, 12, 1')")
        return []
    if not months:
        problems.append(f"{where}: months are required")
    bad = [m for m in months if not 1 <= m <= 12]
    if bad:
        problems.append(f"{where}: months out of range 1-12: {bad}")
    return months


def sources(v):
    return [s.strip() for s in str(v or "").split(";") if s.strip()]


def read_tab(wb, name, required_headers, problems):
    """Rows of a tab as dicts keyed by header, with their spreadsheet row numbers."""
    if name not in wb.sheetnames:
        problems.append(f"Tab '{name}' is missing")
        return []
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    headers = [text(h) or "" for h in rows[0]]
    missing = [h for h in required_headers if h not in headers]
    if missing:
        problems.append(f"Tab '{name}': missing column(s) {missing}")
        return []
    out = []
    for i, r in enumerate(rows[1:], start=2):
        if all(c is None or str(c).strip() == "" for c in r):
            continue
        out.append((i, dict(zip(headers, r))))
    return out


PLANT_HEADERS = [
    "Plant ID", "Plant name", "Botanical name", "Category", "Zone", "Irrigated",
    "Sun min %", "Sun max %", "Sun note", "Soil pH", "Soil texture", "Drainage", "Soil note",
    "Height (m)", "Width (m)", "Spacing (m)", "Wind tolerance", "Salt tolerance", "Frost tolerance",
    "Waterlogging tolerance", "Dry-spell tolerance", "Needs watering to establish",
    "Phosphorus sensitive", "Feeding note", "Pruning tolerance", "Pruning rule", "Deadhead", "Deadhead note",
    "Harvest signs", "Storage", "Cautions", "Sources", "Confidence",
]
TASK_HEADERS = [
    "Plant ID", "Task ID", "Task type", "Task title", "Months", "Critical", "Critical reason",
    "How", "How much", "Materials", "If missed", "Sources", "Confidence",
]
ZONE_HEADERS = [
    "Zone ID", "Zone name", "Theme", "Container", "Sun min %", "Sun max %", "Sun note",
    "Wind exposure", "Wind confirmed", "Salt exposure", "Salt confirmed",
    "Soil pH (measured)", "Soil texture", "Drainage", "Soil surveyed on", "Notes",
]
WISH_HEADERS = ["Plant name", "Botanical name", "Intended zone", "Notes"]


def basis(c, where, problems):
    src = sources(c["Sources"])
    if not src:
        problems.append(f"{where}: Sources is required (KB-05)")
    return {"sources": src, "confidence": choice(c["Confidence"], CONFIDENCE, where, "Confidence", problems, True)}


def convert_zone(row, c, problems):
    w = f"Zones row {row}"
    zone_id = text(c["Zone ID"])
    if not zone_id:
        problems.append(f"{w}: Zone ID is required")
    surveyed = c["Soil surveyed on"]
    return {
        "id": zone_id,
        "name": text(c["Zone name"]),
        "theme": text(c["Theme"]),
        "container": yes_no(c["Container"], w, "Container", problems, True),
        "sun": {"min": number(c["Sun min %"], w, "Sun min %", problems),
                "max": number(c["Sun max %"], w, "Sun max %", problems), "note": text(c["Sun note"])},
        "wind": {"level": choice(c["Wind exposure"], EXPOSURE, w, "Wind exposure", problems),
                 "confirmed": bool(yes_no(c["Wind confirmed"], w, "Wind confirmed", problems))},
        "salt": {"level": choice(c["Salt exposure"], LEVEL, w, "Salt exposure", problems),
                 "confirmed": bool(yes_no(c["Salt confirmed"], w, "Salt confirmed", problems))},
        "soil": {"ph": number(c["Soil pH (measured)"], w, "Soil pH", problems),
                 "texture": choice(c["Soil texture"], TEXTURE, w, "Soil texture", problems),
                 "drainage": choice(c["Drainage"], DRAINAGE, w, "Drainage", problems),
                 "surveyedOn": surveyed.strftime("%Y-%m-%d") if hasattr(surveyed, "strftime") else text(surveyed)},
        "notes": text(c["Notes"]),
    }


def convert_plant(row, c, problems):
    w = f"Plants row {row}"
    plant_id = text(c["Plant ID"])
    if not plant_id:
        problems.append(f"{w}: Plant ID is required")
    for f in ["Plant name", "Category"]:
        if not text(c[f]):
            problems.append(f"{w}: {f} is required")
    harvest = None
    if text(c["Harvest signs"]) or text(c["Storage"]):
        harvest = {"signs": text(c["Harvest signs"]), "storage": text(c["Storage"])}
    return {
        "id": plant_id,
        "name": text(c["Plant name"]),
        "botanicalName": text(c["Botanical name"]),
        "category": text(c["Category"]),
        "zone": text(c["Zone"]),
        "irrigated": bool(yes_no(c["Irrigated"], w, "Irrigated", problems)),
        "sun": {"min": number(c["Sun min %"], w, "Sun min %", problems),
                "max": number(c["Sun max %"], w, "Sun max %", problems), "note": text(c["Sun note"])},
        "soil": {"ph": parse_ph(c["Soil pH"], w, problems),
                 "texture": choice(c["Soil texture"], TEXTURE, w, "Soil texture", problems),
                 "drainage": choice(c["Drainage"], DRAINAGE, w, "Drainage", problems),
                 "note": text(c["Soil note"])},
        "size": {"heightM": number(c["Height (m)"], w, "Height", problems),
                 "widthM": number(c["Width (m)"], w, "Width", problems),
                 "spacingM": number(c["Spacing (m)"], w, "Spacing", problems)},
        "tolerance": {
            "wind": choice(c["Wind tolerance"], LEVEL, w, "Wind tolerance", problems),
            "salt": choice(c["Salt tolerance"], LEVEL, w, "Salt tolerance", problems),
            "frost": choice(c["Frost tolerance"], FROST, w, "Frost tolerance", problems),
            "waterlogging": choice(c["Waterlogging tolerance"], LEVEL, w, "Waterlogging tolerance", problems),
            "drySpells": choice(c["Dry-spell tolerance"], LEVEL, w, "Dry-spell tolerance", problems),
        },
        "needsEstablishmentWatering": yes_no(c["Needs watering to establish"], w, "Needs watering to establish", problems),
        "phosphorusSensitive": yes_no(c["Phosphorus sensitive"], w, "Phosphorus sensitive", problems),
        "feedingNote": text(c["Feeding note"]),
        "pruning": {"tolerance": choice(c["Pruning tolerance"], PRUNING, w, "Pruning tolerance", problems),
                    "rule": text(c["Pruning rule"])},
        "deadhead": {"advice": choice(c["Deadhead"], {"yes", "no", "n/a"}, w, "Deadhead", problems),
                     "note": text(c["Deadhead note"])},
        "harvest": harvest,
        "cautions": text(c["Cautions"]),
        "basis": basis(c, w, problems),
        "tasks": [],
    }


def convert_task(row, c, problems):
    w = f"Tasks row {row}"
    for f in ["Task ID", "Task title", "How"]:
        if not text(c[f]):
            problems.append(f"{w}: {f} is required")
    critical = yes_no(c["Critical"], w, "Critical", problems, True)
    if critical and not text(c["Critical reason"]):
        problems.append(f"{w}: a critical task needs a 'Critical reason' (KB-04)")
    return {
        "id": text(c["Task ID"]),
        "type": choice(c["Task type"], TASK_TYPES, w, "Task type", problems, True),
        "title": text(c["Task title"]),
        "description": text(c["How"]),
        "months": parse_months(c["Months"], w, problems),
        "critical": bool(critical),
        "criticalReason": text(c["Critical reason"]),
        "howMuch": text(c["How much"]),
        "materials": [m.strip() for m in str(c["Materials"] or "").split(";") if m.strip()],
        "ifMissed": text(c["If missed"]),
        "basis": basis(c, w, problems),
    }


def main() -> int:
    problems = Problems()
    wb = openpyxl.load_workbook(SOURCE, data_only=True)

    zones = [convert_zone(r, c, problems) for r, c in read_tab(wb, "Zones", ZONE_HEADERS, problems)]
    zone_ids = {z["id"] for z in zones}

    plants: dict[str, dict] = {}
    for r, c in read_tab(wb, "Plants", PLANT_HEADERS, problems):
        p = convert_plant(r, c, problems)
        if p["id"] in plants:
            problems.append(f"Plants row {r}: duplicate Plant ID '{p['id']}'")
        elif p["zone"] and p["zone"] not in zone_ids:
            problems.append(f"Plants row {r}: zone '{p['zone']}' is not in the Zones tab")
        plants[p["id"]] = p

    for r, c in read_tab(wb, "Tasks", TASK_HEADERS, problems):
        t = convert_task(r, c, problems)
        pid = text(c["Plant ID"])
        if pid not in plants:
            problems.append(f"Tasks row {r}: Plant ID '{pid}' is not in the Plants tab")
            continue
        plants[pid]["tasks"].append(t)

    wishlist = []
    for r, c in read_tab(wb, "Wishlist", WISH_HEADERS, problems):
        zone = text(c["Intended zone"])
        if zone and zone not in zone_ids:
            problems.append(f"Wishlist row {r}: zone '{zone}' is not in the Zones tab")
        wishlist.append({"name": text(c["Plant name"]), "botanicalName": text(c["Botanical name"]),
                         "zone": zone, "notes": text(c["Notes"])})

    for p in plants.values():
        if not p["tasks"]:
            problems.append(f"Plant '{p['id']}' has no tasks in the Tasks tab")

    if problems:
        print("Spreadsheet problems:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1

    library = {
        "schemaVersion": SCHEMA_VERSION,
        "hemisphere": "south",
        "location": "Skenes Creek, Victoria",
        "source": SOURCE.name,
        "zones": zones,
        "plants": list(plants.values()),
        "wishlist": wishlist,
    }
    # newline="\n": the same file on Windows and Linux, so git only shows real changes.
    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(library, indent=2, ensure_ascii=False) + "\n")
    n_tasks = sum(len(p["tasks"]) for p in library["plants"])
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(plants)} plants, {n_tasks} tasks, {len(zones)} zones, {len(wishlist)} wishlist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
