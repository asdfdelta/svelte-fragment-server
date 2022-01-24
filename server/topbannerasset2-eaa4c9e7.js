'use strict';

var Header = require('./Header-62514acc.js');
require('$lib/Header/showOverlay.js');

/* src\assets\topbannercontent\topbannerasset2.svelte generated by Svelte v3.44.1 */

const css = {
	code: "body{font-family:\"Open Sans\", Arial, sans-serif;overflow-x:hidden}h1{font-weight:700;font-size:60px;line-height:60px}h2{font-weight:700;font-size:36px;line-height:36px}h3{font-weight:700;font-size:28px;line-height:28px}h4{font-weight:400;font-size:23px;line-height:23px}h5{font-weight:400;font-size:18px;line-height:18px}h6{font-weight:400;font-size:16px;line-height:16px}p{font-size:14px;line-height:14px;font-weight:400}p.large{font-size:16px;line-height:16px;font-weight:400}p.small{font-size:12px;line-height:12px;font-weight:400}p.italic{font-style:italic}p.semi-bold{font-weight:600}p.bold{font-weight:700}.visibility-hidden{visibility:hidden}.visually-hidden{border:0 !important;clip:rect(0 0 0 0);height:1px !important;margin:-1px !important;overflow:hidden;padding:0 !important;position:absolute;width:1px !important}.tri-banner-desktop.svelte-12ikqam.svelte-12ikqam.svelte-12ikqam{position:relative;display:block;height:40px;box-sizing:border-box}.tri-banner-desktop.svelte-12ikqam .tri-banner.svelte-12ikqam.svelte-12ikqam{display:flex;position:absolute;width:calc(100% + 18px)}.tri-banner.svelte-12ikqam .desktop-item-slide.svelte-12ikqam.svelte-12ikqam{z-index:99;flex:1;box-sizing:border-box}.desktop-item-slide.svelte-12ikqam .desktop-item.svelte-12ikqam.svelte-12ikqam{text-align:center;width:100%;height:40px;box-sizing:border-box}.desktop-item.svelte-12ikqam>a.svelte-12ikqam.svelte-12ikqam{font-size:15px;font-weight:600;text-decoration:none;display:flex;justify-content:center;align-items:center;line-height:14px;flex-wrap:wrap;height:40px;padding:0 15px}.desktop-item.orange.svelte-12ikqam.svelte-12ikqam.svelte-12ikqam{background:#dc6901}.desktop-item.dark-gray.svelte-12ikqam.svelte-12ikqam.svelte-12ikqam{background:#3f4045}.desktop-item.light-gray.svelte-12ikqam.svelte-12ikqam.svelte-12ikqam{background:#cccdce}.desktop-item.orange.svelte-12ikqam a.svelte-12ikqam.svelte-12ikqam,.desktop-item.dark-gray.svelte-12ikqam a.svelte-12ikqam.svelte-12ikqam{color:#fff}.desktop-item.light-gray.svelte-12ikqam a.svelte-12ikqam.svelte-12ikqam{color:#333}.tri-banner-desktop.svelte-12ikqam .desktop-item:hover .tribanner-drop-down.svelte-12ikqam.svelte-12ikqam{height:35px;opacity:1}.desktop-item.svelte-12ikqam .tribanner-drop-down.svelte-12ikqam.svelte-12ikqam{height:0px;opacity:0;transition:all 0.15s ease-in-out}.desktop-item.svelte-12ikqam .tribanner-drop-down.svelte-12ikqam>a.svelte-12ikqam{display:inline-block;text-decoration:underline;font-weight:normal;margin-bottom:5px;margin-top:-5px;font-size:15px}",
	map: "{\"version\":3,\"file\":\"topbannerasset2.svelte\",\"sources\":[\"topbannerasset2.svelte\"],\"sourcesContent\":[\"<div class=\\\"tri-banner-desktop\\\">\\r\\n    <div class=\\\"tri-banner\\\">\\r\\n        <div class=\\\"desktop-item-slide\\\">\\r\\n            <div class=\\\"orange desktop-item\\\">\\r\\n                <a href=\\\"/c/deals/top-picks/\\\">In-Stock &amp; Ready to Ship up to 30% Off*</a>\\r\\n                <div class=\\\"tribanner-drop-down\\\" style=\\\"background: #dc6901;\\\">\\r\\n                    <a href=\\\"/c/deals/top-picks/\\\">Shop Now</a>\\r\\n                </div>\\r\\n            </div>\\r\\n        </div>\\r\\n        <div class=\\\"desktop-item-slide\\\">\\r\\n            <div class=\\\"dark-gray desktop-item\\\">\\r\\n                <a href=\\\"/c/outdoor/outdoor-seating/\\\">NEW! Outdoor Price Cuts Up to 70% Off*</a>\\r\\n                <div class=\\\"tribanner-drop-down\\\" style=\\\"background: #3F4045;\\\">\\r\\n                    <a href=\\\"/c/outdoor/outdoor-seating/\\\">Shop Now</a>\\r\\n                </div>\\r\\n            </div>\\r\\n        </div>\\r\\n        <div class=\\\"desktop-item-slide\\\">\\r\\n            <div class=\\\"light-gray desktop-item\\\">\\r\\n                <a href=\\\"/c/deals/\\\">NEW!! Shop Limited Time Flash Deals</a>\\r\\n                <div class=\\\"tribanner-drop-down\\\" style=\\\"background: #CCCDCE;\\\"><a href=\\\"/c/deals/\\\">Shop Now</a></div>\\r\\n            </div>\\r\\n        </div>\\r\\n    </div>\\r\\n</div>\\r\\n\\r\\n<style type=\\\"text/scss\\\">/* Colors */\\n/* z-indexes */\\n:global(body) {\\n  font-family: \\\"Open Sans\\\", Arial, sans-serif;\\n  overflow-x: hidden;\\n}\\n\\n:global(h1) {\\n  font-weight: 700;\\n  font-size: 60px;\\n  line-height: 60px;\\n}\\n\\n:global(h2) {\\n  font-weight: 700;\\n  font-size: 36px;\\n  line-height: 36px;\\n}\\n\\n:global(h3) {\\n  font-weight: 700;\\n  font-size: 28px;\\n  line-height: 28px;\\n}\\n\\n:global(h4) {\\n  font-weight: 400;\\n  font-size: 23px;\\n  line-height: 23px;\\n}\\n\\n:global(h5) {\\n  font-weight: 400;\\n  font-size: 18px;\\n  line-height: 18px;\\n}\\n\\n:global(h6) {\\n  font-weight: 400;\\n  font-size: 16px;\\n  line-height: 16px;\\n}\\n\\n:global(p) {\\n  font-size: 14px;\\n  line-height: 14px;\\n  font-weight: 400;\\n}\\n\\n:global(p.large) {\\n  font-size: 16px;\\n  line-height: 16px;\\n  font-weight: 400;\\n}\\n\\n:global(p.small) {\\n  font-size: 12px;\\n  line-height: 12px;\\n  font-weight: 400;\\n}\\n\\n:global(p.italic) {\\n  font-style: italic;\\n}\\n\\n:global(p.semi-bold) {\\n  font-weight: 600;\\n}\\n\\n:global(p.bold) {\\n  font-weight: 700;\\n}\\n\\n:global(.visibility-hidden) {\\n  visibility: hidden;\\n}\\n\\n:global(.visually-hidden) {\\n  border: 0 !important;\\n  clip: rect(0 0 0 0);\\n  height: 1px !important;\\n  margin: -1px !important;\\n  overflow: hidden;\\n  padding: 0 !important;\\n  position: absolute;\\n  width: 1px !important;\\n}\\n\\n.tri-banner-desktop {\\n  position: relative;\\n  display: block;\\n  height: 40px;\\n  box-sizing: border-box;\\n}\\n\\n.tri-banner-desktop .tri-banner {\\n  display: flex;\\n  position: absolute;\\n  width: calc(100% + 18px);\\n}\\n\\n.tri-banner .desktop-item-slide {\\n  z-index: 99;\\n  flex: 1;\\n  box-sizing: border-box;\\n}\\n\\n.desktop-item-slide .desktop-item {\\n  text-align: center;\\n  width: 100%;\\n  height: 40px;\\n  box-sizing: border-box;\\n}\\n\\n.desktop-item > a {\\n  font-size: 15px;\\n  font-weight: 600;\\n  text-decoration: none;\\n  display: flex;\\n  justify-content: center;\\n  align-items: center;\\n  line-height: 14px;\\n  flex-wrap: wrap;\\n  height: 40px;\\n  padding: 0 15px;\\n}\\n\\n.desktop-item.orange {\\n  background: #dc6901;\\n}\\n\\n.desktop-item.dark-gray {\\n  background: #3f4045;\\n}\\n\\n.desktop-item.light-gray {\\n  background: #cccdce;\\n}\\n\\n.desktop-item.orange a,\\n.desktop-item.dark-gray a {\\n  color: #fff;\\n}\\n\\n.desktop-item.light-gray a {\\n  color: #333;\\n}\\n\\n.tri-banner-desktop .desktop-item:hover .tribanner-drop-down {\\n  height: 35px;\\n  opacity: 1;\\n}\\n\\n.desktop-item .tribanner-drop-down {\\n  height: 0px;\\n  opacity: 0;\\n  transition: all 0.15s ease-in-out;\\n}\\n\\n.desktop-item .tribanner-drop-down > a {\\n  display: inline-block;\\n  text-decoration: underline;\\n  font-weight: normal;\\n  margin-bottom: 5px;\\n  margin-top: -5px;\\n  font-size: 15px;\\n}</style>\\r\\n\"],\"names\":[],\"mappings\":\"AA6BQ,IAAI,AAAE,CAAC,AACb,WAAW,CAAE,WAAW,CAAC,CAAC,KAAK,CAAC,CAAC,UAAU,CAC3C,UAAU,CAAE,MAAM,AACpB,CAAC,AAEO,EAAE,AAAE,CAAC,AACX,WAAW,CAAE,GAAG,CAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,AACnB,CAAC,AAEO,EAAE,AAAE,CAAC,AACX,WAAW,CAAE,GAAG,CAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,AACnB,CAAC,AAEO,EAAE,AAAE,CAAC,AACX,WAAW,CAAE,GAAG,CAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,AACnB,CAAC,AAEO,EAAE,AAAE,CAAC,AACX,WAAW,CAAE,GAAG,CAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,AACnB,CAAC,AAEO,EAAE,AAAE,CAAC,AACX,WAAW,CAAE,GAAG,CAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,AACnB,CAAC,AAEO,EAAE,AAAE,CAAC,AACX,WAAW,CAAE,GAAG,CAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,AACnB,CAAC,AAEO,CAAC,AAAE,CAAC,AACV,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,CACjB,WAAW,CAAE,GAAG,AAClB,CAAC,AAEO,OAAO,AAAE,CAAC,AAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,CACjB,WAAW,CAAE,GAAG,AAClB,CAAC,AAEO,OAAO,AAAE,CAAC,AAChB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,CACjB,WAAW,CAAE,GAAG,AAClB,CAAC,AAEO,QAAQ,AAAE,CAAC,AACjB,UAAU,CAAE,MAAM,AACpB,CAAC,AAEO,WAAW,AAAE,CAAC,AACpB,WAAW,CAAE,GAAG,AAClB,CAAC,AAEO,MAAM,AAAE,CAAC,AACf,WAAW,CAAE,GAAG,AAClB,CAAC,AAEO,kBAAkB,AAAE,CAAC,AAC3B,UAAU,CAAE,MAAM,AACpB,CAAC,AAEO,gBAAgB,AAAE,CAAC,AACzB,MAAM,CAAE,CAAC,CAAC,UAAU,CACpB,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CACnB,MAAM,CAAE,GAAG,CAAC,UAAU,CACtB,MAAM,CAAE,IAAI,CAAC,UAAU,CACvB,QAAQ,CAAE,MAAM,CAChB,OAAO,CAAE,CAAC,CAAC,UAAU,CACrB,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,GAAG,CAAC,UAAU,AACvB,CAAC,AAED,mBAAmB,6CAAC,CAAC,AACnB,QAAQ,CAAE,QAAQ,CAClB,OAAO,CAAE,KAAK,CACd,MAAM,CAAE,IAAI,CACZ,UAAU,CAAE,UAAU,AACxB,CAAC,AAED,kCAAmB,CAAC,WAAW,8BAAC,CAAC,AAC/B,OAAO,CAAE,IAAI,CACb,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,KAAK,IAAI,CAAC,CAAC,CAAC,IAAI,CAAC,AAC1B,CAAC,AAED,0BAAW,CAAC,mBAAmB,8BAAC,CAAC,AAC/B,OAAO,CAAE,EAAE,CACX,IAAI,CAAE,CAAC,CACP,UAAU,CAAE,UAAU,AACxB,CAAC,AAED,kCAAmB,CAAC,aAAa,8BAAC,CAAC,AACjC,UAAU,CAAE,MAAM,CAClB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,UAAU,CAAE,UAAU,AACxB,CAAC,AAED,4BAAa,CAAG,CAAC,8BAAC,CAAC,AACjB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,GAAG,CAChB,eAAe,CAAE,IAAI,CACrB,OAAO,CAAE,IAAI,CACb,eAAe,CAAE,MAAM,CACvB,WAAW,CAAE,MAAM,CACnB,WAAW,CAAE,IAAI,CACjB,SAAS,CAAE,IAAI,CACf,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,CAAC,IAAI,AACjB,CAAC,AAED,aAAa,OAAO,6CAAC,CAAC,AACpB,UAAU,CAAE,OAAO,AACrB,CAAC,AAED,aAAa,UAAU,6CAAC,CAAC,AACvB,UAAU,CAAE,OAAO,AACrB,CAAC,AAED,aAAa,WAAW,6CAAC,CAAC,AACxB,UAAU,CAAE,OAAO,AACrB,CAAC,AAED,aAAa,sBAAO,CAAC,+BAAC,CACtB,aAAa,yBAAU,CAAC,CAAC,8BAAC,CAAC,AACzB,KAAK,CAAE,IAAI,AACb,CAAC,AAED,aAAa,0BAAW,CAAC,CAAC,8BAAC,CAAC,AAC1B,KAAK,CAAE,IAAI,AACb,CAAC,AAED,kCAAmB,CAAC,aAAa,MAAM,CAAC,oBAAoB,8BAAC,CAAC,AAC5D,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,CAAC,AACZ,CAAC,AAED,4BAAa,CAAC,oBAAoB,8BAAC,CAAC,AAClC,MAAM,CAAE,GAAG,CACX,OAAO,CAAE,CAAC,CACV,UAAU,CAAE,GAAG,CAAC,KAAK,CAAC,WAAW,AACnC,CAAC,AAED,4BAAa,CAAC,mCAAoB,CAAG,CAAC,eAAC,CAAC,AACtC,OAAO,CAAE,YAAY,CACrB,eAAe,CAAE,SAAS,CAC1B,WAAW,CAAE,MAAM,CACnB,aAAa,CAAE,GAAG,CAClB,UAAU,CAAE,IAAI,CAChB,SAAS,CAAE,IAAI,AACjB,CAAC\"}"
};

const Topbannerasset2 = Header.create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css);

	return `<div class="${"tri-banner-desktop svelte-12ikqam"}"><div class="${"tri-banner svelte-12ikqam"}"><div class="${"desktop-item-slide svelte-12ikqam"}"><div class="${"orange desktop-item svelte-12ikqam"}"><a href="${"/c/deals/top-picks/"}" class="${"svelte-12ikqam"}">In-Stock &amp; Ready to Ship up to 30% Off*</a>
                <div class="${"tribanner-drop-down svelte-12ikqam"}" style="${"background: #dc6901;"}"><a href="${"/c/deals/top-picks/"}" class="${"svelte-12ikqam"}">Shop Now</a></div></div></div>
        <div class="${"desktop-item-slide svelte-12ikqam"}"><div class="${"dark-gray desktop-item svelte-12ikqam"}"><a href="${"/c/outdoor/outdoor-seating/"}" class="${"svelte-12ikqam"}">NEW! Outdoor Price Cuts Up to 70% Off*</a>
                <div class="${"tribanner-drop-down svelte-12ikqam"}" style="${"background: #3F4045;"}"><a href="${"/c/outdoor/outdoor-seating/"}" class="${"svelte-12ikqam"}">Shop Now</a></div></div></div>
        <div class="${"desktop-item-slide svelte-12ikqam"}"><div class="${"light-gray desktop-item svelte-12ikqam"}"><a href="${"/c/deals/"}" class="${"svelte-12ikqam"}">NEW!! Shop Limited Time Flash Deals</a>
                <div class="${"tribanner-drop-down svelte-12ikqam"}" style="${"background: #CCCDCE;"}"><a href="${"/c/deals/"}" class="${"svelte-12ikqam"}">Shop Now</a></div></div></div></div>
</div>`;
});

exports["default"] = Topbannerasset2;
