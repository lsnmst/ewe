<script>
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import "leaflet-minimap";
  import "leaflet-minimap/dist/Control.MiniMap.min.css";

  export let plants = [];
  export let highlight = null; // now can be string or array

  let mapDiv;
  let map;
  let markersMap = new Map();

  const MAP_BOUNDS = [
    [-0.004491014968947042, 0.004491014973545032],
    [0.004492137863052166, -0.004492137867650181],
  ];

  const TILE_URL =
    "https://www.alessandromusetta.com/geo/tiles/ewe/carto/{z}/{x}/{y}.png";
  const TILE_MINIMAP_URL =
    "https://www.alessandromusetta.com/geo/tiles/ewe/myth/{z}/{x}/{y}.png";

  const normalIcon = L.divIcon({
    className: "custom-marker",
    html: `<svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" fill="#ede3e3" stroke="#000000" stroke-width="2"/>
           </svg>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  const highlightIcon = L.divIcon({
    className: "custom-marker",
    html: `
      <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" fill="#da9a9a" stroke="#fff" stroke-width="2"/>
      <line x1="10" y1="10" x2="22" y2="22" stroke="#262626" stroke-width="3" stroke-linecap="round"/>
      <line x1="22" y1="10" x2="10" y2="22" stroke="#262626" stroke-width="3" stroke-linecap="round"/>
      </svg>           
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  function updateMarkers() {
    if (!map) return;

    const highlightArray = Array.isArray(highlight)
      ? highlight
      : highlight
        ? [highlight]
        : [];

    plants.forEach((p, i) => {
      if (p.X == null || p.Y == null) return;

      const lat = parseFloat(p.Y);
      const lng = parseFloat(p.X);
      const key = `${p.ewe_name}-${p.part}-${i}`;
      let marker = markersMap.get(key);
      const isHighlighted = highlightArray.includes(p.ewe_name);

      if (!marker) {
        marker = L.marker([lat, lng], {
          icon: isHighlighted ? highlightIcon : normalIcon,
        })
          .addTo(map)
          .bindPopup(`<b>${p.ewe_name}</b>`);
        markersMap.set(key, marker);
      } else {
        marker.setIcon(isHighlighted ? highlightIcon : normalIcon);
      }
    });
  }

  export function zoomToPlants(plantsArray) {
    if (!map || !plantsArray?.length) return;

    const latlngs = plantsArray
      .filter((p) => p.X != null && p.Y != null)
      .map((p) => [Number(p.Y), Number(p.X)]);

    if (!latlngs.length) return;

    // set highlight to all plants in this recipe
    highlight = plantsArray.map((p) => p.ewe_name);

    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  export function zoomToPlant(p) {
    if (!map || p.X == null || p.Y == null) return;
    highlight = p.ewe_name; // single highlight
    map.setView([Number(p.Y), Number(p.X)], 19, { animate: true });
  }

  onMount(() => {
    map = L.map(mapDiv, {
      center: [0, 0],
      zoom: 20,
      minZoom: 16,
      maxZoom: 20,
      zoomControl: false,
    });

    L.tileLayer(TILE_URL, {
      tms: true,
      noWrap: true,
      minZoom: 16,
      maxZoom: 20,
    }).addTo(map);

    map.fitBounds(MAP_BOUNDS);

    const miniLayer = L.tileLayer(TILE_MINIMAP_URL, {
      tms: true,
      noWrap: true,
      minZoom: 0,
      maxZoom: 20,
    });

    new L.Control.MiniMap(miniLayer, {
      toggleDisplay: true,
      minimized: false,
      zoomLevelOffset: -2,
      width: 200,
      height: 200,
      aimingRectOptions: {
        color: "#ede3e3",
        weight: 1,
        fill: false,
      },
    }).addTo(map);

    L.control.zoom({ position: "topleft" }).addTo(map);

    updateMarkers();
  });

  $: if (map && plants.length && markersMap.size === 0) {
    updateMarkers();
  }
  $: if (map && highlight) updateMarkers();

  onDestroy(() => map?.remove());
</script>

<div bind:this={mapDiv} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 500px;
    background-color: #262626;
  }
  .custom-marker {
    pointer-events: auto;
  }
</style>
