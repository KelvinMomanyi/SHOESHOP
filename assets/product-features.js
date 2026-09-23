const moneyFormat = window.Treadora?.moneyFormat || '${{amount}}';
const strings = window.Treadora?.strings || {};

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

class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    const url = this.dataset.url;
    if (!url || this.dataset.loaded === 'true') return;

    this.dataset.loaded = 'true';
    this.setAttribute('aria-busy', 'true');

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load product recommendations');
        return response.text();
      })
      .then((text) => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('product-recommendations');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
          window.TreadoraTheme?.initialize(this);
        } else if (this.dataset.hideWhenEmpty === 'true') {
          this.closest('[data-recommendations-container]')?.setAttribute('hidden', '');
        }
      })
      .catch(() => {
        delete this.dataset.loaded;
      })
      .finally(() => this.removeAttribute('aria-busy'));
  }
}

class PickupAvailability extends HTMLElement {
  connectedCallback() {
    this.currentVariantId = this.dataset.variantId;
  }

  update(variantId) {
    if (!variantId || variantId === this.currentVariantId) return;
    this.currentVariantId = variantId;
    const rootUrl = this.dataset.rootUrl || window.Treadora?.routes?.root;
    if (!rootUrl) return;
    const localizedRoot = rootUrl.endsWith('/') ? rootUrl : `${rootUrl}/`;
    const sectionId = this.dataset.sectionId || 'pickup-availability';
    fetch(`${localizedRoot}variants/${variantId}/?section_id=${sectionId}`)
      .then((response) => response.text())
      .then((text) => {
        this.innerHTML = text;
      })
      .catch(() => {});
  }
}

class VariantSelects extends HTMLElement {
  connectedCallback() {
    if (this.dataset.variantSelectsReady === 'true') return;
    this.dataset.variantSelectsReady = 'true';
    this.sectionId = this.dataset.section;
    const json = document.getElementById(`ProductJson-${this.sectionId}`);
    this.variants = json ? JSON.parse(json.textContent) : [];
    this.form = document.getElementById(`product-form-${this.sectionId}`);
    this.requestController = null;
    this.addEventListener('change', this.onVariantChange.bind(this));
  }

  onVariantChange(event) {
    this.options = Array.from(this.querySelectorAll('fieldset')).map((fieldset) => {
      return fieldset.querySelector('input:checked')?.value;
    });
    this.currentVariant = this.variants.find((variant) => {
      return variant.options.every((option, index) => option === this.options[index]);
    });
    this.querySelectorAll('fieldset').forEach((fieldset) => {
      const selectedLabel = fieldset.querySelector('[data-selected-option]');
      if (selectedLabel) selectedLabel.textContent = fieldset.querySelector('input:checked')?.value || '';
    });
    this.updateForm();
    this.updatePrice();
    this.updateAvailability();
    this.updateMedia();
    this.updatePickupAvailability();
    this.renderSelectedOptions(event.target);
  }

  getSelectedOptionValueIds() {
    return Array.from(this.querySelectorAll('fieldset input:checked'))
      .map((input) => input.dataset.optionValueId)
      .filter(Boolean);
  }

  async renderSelectedOptions(changedInput) {
    if (!(changedInput instanceof HTMLInputElement)) return;

    const selectedOptionValueIds = this.getSelectedOptionValueIds();
    const optionCount = this.querySelectorAll('fieldset').length;
    if (!this.sectionId || selectedOptionValueIds.length !== optionCount) return;

    const productUrl = changedInput.dataset.productUrl || this.dataset.url;
    if (!productUrl) return;

    const shouldUpdateUrl = this.dataset.updateUrl === 'true';
    const currentProductUrl = new URL(this.dataset.url, window.location.origin);
    const nextProductUrl = new URL(productUrl, window.location.origin);

    if (!shouldUpdateUrl && changedInput.dataset.productUrl && nextProductUrl.pathname !== currentProductUrl.pathname) {
      window.location.assign(nextProductUrl.toString());
      return;
    }

    const requestUrl = new URL(nextProductUrl.toString());
    requestUrl.searchParams.delete('variant');
    requestUrl.searchParams.set('option_values', selectedOptionValueIds.join(','));
    requestUrl.searchParams.set('section_id', this.sectionId);

    this.requestController?.abort();
    this.requestController = new AbortController();

    const currentProduct = this.closest('.product');
    currentProduct?.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(requestUrl.toString(), { signal: this.requestController.signal });
      if (!response.ok) throw new Error(`Variant section request failed: ${response.status}`);

      const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
      const newProduct = documentFragment.querySelector(`.product[data-section-id="${this.sectionId}"]`);
      if (!newProduct || !currentProduct) {
        currentProduct?.removeAttribute('aria-busy');
        return;
      }

      const variantId = newProduct.querySelector('[data-product-id-input]')?.value;
      const changedOptionValueId = changedInput.dataset.optionValueId;
      currentProduct.replaceWith(newProduct);
      initializeProductFeatures(document);
      window.TreadoraTheme?.initialize(newProduct);
      window.TreadoraFormEnhancements?.initialize(newProduct);
      window.dispatchEvent(new Event('resize'));

      if (shouldUpdateUrl) {
        const pageUrl = new URL(nextProductUrl.toString());
        pageUrl.searchParams.delete('option_values');
        pageUrl.searchParams.delete('section_id');
        if (variantId) pageUrl.searchParams.set('variant', variantId);
        window.history.replaceState({}, '', `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
      }

      window.requestAnimationFrame(() => {
        if (!changedOptionValueId) return;
        newProduct.querySelector(`[data-option-value-id="${changedOptionValueId}"]`)?.focus({ preventScroll: true });
      });
    } catch (error) {
      if (error.name !== 'AbortError') currentProduct?.removeAttribute('aria-busy');
    }
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

    const savings = this.form.querySelector('[data-product-savings]');
    if (savings) {
      const comparePrice = this.currentVariant.compare_at_price;
      const hasSavings = comparePrice > this.currentVariant.price;
      savings.hidden = !hasSavings;
      if (hasSavings) {
        const percent = Math.round((comparePrice - this.currentVariant.price) * 100 / comparePrice);
        savings.textContent = savings.dataset.savingsLabel.replace('[percent]', String(percent));
      }
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
    if (sku) sku.textContent = this.currentVariant?.sku ? `${strings.sku}: ${this.currentVariant.sku}` : '';
    const availability = this.form.querySelector('[data-main-availability]');
    if (availability) {
      availability.classList.toggle('is-unavailable', unavailable || soldOut);
      availability.textContent = unavailable ? strings.unavailable : soldOut ? strings.soldOut : availability.dataset.availableLabel;
    }
    if (unavailable) {
      const savings = this.form.querySelector('[data-product-savings]');
      if (savings) savings.hidden = true;
    }
  }

  updateMedia() {
    const mediaId = this.currentVariant?.featured_media?.id;
    if (!mediaId) return;
    const gallery = this.form?.closest('.product')?.querySelector('[data-product-media-gallery]');
    const thumbnail = gallery?.closest('.product__media-gallery')?.querySelector(`[data-media-thumbnail="${this.sectionId}-${mediaId}"]`);
    if (thumbnail) thumbnail.click();
  }

  updatePickupAvailability() {
    const pickup = this.form?.closest('.product')?.querySelector('pickup-availability');
    if (pickup && this.currentVariant) pickup.update(this.currentVariant.id);
  }
}

const initProductMediaGalleries = () => {
  document.querySelectorAll('[data-product-media-gallery]').forEach((stage) => {
    const gallery = stage.closest('.product__media-gallery');
    if (!gallery || gallery.dataset.mediaGalleryReady) return;

    const mediaItems = [...stage.querySelectorAll('[data-media-id]')];
    const thumbnails = [...gallery.querySelectorAll('[data-media-thumbnail]')];
    if (!mediaItems.length || !thumbnails.length) return;

    gallery.dataset.mediaGalleryReady = 'true';

    const selectMedia = (mediaId) => {
      const selectedMedia = stage.querySelector(`[data-media-id="${mediaId}"]`);
      if (!selectedMedia) return;

      mediaItems.forEach((item) => {
        const isSelected = item === selectedMedia;
        item.classList.toggle('product-media--active', isSelected);
        if (!isSelected) item.querySelectorAll('video').forEach((video) => video.pause());
      });

      thumbnails.forEach((thumbnail) => {
        const isSelected = thumbnail.dataset.mediaThumbnail === mediaId;
        thumbnail.classList.toggle('is-active', isSelected);
        thumbnail.setAttribute('aria-pressed', String(isSelected));
      });
    };

    thumbnails.forEach((thumbnail) => {
      thumbnail.addEventListener('click', () => selectMedia(thumbnail.dataset.mediaThumbnail));
    });
    gallery.querySelectorAll('[data-media-step]').forEach((button) => {
      button.hidden = false;
      button.addEventListener('click', () => {
        const currentIndex = mediaItems.findIndex((item) => item.classList.contains('product-media--active'));
        const nextIndex = (currentIndex + Number(button.dataset.mediaStep) + mediaItems.length) % mediaItems.length;
        const mediaId = mediaItems[nextIndex].dataset.mediaId;
        selectMedia(mediaId);
        const thumbnail = thumbnails.find((item) => item.dataset.mediaThumbnail === mediaId);
        if (thumbnail) {
          const offset = thumbnail.offsetLeft - thumbnail.parentElement.offsetLeft;
          thumbnail.parentElement.scrollTo({ left: offset - thumbnail.parentElement.clientWidth / 2 + thumbnail.clientWidth / 2 });
        }
      });
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

export const initializeProductFeatures = () => {
  initProductMediaGalleries();
};

initializeProductFeatures();
