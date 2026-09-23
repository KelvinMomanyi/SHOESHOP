(() => {
  const findWithin = (scope, selector) => {
    const matches = scope.matches?.(selector) ? [scope] : [];
    return matches.concat(Array.from(scope.querySelectorAll?.(selector) || []));
  };

  const initReveal = (scope = document) => {
    const items = findWithin(scope, '.reveal-item:not([data-reveal-ready])');
    items.forEach((item) => { item.dataset.revealReady = 'true'; });
    if (!items.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });

    items.forEach((item) => observer.observe(item));
  };

  const hasWithin = (scope, selector) => {
    return scope.matches?.(selector) || scope.querySelector?.(selector);
  };

  const loadScopedModule = (scope, selector, url, exportName) => {
    if (!url || !hasWithin(scope, selector)) return;
    import(url)
      .then((module) => module[exportName]?.(scope))
      .catch(() => {});
  };

  const initializeTheme = (scope = document) => {
    initReveal(scope);
    const assets = window.Treadora?.assets || {};

    loadScopedModule(
      scope,
      '[data-hover-preview], [data-tilt-stack], [data-scroll-hero], [data-image-spread], [data-alexandra-loader], [data-featured-product-stack]',
      assets.motionEffects,
      'initializeMotionEffects'
    );
    loadScopedModule(scope, '.facets', assets.facets, 'initializeFacets');
    loadScopedModule(
      scope,
      'variant-selects, product-recommendations, pickup-availability, [data-product-media-gallery]',
      assets.productFeatures,
      'initializeProductFeatures'
    );
  };

  window.TreadoraTheme = { initialize: initializeTheme };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme);
  } else {
    initializeTheme();
  }

  document.addEventListener('shopify:section:load', (event) => {
    initializeTheme(event.target);
  });
})();
