let documentListenerReady = false;

const escapeHTML = (value) => {
  const element = document.createElement('span');
  element.textContent = value || '';
  return element.innerHTML;
};

const escapeAttribute = (value) => escapeHTML(value).replace(/"/g, '&quot;');

const formatMoney = (cents, format) => {
  if (typeof cents === 'string') cents = cents.replace('.', '');
  const value = Number(cents || 0) / 100;
  const amount = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return format
    .replace(/\{\{\s*amount\s*\}\}/, amount)
    .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(value).toString())
    .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, amount.replace('.', ','));
};

const getImage = (product) => {
  if (typeof product.image === 'string') return { url: product.image };
  if (product.image?.url) return product.image;
  if (typeof product.featured_image === 'string') return { url: product.featured_image };
  return product.featured_image || null;
};

const imageUrlAtWidth = (source, width) => {
  const url = new URL(source, window.location.origin);
  url.searchParams.set('width', String(width));
  return url.toString();
};

const renderImage = (image, alt) => {
  if (!image?.url) return '<span class="predictive-search__placeholder"></span>';

  const width = 72;
  const intrinsicWidth = Number(image.width || width);
  const intrinsicHeight = Number(image.height || width);
  const height = Math.max(1, Math.round(width * intrinsicHeight / intrinsicWidth));
  const srcset = [72, 144, 216]
    .map((candidate) => `${escapeAttribute(imageUrlAtWidth(image.url, candidate))} ${candidate}w`)
    .join(', ');

  return `<img
    src="${escapeAttribute(imageUrlAtWidth(image.url, 144))}"
    srcset="${srcset}"
    sizes="72px"
    width="${width}"
    height="${height}"
    alt="${escapeAttribute(alt)}"
    loading="lazy"
    decoding="async"
  >`;
};

export const initializePredictiveSearch = (scope = document) => {
  const forms = scope.matches?.('[data-predictive-search]')
    ? [scope]
    : Array.from(scope.querySelectorAll?.('[data-predictive-search]') || []);

  forms.forEach((form) => {
    if (form.dataset.predictiveSearchReady === 'true') return;

    const input = form.querySelector('input[type="search"]');
    const results = form.querySelector('[data-predictive-search-results]');
    const predictiveRoute = window.Treadora?.routes?.predictiveSearch;
    if (!input || !results || !predictiveRoute) return;

    form.dataset.predictiveSearchReady = 'true';

    const strings = window.Treadora?.strings || {};
    const labels = {
      heading: strings.predictiveHeading || '',
      loading: strings.searchLoading || '',
      noResults: strings.searchNoResults || '',
      viewAll: strings.searchViewAll || ''
    };
    const moneyFormat = window.Treadora?.moneyFormat || '{{amount}}';
    const cache = new Map();
    let controller = null;
    let debounceTimer = null;

    const getSearchUrl = (query) => {
      const predictivePath = predictiveRoute.endsWith('.json')
        ? predictiveRoute
        : `${predictiveRoute.replace(/\/$/, '')}.json`;
      const url = new URL(predictivePath, window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('resources[type]', 'product');
      url.searchParams.set('resources[limit]', '6');
      url.searchParams.set('resources[options][unavailable_products]', 'last');
      url.searchParams.set('resources[options][fields]', 'title,product_type,variants.title,vendor');
      return url.toString();
    };

    const getResultsUrl = (query) => {
      const url = new URL(form.action, window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'product,page,article');
      return url.toString();
    };

    const setExpanded = (expanded) => {
      input.setAttribute('aria-expanded', String(expanded));
      results.classList.toggle('is-open', expanded);
    };

    const renderMessage = (message, modifier = '') => {
      results.innerHTML = `<div class="predictive-search__status${modifier ? ` predictive-search__status--${modifier}` : ''}">${escapeHTML(message)}</div>`;
      setExpanded(true);
    };

    const renderProductPrice = (product) => {
      const price = product.price_min ?? product.price;
      if (typeof price === 'number') {
        return `<span class="predictive-search__price">${formatMoney(price, moneyFormat)}</span>`;
      }
      if (typeof price === 'string' && price.trim()) {
        return `<span class="predictive-search__price">${escapeHTML(price)}</span>`;
      }
      return '';
    };

    const renderProducts = (products, query) => {
      if (!products.length) {
        renderMessage(labels.noResults, 'empty');
        return;
      }

      const productMarkup = products.map((product) => {
        const vendor = product.vendor || product.type || '';
        const price = renderProductPrice(product);
        const productUrl = product.url || form.action;

        return `
          <a class="predictive-search__item" href="${escapeAttribute(productUrl)}">
            <span class="predictive-search__media">
              ${renderImage(getImage(product), product.title || '')}
            </span>
            <span class="predictive-search__content">
              ${vendor ? `<span class="predictive-search__meta">${escapeHTML(vendor)}</span>` : ''}
              <span class="predictive-search__title">${escapeHTML(product.title || '')}</span>
              ${price}
            </span>
          </a>
        `;
      }).join('');

      results.innerHTML = `
        <div class="predictive-search__header">${escapeHTML(labels.heading)}</div>
        <div class="predictive-search__list">${productMarkup}</div>
        <a class="predictive-search__view-all" href="${escapeAttribute(getResultsUrl(query))}">${escapeHTML(labels.viewAll)}</a>
      `;
      setExpanded(true);
    };

    const hideResults = () => {
      results.innerHTML = '';
      setExpanded(false);
    };

    const search = () => {
      const query = input.value.trim();

      controller?.abort();
      if (query.length < 2) {
        hideResults();
        return;
      }

      if (cache.has(query)) {
        renderProducts(cache.get(query), query);
        return;
      }

      renderMessage(labels.loading, 'loading');
      controller = new AbortController();

      fetch(getSearchUrl(query), { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        })
        .then((data) => {
          const products = data.resources?.results?.products || [];
          cache.set(query, products);
          renderProducts(products, query);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') renderMessage(labels.noResults, 'empty');
        });
    };

    input.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(search, 140);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2 && results.innerHTML.trim()) setExpanded(true);
    });
  });

  if (!documentListenerReady) {
    documentListenerReady = true;
    document.addEventListener('click', (event) => {
      document.querySelectorAll('[data-predictive-search][data-predictive-search-ready="true"]').forEach((form) => {
        if (form.contains(event.target)) return;
        form.querySelector('input[type="search"]')?.setAttribute('aria-expanded', 'false');
        form.querySelector('[data-predictive-search-results]')?.classList.remove('is-open');
      });
    });
  }
};

