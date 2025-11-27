#!/usr/bin/env python3


"""
python coexistence.py formulas.json --cell-size 0.5 --out coexistence_geo.json
"""

import argparse
import json
import time
import os
import re
import math
from collections import defaultdict

from pygbif import species, occurrences
from tqdm import tqdm


# -------------------------------------------------------------
#  NAME CLEANING
# -------------------------------------------------------------
def clean_name(name):
    if not name:
        return None
    
    name = name.strip()
    name = re.sub(r"\s+", " ", name)

    # Handle “sp.” or “sp”
    if " sp" in name.lower():
        return name.split()[0].capitalize()

    parts = name.split(" ")
    if len(parts) >= 2:
        genus = parts[0].capitalize()
        epithet = parts[1].lower()
        return f"{genus} {epithet}"

    return name.capitalize()


# -------------------------------------------------------------
#  GBIF TAXON MATCHING
# -------------------------------------------------------------
def resolve_taxon(name):
    """Returns taxonKey or None."""
    cleaned = clean_name(name)

    # Direct match
    m = species.name_backbone(name=cleaned)
    if m and "usageKey" in m:
        return m["usageKey"]

    # fallback: fuzzy search
    sugg = species.name_suggest(q=cleaned)
    if sugg:
        return sugg[0]["key"]

    return None


# -------------------------------------------------------------
#  GBIF OCCURRENCE DOWNLOAD + CACHING
# -------------------------------------------------------------
def fetch_occurrences(taxon_key, cache_dir="occ_cache"):
    os.makedirs(cache_dir, exist_ok=True)
    cachefile = os.path.join(cache_dir, f"{taxon_key}.json")

    if os.path.exists(cachefile):
        with open(cachefile, "r", encoding="utf8") as f:
            return json.load(f)

    # Fetch up to 3000 occurrences (GBIF API)
    print(f"  → Fetching occurrences for {taxon_key} ...")
    out = []

    for i in range(0, 3000, 300):
        res = occurrences.search(
            taxonKey=taxon_key,
            limit=300,
            offset=i,
            hasCoordinate=True
        )
        if "results" not in res:
            break

        for r in res["results"]:
            if "decimalLatitude" in r and "decimalLongitude" in r:
                out.append([r["decimalLongitude"], r["decimalLatitude"]])

        if len(res["results"]) < 300:
            break

        time.sleep(0.2)

    with open(cachefile, "w", encoding="utf8") as f:
        json.dump(out, f)

    return out


# -------------------------------------------------------------
#  GRID CELL ASSIGNMENT
# -------------------------------------------------------------
def cell_id(lon, lat, size):
    x = math.floor(lon / size)
    y = math.floor(lat / size)
    return f"{x}:{y}"


# -------------------------------------------------------------
#  MAIN PROCESSING
# -------------------------------------------------------------
def process_formula(formula, min_relaxed, cell_size):
    species_list = formula["plants"]

    resolved = {}
    species_cells = defaultdict(set)

    print(f"\n=== Formula: {formula['name']} ===")

    # 1. Resolve taxon keys
    for sp in species_list:
        key = resolve_taxon(sp)
        if not key:
            print(f"  ✖ No taxonKey for {sp}")
        else:
            print(f"  ✔ {sp} → taxonKey {key}")
        resolved[sp] = key

    # 2. Download occurrences and bin into grid
    for sp, key in resolved.items():
        if not key:
            continue

        occs = fetch_occurrences(key)
        for lon, lat in occs:
            cid = cell_id(lon, lat, cell_size)
            species_cells[sp].add(cid)

    # 3. Strict coexistence: intersection of all species
    valid_species = {k for k, v in species_cells.items() if len(v) > 0}
    if len(valid_species) == 0:
        strict = []
    else:
        strict = list(set.intersection(*(species_cells[s] for s in valid_species)))

    # 4. Relaxed coexistence (at least N species)
    counter = defaultdict(int)
    for sp in valid_species:
        for cid in species_cells[sp]:
            counter[cid] += 1

    relaxed = [cid for cid, c in counter.items() if c >= min_relaxed]

    # 5. Species layers
    species_layers = {sp: list(cells) for sp, cells in species_cells.items()}

    return {
        "name": formula["name"],
        "strict_cells": strict,
        "relaxed_cells": relaxed,
        "species_layers": species_layers
    }


# -------------------------------------------------------------
#  ENTRY POINT
# -------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("formulas", help="JSON file with formulas")
    parser.add_argument("--cell-size", type=float, default=0.5)
    parser.add_argument("--min-relaxed", type=int, default=2)
    parser.add_argument("--out", default="coexistence_geo.json")
    args = parser.parse_args()

    with open(args.formulas, "r", encoding="utf8") as f:
        formulas = json.load(f)

    results = []

    for formula in formulas:
        res = process_formula(
            formula,
            min_relaxed=args.min_relaxed,
            cell_size=args.cell_size
        )
        results.append(res)

    with open(args.out, "w", encoding="utf8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nSaved → {args.out}")


if __name__ == "__main__":
    main()
