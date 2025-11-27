import Papa from "papaparse";
import { tsvParse } from "d3-dsv";

// Bounds of your GDAL2Tiles map
const SW = { lat: -0.004491014968947042, lng: 0.004491014973545032 };
const NE = { lat: 0.004492137863052166, lng: -0.004492137867650181 };
const OLD_MIN = -500;
const OLD_MAX = 500;

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

  plantRows.forEach((p) => {
    if (p.ewe_name) {
      plantIndex[p.ewe_name.trim()] = { ...p };
    }
  });

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

  Object.values(grouped).forEach((recipe) => {
    recipe.plantDetails = recipe.plants.map((p) => {
      const details = plantIndex[p.ewe_name] || null;

      if (details) {
        const X = details.X != null ? Number(details.X) : null;
        const Y = details.Y != null ? Number(details.Y) : null;
        const { X: _dX, Y: _dY, ...restDetails } = details;

        return {
          ...p,
          X,
          Y,
          details: { ...restDetails, X, Y },
          ...restDetails,
        };
      } else {
        return { ...p, X: null, Y: null, details: null };
      }
    });
  });

  return Object.values(grouped);
}

// Parse GBIF speciesKey
function extractSpeciesKey(url) {
  if (!url) return null;
  const match = url.match(/species\/(\d+)/);
  return match ? match[1] : null;
}

// GBIF image resizer using images.weserv.nl
function resizeGBIF(url, size = 400) {
  if (!url) return null;
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=contain&we&il`;
}

// Local storage (7 days)

const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    if (Date.now() - obj.time > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return obj.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
  } catch { }
}

// Fetch herbarium → fallback images
export async function fetchGBIFImage(speciesKey) {
  if (!speciesKey) return null;

  const cacheKey = "gbif_" + speciesKey;

  // 1️⃣ Try cached value first
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // 2️⃣ Otherwise fetch from API
  const q = (extra = "") =>
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${speciesKey}` +
    `&mediaType=StillImage&limit=10${extra}`;

  try {
    // Herbarium first
    let res = await fetch(q("&basisOfRecord=PRESERVED_SPECIMEN"));
    let data = await res.json();

    const herb = data.results.find((r) => r.media && r.media.length > 0);
    if (herb) {
      const original = herb.media[0].identifier;
      const result = {
        url: resizeGBIF(original, 400),
        full: original,
        source: "herbarium",
        rights: herb.media[0].license,
        holder: herb.media[0].rightsHolder,
        institution: herb.institutionCode,
      };
      setCache(cacheKey, result);
      return result;
    }

    // Fallback: any image
    res = await fetch(q(""));
    data = await res.json();

    const any = data.results.find((r) => r.media && r.media.length > 0);
    if (any) {
      const original = any.media[0].identifier;
      const result = {
        url: resizeGBIF(original, 400),
        full: original,
        source: "other",
        rights: any.media[0].license,
        holder: any.media[0].rightsHolder,
        institution: any.institutionCode,
      };
      setCache(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn("GBIF image fetch failed:", err);
  }

  setCache(cacheKey, null);
  return null;
}

// Load + merge TSV data
export async function loadData() {
  const plantTsv = await fetch("/plants.tsv").then((r) => r.text());
  const recipeTsv = await fetch("/recipe.tsv").then((r) => r.text());

  let plants = tsvParse(plantTsv, (d) => ({
    ...d,
    X: +d.X,
    Y: +d.Y,
    speciesKey: extractSpeciesKey(d.GBIF),
    gbifImage: null,
  }));

  const recipes = tsvParse(recipeTsv, (d) => ({
    ...d,
    X: +d.X,
    Y: +d.Y,
  }));

  for (let plant of plants) {
    if (plant.speciesKey) {
      plant.gbifImage = await fetchGBIFImage(plant.speciesKey);
    }
  }

  return { plants, recipes };
} 