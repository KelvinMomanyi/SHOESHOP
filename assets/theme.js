(() => {
  const moneyFormat = window.Scrollcraft?.moneyFormat || '${{amount}}';

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
          floatingPreview.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${visible ? 1 : 0})`;
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
            previewTrack.style.transform = `translateY(${-100 * index}%)`;
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

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    let ticking = false;

    const update = () => {
      let hasPassedHero = false;

      heroes.forEach((hero) => {
        const panels = Array.from(hero.querySelectorAll('.editorial-hero__panel'));
        const dots = Array.from(hero.querySelectorAll('.editorial-hero__dots span'));
        if (!panels.length) return;

        const rect = hero.getBoundingClientRect();
        const scrollable = Math.max(hero.offsetHeight - window.innerHeight, 1);
        const progress = clamp(-rect.top / scrollable, 0, 1);
        const inView = rect.bottom > 0 && rect.top < window.innerHeight;
        const segments = Math.max(panels.length - 1, 1);
        const timelinePosition = progress * segments;
        const activeIndex = Math.min(panels.length - 1, Math.floor(progress * panels.length));

        if (rect.bottom <= 0) hasPassedHero = true;
        hero.style.setProperty('--hero-progress', progress.toFixed(4));
        hero.classList.toggle('is-in-view', inView);

        panels.forEach((panel, index) => {
          const image = panel.querySelector('.editorial-hero__image');
          const clipProgress = index < panels.length - 1 ? clamp(timelinePosition - index, 0, 1) : 0;
          const imageProgress = index === 0 ? 1 : clamp(timelinePosition - (index - 1), 0, 1);
          const scale = 1.2 - imageProgress * 0.2;

          panel.style.clipPath = `inset(0 0 ${clipProgress * 100}% 0)`;
          panel.classList.toggle('is-active', index === activeIndex);
          if (image) image.style.transform = `scale(${scale.toFixed(4)})`;
        });

        dots.forEach((dot, index) => dot.classList.toggle('is-active', index === activeIndex));
      });

      document.body.classList.toggle('is-past-hero', hasPassedHero);
      ticking = false;
    };

    const requestUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
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
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const lerp = (start, end, progress) => start + (end - start) * progress;
    let ticking = false;

    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < 800;
      const spread = isMobile ? 1.45 : 0.72;

      spreads.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const scrollable = Math.max(section.offsetHeight - height, 1);
        const progress = clamp(-rect.top / scrollable, 0, 1);
        const items = Array.from(section.querySelectorAll('[data-flow-item]'));

        items.forEach((item, index) => {
          const position = positions[index % positions.length];
          const totalDelay = 0.38;
          const delay = items.length > 1 ? (index / (items.length - 1)) * totalDelay : 0;
          const itemProgress = clamp((progress - delay) / (1 - totalDelay), 0, 1);
          const finalX = position.x * width * spread;
          const finalY = position.y * height * spread;
          let x = lerp(0, finalX, itemProgress);
          let y = lerp(0, finalY, itemProgress);
          let z = lerp(-1000, 2000, itemProgress);
          let scale = lerp(0.05, 1, itemProgress);
          let opacity = itemProgress > 0 ? clamp(itemProgress * 1.6, 0, 1) : 0;

          if (item.classList.contains('is-cover')) {
            x = 0;
            y = 0;
            z = lerp(-900, 0, itemProgress);
          }

          item.style.opacity = opacity.toFixed(3);
          item.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) scale(${scale.toFixed(4)})`;
        });
      });

      ticking = false;
    };

    const requestUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  };

  const initAlexandraLoader = () => {
    const loaders = document.querySelectorAll('[data-alexandra-loader]');
    if (!loaders.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const lerp = (start, end, progress) => start + (end - start) * progress;
    const segment = (progress, start, end) => clamp((progress - start) / (end - start), 0, 1);
    const easeOut = (progress) => 1 - Math.pow(1 - progress, 3);
    const easeInOut = (progress) => {
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    };
    let ticking = false;

    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < 768;
      const baseWidth = Math.min(Math.max(width * (isMobile ? 0.26 : 0.14), isMobile ? 82 : 76), isMobile ? 120 : 140);

      loaders.forEach((section) => {
        const gallery = section.querySelector('[data-loader-gallery]');
        const curtain = section.querySelector('[data-loader-curtain]');
        const topbar = section.querySelector('[data-loader-topbar]');
        const titleLines = Array.from(section.querySelectorAll('[data-loader-title-line]'));
        const items = Array.from(section.querySelectorAll('[data-loader-item]')).filter((item) => item.offsetWidth > 0);
        if (!gallery || !items.length) return;

        const rect = section.getBoundingClientRect();
        const scrollable = Math.max(section.offsetHeight - height, 1);
        const progress = reduceMotion ? 1 : clamp(-rect.top / scrollable, 0, 1);
        const inView = rect.bottom > 0 && rect.top < height;
        const hero = section.querySelector('[data-loader-item].is-hero') || items[Math.floor(items.length / 2)];
        const galleryWidth = gallery.clientWidth;
        const initialGap = items.length > 1 ? Math.max(0, (galleryWidth - items.length * baseWidth) / (items.length - 1)) : 0;
        const finalGap = baseWidth * 0.4;
        const gatherProgress = easeInOut(segment(progress, 0.24, 0.44));
        const sideItems = items.filter((item) => item !== hero);
        const heroProgress = easeInOut(segment(progress, 0.58, 0.86));
        const targetHeroWidth = Math.min(width * (isMobile ? 0.8 : 0.25), galleryWidth * 0.86);
        const revealProgress = easeInOut(segment(progress, 0.72, 0.9));

        section.style.setProperty('--alexandra-progress', progress.toFixed(4));
        section.classList.toggle('is-in-view', inView);
        gallery.style.gap = `${lerp(initialGap, finalGap, gatherProgress).toFixed(2)}px`;

        items.forEach((item, index) => {
          const appearProgress = easeOut(segment(progress, index * 0.03, 0.2 + index * 0.03));
          const sideIndex = sideItems.indexOf(item);
          const clipProgress = item === hero
            ? 0
            : easeInOut(segment(progress, 0.48 + sideIndex * 0.025, 0.66 + sideIndex * 0.025));
          const scale = item === hero
            ? lerp(lerp(1, 1.2, gatherProgress), 1, heroProgress)
            : lerp(1, 1.2, gatherProgress);

          item.style.opacity = appearProgress.toFixed(3);
          item.style.transform = `translateY(${lerp(60, 0, appearProgress).toFixed(2)}px) scale(${scale.toFixed(4)})`;
          item.style.clipPath = `inset(0 0 ${(clipProgress * 100).toFixed(2)}% 0)`;
          item.style.pointerEvents = item === hero || clipProgress < 0.98 ? 'auto' : 'none';
        });

        if (hero) {
          hero.style.width = `${lerp(baseWidth, targetHeroWidth, heroProgress).toFixed(2)}px`;
        }

        if (curtain) {
          curtain.style.transform = `scaleY(${(1 - revealProgress).toFixed(4)})`;
        }

        if (topbar) {
          topbar.style.opacity = revealProgress.toFixed(3);
          topbar.style.transform = `translateY(${lerp(-8, 0, revealProgress).toFixed(2)}px)`;
        }

        titleLines.forEach((line, index) => {
          const lineProgress = easeOut(segment(progress, 0.76 + index * 0.04, 0.96 + index * 0.04));
          line.style.transform = `translateY(${((1 - lineProgress) * 120).toFixed(2)}%)`;
        });
      });

      ticking = false;
    };

    const requestUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  };

  const initFeaturedProductStacks = () => {
    const stacks = document.querySelectorAll('[data-featured-product-stack]');
    if (!stacks.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const lerp = (start, end, progress) => start + (end - start) * progress;
    const easeEdge = (progress) => {
      if (progress <= 0.08) return clamp(progress / 0.08, 0, 1);
      if (progress >= 0.96) return clamp((1.04 - progress) / 0.08, 0, 1);
      return 1;
    };
    let ticking = false;

    const update = () => {
      const height = window.innerHeight;
      const width = window.innerWidth;
      const isMobile = width < 750;
      const stagger = isMobile ? 0.62 : 0.55;

      stacks.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const scrollable = Math.max(section.offsetHeight - height, 1);
        const progress = clamp(-rect.top / scrollable, 0, 1);
        const cards = Array.from(section.querySelectorAll('[data-featured-product-card]'));
        if (!cards.length) return;

        const timelineLength = Math.max((cards.length - 1) * stagger + 1, 1);
        const timelinePosition = progress * timelineLength;
        section.style.setProperty('--featured-stack-progress', progress.toFixed(4));
        section.classList.toggle('is-in-view', rect.bottom > 0 && rect.top < height);

        cards.forEach((card, index) => {
          const cardProgress = clamp(timelinePosition - index * stagger, 0, 1);
          const rotateFrom = Number(card.dataset.rotateFrom || 0);
          const rotateTo = Number(card.dataset.rotateTo || 0);
          const travelStart = height * (isMobile ? 1.12 : 1.22);
          const travelEnd = -height * (isMobile ? 0.86 : 0.76);
          const y = lerp(travelStart, travelEnd, cardProgress);
          const scale = lerp(isMobile ? 1.04 : 1.12, 0.92, cardProgress);
          const rotate = lerp(rotateFrom, rotateTo, cardProgress);
          const opacity = easeEdge(cardProgress);

          card.style.zIndex = String(index + 1);
          card.style.opacity = opacity.toFixed(3);
          card.style.transform = `translate(-50%, -50%) translateY(${y.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
          card.style.pointerEvents = opacity > 0.92 && cardProgress > 0.08 && cardProgress < 0.92 ? 'auto' : 'none';
        });
      });

      ticking = false;
    };

    const requestUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  };

  const initPredictiveSearch = () => {
    document.querySelectorAll('[data-predictive-search]').forEach((form) => {
      const input = form.querySelector('input[type="search"]');
      const results = form.querySelector('[data-predictive-search-results]');
      if (!input || !results) return;

      let controller = null;
      input.addEventListener('input', () => {
        const query = input.value.trim();
        input.setAttribute('aria-expanded', 'false');
        results.classList.remove('is-open');

        if (controller) controller.abort();
        if (query.length < 2) {
          results.innerHTML = '';
          return;
        }

        controller = new AbortController();
        const url = `${window.Scrollcraft.routes.predictiveSearch}?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=4&resources[options][unavailable_products]=last`;

        fetch(url, { signal: controller.signal })
          .then((response) => response.json())
          .then((data) => {
            const products = data.resources?.results?.products || [];
            if (!products.length) {
              results.innerHTML = '';
              return;
            }

            results.innerHTML = products.map((product) => {
              const image = product.image ? `<img src="${product.image}" alt="">` : '<span></span>';
              return `<a href="${product.url}">${image}<span>${product.title}</span></a>`;
            }).join('');
            results.classList.add('is-open');
            input.setAttribute('aria-expanded', 'true');
          })
          .catch((error) => {
            if (error.name !== 'AbortError') results.innerHTML = '';
          });
      });

      document.addEventListener('click', (event) => {
        if (!form.contains(event.target)) {
          results.classList.remove('is-open');
          input.setAttribute('aria-expanded', 'false');
        }
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
        if (unavailable) text.textContent = 'Unavailable';
        else if (soldOut) text.textContent = 'Sold out';
        else text.textContent = 'Add to cart';
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
      const pickup = document.querySelector('pickup-availability');
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
    initAddressToggles();
  });
})();
