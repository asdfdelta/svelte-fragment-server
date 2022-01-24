<script>
    import { Input, Button } from 'ashcomm-core-svelte';
    import { SearchIcon } from 'ashcomm-core-svelte/SVG';
    export let q, placeholder, accessibility, formAction;

    let searchInputValue = '';

    function doSearch(e) {
        e.stopPropagation();
        e.preventDefault();

        const href = '/search/' + searchInputValue;
        location.href = href;
    }
</script>

<div class="header-search">
    <form role="search" action={formAction} method="get" name="simpleSearch">
        <label class="visually-hidden" for="q">Search Catalog</label>
        <span class="visually-hidden search-accessibility">{accessibility}</span>
        <Input
            type="text"
            id={q}
            name={q}
            bind:value={searchInputValue}
            {placeholder}
            maxlength="500"
            class="valid no-outline"
            ariaInvalid="false"
            autocomplete="off"
        />
        <Input type="hidden" id="lang" name="lang" value="default" placeholder="" maxlength="" autocomplete="off" />
        <Button class="unset" style="margin-top:10px" name="search" type="submit" value="Submit" on:click={doSearch}
            ><span class="visually-hidden">Search</span><SearchIcon /></Button
        >
    </form>
</div>

<style lang="scss" src="./search.scss"></style>
