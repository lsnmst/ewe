<script>
  import { onMount } from "svelte";
  import Map from "./components/Map.svelte";
  import { mergeRecipeData, loadTSVPapa } from "./lib/data.js";

  let recipes = [];
  let plants = [];
  let highlightName = null;
  let selectedRecipe = null;
  let loading = true;
  let error = null;
  let searchQuery = ""; // <-- search query

  onMount(async () => {
    try {
      const recipeRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `recipe.tsv?v=${Date.now()}`,
      );
      const plantRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `plants.tsv?v=${Date.now()}`,
      );
      recipes = mergeRecipeData(recipeRows, plantRows);
      plants = plantRows;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  // Filter recipes and plants by search query
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
  <p>Loading...</p>
{:else if error}
  <p style="color:red">{error}</p>
{:else}
  <div class="app-container">
    <!-- SEARCH BAR -->
    <div class="search-bar">
      <input
        type="text"
        placeholder="  Search formulae or plants..."
        bind:value={searchQuery}
      />
    </div>

    <!-- SIDEBAR -->
    <div class="sidebar">
      <h2 id="title">Cosmoscape of the Yoruba plants</h2>
      <p>
        The Yoruba cosmoscape is a symbolic cartography where Òrìṣà, energetic
        fields, and sacred habitats are arranged. In this mapped cosmology,
        plant-beings are situated as spatial actors who relate through their
        spiritual affiliation, ritual function, and traditional ecological
        domain/knowledge.<br />Explore the formulae and notice where the plants
        are located in the cosmoscape, building a new perspective from outside
        or complementary to Western ethnobotany.
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
            <h5>{recipe.odu}</h5>
            <p>{recipe.recipe}</p>
          </button>
        </div>
      {/each}
      <br /><br />
      <p style="font-size:0.9rem;">
        <u>Sources:</u><br /><br />Verger, Pierre Fatumbi (1995). Ewé: o uso das
        plantas na sociedade iorubá<br />Wande Abimbola (1977). Awon Odu Ifá<br
        />Bolaji Idowu (1962). Olódùmarè: God in Yoruba Belief<br />Henry &
        Margaret Drewal (1983). Gelede: Art and Female Power among the Yoruba<br
        />R.C. Abraham (1958). Dictionary of Modern Yoruba<br />Oyekan Owomoyela
        (2005). Yoruba Proverbs<br />Teresa N. Washington (2005). Our Mothers,
        Our Powers, Our Texts.
      </p>
    </div>

    <!-- MAP AREA -->
    <div class="map-area">
      <Map bind:this={mapRef} {plants} highlight={highlightName} />

      {#if selectedRecipe}
        <div class="plant-panel">
          <h3>{selectedRecipe.EN_recipe_name}</h3>
          <p>{selectedRecipe.recipe_EN}</p>
          {#each selectedRecipe.plantDetails as p}
            <div class="plant-card" on:click={() => selectPlant(p)}>
              <h4><u>{p.ewe_name}</u></h4>
              {#if p.details}
                <p><b>Energetic Polarity:</b> {p.details.EP}</p>
                <p><b>Ritual Function:</b> {p.details.ritual_function}</p>
                <hr />
                <b>{p.details.ifa_prescription}</b>
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
  }

  /* Mobile layout only */
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
      height: 40%;
    }

    .sidebar .recipe-item {
      display: inline-block; /* make horizontal */
      margin-right: 8px;
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
      height: 30%;
      left: 0px !important;
    }

    .plant-card {
      display: inline-block; /* horizontal cards */
      margin-right: 8px;
    }
  }
</style>
