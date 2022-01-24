<script>
    import { ListItem } from 'ashcomm-core-svelte';
    import { CloseIcon } from 'ashcomm-core-svelte/SVG';
    import { showOverlay } from '../showOverlay.js';
    export let links = [];

    function showDropdown(e, link) {
        if (link.dropdown) {
            e.preventDefault();
            link.showDropdown = true;
            links = links;
        }
        showOverlay.set(true);
    }
</script>

<ul class="menu-utility-user">
    {#each links as link}
        <ListItem class="util-link header-flyout-trigger">
            <a
                href={link.url}
                title={link.title}
                class="account-text-container"
                on:click={(e) => showDropdown(e, link)}
            >
                {@html link.name}
            </a>
            {#if link.dropdown}
                <div class="header-user-panel header-flyout {link.showDropdown === true ? 'show' : ''}">
                    <div class="close-header-overlay">
                        <span
                            class="icon-closethick"
                            on:click={() => {
                                link.showDropdown = false;
                                showOverlay.set(false);
                            }}><CloseIcon /></span
                        >
                    </div>
                    {@html link.dropdown}
                </div>
            {/if}
        </ListItem>
    {/each}
</ul>

<style lang="scss" src="./linkmenu.scss"></style>
