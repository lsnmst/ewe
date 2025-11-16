import Papa from "papaparse";

// Bounds of your GDAL2Tiles map
const SW = { lat: -0.004491014968947042, lng: 0.004491014973545032 };
const NE = { lat: 0.004492137863052166, lng: -0.004492137867650181 };
const OLD_MIN = -500;
const OLD_MAX = 500;

// Map old X/Y [-500,500] to tile bounds
function mapX(oldX) {
  return SW.lng + ((oldX - OLD_MIN) / (OLD_MAX - OLD_MIN)) * (NE.lng - SW.lng);
}

function mapY(oldY) {
  return SW.lat + ((oldY - OLD_MIN) / (OLD_MAX - OLD_MIN)) * (NE.lat - SW.lat);
}

/**
 * Load a TSV file via fetch and parse with PapaParse
 * Converts X/Y coords to map bounds
 */
export async function loadTSVPapa(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);

  const text = await res.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.map((row) => {
          // Convert X/Y to numbers and map to bounds
          if (row.X) row.X = mapX(parseFloat(row.X));
          if (row.Y) row.Y = mapY(parseFloat(row.Y));
          return row;
        });
        resolve(data);
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Merge recipe data with plant details
 */
export function mergeRecipeData(recipeRows, plantRows) {
  const grouped = {};
  const plantIndex = {};

  // Build plant lookup
  plantRows.forEach((p) => {
    if (p.ewe_name) {
      plantIndex[p.ewe_name.trim()] = { ...p };
    }
  });

  // Group recipes
  recipeRows.forEach((row) => {
    const key = row.recipe_name?.trim();
    if (!key) return;

    if (!grouped[key]) {
      grouped[key] = {
        recipe_name: row.recipe_name,
        EN_recipe_name: row.EN_recipe_name,
        class_fatumbi: row.class_fatumbi,
        odu: row.odu,
        recipe: row.recipe,
        recipe_EN: row.recipe_EN,
        plants: [],
      };
    }

    grouped[key].plants.push({
      ewe_name: row.ewe_name?.trim(),
      part: row.part,
    });
  });

  // Attach full plant details — merge details into top-level so Map can read p.X / p.Y
  Object.values(grouped).forEach((recipe) => {
    recipe.plantDetails = recipe.plants.map((p) => {
      const details = plantIndex[p.ewe_name] || null;

      if (details) {
        // Ensure numeric X/Y at top-level (may already be numbers from loadTSVPapa)
        const X = details.X != null ? Number(details.X) : null;
        const Y = details.Y != null ? Number(details.Y) : null;

        // Keep details copy (without duplicating huge text) but also expose X/Y top-level
        const { X: _dX, Y: _dY, ...restDetails } = details;
        return {
          ...p,          // ewe_name, part
          X,
          Y,
          details: { ...restDetails, X, Y },
          ...restDetails // optionally expose common fields (EN_ewe_name, botanical_name, etc.)
        };
      } else {
        return { ...p, X: null, Y: null, details: null };
      }
    });
  });

  return Object.values(grouped);
}
