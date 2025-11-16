<script>
  import { onMount } from "svelte";
  import Map from "./components/Map.svelte";
  import { mergeRecipeData } from "./lib/data.js";
  import { loadTSVPapa } from "./lib/data.js"; // use PapaParse loader

  let recipes = [];
  let plants = [];
  let highlightName = null;
  let loading = true;
  let error = null;

  onMount(async () => {
    console.log("onMount running...");

    try {
      console.log("Loading recipe.tsv...");
      const recipeRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `recipe.tsv?v=${Date.now()}`,
      );
      console.log("recipeRows:", recipeRows);

      console.log("Loading plants.tsv...");
      const plantRows = await loadTSVPapa(
        import.meta.env.BASE_URL + `plants.tsv?v=${Date.now()}`,
      );
      console.log("plantRows:", plantRows);

      recipes = mergeRecipeData(recipeRows, plantRows);
      plants = plantRows;
    } catch (e) {
      console.error("🔥 FATAL ERROR:", e);
      error = e.message;
    } finally {
      console.log("Setting loading = false");
      loading = false;
    }
  });

  function selectPlant(ewe_name) {
    highlightName = ewe_name;
  }
</script>

{#if loading}
  <p>Loading recipes...</p>
{:else if error}
  <p style="color:red;">{error}</p>
{:else}
  <div class="app-container">
    <div class="sidebar">
      {#each recipes as recipe}
        <h3>{recipe.EN_recipe_name}</h3>
        <p>{recipe.recipe_EN}</p>
        <ul>
          {#each recipe.plantDetails as p}
            <li>
              <button
                type="button"
                class="plant-item"
                on:click={() => selectPlant(p.ewe_name)}
              >
                {p.ewe_name} ({p.part})
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>

    <div class="map-area">
      <Map {plants} highlight={highlightName} />
    </div>
  </div>
{/if}

<style>
  .app-container {
    display: flex;
    height: 100vh;
  }
  .sidebar {
    width: 300px;
    overflow-y: auto;
    border-right: 1px solid #ddd;
    padding: 10px;
    background: #fafafa;
  }
  .map-area {
    flex: 1;
  }
  .plant-item {
    cursor: pointer;
    padding: 4px;
    border-bottom: 1px solid #eee;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
  }
  .plant-item:hover {
    background: #f0f0f0;
  }
  button.plant-item:focus {
    outline: 2px solid #3399ff;
  }
</style>
