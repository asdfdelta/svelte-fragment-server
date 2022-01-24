<script>
    import {
        SocialInstagramIcon,
        SocialFacebookIcon,
        SocialPinterestIcon,
        SocialTwitterIcon,
        SocialYoutubeIcon,
        FlagAmericaThumbnail,
        MobileAppIcon,
        ScrollToTop
    } from 'ashcomm-core-svelte/SVG';
    
    import { Input, Button, ListItem } from 'ashcomm-core-svelte';
    import { onMount } from 'svelte';
    import { navStore } from './nav.js';
    //import { t } from 'svelte-intl-precompile';

    let emailAlertAddress = '',
        showEmailSuccess;

    let termsPolicies = {
        name: 'Terms & Policies',
        links: [
            {
                //name: $t('footer.terms.offers'),
                name: 'footer.terms.offers',
                url: 'https://www.ashleyfurniture.com/coupons-deals-and-offers/'
            },
            {
                //name: $t('footer.terms.conditions'),
                name: 'footer.terms.conditions',
                url: 'https://www.ashleyfurniture.com/terms-and-conditions/'
            },
            {
                //name: $t('footer.terms.use'),
                name: 'footer.terms.use',
                url: 'https://www.ashleyfurniture.com/terms-of-use/'
            },
            {
                //name: $t('footer.terms.privacy'),
                name: 'footer.terms.privacy',
                url: 'https://www.ashleyfurniture.com/privacy-policy/'
            },
            {
                //name: $t('footer.terms.ads'),
                name: 'footer.terms.ads',
                url: '/interest-based-ads/',
                target: '_self'
            },
            {
                //name: $t('footer.terms.personal'),
                name: 'footer.terms.personal',
                url: 'http://preferences.ashleyfurniture.com',
                target: '_blank'
            }
        ]
    };

    let footerLinkLists = [
        {
            //name: $t('footer.links.know'),
            name: 'footer.links.know',
            links: [
                {
                    //name: $t('footer.links.about-ah'),
                    name: 'footer.links.about-ah',
                    url: 'https://www.ashleyfurniture.com/about-us/'
                },
                {
                    //name: $t('footer.links.history'),
                    name: 'footer.links.history',
                    url: 'https://www.ashleyfurnitureindustriesinc.com/en/company/history',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.about-afi'),
                    name: 'footer.links.about-afi',
                    url: 'https://www.ashleyfurnitureindustriesinc.com/en/company/company-overview',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.careers'),
                    name: 'footer.links.careers',
                    url: 'https://ashleycareers.ttcportals.com/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.news'),
                    name: 'footer.links.news',
                    url: 'https://www.ashleyfurnitureindustriesinc.com/news',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.social'),
                    name: 'footer.links.social',
                    url: 'https://www.ashleyfurniture.com/social-responsibility/'
                },
                {
                    //name: $t('footer.links.location'),
                    name: 'footer.links.location',
                    url: 'https://stores.ashleyfurniture.com'
                },
                {
                    //name: $t('footer.links.trade'),
                    name: 'footer.links.trade',
                    url: 'https://www.ashleyfurniture.com/trade/'
                }
            ]
        },
        {
            //name: $t('footer.links.cc'),
            name: 'footer.links.cc',
            links: [
                {
                    //name: $t('footer.links.help'),
                    name: 'footer.links.help',
                    url: '/ask-ashley/',
                    target: '_self'
                },
                {
                    //name: $t('footer.links.contact'),
                    name: 'footer.links.contact',
                    url: '/ask-ashley/',
                    target: '_self'
                },
                {
                    //name: $t('footer.links.financing'),
                    name: 'footer.links.financing',
                    url: 'https://www.ashleyfurniture.com/financing/'
                },
                {
                    //name: $t('footer.links.returns'),
                    name: 'footer.links.returns',
                    url: 'https://www.ashleyfurniture.com/on/demandware.store/Sites-Ashley-US-Site/default/AskAshley-ShowPage?pname=returns'
                },
                {
                    //name: $t('footer.links.accessibility'),
                    name: 'footer.links.accessibility',
                    url: 'https://www.essentialaccessibility.com/ashley-homestore/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.notifications'),
                    name: 'footer.links.notifications',
                    url: 'https://www.ashleyfurnitureindustriesinc.com/consumer-notifications',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.faq'),
                    name: 'footer.links.faq',
                    url: 'https://www.ashleyfurniture.com/on/demandware.store/Sites-Ashley-US-Site/default/AskAshley-ShowPage?pname=faqs'
                },
                {
                    //name: $t('footer.links.price-match'),
                    name: 'footer.links.price-match',
                    url: 'https://www.ashleyfurniture.com/price-match/'
                },
                {
                    //name: $t('footer.links.child'),
                    name: 'footer.links.child',
                    url: 'https://www.ashleyfurniture.com/anchorit/'
                },
                {
                    //name: $t('footer.links.warranty'),
                    name: 'footer.links.warranty',
                    url: '/warranty/',
                    target: '_self'
                },
                {
                    //name: $t('footer.links.product-care'),
                    name: 'footer.links.product-care',
                    url: 'https://www.ashleyfurniture.com/care-and-cleaning/'
                },
                {
                    //name: $t('footer.links.protection'),
                    name: 'footer.links.protection',
                    url: 'https://www.ashleyfurniture.com/furniture-protection/'
                }
            ]
        },
        {
            //name: $t('footer.links.inspired'),
            name: 'footer.links.inspired',
            links: [
                {
                    //name: $t('footer.links.blog'),
                    name: 'footer.links.blog',
                    url: 'https://blog.ashleyfurniture.com',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.ideas'),
                    name: 'footer.links.ideas',
                    url: 'https://www.ashleyfurniture.com/c/shop-by/'
                },
                {
                    //name: $t('footer.links.catalog'),
                    name: 'footer.links.catalog',
                    url: 'https://www.ashleyfurniture.com/digital-catalog/'
                },
                {
                    //name: $t('footer.links.3d'),
                    name: 'footer.links.3d',
                    url: 'https://roombuilder.ashleyfurniture.com',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.dream'),
                    name: 'footer.links.dream',
                    url: 'https://www.ahopetodream.com/',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                {
                    //name: $t('footer.links.refer'),
                    name: 'footer.links.refer',
                    url: 'https://www.ashleyfurniture.com/referafriend/'
                }
            ]
        }
    ];

    function emailAlertSignup() {
        if (emailAlertAddress && emailAlertAddress.trim() != '') {
            showEmailSuccess = true;
        } else {
            showEmailSuccess = false;
        }
    }

    onMount(() => {
        navStore.set(false);
    });
</script>

<div class="footer">
    <div class="footer-itemsignup">
        <div id="email-alert-signup" class="email-subscribefooter">
            <!--title={$t('footer.enter-email')}-->
            <!--placeholder={$t('footer.sign-up.placeholder')}-->
            <Input
                type="text"
                id="email-alert-address"
                title="footer.enter-email"
                class="input-text email email-alert-address"
                bind:value={emailAlertAddress}
                placeholder="footer.sign-up.placeholder"
                name="emailsubscribe"
                required
            />
            <!--on:click={emailAlertSignup}>{$t('footer.sign-up')}</Button-->
            <Button
                type="submit"
                name="home-email"
                value="Sign Up"
                class="email-alert-button button tertiary-alt"
                on:click={emailAlertSignup}>footer.sign-up</Button
            >
        </div>
        {#if showEmailSuccess}
            <div class="emailsignup_success">
                <!--<span>{$t('footer.congrats')}</span>-->
                <span>footer.congrats</span>
            </div>
        {:else if showEmailSuccess === false}
            <!--<div class="fieldErrMsg">{$t('footer.email')}</div>-->
            <div class="fieldErrMsg">footer.email</div>
        {/if}
    </div>
    <div class="social-icons">
        <div class="content-asset ca-online-only">
            <ul>
                <ListItem>
                    <a
                        aria-label="Instagram"
                        href="https://www.instagram.com/Ashleyhomestore/"
                        target="_blank"
                        title="Instagram"><SocialInstagramIcon /></a
                    >
                </ListItem>
                <ListItem>
                    <a
                        aria-label="Facebook"
                        href="https://www.facebook.com/AshleyHomeStore/"
                        target="_blank"
                        title="Facebook"><SocialFacebookIcon /></a
                    >
                </ListItem>
                <ListItem>
                    <a
                        aria-label="Pinterest"
                        href="https://www.pinterest.com/ashleyhomestore/"
                        target="_blank"
                        title="Pinterest"><SocialPinterestIcon /></a
                    >
                </ListItem>
                <ListItem>
                    <a aria-label="Twitter" href="https://twitter.com/ashleyhomestore" target="_blank" title="Twitter"
                        ><SocialTwitterIcon /></a
                    >
                </ListItem>
                <ListItem>
                    <a
                        aria-label="YouTube"
                        href="https://www.youtube.com/user/ashleyhomestore"
                        target="_blank"
                        title="YouTube"><SocialYoutubeIcon /></a
                    >
                </ListItem>
            </ul>
        </div>
    </div>
    <div class="mobile-apps">
        <div class="content-asset ca-online-only">
            <a aria-label="Mobile Apps" href="https://www.ashleyfurniture.com/mobileapp/">
                <MobileAppIcon />
                <!--{$t('footer.mobile')}-->
                footer.mobile
            </a>
        </div>
    </div>
    <div class="clearfix" />
    <div class="footer-link-lists">
        {#each footerLinkLists as section}
            <div class="link-list {section.class}">
                <div class="content-asset ca-online-only">
                    <h4>{section.name}</h4>
                    <ul>
                        {#each section.links as link}
                            <ListItem>
                                <a href={link.url} target={link.target} rel={link.rel}>{link.name}</a>
                            </ListItem>
                        {/each}
                    </ul>
                </div>
            </div>
        {/each}
    </div>
    <div class="country-link">
        <div class="content-asset ca-online-only">
            <a href="https://www.ashleyfurniture.com/choose-country-region/">
                <FlagAmericaThumbnail />
                <!--<span>{$t("footer.'merica")}</span>-->
                <span>footer.merica</span>
            </a>
        </div>
    </div>
    <div class="copyright-text" />
    <div class="hide-for-mobile bottom-links">
        <div class="content-asset ca-online-only">
            <h4>{termsPolicies.name}</h4>
            <ul>
                {#each termsPolicies.links as link}
                    <ListItem>
                        <a href={link.url} target={link.target}>{link.name}</a>
                    </ListItem>
                {/each}
            </ul>
        </div>
    </div>
    <div id="scroll-to-top" class="scroll-to-top">
        <div class="img-container">
            <ScrollToTop />
        </div>
    </div>
</div>

<style lang="scss" src="./_footer.scss"></style>
