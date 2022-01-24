<script>
    import { getContext } from 'svelte';
    import { Input, Button } from 'ashcomm-core-svelte';
    import { t } from 'svelte-intl-precompile';

    let storeZip = getContext('storeZip');
    let storeTime = getContext('storeTime');
</script>

<div
    id="LocalPricingDialog"
    class="dialog-content ui-dialog-content ui-widget-content"
    scrolltop="0"
    scrollleft="0"
    style="width: auto; min-height: 98px; height: auto;"
>
    <form
        action="https://www.ashleyfurniture.com/on/demandware.store/Sites-Ashley-US-Site/default/CustomerPersonalization-SetZipCode"
        method="post"
        id="zip-code-entry-form"
        class="zip-code-entry-form"
    >
        <fieldset>
            <h4>{$t('store-locator.change-location')}</h4>

            <div class="form-row required">
                <label for="zipcodeentry_postal" id="zipcodeentry_postal-label"
                    ><span>{$t('store-locator.zip')}</span><span class="required-indicator">*</span></label
                >

                <div class="field-wrapper">
                    <Input
                        class="input-text numbers-hypen-only postal required"
                        type="text"
                        id="zipcodeentry_postal"
                        name="zipcodeentry_postal"
                        value=""
                        placeholder={storeZip}
                        maxlength="5"
                    />
                </div>

                <span class="form-caption" id="zipcodeentry_postal-desc" />
            </div>

            <div class="form-row form-row-button form-row-bottom-zero">
                <Button class="redesign-button update-button" type="submit" value="Update" name="zipcodeentry_update"
                    >{$t('store-locator.update')}</Button
                >
            </div>
        </fieldset>
    </form>

    <div class="closest-store-wrap">
        <input
            type="hidden"
            name="closest-store-hours-html"
            id="closest-store-hours-html"
            value="Mon: 11:00AM-07:00PM <br/>Tue: 11:00AM-07:00PM <br/>Wed: 11:00AM-07:00PM <br/>Thu: 11:00AM-07:00PM <br/>Fri: 11:00AM-07:00PM <br/>Sat: 11:00AM-07:00PM <br/>Sun: 11:00AM-07:00PM"
        />

        <div class="closest-store-heading">
            <p>store-locator.closest-to <span>{storeZip}</span></p>
            <input type="hidden" id="is-today-closed" value="null" />
        </div>

        <div class="closest-store-address">
            <div class="closest-store-address-text">
                <div class="closest-store-name">Ashley HomeStore</div>
                <div class="closest-store-address">2915 N Dale Mabry Hwy</div>
                <div class="closest-store-citystatezip">Tampa, FL 33607</div>

                <div id="closest-store-phone-number" class="closest-store-phone">
                    <b> {$t('store-locator.number')}</b><a href="tel:+18139403272">813-940-3272</a>
                    <br />
                    <b> {$t('store-locator.customer-service')}</b><a href="tel:+18004770097">800-477-0097</a>
                </div>
            </div>
        </div>

        <div class="closest-store-hours">
            {#if storeTime}
                <h3 class="closest-store-hours-open">
                    {$t('store-locator.open')}<span class="closest-store-hours-value">{storeTime}</span>
                </h3>
            {:else}
                <h3 class="closest-store-hours-closed visually-hidden">{$t('store-locator.closed')}</h3>
            {/if}
        </div>

        <div class="closest-store-links">
            <a
                class="redesign-button"
                href="https://stores.ashleyfurniture.com/store/us/florida/tampa/7710000102"
                target="blank">{$t('store-locator.details')}</a
            >
            <a class="redesign-button" href="https://stores.ashleyfurniture.com/" target="blank"
                >{$t('store-locator.locations')}</a
            >
        </div>
    </div>
</div>

<style lang="scss" src="./storelocatorpopup.scss"></style>
