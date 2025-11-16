<script>
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";

  export let plants = [];
  export let highlight = null;

  let mapDiv;
  let map;
  let markersMap = new Map();

  const MAP_BOUNDS = [
    [-0.004491014968947042, 0.004491014973545032],
    [0.004492137863052166, -0.004492137867650181],
  ];

  function updateMarkers() {
    if (!map) return;

    plants.forEach((p) => {
      if (p.X == null || p.Y == null) return;

      const lat = parseFloat(p.Y);
      const lng = parseFloat(p.X);

      let marker = markersMap.get(p.ewe_name);
      if (!marker) {
        marker = L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`<b>${p.ewe_name}</b>`);
        markersMap.set(p.ewe_name, marker);
      }

      if (highlight === p.ewe_name) {
        marker.openPopup();
        map.setView([lat, lng], map.getZoom());
      }
    });
  }

  onMount(() => {
    map = L.map(mapDiv, {
      center: [0, 0],
      zoom: 20,
      minZoom: 0,
      maxZoom: 20,
    });

    L.tileLayer(
      "https://www.alessandromusetta.com/geo/tiles/ewe/carto/{z}/{x}/{y}.png",
      { tms: true, minZoom: 0, maxZoom: 20, noWrap: true },
    ).addTo(map);

    map.fitBounds(MAP_BOUNDS);
    updateMarkers();
  });

  $: if (map && plants.length) updateMarkers();

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
</style>
