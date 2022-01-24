<div class="tri-banner-desktop">
    <div class="tri-banner">
        <div class="desktop-item-slide">
            <div class="orange desktop-item">
                <a href="/c/deals/top-picks/">In-Stock &amp; Ready to Ship up to 30% Off*</a>
                <div class="tribanner-drop-down" style="background: #dc6901;">
                    <a href="/c/deals/top-picks/">Shop Now</a>
                </div>
            </div>
        </div>
        <div class="desktop-item-slide">
            <div class="dark-gray desktop-item">
                <a href="/c/outdoor/outdoor-seating/">NEW! Outdoor Price Cuts Up to 70% Off*</a>
                <div class="tribanner-drop-down" style="background: #3F4045;">
                    <a href="/c/outdoor/outdoor-seating/">Shop Now</a>
                </div>
            </div>
        </div>
        <div class="desktop-item-slide">
            <div class="light-gray desktop-item">
                <a href="/c/deals/">NEW!! Shop Limited Time Flash Deals</a>
                <div class="tribanner-drop-down" style="background: #CCCDCE;"><a href="/c/deals/">Shop Now</a></div>
            </div>
        </div>
    </div>
</div>

<style type="text/scss">
    @import '../../theme/theme';
    .tri-banner-desktop {
        position: relative;
        display: block;
        height: 40px;
        box-sizing: border-box;
    }

    .tri-banner-desktop .tri-banner {
        display: flex;
        position: absolute;
        width: calc(100% + 18px);
    }

    .tri-banner .desktop-item-slide {
        z-index: 99;
        flex: 1;
        box-sizing: border-box;
    }

    .desktop-item-slide .desktop-item {
        text-align: center;
        width: 100%;
        height: 40px;
        box-sizing: border-box;
    }

    .desktop-item > a {
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
        display: flex;
        justify-content: center;
        align-items: center;
        line-height: 14px;
        flex-wrap: wrap;
        height: 40px;
        padding: 0 15px;
    }

    .desktop-item.orange {
        background: #dc6901;
    }
    .desktop-item.dark-gray {
        background: #3f4045;
    }
    .desktop-item.light-gray {
        background: #cccdce;
    }

    .desktop-item.orange a,
    .desktop-item.dark-gray a {
        color: #fff;
    }
    .desktop-item.light-gray a {
        color: #333;
    }
    .tri-banner-desktop .desktop-item:hover .tribanner-drop-down {
        height: 35px;
        opacity: 1;
    }
    .desktop-item .tribanner-drop-down {
        height: 0px;
        opacity: 0;
        transition: all 0.15s ease-in-out;
    }
    .desktop-item .tribanner-drop-down > a {
        display: inline-block;
        text-decoration: underline;
        font-weight: normal;
        margin-bottom: 5px;
        margin-top: -5px;
        font-size: 15px;
    }
</style>
