<script>
  import { onMount } from "svelte";
  import maplibregl from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";

  export let plants = [];
  export let highlight = null;

  let map;
  let container;
  let coexistenceData = [];

  // Grid size
  export let CELL_SIZE = 0.5;

  // Initial overlay message visible
  let emptyState = true;

  // --- UTILITIES ---
  function normalize(str) {
    return str
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function gridToPolygon(key) {
    const [gx, gy] = key.split(":").map(Number);

    // SAFE coordinates
    const minLng = Math.max(-180, Math.min(180, gx * CELL_SIZE));
    const maxLng = Math.max(-180, Math.min(180, (gx + 1) * CELL_SIZE));
    const minLat = Math.max(-90, Math.min(90, gy * CELL_SIZE));
    const maxLat = Math.max(-90, Math.min(90, (gy + 1) * CELL_SIZE));

    return [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ];
  }

  function clearGrid() {
    if (map?.getSource("grid-cells")) {
      map.getSource("grid-cells").setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }

  function drawGridCells(cellKeys, color, outline = "#000") {
    if (!map || !cellKeys?.length) return;

    const features = cellKeys.map((key) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: gridToPolygon(key) },
      properties: { color, outline, opacity: 0.75 },
    }));

    if (map.getSource("grid-cells")) {
      map.getSource("grid-cells").setData({
        type: "FeatureCollection",
        features,
      });
    } else {
      map.addSource("grid-cells", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      map.addLayer({
        id: "grid-cells-fill",
        type: "fill",
        source: "grid-cells",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.75,
        },
      });

      map.addLayer({
        id: "grid-cells-outline",
        type: "line",
        source: "grid-cells",
        paint: {
          "line-color": ["get", "outline"],
          "line-width": 4,
          "line-opacity": 0.75,
        },
      });
    }
  }

  function resetMapView() {
    if (!map) return;
    map.jumpTo({ center: [0, 0], zoom: 1 });
  }

  function zoomToCells(cellKeys) {
    if (!map || !cellKeys?.length) return;

    const latitudes = [];
    const longitudes = [];

    cellKeys.forEach((key) => {
      const [gx, gy] = key.split(":").map(Number);

      longitudes.push(gx * CELL_SIZE, (gx + 1) * CELL_SIZE);
      latitudes.push(gy * CELL_SIZE, (gy + 1) * CELL_SIZE);
    });

    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);

    // Avoid out-of-range bounds (lat must be -90 to 90)
    if (minLat < -90 || maxLat > 90) return;

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: {
          top: 40,
          bottom: 40,
          left: 400,
          right: 40,
        },
      },
    );
  }

  // --- LOAD JSON ---
  async function loadCoexistence() {
    try {
      const url = import.meta.env.BASE_URL + "coexistence_geo.json";
      const res = await fetch(url);
      coexistenceData = await res.json();
    } catch (err) {
      console.error("Error loading coexistence JSON:", err);
    }
  }

  // --- PUBLIC API ---
  export function zoomToRecipe(recipe) {
    emptyState = false;
    clearGrid();
    resetMapView();

    const recipeName = normalize(recipe.recipe_name);
    const entry = coexistenceData.find((f) => normalize(f.name) === recipeName);
    if (!entry) return;

    drawGridCells(entry.strict_cells, "red", "#000");
    drawGridCells(entry.relaxed_cells, "#598dd6", "#598dd6");

    zoomToCells([...entry.strict_cells, ...entry.relaxed_cells]);
  }

  export function zoomToPlant(plant) {
    emptyState = false;
    clearGrid();
    resetMapView();

    const entry = coexistenceData.find((f) =>
      Object.keys(f.species_layers || {}).some(
        (k) => normalize(k) === normalize(plant.botanical_name),
      ),
    );

    if (!entry) return;

    const cells = entry.species_layers[plant.botanical_name] || [];
    drawGridCells(cells, "#a576e8", "#a576e8");
    zoomToCells(cells);
  }

  export function clearHighlight() {
    emptyState = true;
    clearGrid();
  }

  // --- INIT MAP ---
  onMount(async () => {
    await loadCoexistence();

    map = new maplibregl.Map({
      container,
      style: import.meta.env.BASE_URL + "mapstyle.json",
      center: [0, 0],
      zoom: 1,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
  });
</script>

<div bind:this={container} class="map-container"></div>

{#if emptyState}
  <div class="overlay-message">
    Select a formula to display its biogeographic grid
  </div>
{/if}

<style>
  .map-container {
    width: 100%;
    height: 100%;
  }

  .overlay-message {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(243, 213, 213, 1);
    padding: 20px 30px;
    border-radius: 12px;
    font-size: 0.9rem;
    text-align: center;
    max-width: 200px;
    z-index: 9999;
    box-shadow: 0 4px 14px rgba(218, 154, 154, 0.2);
    color: #262626;
    user-select: none;
  }
</style>
