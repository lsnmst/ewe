<script>
    import { lazyLoad } from "../lib/lazy.js";
    export let p;

    let show = true;

    function hideImage() {
        show = false;
    }
</script>

{#if show}
    <img
        use:lazyLoad
        data-src={p.details.gbifImage.thumbnail || p.details.gbifImage.url}
        alt={p.botanical_name}
        loading="lazy"
        class="plant-image"
        on:error={hideImage}
        style="width:100%; border-radius:8px; margin:8px 0;"
    />

    <small style="opacity:0.6;" on:error={hideImage}>
        {#if p.details.gbifImage.institution}
            Source: {p.details.gbifImage.institution}
        {/if}
        {#if p.details.gbifImage.holder}
            — Rights: {p.details.gbifImage.holder}
        {/if}
    </small>
{/if}

<style>
    .plant-image {
        cursor: context-menu;
    }
</style>
