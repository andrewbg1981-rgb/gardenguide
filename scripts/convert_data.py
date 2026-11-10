"""Convert the GardenGuide spreadsheet into data/plants.json.

The spreadsheet has one row per task, repeating the plant's details on each
row. The JSON lists each plant once, with its tasks nested underneath (D-01).

Usage:  python3 scripts/convert_data.py
Needs:  Python 3 and openpyxl  (pip install openpyxl)
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source" / "GardenGuide v1 data set.xlsx"
OUTPUT = ROOT / "data" / "plants.json"
SHEET = "2. DB schema"

EXPECTED_HEADERS = [
    "Plant ID", "Plant Name", "Category", "Soil Type", "Soil pH", "Sun Exposure",
    "Task ID", "Task Type", "Task Title", "Task Description", "Months",
]

PLANT_FIELDS = ["name", "category", "soilType", "soilPh", "sunExposure"]


def parse_ph(text: str) -> dict:
    """'5.0-7.0 (color dependent)' -> {'min': 5.0, 'max': 7.0, 'note': 'color dependent'}"""
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:\((.*)\))?\s*", text)
    if not m:
        raise ValueError(f"cannot read soil pH {text!r} (expected e.g. '5.5-6.5')")
    ph = {"min": float(m.group(1)), "max": float(m.group(2))}
    if m.group(3):
        ph["note"] = m.group(3).strip()
    return ph


def parse_months(value) -> list[int]:
    """'9, 10, 11' -> [9, 10, 11]  (kept in spreadsheet order)"""
    parts = [p.strip() for p in str(value).split(",") if p.strip()]
    months = [int(float(p)) for p in parts]
    bad = [m for m in months if not 1 <= m <= 12]
    if bad:
        raise ValueError(f"months out of range 1-12: {bad}")
    return months


def main() -> int:
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    ws = wb[SHEET]
    rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    if headers[: len(EXPECTED_HEADERS)] != EXPECTED_HEADERS:
        print(f"Unexpected column headers in '{SHEET}':\n  {headers}", file=sys.stderr)
        return 1

    plants: dict[str, dict] = {}
    errors: list[str] = []
    for line_no, row in enumerate(rows[1:], start=2):
        cell = dict(zip(EXPECTED_HEADERS, row))
        where = f"row {line_no}"
        try:
            plant_id = str(cell["Plant ID"]).strip()
            plant = {
                "id": plant_id,
                "name": str(cell["Plant Name"]).strip(),
                "category": str(cell["Category"]).strip(),
                "soilType": str(cell["Soil Type"]).strip(),
                "soilPh": parse_ph(str(cell["Soil pH"])),
                "sunExposure": str(cell["Sun Exposure"]).strip(),
                "tasks": [],
            }
            task = {
                "id": str(cell["Task ID"]).strip(),
                "type": str(cell["Task Type"]).strip().lower(),
                "title": str(cell["Task Title"]).strip(),
                "description": str(cell["Task Description"]).strip(),
                "months": parse_months(cell["Months"]),
            }
        except Exception as exc:  # report every bad row, not just the first
            errors.append(f"{where}: {exc}")
            continue

        existing = plants.setdefault(plant_id, plant)
        # The same plant appears on several rows; its details must agree.
        for field in PLANT_FIELDS:
            if existing[field] != plant[field]:
                errors.append(f"{where}: plant '{plant_id}' has a different {field} than on an earlier row")
        existing["tasks"].append(task)

    if errors:
        print("Spreadsheet problems:\n  " + "\n  ".join(errors), file=sys.stderr)
        return 1

    library = {
        "schemaVersion": 1,
        "hemisphere": "south",
        "source": SOURCE.name,
        "plants": list(plants.values()),
    }
    OUTPUT.write_text(json.dumps(library, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    n_tasks = sum(len(p["tasks"]) for p in library["plants"])
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(plants)} plants, {n_tasks} tasks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
