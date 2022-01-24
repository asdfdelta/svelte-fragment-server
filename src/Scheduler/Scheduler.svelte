<script>
    import { ContentAsset } from 'ashcomm-core-svelte';
    export let startDate = '',
        endDate = '',
        contentComponent = undefined,
        contentComponentFunction = undefined,
        contentHTML = undefined;
    let lazyLoadComponent, todayInRange;

    function checkRange(startDate, endDate) {
        // Convert to timestamp
        let start = new Date(Date.parse(startDate)).getTime();
        let end = new Date(Date.parse(endDate)).getTime();
        let current = new Date().getTime();
        // Return if today's date is between start date & end date
        return current >= start && current <= end;
    }

    if (checkRange(startDate, endDate)) {
        if (contentComponentFunction) {
            lazyLoadComponent = contentComponentFunction();
        }
        todayInRange = true;
    }
</script>

{#if todayInRange}
    {#if contentHTML != null}
        <ContentAsset {contentHTML} />
    {:else if lazyLoadComponent != null}
        {#await lazyLoadComponent}
            <!-- await -->
        {:then c}
            <ContentAsset contentComponent={c.default} />
        {:catch error}
            <!-- Error logging logic goes here -->
        {/await}
    {:else if contentComponent}
        <ContentAsset {contentComponent} />
    {:else}
        <!-- Render no content -->
        <ContentAsset />
    {/if}
{/if}
