Edit the readable JavaScript and CSS files in `assets/`, then run `npm ci` and `npm run build:assets`.

The storefront serves the generated `.min.js` and `.min.css` assets. Commit generated assets alongside source changes so the uploaded theme stays in sync. Small component styles are inlined with `inline_asset_content`; each inlined asset must stay below Shopify's 15 KB limit.

`theme.js` loads homepage motion, collection-directory motion, and page motion only when their corresponding markup is present. Keep component selectors and the asset URLs in `layout/theme.liquid` in sync when adding components.

`audit-storefront.mjs` records mobile and desktop Lighthouse reports, initial-view JavaScript/CSS coverage, screenshots, and storefront control checks under the ignored `audits/` directory. Set `TREADORA_LIGHTHOUSE_ROOT` to a `node_modules` directory containing `lighthouse`, `chrome-launcher`, and `puppeteer-core`. For a locked storefront, provide its authorized session cookie through `TREADORA_AUDIT_COOKIES`; the runner never saves it in the reports. Set `TREADORA_EXPECT_THEME_ID` to select the intended theme before measurement and reject an accidental preview-theme selection. The measured URL itself stays unchanged.

For repeated measurements, set `TREADORA_AUDIT_LIGHTHOUSE_ONLY=true` to skip coverage, screenshots, and control checks, and `TREADORA_AUDIT_DEVICES=mobile` to measure just mobile. Set `TREADORA_AUDIT_CAPTURE_ONLY=true` for visual and functional checks without Lighthouse. Collection-directory captures cover the top, directory, and footer at both viewport sizes. Run Lighthouse and DevTools performance traces sequentially to avoid CPU contention.

Run `node scripts/audit-storefront.mjs <label> <storefront-url>`. Comparisons must use the same URL, browser version, device settings, theme ID, and cache policy. Initial-view unused code can still be needed by interactions or other pages. Lab interaction samples do not replace field INP.
