<script>
    import Search from './Search/Search.svelte';
    import StoreLocator from './StoreLocator/StoreLocator.svelte';
    import Logo from './Logo/Logo.svelte';
    import Meganav from './Meganav/Meganav.svelte';
    import Minicart from './Minicart/Minicart.svelte';
    import Linkmenu from './Linkmenu/Linkmenu.svelte';
    import { showOverlay } from './showOverlay.js';
    import { default as Scheduler } from './Scheduler/Scheduler.svelte';
    //import { t } from 'svelte-intl-precompile';
    import { navStore } from './nav.js';
    import { onMount } from 'svelte';
    export let links = [];



    import { Button } from 'ashcomm-core-svelte';


    let banner, overlayShow, overlayHeight;

    let mainLogo = `<picture>
                        <source srcset="https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/dwb8b8f8f7/images/global/AshleyHomeStore_WebColors_Original.svg" media="(min-width: 480px)">
                        <img src="https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/dw53fd8f0c/images/global/AHS_Icon.svg" alt="Ashley HomeStore">
                    </picture>`;

    let minicartList = [
        {
            imgUrl: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/44401-38-10x8-CROP?$AFHS-PDP-Thumb-1X$',
            url: 'https://www.ashleyfurniture.com/p/nandero_sofa/4440138.html',
            name: 'Nadero Sofa',
            sku: '4440138',
            color: 'Mineral',
            qty: 1,
            price: 674.99
        }
    ];

    let linksmenu = [
        {
            url: 'https://www.ashleyfurniture.com/account/',
            title: null,
            //name: `${$t('header.links.log-in')}<br>${$t('header.links.account')}`,
            name: `header.links.log-in - header.links.account`,
            dropdown: `<ul class="user-links">
                    <li><a href="https://www.ashleyfurniture.com/orders/">header.links.orders</a></li>
                    <li><a href="https://www.ashleyfurniture.com/wishlist/">header.links.wish-list</a></li>
                    <li><a href="https://www.ashleyfurniture.com/account/">header.links.account</a></li>
                </ul>         
                <a href="https://www.ashleyfurniture.com/account/" class="redesign-button">header.links.create-account</a>`
        },
        {
            url: '/ordertracking/',
            //title: $t('header.links.delivery.alt'),
            title: 'header.links.delivery.alt',
            target: '_self',
            //name: `${$t('header.links.delivery')}<br>${$t('header.links.tracking')}`
            name: `header.links.delivery - header.links.tracking`
        },
        {
            url: 'https://roombuilder.ashleyfurniture.com',
            //title: $t('header.links.room.alt'),
            title: 'header.links.room.alt',
            //name: `${$t('header.links.room')}<br>${$t('header.links.builder')}`
            name: `header.links.room - header.links.builder`
        },
        {
            url: '/ask-ashley/',
            //title: $t('header.links.help.alt'),
            title: 'header.links.help.alt',
            target: '_self',
            //name: `<br>${$t('header.links.help')}`
            name: `header.links.help`
        },
        {
            url: 'https://www.ashleyfurniture.com/financing/',
            //title: $t('header.links.financing.alt'),
            title: 'header.links.financing.alt',
            //name: `<br>${$t('header.links.financing')}`
            name: `header.links.financing`
        }
    ];

    const topBanner1 = () => {
        return import('./assets/topbannercontent/topbannerasset1.svelte');
    };

    const topBanner2 = () => {
        return import('./assets/topbannercontent/topbannerasset2.svelte');
    };

    const topBannerBottom = () => {
        return import('./assets/trustedbanner/trustedbanner1.svelte');
    };

    const unsubscribe = showOverlay.subscribe((value) => {
        overlayShow = value;
    });

    onMount(() => {
        let topBanner = document.querySelector('.top-banner');
        overlayHeight =
            Math.max(window.innerHeight, document.body.clientHeight) -
            topBanner.offsetTop -
            topBanner.offsetHeight +
            'px';
        navStore.set(false);
    });
</script>

<div id="test-id" class="top-banner" role="banner" bind:this={banner}>
    <div class="top-banner-container">
        <Scheduler
            startDate="2021-06-09 09:30:00"
            endDate="2021-08-11 09:30:00"
            contentComponentFunction={topBanner1}
        />
        <Scheduler
            startDate="2021-08-11 09:30:01"
            endDate="2022-08-12 09:30:00"
            contentComponentFunction={topBanner2}
        />
    </div>
    <div class="header-container">
        <Logo contentHTML={mainLogo} />
        <StoreLocator
            storeName="N Dale Mabry Hwy, Tampa"
            storeHours="OPEN TODAY AT 11:00 AM"
            storeZip="33609"
            storeTime="7:00 PM"
        />
        <Search
            q="q"
            placeholder="header.search.placeholder"
            accessibility="header.search.accessibility"
            formAction=""
        />
        <Linkmenu links={linksmenu} />
        <Minicart list={minicartList} />
    </div>
    <div class="main-nav">
        <Meganav {links} />
    </div>


    <Button
    type="submit"
    name="home-email"
    value="Sign Up"
    class="email-alert-button button tertiary-alt">footer.sign-up</Button>





    <div class="trusted-banner-container">
        <Scheduler
            startDate="2021-06-09 09:30:00"
            endDate="2022-06-09 09:30:00"
            contentComponentFunction={topBannerBottom}
        />
    </div>
</div>
<div id="header-overlay" class:active={overlayShow} style="height: {overlayHeight}" />

<style lang="scss" src="./_header.scss"></style>
