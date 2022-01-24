<script>
    import { setContext } from 'svelte';
    import { ArrowCarouselLeftIcon } from 'ashcomm-core-svelte/SVG';
    import { Content, Modal } from 'ashcomm-core-svelte';
    import { writable } from 'svelte/store';
    import { t } from 'svelte-intl-precompile';
    import { default as content } from './StoreLocatorPopup.svelte';
    export let storeName, storeHours, storeZip, storeTime;

    let storeMessage = '',
        currentHour = new Date().getHours(),
        thisCloseTime = storeTime,
        thisStoreHours = storeHours,
        openTime = parseInt(thisStoreHours.replace(/[A-Z]/g, ''), 10),
        closeTime = parseInt(thisCloseTime, 10) + 12;

    if (currentHour >= openTime && currentHour <= closeTime) {
        storeMessage = 'OPEN UNTIL ' + storeTime;
    } else {
        storeMessage = storeHours;
    }

    setContext('storeZip', storeZip);
    setContext('storeTime', storeTime);

    let styleWindowWrap = {
        paddingTop: '40px;'
    };

    let styleWindow = {
        width: '300px;',
        borderRadius: '0px;'
    };

    let styleContent = {
        padding: '30px 20px;'
    };

    let styleCloseButton = {
        color: '$black;',
        transition: 'none;',
        border: 'none;',
        borderRadius: '0px;',
        boxShadow: 'none;',
        cursor: 'pointer;'
    };

    const modal = writable(null);
</script>

<div class="header-local-pricing">
    <div class="local-pricing-status-container">
        <input type="hidden" class="is_today_closed" value="null" />
        <div class="local-pricing-label">
            store-locator.closest
        </div>
        <div class="local-pricing-zip-code">{storeName}</div>
        <div
            id="js-local-pricing-link"
            class="js-local-pricing-link local-pricing-link"
            data-href="/on/demandware.store/Sites-Ashley-US-Site/default/CustomerPersonalization-EnterZipCode?fullContent=true"
        >
            <Modal show={$modal} closeOnEsc={false} {styleCloseButton} {styleContent} {styleWindow} {styleWindowWrap}>
                <Content popupContent={content}>
                    <ArrowCarouselLeftIcon />
                </Content>
            </Modal>
        </div>
        <div class="local-pricing-label hours">{storeMessage}</div>
        <input type="hidden" name="userZipCode" value={storeZip} />
    </div>
</div>

<style lang="scss" src="./storelocator.scss"></style>
