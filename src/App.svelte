<script>
  import { onMount } from "svelte";
  import viteLogo from "./assets/vite.svg";
  import Map from "./components/Map.svelte";
  import PlantImage from "./components/PlantImage.svelte";
  import { mergeRecipeData, loadTSVPapa, fetchGBIFImage } from "./lib/data.js";

  let recipes = [];
  let plants = [];
  let highlightName = null;
  let selectedRecipe = null;
  let mergedRecipes = [];
  let loading = true;
  let error = null;

  let searchQuery = "";
  let showMobileInfo = false;
  let mapRef;

  const fullDescription = `Which Yoruba plant-based formulae can be replicated outside Yorubaland? 
  This biogeographical map shows where the ingredients of traditional Yoruba formulae coexist in nature.
  By selecting a recipe, you can discover where at least two ingredients in the formula coexist. 
  To revive traditional Yoruba knowledge among its diaspora.`;

  const IUCN_MAP = {
    VU: "Vulnerable",
    EN: "Endangered",
    CR: "Critically Endangered",
    NT: "Near Threatened",
    LC: "Least Concern",
  };
  const VALID_IUCN = new Set(["CR", "EN", "VU", "NT", "LC"]);

  function getRawIUCN(details) {
    if (!details) return null;
    const candidates = [
      details.IUCN,
      details["IUCN "],
      details[" IUCN"],
      details["IUCN  "],
    ];
    let raw = candidates.find((v) => typeof v === "string" && v.trim() !== "");
    if (!raw) return null;
    raw = raw.trim().toUpperCase();
    return VALID_IUCN.has(raw) ? raw : null;
  }

  function getPrettyIUCN(details) {
    const raw = getRawIUCN(details);
    return raw ? (IUCN_MAP[raw] ?? raw) : null;
  }

  onMount(async () => {
    try {
      const recipeRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `recipe.tsv?v=${Date.now()}`,
      );
      const plantRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `plants.tsv?v=${Date.now()}`,
      );

      // fetch GBIF images in parallel
      await Promise.all(
        plantRows.map(async (p) => {
          const speciesKey = p.GBIF?.match(/species\/(\d+)/)?.[1];
          if (speciesKey) p.gbifImage = await fetchGBIFImage(speciesKey);
        }),
      );

      mergedRecipes = mergeRecipeData(recipeRows, plantRows);
      plants = plantRows;
      recipes = mergedRecipes.map((r) => ({
        ...r,
        hasVulnerable: r.plantDetails.some((p) =>
          ["VU", "EN", "CR"].includes(getRawIUCN(p.details)),
        ),
      }));
      console.log("Loaded recipes:", recipes);
      console.log("Loaded plants:", plants);
    } catch (e) {
      error = e.message;
      console.error("Error loading data:", e);
    } finally {
      loading = false;
    }
  });

  $: filteredRecipes = recipes.filter((r) => {
    const q = searchQuery.toLowerCase();
    const recipeNameMatch =
      r.recipe_name?.toLowerCase().includes(q) ||
      r.EN_recipe_name?.toLowerCase().includes(q);
    const plantMatch = r.plantDetails.some(
      (p) =>
        p.ewe_name?.toLowerCase().includes(q) ||
        p.details?.EN_ewe_name?.toLowerCase().includes(q),
    );
    return recipeNameMatch || plantMatch;
  });

  function selectRecipe(recipe) {
    selectedRecipe = recipe;
    highlightName = null;
    if (mapRef) {
      console.log("selectRecipe:", recipe.recipe_name);
      mapRef.zoomToRecipe(recipe);
    }
  }

  function selectPlant(p) {
    highlightName = p.ewe_name;
    if (mapRef) {
      console.log("selectPlant:", p.botanical_name);
      mapRef.zoomToPlant(p);
    }
  }
</script>

{#if loading}
  <div class="loading-overlay">
    <div class="loading-text-container">
      <h2 id="title">Yoruba Plant Formulae Across the Diaspora</h2>
      <p>{fullDescription}</p>
      <img src={viteLogo} alt="Loading..." class="loading-icon" />
      <p class="loading-text">Loading the biogeographic map</p>
      <div class="energy-line"><div class="flow"></div></div>
    </div>
  </div>
{:else if error}
  <p style="color:red">{error}</p>
{:else}
  <div class="app-container">
    <div class="search-bar">
      <input
        type="text"
        placeholder="   Search formulae or plants..."
        bind:value={searchQuery}
      />
    </div>

    <div class="sidebar">
      <div class="title-row">
        <h2>Yoruba Plant Formulae Across the Diaspora</h2>
        <span
          class="info-button"
          on:click={() => (showMobileInfo = !showMobileInfo)}>ⓘ</span
        >
      </div>

      <p class="description" class:show-mobile={showMobileInfo}>
        {fullDescription}
      </p>
      <hr />

      <h3>Formulae</h3>
      {#each filteredRecipes as recipe}
        <div class="recipe-item">
          <button
            type="button"
            class="recipe-button"
            on:click={() => selectRecipe(recipe)}
          >
            <h3>{recipe.recipe_name}</h3>
            <h5 class="onlymobile">{recipe.odu}</h5>
            <p class="onlymobile">{recipe.recipe}</p>
            {#if recipe.hasVulnerable}
              <div class="vuln-banner onlymobile">
                <span class="red-dot"></span>
                At least one ingredient is vulnerable to extinction
              </div>
            {/if}
          </button>
        </div>
      {/each}

      <br /><br />
      <p style="font-size:0.9rem;">
        <u>Data & Method</u><br /><br />
        Global native distribution ranges were sourced from Global Biodiversity Information
        Facility (GBIF) Occurrence Records. Ranges were converted into presence/absence
        grids and normalized. Species ranges were converted into 0.5° resolution
        grid cells (approx. 55 km × 55 km). For each formula, coexistence was calculated
        using: Coexistence = grid cells where ≥2 species occur. Grids were generated
        using custom processing in Python + GeoPandas, then exported as a simplified
        GeoJSON coexistence matrix. All coordinates are displayed in WGS84 / EPSG:4326
        for browser compatibility.<br /><br />

        <u>Critics & Limitations</u><br /><br />
        The species occurrence records used in this project were obtained from the
        Global Biodiversity Information Facility (GBIF). Only occurrence points containing
        valid geographic coordinates were included. Records that were missing coordinates,
        provided only country-level information, or contained obvious geospatial
        errors were excluded. Because GBIF relies on contributions from museums,
        herbaria, institutions, and citizen-science projects, its coverage is inherently
        uneven across regions and taxa. Some species may therefore be: under-represented
        due to limited sampling, recorded only in certain countries despite having
        a wider distribution, present in herbarium collections but lacking digitized
        or georeferenced data, absent from regions where they exist in the wild simply
        because no voucher specimens were uploaded. These gaps and inconsistencies
        may cause missing or incomplete grid cells on the map, particularly for culturally
        sensible species that are not collected by Western institutions, who monopolize
        funds and decision-making in research projects.<br /><br />

        <u>Bibliography:</u><br /><br />
        Verger, Pierre Fatumbi (1995). Ewé: o uso das plantas na sociedade iorubá
        <br />Wande Abimbola (1977). Awon Odu Ifá <br />Bolaji Idowu (1962).
        Olódùmarè: God in Yoruba Belief <br />Henry & Margaret Drewal (1983).
        Gelede: Art and Female Power among the Yoruba <br />R.C. Abraham (1958).
        Dictionary of Modern Yoruba <br />Oyekan Owomoyela (2005). Yoruba
        Proverbs <br />Teresa N. Washington (2005). Our Mothers, Our Powers, Our
        Texts.
      </p>
    </div>

    <div class="map-area">
      <Map bind:this={mapRef} {plants} highlight={highlightName} />

      <div class="legend">
        <div class="legend-item">
          <span class="legend-color" style="background:#598dd6;"></span>
          Coexistence of species belonging to the same formula
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background:#a576e8;"></span>
          Distribution of the species
        </div>
      </div>

      {#if selectedRecipe}
        <div class="plant-panel">
          <button
            class="close-plant-panel"
            on:click={() => {
              selectedRecipe = null;
              mapRef?.clearHighlight();
            }}>×</button
          >
          <h3>{selectedRecipe.EN_recipe_name}</h3>
          <p>{selectedRecipe.recipe_EN}</p>

          {#each selectedRecipe.plantDetails as p}
            <div class="plant-card" on:click={() => selectPlant(p)}>
              <h4 style="margin-block-end: 5px !important;">
                <u>{p.ewe_name}</u>
              </h4>
              <span class="botanical">{p.botanical_name}</span>

              {#if p.details}
                <p><b>Energetic Polarity:</b> {p.details.EP}</p>
                <p><b>Ritual Function:</b> {p.details.ritual_function}</p>
                {#if getPrettyIUCN(p.details)}
                  <p
                    style="padding:5px; border:1px #262626 solid; border-radius:2px;"
                  >
                    Identified in the IUCN Red List as <b
                      >{getPrettyIUCN(p.details)}</b
                    >
                  </p>
                {/if}
                <span
                  style="background-color:rgb(218,154,154); padding:5px;border-radius:2px;line-height:2.2rem"
                >
                  Θ {p.details.ifa_prescription}
                </span>
                {#if p.details?.gbifImage?.url}
                  {#key p.details.gbifImage.url}
                    <PlantImage {p} />
                  {/key}
                {/if}
              {:else}
                <p>No plant details found.</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: #ede3e3;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .loading-icon {
    width: 80px;
    margin-bottom: 20px;
  }

  .loading-text-container {
    display: inline-block;
    position: relative;
    text-align: center;
    width: 50%;
  }

  .loading-text {
    font-size: 1rem;
    margin: 0;
  }

  .energy-line {
    position: relative;
    height: 2px;
    width: 100%;
    background: #ccc;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 10px;
  }

  .flow {
    position: absolute;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(52, 145, 100, 0) 0%,
      rgba(83, 152, 78, 0.7) 50%,
      rgba(218, 154, 154, 0) 100%
    );
    animation: moveFlow 1.5s linear infinite;
  }

  @keyframes moveFlow {
    0% {
      left: -50%;
    }
    100% {
      left: 100%;
    }
  }

  .search-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 99%;
    height: 40px;
    z-index: 10000;
    background: #ede3e3;
    padding: 2px;
  }
  .search-bar input {
    width: 100%;
    height: 100%;
    font-size: 0.9rem;
    background: #ede3e3;
    border-radius: 1px;
    font-family: "Charis SIL", serif;
  }

  .app-container {
    display: flex;
    height: 93vh;
    padding-top: 50px; /* leave space for search bar */
  }

  .sidebar {
    width: 25%;
    overflow-y: auto;
    border-right: 1px solid #ddd;
    padding: 10px;
    background: #ede3e3;
  }
  .map-area {
    flex: 1;
    position: relative;
  }

  .close-plant-panel {
    position: absolute;
    top: 6px;
    right: 6px;
    background: none;
    border: none;
    font-size: 1.6rem;
    font-weight: bold;
    color: #262626;
    cursor: pointer;
    z-index: 99999;
    line-height: 1rem;
    padding: 0;
  }

  .close-plant-panel:hover {
    color: rgb(218, 154, 154);
  }

  .plant-panel {
    position: absolute;
    top: 5px;
    left: 5px;
    width: 25%;
    max-height: 85vh;
    overflow-y: auto;
    padding: 15px;
    background: #ede3e3;
    color: #262626;
    backdrop-filter: blur(6px);
    border-radius: 8px;
    z-index: 9999;
    font-size: 0.9rem;
    line-height: 1.05rem;
  }
  .plant-card {
    padding: 12px;
    margin-bottom: 12px;
    background: #ede3e3;
    border-radius: 10px;
    border: 1px solid #333;
    cursor: pointer;
  }
  .plant-card:hover {
    background: #a576e8;
    color: #262626;
  }
  .recipe-button {
    width: 100%;
    text-align: left;
    padding: 8px;
    margin-bottom: 4px;
    background: none;
    border: 1px solid #444;
    border-radius: 6px;
    color: #262626;
    line-height: 1.25rem;
    cursor: pointer;
  }
  .recipe-button:hover {
    background: #598dd6;
    color: #262626;
  }

  #title {
    font-size: 1.8rem;
    -webkit-text-fill-color: #262626;
    margin-block-start: 4px;
    margin-block-end: 4px;
  }

  .botanical {
    font-family: serif;
    font-style: italic;
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .info-button {
    display: none;
    font-size: 1.3rem;
    padding: 10px;
    cursor: pointer;
  }

  .description {
    margin-top: 8px;
    overflow: visible;
  }

  .vuln-banner {
    display: flex;
    align-items: center;
    color: #262626;
    border: 1px solid rgb(218, 154, 154);
    padding: 8px 10px;
    border-radius: 6px;
    margin: 10px 0;
    font-size: 0.9rem;
    line-height: 1.1rem;
  }

  .red-dot {
    width: 10px;
    height: 20px;
    background: rgb(218, 154, 154);
    border-radius: 20px;
    margin-right: 8px;
  }

  .legend {
    position: absolute;
    right: 20px;
    bottom: 20px;
    background: rgba(243, 213, 213, 1);
    padding: 12px 16px;
    border-radius: 5px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0);
    font-size: 0.8rem;
    line-height: 1.2;
    width: 220px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    margin: 4px 0;
    color: #444;
  }

  .legend-color {
    width: 16px;
    height: 16px;
    min-width: 16px;
    border-radius: 4px;
    display: inline-block;
    margin-right: 8px;
    border: 1px solid rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    .loading-text-container {
      width: 80%;
    }

    .app-container {
      display: flex;
      flex-direction: column; /* stack vertically */
      height: 100vh;
    }

    .sidebar {
      max-width: 100%; /* full width */
      width: 100%;
      border-bottom: 1px solid #ddd;
      padding: 5px;
      box-sizing: border-box;
      height: 24%;
    }

    .sidebar .recipe-item {
      display: inline-block; /* make horizontal */
      margin-right: 8px;
    }

    .recipe-item {
      display: contents !important;
    }

    .onlymobile {
      display: none;
    }

    .map-area {
      flex: 1;
      position: relative;
    }

    .plant-panel {
      max-width: 100%; /* full width */
      width: 100%;
      padding: 5px;
      box-sizing: border-box;
      height: 38%;
      left: 0px !important;
      background-color: rgb(218, 154, 154);
    }

    .plant-card {
      display: inline-block; /* horizontal cards */
      margin-right: 8px;
    }

    .info-button {
      display: inline-block;
    }

    /* Hide description on mobile unless toggled */
    .description {
      display: none;
    }
    .description.show-mobile {
      display: block;
    }

    .legend {
      bottom: 60px;
    }
  }
</style>
