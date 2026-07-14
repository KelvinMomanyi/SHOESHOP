(() => {
  const moneyFormat = window.Treadora?.moneyFormat || '${{amount}}';
  const strings = window.Treadora?.strings || {
    addToCart: 'Add to cart',
    soldOut: 'Sold out',
    unavailable: 'Unavailable'
  };

  const escapeHTML = (value) => {
    const element = document.createElement('span');
    element.textContent = value || '';
    return element.innerHTML;
  };

  const escapeAttribute = (value) => escapeHTML(value).replace(/"/g, '&quot;');

  const formatMoney = (cents, format = moneyFormat) => {
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

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const styleCache = new WeakMap();
  const scrollEffects = [];
  let scrollTicking = false;
  let resizeTicking = false;

  const getViewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const isNearViewport = (rect, height, buffer = 0.35) => {
    return rect.bottom > -height * buffer && rect.top < height * (1 + buffer);
  };

  const setStyleValue = (element, property, value) => {
    let cache = styleCache.get(element);
    if (!cache) {
      cache = {};
      styleCache.set(element, cache);
    }

    if (cache[property] === value) return;
    element.style[property] = value;
    cache[property] = value;
  };

  const setCustomProperty = (element, property, value) => {
    let cache = styleCache.get(element);
    if (!cache) {
      cache = {};
      styleCache.set(element, cache);
    }

    if (cache[property] === value) return;
    element.style.setProperty(property, value);
    cache[property] = value;
  };

  const toggleClass = (element, className, force) => {
    if (element.classList.contains(className) === force) return;
    element.classList.toggle(className, force);
  };

  const runScrollEffects = () => {
    const viewport = getViewport();
    scrollEffects.forEach((effect) => effect.update(viewport));
    scrollTicking = false;
  };

  const requestScrollEffects = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(runScrollEffects);
  };

  const requestResizeEffects = () => {
    if (resizeTicking) return;
    resizeTicking = true;

    window.requestAnimationFrame(() => {
      const viewport = getViewport();
      scrollEffects.forEach((effect) => effect.refresh?.(viewport));
      resizeTicking = false;
      requestScrollEffects();
    });
  };

  const registerScrollEffect = (effect) => {
    scrollEffects.push(effect);

    if (scrollEffects.length === 1) {
      window.addEventListener('scroll', requestScrollEffects, { passive: true });
      window.addEventListener('resize', requestResizeEffects);
    }

    const viewport = getViewport();
    effect.refresh?.(viewport);
    effect.update(viewport);
  };

  const initReveal = () => {
    const items = document.querySelectorAll('.reveal-item');
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

  const initHoverPreviews = () => {
    document.querySelectorAll('[data-hover-preview]').forEach((root) => {
      const triggers = root.querySelectorAll('[data-preview-index]');
      const images = root.querySelectorAll('[data-preview-image]');
      if (!triggers.length || !images.length) return;

      const floatingPreview = root.querySelector('[data-floating-preview]');
      const previewTrack = root.querySelector('[data-preview-track]');

      if (floatingPreview && previewTrack) {
        let x = 0;
        let y = 0;
        let targetX = 0;
        let targetY = 0;
        let visible = false;
        let rafId = null;

        const animate = () => {
          x += (targetX - x) * 0.18;
          y += (targetY - y) * 0.18;
          setStyleValue(floatingPreview, 'transform', `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${visible ? 1 : 0})`);

          if (!visible && Math.abs(targetX - x) < 0.2 && Math.abs(targetY - y) < 0.2) {
            rafId = null;
            return;
          }

          rafId = window.requestAnimationFrame(animate);
        };

        root.addEventListener('mousemove', (event) => {
          targetX = event.clientX;
          targetY = event.clientY;
          if (!rafId) animate();
        });

        root.addEventListener('mouseleave', () => {
          visible = false;
          floatingPreview.classList.remove('is-visible');
        });

        triggers.forEach((trigger) => {
          trigger.addEventListener('mouseenter', () => {
            const index = Number(trigger.getAttribute('data-preview-index')) || 0;
            visible = true;
            floatingPreview.classList.add('is-visible');
            setStyleValue(previewTrack, 'transform', `translateY(${-100 * index}%)`);
            if (!rafId) animate();
          });
        });

        return;
      }

      triggers.forEach((trigger) => {
        trigger.addEventListener('mouseenter', () => {
          const index = trigger.getAttribute('data-preview-index');
          images.forEach((image) => {
            image.classList.toggle('is-active', image.getAttribute('data-preview-image') === index);
          });
        });
      });
    });
  };

  const initTiltStacks = () => {
    document.querySelectorAll('[data-tilt-stack]').forEach((stack) => {
      stack.addEventListener('pointermove', (event) => {
        const rect = stack.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        stack.style.setProperty('--tilt-x', String(x));
        stack.style.setProperty('--tilt-y', String(y));
      });
    });
  };

  const initScrollHero = () => {
    const heroes = document.querySelectorAll('[data-scroll-hero]');
    if (!heroes.length) return;

    const heroStates = Array.from(heroes).map((hero) => {
      const panels = Array.from(hero.querySelectorAll('.editorial-hero__panel')).map((panel) => ({
        panel,
        image: panel.querySelector('.editorial-hero__image')
      }));

      return {
        hero,
        panels,
        dots: Array.from(hero.querySelectorAll('.editorial-hero__dots span')),
        scrollable: 1,
        activeIndex: -1
      };
    }).filter((state) => state.panels.length);

    if (!heroStates.length) return;

    const refresh = ({ height }) => {
      heroStates.forEach((state) => {
        state.scrollable = Math.max(state.hero.offsetHeight - height, 1);
      });
    };

    const update = ({ height }) => {
      let hasPassedHero = false;

      heroStates.forEach((state) => {
        const rect = state.hero.getBoundingClientRect();
        const inView = rect.bottom > 0 && rect.top < height;

        if (rect.bottom <= 0) hasPassedHero = true;
        toggleClass(state.hero, 'is-in-view', inView);

        if (!isNearViewport(rect, height, 0.25)) return;

        const progress = clamp(-rect.top / state.scrollable, 0, 1);
        const segments = Math.max(state.panels.length - 1, 1);
        const timelinePosition = progress * segments;
        const activeIndex = Math.min(state.panels.length - 1, Math.floor(progress * state.panels.length));

        state.panels.forEach(({ panel, image }, index) => {
          const slideProgress = index < state.panels.length - 1 ? clamp(timelinePosition - index, 0, 1) : 0;
          const imageProgress = index === 0 ? 1 : clamp(timelinePosition - (index - 1), 0, 1);
          const scale = 1.2 - imageProgress * 0.2;

          setStyleValue(panel, 'transform', `translate3d(0, ${(-slideProgress * 100).toFixed(3)}%, 0)`);
          toggleClass(panel, 'is-active', index === activeIndex);
          if (image) setStyleValue(image, 'transform', `translateZ(0) scale(${scale.toFixed(4)})`);
        });

        if (state.activeIndex !== activeIndex) {
          state.dots.forEach((dot, index) => toggleClass(dot, 'is-active', index === activeIndex));
          state.activeIndex = activeIndex;
        }
      });

      toggleClass(document.body, 'is-past-hero', hasPassedHero);
    };

    registerScrollEffect({ update, refresh });
  };

  const initImageSpread = () => {
    const spreads = document.querySelectorAll('[data-image-spread]');
    if (!spreads.length) return;

    const positions = [
      { x: -0.8, y: -0.6 },
      { x: 0.7, y: 0.4 },
      { x: -0.5, y: 0.7 },
      { x: 0.6, y: -0.5 },
      { x: -0.8, y: 0.2 },
      { x: 0.8, y: -0.3 },
      { x: -0.6, y: -0.8 },
      { x: 0.4, y: 0.6 },
      { x: -0.7, y: 0.5 },
      { x: 0.5, y: -0.7 },
      { x: -0.4, y: -0.4 },
      { x: 0.3, y: 0.8 }
    ];

    const spreadStates = Array.from(spreads).map((section) => ({
      section,
      items: Array.from(section.querySelectorAll('[data-flow-item]')).map((item, index) => ({
        item,
        index,
        position: positions[index % positions.length],
        isCover: item.classList.contains('is-cover')
      })),
      scrollable: 1
    })).filter((state) => state.items.length);

    if (!spreadStates.length) return;

    const refresh = ({ height }) => {
      spreadStates.forEach((state) => {
        state.scrollable = Math.max(state.section.offsetHeight - height, 1);
      });
    };

    const update = ({ width, height }) => {
      const isMobile = width < 800;
      const spread = isMobile ? 1.45 : 0.72;

      spreadStates.forEach((state) => {
        const rect = state.section.getBoundingClientRect();
        if (!isNearViewport(rect, height, 0.45)) return;

        const progress = clamp(-rect.top / state.scrollable, 0, 1);

        state.items.forEach(({ item, index, position, isCover }) => {
          const totalDelay = 0.38;
          const delay = state.items.length > 1 ? (index / (state.items.length - 1)) * totalDelay : 0;
          const itemProgress = clamp((progress - delay) / (1 - totalDelay), 0, 1);
          const finalX = position.x * width * spread;
          const finalY = position.y * height * spread;
          let x = lerp(0, finalX, itemProgress);
          let y = lerp(0, finalY, itemProgress);
          let z = lerp(-1000, 2000, itemProgress);
          let scale = lerp(0.05, 1, itemProgress);
          let opacity = itemProgress > 0 ? clamp(itemProgress * 1.6, 0, 1) : 0;

          if (isCover) {
            x = 0;
            y = 0;
            z = lerp(-900, 0, itemProgress);
          }

          setStyleValue(item, 'opacity', opacity.toFixed(3));
          setStyleValue(item, 'transform', `translate3d(-50%, -50%, 0) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) scale(${scale.toFixed(4)})`);
        });
      });
    };

    registerScrollEffect({ update, refresh });
  };

  const initAlexandraLoader = () => {
    const loaders = document.querySelectorAll('[data-alexandra-loader]');
    if (!loaders.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const segment = (progress, start, end) => clamp((progress - start) / (end - start), 0, 1);
    const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);
    const easeInOut = (progress) => {
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    };

    const loaderStates = Array.from(loaders).map((section) => {
      const allItems = Array.from(section.querySelectorAll('[data-loader-item]')).map((item) => ({
        item,
        isPreferredHero: item.classList.contains('is-hero')
      }));

      return {
        section,
        gallery: section.querySelector('[data-loader-gallery]'),
        curtain: section.querySelector('[data-loader-curtain]'),
        topbar: section.querySelector('[data-loader-topbar]'),
        titleLines: Array.from(section.querySelectorAll('[data-loader-title-line]')),
        allItems,
        items: [],
        hero: null,
        scrollable: 1,
        baseWidth: 0,
        initialGap: 0,
        finalGap: 0,
        targetHeroWidth: 0
      };
    }).filter((state) => state.gallery && state.allItems.length);

    if (!loaderStates.length) return;

    const refresh = ({ width, height }) => {
      const isMobile = width < 768;
      const baseWidth = Math.min(Math.max(width * (isMobile ? 0.26 : 0.14), isMobile ? 82 : 76), isMobile ? 120 : 140);

      loaderStates.forEach((state) => {
        const visibleItems = state.allItems.filter(({ item }) => item.offsetWidth > 0);
        const hero = visibleItems.find((entry) => entry.isPreferredHero) || visibleItems[Math.floor(visibleItems.length / 2)] || null;
        const sideItems = visibleItems.filter((entry) => entry !== hero);
        const sideIndexMap = new Map(sideItems.map((entry, index) => [entry.item, index]));
        const galleryWidth = state.gallery.clientWidth;

        state.scrollable = Math.max(state.section.offsetHeight - height, 1);
        state.baseWidth = baseWidth;
        state.initialGap = visibleItems.length > 1 ? Math.max(0, (galleryWidth - visibleItems.length * baseWidth) / (visibleItems.length - 1)) : 0;
        state.finalGap = baseWidth * 0.4;
        state.targetHeroWidth = Math.min(width * (isMobile ? 0.8 : 0.25), galleryWidth * 0.86);
        state.hero = hero;
        state.items = visibleItems.map((entry, index) => ({
          ...entry,
          index,
          isHero: entry === hero,
          sideIndex: sideIndexMap.get(entry.item) ?? -1
        }));
      });
    };

    const update = ({ height }) => {
      loaderStates.forEach((state) => {
        if (!state.items.length) return;

        const rect = state.section.getBoundingClientRect();
        const inView = rect.bottom > 0 && rect.top < height;
        toggleClass(state.section, 'is-in-view', inView);

        if (!reduceMotion && !isNearViewport(rect, height, 0.45)) return;

        const progress = reduceMotion ? 1 : clamp(-rect.top / state.scrollable, 0, 1);
        const gatherProgress = easeInOut(segment(progress, 0.24, 0.44));
        const heroProgress = easeInOut(segment(progress, 0.58, 0.86));
        const revealProgress = easeInOut(segment(progress, 0.72, 0.9));

        setCustomProperty(state.section, '--alexandra-progress', progress.toFixed(4));
        setStyleValue(state.gallery, 'gap', `${lerp(state.initialGap, state.finalGap, gatherProgress).toFixed(2)}px`);

        state.items.forEach(({ item, index, isHero, sideIndex }) => {
          const appearProgress = easeOut(segment(progress, index * 0.03, 0.2 + index * 0.03));
          const clipProgress = isHero
            ? 0
            : easeInOut(segment(progress, 0.48 + sideIndex * 0.025, 0.66 + sideIndex * 0.025));
          const scale = isHero
            ? lerp(lerp(1, 1.2, gatherProgress), 1, heroProgress)
            : lerp(1, 1.2, gatherProgress);

          setStyleValue(item, 'opacity', appearProgress.toFixed(3));
          setStyleValue(item, 'transform', `translate3d(0, ${lerp(60, 0, appearProgress).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`);
          setStyleValue(item, 'clipPath', `inset(0 0 ${(clipProgress * 100).toFixed(2)}% 0)`);
          setStyleValue(item, 'pointerEvents', isHero || clipProgress < 0.98 ? 'auto' : 'none');
        });

        if (state.hero) {
          setStyleValue(state.hero.item, 'width', `${lerp(state.baseWidth, state.targetHeroWidth, heroProgress).toFixed(2)}px`);
        }

        if (state.curtain) {
          setStyleValue(state.curtain, 'transform', `scaleY(${(1 - revealProgress).toFixed(4)})`);
        }

        if (state.topbar) {
          setStyleValue(state.topbar, 'opacity', revealProgress.toFixed(3));
          setStyleValue(state.topbar, 'transform', `translate3d(0, ${lerp(-8, 0, revealProgress).toFixed(2)}px, 0)`);
        }

        state.titleLines.forEach((line, index) => {
          const lineProgress = easeOut(segment(progress, 0.76 + index * 0.04, 0.96 + index * 0.04));
          setStyleValue(line, 'transform', `translate3d(0, ${((1 - lineProgress) * 120).toFixed(2)}%, 0)`);
        });
      });
    };

    registerScrollEffect({ update, refresh });
  };

  const initFeaturedProductStacks = () => {
    const stacks = document.querySelectorAll('[data-featured-product-stack]');
    if (!stacks.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const easeEdge = (progress) => {
      if (progress <= 0.08) return clamp(progress / 0.08, 0, 1);
      if (progress >= 0.96) return clamp((1.04 - progress) / 0.08, 0, 1);
      return 1;
    };

    const stackStates = Array.from(stacks).map((section) => ({
      section,
      cards: Array.from(section.querySelectorAll('[data-featured-product-card]')).map((card) => ({
        card,
        rotateFrom: Number(card.dataset.rotateFrom || 0),
        rotateTo: Number(card.dataset.rotateTo || 0)
      })),
      scrollable: 1
    })).filter((state) => state.cards.length);

    if (!stackStates.length) return;

    const refresh = ({ height }) => {
      stackStates.forEach((state) => {
        state.scrollable = Math.max(state.section.offsetHeight - height, 1);
      });
    };

    const update = ({ width, height }) => {
      const isMobile = width < 750;
      const stagger = isMobile ? 0.62 : 0.55;

      stackStates.forEach((state) => {
        const rect = state.section.getBoundingClientRect();
        const inView = rect.bottom > 0 && rect.top < height;
        toggleClass(state.section, 'is-in-view', inView);

        if (!isNearViewport(rect, height, 0.45)) return;

        const progress = clamp(-rect.top / state.scrollable, 0, 1);

        const timelineLength = Math.max((state.cards.length - 1) * stagger + 1, 1);
        const timelinePosition = progress * timelineLength;
        setCustomProperty(state.section, '--featured-stack-progress', progress.toFixed(4));

        state.cards.forEach(({ card, rotateFrom, rotateTo }, index) => {
          const cardProgress = clamp(timelinePosition - index * stagger, 0, 1);
          const travelStart = height * (isMobile ? 1.12 : 1.22);
          const travelEnd = -height * (isMobile ? 0.86 : 0.76);
          const y = lerp(travelStart, travelEnd, cardProgress);
          const scale = lerp(isMobile ? 1.04 : 1.12, 0.92, cardProgress);
          const rotate = lerp(rotateFrom, rotateTo, cardProgress);
          const opacity = easeEdge(cardProgress);

          setStyleValue(card, 'zIndex', String(index + 1));
          setStyleValue(card, 'opacity', opacity.toFixed(3));
          setStyleValue(card, 'transform', `translate3d(-50%, -50%, 0) translate3d(0, ${y.toFixed(2)}px, 0) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`);
          setStyleValue(card, 'pointerEvents', opacity > 0.92 && cardProgress > 0.08 && cardProgress < 0.92 ? 'auto' : 'none');
        });
      });
    };

    registerScrollEffect({ update, refresh });
  };

  const initPredictiveSearch = () => {
    document.querySelectorAll('[data-predictive-search]').forEach((form) => {
      const input = form.querySelector('input[type="search"]');
      const results = form.querySelector('[data-predictive-search-results]');
      if (!input || !results) return;

      const labels = {
        heading: strings.predictiveHeading || 'Suggested products',
        loading: strings.searchLoading || 'Searching...',
        noResults: strings.searchNoResults || 'No results found.',
        viewAll: strings.searchViewAll || 'View all results'
      };
      const cache = new Map();
      let controller = null;
      let debounceTimer = null;

      const getSearchUrl = (query) => {
        const predictiveRoute = window.Treadora?.routes?.predictiveSearch || '/search/suggest';
        const predictivePath = predictiveRoute.endsWith('.json') ? predictiveRoute : `${predictiveRoute.replace(/\/$/, '')}.json`;
        const url = new URL(predictivePath, window.location.origin);

        url.searchParams.set('q', query);
        url.searchParams.set('resources[type]', 'product');
        url.searchParams.set('resources[limit]', '6');
        url.searchParams.set('resources[options][unavailable_products]', 'last');
        url.searchParams.set('resources[options][fields]', 'title,product_type,variants.title,vendor');

        return url.toString();
      };

      const getResultsUrl = (query) => {
        const url = new URL(window.Treadora?.routes?.search || '/search', window.location.origin);
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

      const getProductImage = (product) => {
        if (typeof product.image === 'string') return product.image;
        return product.image?.url || product.featured_image?.url || product.featured_image || '';
      };

      const renderProductPrice = (product) => {
        const price = product.price_min ?? product.price;
        if (typeof price === 'number') return `<span class="predictive-search__price">${formatMoney(price)}</span>`;
        if (typeof price === 'string' && price.trim()) return `<span class="predictive-search__price">${escapeHTML(price)}</span>`;
        return '';
      };

      const renderProducts = (products, query) => {
        if (!products.length) {
          renderMessage(labels.noResults, 'empty');
          return;
        }

        const productMarkup = products.map((product) => {
          const image = getProductImage(product);
          const vendor = product.vendor || product.type || '';
          const price = renderProductPrice(product);

          return `
            <a class="predictive-search__item" href="${escapeAttribute(product.url || '#')}">
              <span class="predictive-search__media">
                ${
                  image
                    ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(product.title || '')}" loading="lazy">`
                    : '<span class="predictive-search__placeholder"></span>'
                }
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

        if (controller) controller.abort();
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
          .then((response) => response.json())
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

      document.addEventListener('click', (event) => {
        if (!form.contains(event.target)) {
          setExpanded(false);
        }
      });
    });
  };

  const initHeaderDrawers = () => {
    const closeDetails = (details, restoreFocus = false) => {
      if (!details || !details.hasAttribute('open')) return;

      details.removeAttribute('open');
      details.querySelectorAll('[data-predictive-search-results]').forEach((results) => {
        results.classList.remove('is-open');
      });
      details.querySelectorAll('input[aria-expanded]').forEach((input) => {
        input.setAttribute('aria-expanded', 'false');
      });

      if (restoreFocus) details.querySelector('summary')?.focus();
    };

    const closeGroup = (selector, except = null) => {
      document.querySelectorAll(selector).forEach((details) => {
        if (details !== except) closeDetails(details);
      });
    };

    document.querySelectorAll('[data-search-drawer]').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        closeGroup('[data-cart-drawer][open]');
        window.requestAnimationFrame(() => details.querySelector('[data-search-input]')?.focus());
      });
    });

    document.querySelectorAll('[data-cart-drawer]').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        closeGroup('[data-search-drawer][open]');
      });
    });

    document.querySelectorAll('[data-cart-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const cartDrawer = document.querySelector('[data-cart-drawer]');
        if (!cartDrawer) return;

        closeGroup('[data-search-drawer][open]');
        button.closest('.mobile-drawer')?.removeAttribute('open');
        cartDrawer.setAttribute('open', '');
        cartDrawer.querySelector('summary')?.focus();
      });
    });

    document.addEventListener('click', (event) => {
      const closeTrigger = event.target.closest('[data-details-close]');
      if (closeTrigger) {
        closeDetails(closeTrigger.closest('details'), true);
        return;
      }

      document.querySelectorAll('[data-search-drawer][open]').forEach((details) => {
        if (!details.contains(event.target)) closeDetails(details);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('[data-search-drawer][open], [data-cart-drawer][open], .mobile-drawer[open]').forEach((details) => {
        closeDetails(details, true);
      });
    });
  };

  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      const url = this.dataset.url;
      if (!url || this.querySelector('.product-grid')) return;

      fetch(url)
        .then((response) => response.text())
        .then((text) => {
          const html = document.createElement('div');
          html.innerHTML = text;
          const recommendations = html.querySelector('product-recommendations');
          if (recommendations && recommendations.innerHTML.trim().length) {
            this.innerHTML = recommendations.innerHTML;
            initReveal();
          }
        })
        .catch(() => {});
    }
  }

  class PickupAvailability extends HTMLElement {
    connectedCallback() {
      this.currentVariantId = this.dataset.variantId;
    }

    update(variantId) {
      if (!variantId || variantId === this.currentVariantId) return;
      this.currentVariantId = variantId;
      const rootUrl = this.dataset.rootUrl || '/';
      const sectionId = this.dataset.sectionId || 'pickup-availability';
      fetch(`${rootUrl}variants/${variantId}/?section_id=${sectionId}`)
        .then((response) => response.text())
        .then((text) => {
          this.innerHTML = text;
        })
        .catch(() => {});
    }
  }

  class VariantSelects extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.section;
      const json = document.getElementById(`ProductJson-${this.sectionId}`);
      this.variants = json ? JSON.parse(json.textContent) : [];
      this.form = document.getElementById(`product-form-${this.sectionId}`);
      this.addEventListener('change', this.onVariantChange.bind(this));
    }

    onVariantChange() {
      this.options = Array.from(this.querySelectorAll('fieldset')).map((fieldset) => {
        return fieldset.querySelector('input:checked')?.value;
      });
      this.currentVariant = this.variants.find((variant) => {
        return variant.options.every((option, index) => option === this.options[index]);
      });
      this.updateForm();
      this.updatePrice();
      this.updateAvailability();
      this.updateMedia();
      this.updatePickupAvailability();
    }

    updateForm() {
      if (!this.form) return;
      const input = this.form.querySelector('[data-product-id-input]');
      if (input && this.currentVariant) input.value = this.currentVariant.id;
    }

    updatePrice() {
      if (!this.form || !this.currentVariant) return;
      const price = this.form.querySelector('[data-product-price]');
      const compare = this.form.querySelector('[data-compare-price]');
      const unit = this.form.querySelector('[data-unit-price]');
      if (price) price.textContent = formatMoney(this.currentVariant.price);

      if (compare) {
        const showCompare = this.currentVariant.compare_at_price && this.currentVariant.compare_at_price > this.currentVariant.price;
        compare.classList.toggle('hidden', !showCompare);
        compare.innerHTML = showCompare ? `<s>${formatMoney(this.currentVariant.compare_at_price)}</s>` : '';
      }

      if (unit) {
        const measurement = this.currentVariant.unit_price_measurement;
        if (measurement && this.currentVariant.unit_price) {
          const referenceValue = measurement.reference_value !== 1 ? measurement.reference_value : '';
          unit.textContent = `${formatMoney(this.currentVariant.unit_price)}/${referenceValue}${measurement.reference_unit}`;
          unit.classList.remove('hidden');
        } else {
          unit.textContent = '';
          unit.classList.add('hidden');
        }
      }
    }

    updateAvailability() {
      if (!this.form) return;
      const button = this.form.querySelector('[data-add-to-cart]');
      const text = this.form.querySelector('[data-add-to-cart-text]');
      const sku = this.form.querySelector('[data-variant-sku]');
      const unavailable = !this.currentVariant;
      const soldOut = this.currentVariant && !this.currentVariant.available;

      if (button) button.disabled = unavailable || soldOut;
      if (text) {
        if (unavailable) text.textContent = strings.unavailable;
        else if (soldOut) text.textContent = strings.soldOut;
        else text.textContent = strings.addToCart;
      }
      if (sku) sku.textContent = this.currentVariant?.sku ? `SKU: ${this.currentVariant.sku}` : '';
    }

    updateMedia() {
      const mediaId = this.currentVariant?.featured_media?.id;
      if (!mediaId) return;
      const target = document.querySelector(`[data-media-id="${this.sectionId}-${mediaId}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    updatePickupAvailability() {
      const pickup = this.form?.closest('.product')?.querySelector('pickup-availability');
      if (pickup && this.currentVariant) pickup.update(this.currentVariant.id);
    }
  }

  const initAddressToggles = () => {
    document.querySelectorAll('[data-address-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = document.getElementById(button.dataset.addressToggle);
        if (target) target.hidden = !target.hidden;
      });
    });

    document.querySelectorAll('[data-confirm-message]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        if (!window.confirm(form.dataset.confirmMessage)) event.preventDefault();
      });
    });
  };

  if (!customElements.get('product-recommendations')) {
    customElements.define('product-recommendations', ProductRecommendations);
  }

  if (!customElements.get('pickup-availability')) {
    customElements.define('pickup-availability', PickupAvailability);
  }

  if (!customElements.get('variant-selects')) {
    customElements.define('variant-selects', VariantSelects);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initReveal();
    initHoverPreviews();
    initTiltStacks();
    initScrollHero();
    initImageSpread();
    initAlexandraLoader();
    initFeaturedProductStacks();
    initPredictiveSearch();
    initHeaderDrawers();
    initAddressToggles();
  });
})();
