<script>
    import { slide } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { onMount } from 'svelte';
    import { CartQuantityShadow, ShoppingCartIcon } from 'ashcomm-core-svelte/SVG';
    import { ContentAsset } from 'ashcomm-core-svelte';
    import { t } from 'svelte-intl-precompile';
    export let list = [],
        subtotal = 0,
        htmlContent = '';

    let showMinicart = false;

    function showCart() {
        if (list.length != 0) showMinicart = true;
    }

    function calculateSum() {
        subtotal = list.reduce((accumulator, currentValue) => accumulator + currentValue.price, 0);
    }

    onMount(() => {
        calculateSum();
    });
</script>

<div id="mini-cart" on:mouseenter={showCart} on:mouseleave={() => (showMinicart = false)}>
    <div class="mini-cart-total">
        <a
            class="mini-cart-link"
            href="https://www.ashleyfurniture.com/cart/"
            title="View Shopping Cart"
            aria-expanded="false"
        >
            <ShoppingCartIcon />
            <CartQuantityShadow />
            <span class="minicart-quantity">{list.length}</span>
        </a>
    </div>

    {#if showMinicart}
        <div
            class="mini-cart-content"
            transition:slide={{ delay: 800, duration: 1100, easing: quintOut }}
            on:mouseenter={showCart}
            on:mouseleave={() => (showMinicart = false)}
        >
            <div class="mini-cart-products">
                {#each list as item}
                    <div class="mini-cart-product">
                        <div class="mini-cart-image">
                            <img src={item.imgUrl} alt={item.alt} />
                        </div>
                        <div class="mini-cart-name">
                            <a href={item.url} title="Go to Product: {item.name}">
                                {item.name}
                                {#if item.setAmount}
                                    <span class="name-set"> ({$t('mini-cart.set')}{item.setAmount})</span>
                                {/if}
                            </a>
                        </div>
                        <div class="mini-cart-attributes">
                            <div class="attribute-skuid">{$t('mini-cart.item')}{item.sku}</div>
                            <div class="attribute" data-attribute={item.dt}>
                                <span class="label">{$t('mini-cart.color')}</span>
                                <span class="value">{item.color}</span>
                            </div>
                        </div>
                        <div class="mini-cart-pricing">
                            <span class="label">{$t('mini-cart.qty')}</span>
                            <span class="value">{item.qty}</span>
                            <span class="mini-cart-price">${item.price}</span>
                        </div>
                        <div class="minicart-product-option">
                            <span class="label">
                                <a
                                    class="remove-cart-item"
                                    href="/Cart-RemoveProduct?pid=R600021632&amp;uuid=c2e5b465a44733d22d7f0d3d0e"
                                >
                                    {$t('mini-cart.remove')}
                                </a>
                            </span>
                            |
                            <span class="label">
                                <a
                                    class="save-item"
                                    data-auth="false"
                                    href="/Wishlist-Add?pid=R600021632&amp;uuid=c2e5b465a44733d22d7f0d3d0e&amp;Quantity=1%2e0"
                                >
                                    {$t('mini-cart.save')}
                                </a>
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
            <div class="mini-cart-totals">
                <div class="mini-cart-subtotals">
                    <span class="label">{$t('mini-cart.cart')} ({list.length})</span>
                    <div class="mini-cart-subtotals-price">
                        <span class="label">{$t('mini-cart.subtotal')}</span>
                        <span class="value">${subtotal}</span>
                    </div>
                </div>
                <div class="mini-cart-promo" />
                <div class="mini-cart-slot">
                    <ContentAsset contentHTML={htmlContent} />
                </div>
                <a class="button mini-cart-link-cart" href="https://www.ashleyfurniture.com/cart/" title="Go to Cart"
                    >{$t('mini-cart.view-cart')}</a
                >
            </div>
            <i />
        </div>
    {/if}
</div>

<style lang="scss" src="./minicart.scss"></style>
