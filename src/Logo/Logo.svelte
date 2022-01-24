<script>
    import { ContentAsset } from 'ashcomm-core-svelte';
    export let contentHTML;
</script>

<div class="primary-logo">
    <a href="https://www.ashleyfurniture.com" title="Ashley Furniture HomeStore Home">
        <ContentAsset {contentHTML} />
    </a>
</div>

<style lang="scss" src="./logo.scss"></style>
