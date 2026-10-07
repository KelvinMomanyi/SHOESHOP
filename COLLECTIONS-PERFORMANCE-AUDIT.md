# Collections performance follow-up

Audited and deployed on 2026-10-07. Page: https://shoeshive.myshopify.com/collections. Live theme: `SHOESHOP/master`, ID `188057026856`.

## Results

The reported mobile score was 56. My controlled baseline reproduced 61. After the fixes, three sequential live mobile runs scored **91, 78, and 73**, giving a **median of 78**. Desktop scored **100**. The page clears a 60-point threshold in every final run; a consistent 90-point mobile score has not been achieved.

| Measurement | Before | After |
| --- | ---: | ---: |
| Mobile performance | 61 | 78 median (73–91) |
| Desktop performance | 99 | 100 |
| Mobile accessibility | 100 | 100 in every run |
| Mobile best practices | 81 | 100 in every run |
| Mobile SEO | 100 | 100 in every run |
| Mobile LCP | 6.25 s | 2.23 s median |
| Mobile FCP | 2.25 s | 1.81 s median |
| Mobile CLS | 0 | 0 in every run |
| Mobile total blocking time | 469 ms | 426 ms median |

After timings are independent medians of the three mobile runs. The baseline is one controlled run. An earlier diagnostic run overlapped a DevTools trace and was excluded from this comparison. Desktop's before result came from that diagnostic session, after its mobile trace had finished.

Shopify's [Theme Store requirement](https://shopify.dev/docs/storefronts/themes/store/requirements#6-lighthouse-performance-and-accessibility) is a minimum average performance score of 60 and accessibility score of 90 across home, product, and collection pages on desktop and mobile, using its benchmark dataset. This collections-directory audit alone does not certify the entire theme or substitute for that benchmark.

## Production changes

- [snippets/collection-directory.liquid](snippets/collection-directory.liquid): render the first row immediately instead of hiding its LCP image behind the scroll reveal animation. Keep subsequent rows animated. Preload just the first collection image through Shopify's responsive image filter, retaining eager loading and high priority. Give the desktop row image and sticky preview matching responsive sizes so they share the same downloaded image.
- [sections/newsletter-popup.liquid](sections/newsletter-popup.liquid): focus the close button when the dialog opens instead of automatically focusing the email input. This avoids opening the mobile keyboard and initializing CAPTCHA before the visitor uses the form. The existing six-second popup delay, artwork, form, dismissal frequency, and CAPTCHA protection remain in place. Success/error messages still receive focus when present.

No CSS, typography, spacing, colors, image crop, or merchant configuration changed in this follow-up. The JavaScript fix lives in the newsletter section's `{% javascript %}` block; Shopify regenerates its compiled script.

## Verification

- Shopify Theme Check: zero errors and warnings. Liquid skill validation passed both changed files, including the final preload revision.
- Chrome DevTools MCP Lighthouse: accessibility, SEO, best practices, and agentic browsing all 100, with no failed audits. Its Lighthouse tool excludes the performance category, so full performance scores above came from Lighthouse CLI 13.5.0 using Chrome 154.0.8037.95.
- All three mobile screenshots and two of three desktop screenshots matched the baseline pixel for pixel. The remaining desktop screenshot showed small differences in animated image/title positioning and was visually inspected; layout, styling, and imagery match.
- Menu, search, and cart open and close with Escape. Collection-directory enhancement, collection product listing motion, and product-page motion initialize correctly on the live theme.
- A fresh popup opened with focus on Close and **zero CAPTCHA requests**. Clicking its email input then loaded hCaptcha normally. No subscription was submitted.
- Desktop DevTools confirmed both eager images use the same 720-pixel source and one successful image download. A speculative 1440-pixel request was aborted with zero transferred bytes.
- Final DevTools trace observed 1.89-second LCP and zero CLS with 4× CPU slowdown and Fast 4G, using the existing browser cache. This is distinct from Lighthouse's simulated cold-cache results.

## Remaining costs and limits

The shared theme stylesheet remains 78,280 decoded bytes, with about 14,340 bytes used in the initial mobile view. Its other rules support drawers, responsive layouts, and other sections; initial-view coverage is not a safe deletion list. Shopify's section stylesheet subset was 11,419 bytes. Neither stylesheet was changed in this follow-up.

Shopify's web pixel manager, Trekkie analytics, performance kit, account components, and checkout prefetching remain platform-managed. Lighthouse still flags approximately 36–37 KiB of unused pixel-manager JavaScript. Platform execution, server response timing, and the timed popup contribute to variation between runs; removing required `content_for_header` scripts would break supported functionality. The final mobile total blocking times were 288, 426, and 770 ms.

No page-level CrUX data was available in the DevTools trace. Field INP was not measured by this follow-up, and the lab metrics do not guarantee real-user Core Web Vitals.

## Reproduction and artifacts

The authenticated storefront was audited directly, with its theme ID verified. The canonical URL, Chrome/Lighthouse versions, device configuration, and cache policy were held constant. Browser network cache was cleared before each Lighthouse run; authorized cookies were retained. Lighthouse runs and performance traces were sequential. Storefront credentials are not saved in reports.

- [Controlled baseline](audits/collections-before-control/mobile.html)
- [Live mobile run 1](audits/collections-after/mobile.html)
- [Live mobile run 2](audits/collections-after-repeat-2/mobile.html)
- [Live mobile run 3](audits/collections-after-repeat-3/mobile.html)
- [Live desktop report](audits/collections-after/desktop.html)
- [Chrome DevTools Lighthouse](audits/collections-after/devtools-lighthouse.html)
- [Functional checks](audits/collections-after/smoke.json)
- [Coverage and requests](audits/collections-after/coverage.json)

Audit artifacts and the pre-change live files in `audits/collections-live-backup/` are local and gitignored. Only the two listed Liquid files were uploaded to the live theme. The existing unpublished preview theme (`190437982504`) also contains the fixes. The audit runner and its README now support route-appropriate screenshots and repeated, performance-only measurements.
