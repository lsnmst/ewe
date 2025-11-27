import pandas as pd
import json

# -----------------------------
# Load your TSVs
# -----------------------------

plants = pd.read_csv("plants.tsv", sep="\t")
recipes = pd.read_csv("recipe.tsv", sep="\t")

# Normalize whitespace
plants['ewe_name'] = plants['ewe_name'].str.strip().str.lower()
plants['botanical_name'] = plants['botanical_name'].str.strip()

recipes['ewe_name'] = recipes['ewe_name'].str.strip().str.lower()
recipes['recipe_name'] = recipes['recipe_name'].str.strip()

# -----------------------------
# Create a lookup: ewe_name → botanical_name
# -----------------------------

ewe_to_botanical = plants.set_index("ewe_name")["botanical_name"].to_dict()

# -----------------------------
# Build formulas
# Group by recipe_name
# -----------------------------

formulas = []

for recipe_name, group in recipes.groupby("recipe_name"):
    plant_names = []

    for _, row in group.iterrows():
        ewe = row["ewe_name"]
        if ewe in ewe_to_botanical:
            plant_names.append(ewe_to_botanical[ewe])
        else:
            print("⚠ Missing plant mapping for:", ewe)

    # Deduplicate
    plant_names = sorted(set(plant_names))

    formulas.append({
        "name": recipe_name,
        "plants": plant_names
    })

# -----------------------------
# Save output
# -----------------------------

with open("formulas.json", "w") as f:
    json.dump(formulas, f, indent=2)

print("✔ Created formulas.json with", len(formulas), "formulas.")
