<script>
    import { ListItem } from 'ashcomm-core-svelte';
    import { showOverlay } from '../showOverlay.js';
    import { onMount } from 'svelte';
    export let links = [];

    let nav;

    function showCategories(link) {
        let leftPosition = link.menuCategoryTag?.offsetLeft - 28; // Show the menu slightly to the left of the link

        // If the menu is located beyond the window, adjust its left position
        if (document.body.clientWidth - link.menuCategoryTag.offsetLeft < link.catagoriesContainerTag.offsetWidth)
            leftPosition = document.body.clientWidth - link.catagoriesContainerTag.offsetWidth - 2; // Substract 2 so it does not show right on the right border

        link.catagoriesContainerTag.style.left = leftPosition + 'px';
        link.catagoriesContainerTag.style.top = link.menuCategoryTag.offsetTop + nav.offsetHeight - 1 + 'px'; // Show the menu below the link

        showOverlay.set(true);
    }

    onMount(() => {
        showOverlay.set(false);
    });
</script>

<nav id="navigation" role="navigation" bind:this={nav}>
    {#if links.length}
        <ul class="menu-category">
            {#each links as link}
                <ListItem class="level-1 custom-content-dropdown" style={link.style} horizontal>
                    <a
                        class="has-sub-menu show-menu-item category-{link.pathId} custom-content-dropdown"
                        href={link.path}
                        data-level="1"
                        data-cgid={link.pathId}
                        bind:this={link.menuCategoryTag}
                        on:mouseenter={showCategories(link)}
                        on:mouseleave={() => showOverlay.set(false)} 
                        target="_self"
                    >
                        <span>{link.name}</span>
                    </a>
                    {#if link.columns != undefined}
                        <div
                            class="level-2"
                            data-container-level="2"
                            bind:this={link.catagoriesContainerTag}
                            on:mouseenter={() => showOverlay.set(true)}
                            on:mouseleave={() => showOverlay.set(false)}
                        >
                            {#each link.columns as col}
                                {#if col.length}
                                    <div class="menu-col">
                                        {#each col as subCats}
                                            <div>
                                                <a
                                                    href={subCats.path}
                                                    class="main-category"
                                                    class:has-sub-menu={subCats.subcategories &&
                                                        subCats.subcategories.length > 1}
                                                    data-level="2"
                                                    data-cgid={subCats.pathId} 
                                                    target="_self">{subCats.name}</a
                                                >
                                                {#if subCats.subcategories != undefined}
                                                    <ul class="menu-vertical key-accessible">
                                                        {#each subCats.subcategories as subCat}
                                                            <ListItem>
                                                                <a
                                                                    href={subCat.path}
                                                                    data-level="2"
                                                                    data-cgid={subCat.pathId} 
                                                                    target="_self">{subCat.name}</a
                                                                >
                                                            </ListItem>
                                                        {/each}
                                                    </ul>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </ListItem>
            {/each}
        </ul>
    {/if}
</nav>

<style lang="scss" src="./meganav.scss"></style>
