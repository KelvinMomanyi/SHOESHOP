# Treadora storefront audit — 7 October 2026

The fixes are applied to live Shopify theme **188057026856**, `SHOESHOP/master`, whose schema is Treadora 1.0.0. The repository changes remain uncommitted. A complete original-theme backup is in `audits/live-backup/`; the tested unpublished preview is theme **190437982504**.

## Before and after

These are matched, single-run, cold-cache Lighthouse 13.5.0 measurements in Chrome 154.0.8037.95. Mobile uses Lighthouse's simulated 4× CPU slowdown, 150 ms RTT, approximately 1.6 Mbps network, and 412 × 823 viewport. Both runs pin the same live theme using `?preview_theme_id=188057026856&pb=0`; the resulting approximately 0.75-second mobile redirect chain is included in both results. These numbers should not be compared directly with an unpinned or warm-cache visit.

| Metric | Mobile before | Mobile after | Desktop before | Desktop after |
|---|---:|---:|---:|---:|
| Performance | 69 | 74 | 90 | 99 |
| Accessibility | 100 | 100 | 100 | 100 |
| Best practices | 96 | 100 | 100 | 100 |
| SEO | 92 | 100 | 92 | 100 |
| LCP | 3.22 s | 2.84 s | 0.72 s | 0.76 s |
| CLS | 0 | 0 | 0.000021 | 0.000021 |
| Total blocking time | 859 ms | 799 ms | 244 ms | 29 ms |
| Blocking external stylesheets | 7 | 2 | 7 | 2 |

The small desktop LCP increase remains within a good range and ordinary run-to-run variation. Mobile LCP and blocking time still need improvement; this audit does not claim that all performance issues are resolved.

Chrome DevTools MCP independently re-tested the live homepage: accessibility **100**, best practices **100**, SEO **100**, with zero failed audits in those categories. Its Lighthouse tool excludes performance, so the CLI supplied the performance and coverage measurements above.

For interaction testing, DevTools traced menu-open/Escape, search-open/Escape, and cart-open/Escape at 390 × 844, DPR 3, 4× CPU slowdown, and Fast 4G. Observed lab INP was **203 ms before → 124 ms after**, with CLS 0. This is a six-interaction lab sample, not real-user p75 INP; DevTools reported no page-level CrUX data.

## Findings and source fixes

| Finding | Responsible source | Applied change |
|---|---|---|
| Seven stylesheets block initial rendering | [theme layout](layout/theme.liquid), [hero](sections/editorial-hero.liquid), [featured products](sections/featured-products.liquid), [image spread](sections/image-spread.liquid), [scroll story](sections/scroll-story.liquid), [Alexandra loader](sections/alexandra-loader.liquid), [stacked media](sections/stacked-media.liquid) | Inline the small minified component styles in their existing cascade positions; serve the minified main stylesheet before `content_for_header`. External blocking stylesheets fall to two. |
| Homepage downloads animation code for other page types | [theme loader](assets/theme.js), [motion effects](assets/motion-effects.js), [new page-motion module](assets/page-motion.js), [layout asset URLs](layout/theme.liquid) | Load homepage, collection-directory, and page-specific animations only when their markup exists. Homepage motion bundle falls from 23,776 to 9,625 decoded bytes. |
| Duplicate heading font declarations | [theme layout](layout/theme.liquid) | Deduplicate regular/bold font URLs while retaining the same fonts, preloads, weights, and `font-display: swap`. |
| Missing favicon produces a 404 | [theme layout](layout/theme.liquid) | Supply an empty data favicon when no merchant favicon is configured. No storefront artwork changes. |
| Generic “Learn more” link fails the SEO audit | [scroll highlight](sections/scroll-highlight.liquid), [translations](locales/en.default.json) | Add visually hidden, translated context. Visible wording stays unchanged. |
| Four hero H1s and hidden slides remain exposed to keyboard/assistive technology | [hero markup](sections/editorial-hero.liquid), [hero CSS](assets/editorial-stacked.css), [motion effects](assets/motion-effects.js) | Use one primary H1, identical title styling for later H2s, and synchronize inactive slides' `inert`/`aria-hidden` state. |
| Image alt text is escaped twice | [responsive-image helper](snippets/responsive-image.liquid) | Let `image_tag` perform HTML escaping once. Responsive sizing and loading priorities are preserved. |
| Generated CSS assets need a repeatable build | [build script](scripts/build-theme-assets.mjs), [build instructions](scripts/README.md) | Generate and retain `.min.css` alongside `.min.js`, including password and gift-card stylesheet references. |

Shopify supports inlining CSS assets below 15 KB; every inlined component asset here is below 4.3 KB. Inlining removes requests but trades separate browser caching for a small increase in HTML size. Shopify already minifies served CSS, so the main source file's 22 KB build reduction should not be interpreted as a 22 KB network saving. [Shopify inline asset documentation](https://shopify.dev/docs/api/liquid/filters/inline_asset_content).

## Coverage, images, fonts, and platform scripts

- Homepage theme JavaScript falls from **25,493 → 11,351 decoded bytes**, a 55.5% reduction. Initial-view unused theme JavaScript falls from **15,156 → 2,399 bytes**. Coverage includes initial initialization, not every interactive state.
- Lighthouse did not flag an unused-CSS opportunity. Coverage still shows approximately **56.7 KB** of the main stylesheet unused in the initial homepage view. This includes other page types, responsive layouts, drawers, and interaction states; it was retained to preserve the rest of the theme. It cannot safely be deleted from homepage coverage alone.
- The homepage uses inline SVG image placeholders. Lighthouse found no image-delivery opportunity. The shared image helper already supplies Shopify responsive sources, dimensions, lazy loading, and hero priority. Real product-page images were exercised during the functional smoke check.
- Three WOFF2 requests remain: Space Grotesk regular/bold and Syne bold, totaling 44,340 decoded bytes. Lighthouse's font-display audit passes. Font choices and appearance were preserved.
- Theme asset requests fall from **8 → 3** on the homepage. Overall mobile requests rise from **172 → 230** in the measured windows: checkout-associated requests rise from 119 to 179 and telemetry from 19 to 23. Total request counts vary substantially with Shopify's preloading and analytics; they did not improve in this pair of runs.
- Remaining major JavaScript costs are Shopify's pixel manager (`/cdn/wpm/`), Trekkie, perf-kit, account/checkout resources, and hCaptcha when it initializes. Lighthouse attributes approximately 37 KB of unused JavaScript to the Shopify pixel manager. DevTools attributed the main forced-reflow hotspot to Shopify's account component. These implementations are injected by the platform and are not editable source files in this repository. Analytics, account behavior, checkout, and captcha protection were preserved.
- An earlier mobile session also reported hCaptcha's Protected Audience API deprecation. The final runs pass best practices, but that vendor warning can recur depending on whether captcha initializes.

## Validation and artifacts

Theme Check passes with **zero errors and zero warnings**. The Shopify Liquid skill validator passes; it emits one advisory about the intentional data-URI favicon. The build and JavaScript syntax check pass.

Five of six sampled mobile/desktop screenshots are pixel-identical to the original. The sixth differs only by isolated color rounding of at most 1/255 per channel. Menu, search, and cart open and close with Escape. Collection directory, collection listing, and `/products/converse-star-player-77` return 200 and initialize their appropriate motion modules. The homepage does not download `page-motion.min.js`. Only the homepage received the full Lighthouse audit; the other routes received functional smoke checks.

Reports and evidence:

- [Before mobile Lighthouse](audits/before-live/mobile.html), [after mobile Lighthouse](audits/after-live/mobile.html)
- [Before desktop Lighthouse](audits/before-live/desktop.html), [after desktop Lighthouse](audits/after-live/desktop.html)
- [Metric/source comparison](audits/comparison.json), [interaction samples](audits/interaction-comparison.json)
- [Before coverage](audits/before-live/coverage.json), [after coverage](audits/after-live/coverage.json)
- [Visual comparison](audits/visual-comparison.json), [functional checks](audits/after-live/smoke.json)
- [Final DevTools Lighthouse report](audits/after-devtools-mobile-lighthouse.html)

`audits/` is intentionally ignored by Git and excluded from Theme Check. An exploratory run under `audits/preview-cold/` tested the unpublished preview and is excluded from the comparison. The earlier `audits/before-full-mobile.*` files audited the password page in an unauthenticated browser and are also excluded. Subsequent audit runs verify the theme ID and reject the password page. All reported before/after metrics above come from the authenticated, live-theme-verified pair.
