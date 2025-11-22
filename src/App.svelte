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
  let loading = true;
  let error = null;

  let searchQuery = "";

  let showMobileInfo = false;

  const fullDescription = `The Yoruba cosmoscape is a symbolic cartography where Òrìṣà, energetic
  fields, and sacred habitats are arranged. In this mapped cosmology,
  plant-beings are situated as spatial actors who relate through their
  spiritual affiliation, ritual function, and traditional ecological
  domain/knowledge. Explore the formulae and notice where the plants
  are located in the cosmoscape, building a new perspective from outside
  or complementary to Western ethnobotany.`;

  const IUCN_MAP = {
    VU: "Vulnerable",
    EN: "Endangered",
    CR: "Critically Endangered",
    NT: "Near Threatened",
    LC: "Least Concern",
  };

  function getRawIUCN(details) {
    if (!details) return null;
    const candidates = [
      details.IUCN,
      details["IUCN "],
      details[" IUCN"],
      details["IUCN  "],
    ];
    let raw = candidates.find((v) => v && v.trim() !== "");
    return raw ? raw.trim() : null;
  }

  function getPrettyIUCN(details) {
    const raw = getRawIUCN(details);
    if (!raw) return null;
    return IUCN_MAP[raw] ?? raw;
  }

  onMount(async () => {
    try {
      const recipeRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `recipe.tsv?v=${Date.now()}`,
      );
      const plantRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `plants.tsv?v=${Date.now()}`,
      );

      // Fetch images sequentially (or use Promise.all for parallel)
      await Promise.all(
        plantRows.map(async (p) => {
          const speciesKey = p.GBIF?.match(/species\/(\d+)/)?.[1];
          if (speciesKey) {
            p.gbifImage = await fetchGBIFImage(speciesKey);
          }
        }),
      );

      recipes = mergeRecipeData(recipeRows, plantRows);
      plants = plantRows;
    } catch (e) {
      error = e.message;
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
    if (mapRef) mapRef.zoomToPlants(recipe.plantDetails);
  }

  function selectPlant(p) {
    highlightName = p.ewe_name;
    if (mapRef) mapRef.zoomToPlant(p);
  }

  let mapRef;
</script>

{#if loading}
  <div class="loading-overlay">
    <img src={viteLogo} alt="Loading..." class="loading-icon" />
    <div class="loading-text-container">
      <p class="loading-text">Loading the Cosmoscape</p>
      <div class="energy-line">
        <div class="flow"></div>
      </div>
    </div>
  </div>
{:else if error}
  <p style="color:red">{error}</p>
{:else}
  <div class="app-container">
    <div class="search-bar">
      <input
        type="text"
        placeholder="  Search formulae or plants..."
        bind:value={searchQuery}
      />
    </div>

    <div class="sidebar">
      <div class="title-row">
        <h2 id="title">Cosmoscape of the Yoruba plants</h2>

        <span
          class="info-button"
          on:click={() => (showMobileInfo = !showMobileInfo)}
        >
          ⓘ
        </span>
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
          </button>
        </div>
      {/each}

      <br /><br />
      <p style="font-size:0.9rem;">
        <u>Sources:</u><br /><br />
        Verger, Pierre Fatumbi (1995). Ewé: o uso das plantas na sociedade iorubá
        <br />Wande Abimbola (1977). Awon Odu Ifá <br />Bolaji Idowu (1962).
        Olódùmarè: God in Yoruba Belief <br />Henry & Margaret Drewal (1983).
        Gelede: Art and Female Power among the Yoruba <br />R.C. Abraham (1958).
        Dictionary of Modern Yoruba <br />Oyekan Owomoyela (2005). Yoruba
        Proverbs <br />Teresa N. Washington (2005). Our Mothers, Our Powers, Our
        Texts.
      </p>
    </div>

    <!-- MAP AREA -->
    <div class="map-area">
      <Map bind:this={mapRef} {plants} highlight={highlightName} />

      {#if selectedRecipe}
        <div class="plant-panel">
          <button
            class="close-plant-panel"
            on:click={() => (selectedRecipe = null)}
          >
            ×
          </button>
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
                    style="padding:4px; border:1px #262626 solid; padding:5px;border-radius:2px;"
                  >
                    Identified in the IUCN Red List as
                    <b>{getPrettyIUCN(p.details)}</b>
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
    width: 20%;
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
    background: #262626;
    color: #ede3e3;
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
    background: #262626;
    color: #ede3e3;
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

  @media (max-width: 768px) {
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
  }
</style>
