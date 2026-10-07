import { clamp, lerp, mutate, isNearViewport, setStyleValue, setCustomProperty, toggleClass, registerScrollEffect, requestScrollEffects, requestResizeEffects, initializeMotionLifecycle } from './motion-runtime.js';

const initCollectionEdits = () => {
  const roots = document.querySelectorAll('[data-collection-edit]:not([data-collection-edit-ready])');
  if (!roots.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = Array.from(roots).map((root) => {
    root.dataset.collectionEditReady = 'true';
    root.classList.add('is-edit-ready');
    const state = {
      root,
      refine: root.querySelector('[data-edit-refine]'),
      masthead: root.querySelector('[data-edit-masthead]'),
      image: root.querySelector('.collection-edit__hero-image'),
      desktop: null,
      animate: false
    };
    const viewButtons = Array.from(root.querySelectorAll('[data-edit-view]'));
    viewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const density = button.dataset.editView === 'large' ? 'large' : 'standard';
        root.dataset.gridDensity = density;
        setCustomProperty(root, '--edit-columns', density === 'large' ? '2' : '3');
        viewButtons.forEach((view) => view.setAttribute('aria-pressed', String(view === button)));
        requestResizeEffects();
      });
    });
    return state;
  });

  const refresh = ({ width, height }) => {
    let headerBottom = 0;
    document.querySelectorAll('.site-header, .announcement-bar').forEach((header) => {
      const position = getComputedStyle(header).position;
      if (position === 'fixed' || position === 'sticky') {
        headerBottom = Math.max(headerBottom, header.getBoundingClientRect().bottom);
      }
    });
    states.forEach((state) => {
      if (!state.root.isConnected) return;
      const desktop = width >= 990;
      if (state.desktop !== desktop) {
        state.desktop = desktop;
        if (state.refine) state.refine.open = desktop;
      }
      state.animate = desktop && height >= 480 && !motion.matches
        && state.root.dataset.motionEnabled !== 'false';
      const top = Math.max(24, headerBottom + 24);
      setCustomProperty(state.root, '--edit-top', `${top}px`);
      setCustomProperty(state.root, '--edit-rail-height', `${Math.max(160, height - top - 24)}px`);
      if (!state.animate) {
        setCustomProperty(state.root, '--edit-image-y', '0px');
        setCustomProperty(state.root, '--edit-image-scale', '1');
      }
    });
  };

  const update = ({ height }) => {
    states.forEach((state) => {
      if (!state.root.isConnected || !state.animate || !state.image || !state.masthead) return;
      const rect = state.masthead.getBoundingClientRect();
      if (!isNearViewport(rect, height, 0.35)) return;
      const progress = clamp((height - rect.top) / (height + rect.height), 0, 1);
      setCustomProperty(state.root, '--edit-image-y', `${lerp(-12, 12, progress).toFixed(2)}px`);
      setCustomProperty(state.root, '--edit-image-scale', lerp(1.1, 1.06, progress).toFixed(4));
    });
  };

  motion.addEventListener('change', requestResizeEffects);
  registerScrollEffect({
    refresh,
    update,
    elements: states.map((state) => state.root),
    destroy: () => motion.removeEventListener('change', requestResizeEffects)
  });
};

const initEditorialPages = () => {
  const roots = document.querySelectorAll('[data-editorial-motion]:not([data-editorial-motion-ready])');
  if (!roots.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = Array.from(roots).map((root) => {
    root.dataset.editorialMotionReady = 'true';
    return {
      root,
      media: root.querySelector('[data-editorial-media]'),
      sticky: root.querySelector('[data-editorial-sticky]'),
      animate: false
    };
  });

  const refresh = ({ width, height }) => {
    let headerBottom = 0;
    document.querySelectorAll('.site-header, .announcement-bar').forEach((header) => {
      const position = getComputedStyle(header).position;
      if (position === 'fixed' || position === 'sticky') {
        headerBottom = Math.max(headerBottom, header.getBoundingClientRect().bottom);
      }
    });
    const top = Math.max(24, headerBottom + 24);
    states.forEach((state) => {
      if (!state.root.isConnected) return;
      state.animate = width >= 990 && height >= 480 && !motion.matches
        && state.root.dataset.motionEnabled !== 'false';
      setCustomProperty(state.root, '--editorial-top', `${top}px`);
      toggleClass(state.root, 'has-sticky-intro', Boolean(state.animate && state.sticky
        && state.sticky.getBoundingClientRect().height <= height - top - 24));
      if (!state.animate) {
        setCustomProperty(state.root, '--editorial-image-y', '0px');
        setCustomProperty(state.root, '--editorial-image-scale', '1');
      }
    });
  };

  const update = ({ height }) => {
    states.forEach((state) => {
      if (!state.root.isConnected || !state.animate || !state.media) return;
      const rect = state.media.getBoundingClientRect();
      if (!isNearViewport(rect, height)) return;
      const progress = clamp((height - rect.top) / (height + rect.height), 0, 1);
      setCustomProperty(state.root, '--editorial-image-y', `${lerp(-12, 12, progress).toFixed(2)}px`);
      setCustomProperty(state.root, '--editorial-image-scale', lerp(1.08, 1.04, progress).toFixed(4));
    });
  };

  const observer = new ResizeObserver(requestResizeEffects);
  states.forEach((state) => {
    if (state.sticky) observer.observe(state.sticky);
  });
  motion.addEventListener('change', requestResizeEffects);
  registerScrollEffect({
    refresh,
    update,
    elements: states.map((state) => state.root),
    destroy: () => {
      motion.removeEventListener('change', requestResizeEffects);
      observer.disconnect();
    }
  });
};

const initArticleReaders = () => {
  const roots = document.querySelectorAll('[data-article-reader]:not([data-article-reader-ready])');
  if (!roots.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const states = Array.from(roots).map((root) => {
    root.dataset.articleReaderReady = 'true';
    const content = root.querySelector('[data-reader-content]');
    const outline = root.querySelector('[data-reader-outline]');
    const list = root.querySelector('[data-reader-links]');
    const progress = root.querySelector('[data-reader-progress]');
    const nodes = [];
    list?.replaceChildren();
    if (content && outline && list && root.dataset.outlineEnabled !== 'false') {
      content.querySelectorAll('h2, h3').forEach((heading, index) => {
        const title = heading.textContent.trim().replace(/\s+/g, ' ');
        if (!title) return;
        if (!heading.id || document.getElementById(heading.id) !== heading) {
          const prefix = root.id || 'ArticleReader';
          let id = `${prefix}-heading-${index + 1}`;
          let suffix = 1;
          while (document.getElementById(id)) id = `${prefix}-heading-${index + 1}-${suffix++}`;
          heading.id = id;
        }
        if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.setAttribute('href', `#${encodeURIComponent(heading.id)}`);
        link.textContent = title;
        if (heading.tagName === 'H3') item.classList.add('is-subheading');
        item.append(link);
        list.append(item);
        nodes.push({ heading, link });
      });
      outline.hidden = nodes.length === 0;
    }
    if (progress && content) progress.hidden = false;
    const reveals = new Set(content?.querySelectorAll('h2, h3, blockquote, figure') || []);
    Array.from(content?.children || []).forEach((element, index) => {
      if (element.tagName === 'P' && (index === 0 || element.querySelector('img'))) reveals.add(element);
      if (element.tagName === 'IMG') reveals.add(element);
    });
    root.querySelectorAll('.article-editorial__next > header, .article-editorial__next-story').forEach((element) => reveals.add(element));
    Array.from(reveals).forEach((element, index) => {
      element.classList.add('reader-reveal');
      if (element.classList.contains('article-editorial__next-story')) {
        setCustomProperty(element, '--reader-reveal-delay', `${index % 2 * 90}ms`);
      }
    });
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-reader-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });
    return {
      root, content, outline, progress, nodes, reveals, revealObserver,
      header: root.querySelector('.article-editorial__header'),
      stage: root.querySelector('[data-reader-cover-stage]'),
      cover: root.querySelector('[data-reader-cover]'),
      desktop: null, active: -1, top: 130,
      animate: null, drift: false, pinCover: false, coverHeight: 0
    };
  });

  const refresh = ({ width, height }) => {
    let headerBottom = 0;
    document.querySelectorAll('.site-header, .announcement-bar').forEach((header) => {
      const position = getComputedStyle(header).position;
      if (position === 'fixed' || position === 'sticky') {
        headerBottom = Math.max(headerBottom, header.getBoundingClientRect().bottom);
      }
    });
    states.forEach((state) => {
      if (!state.root.isConnected) return;
      state.top = Math.max(24, headerBottom + 24);
      const desktop = width >= 990;
      if (state.desktop !== desktop) {
        state.desktop = desktop;
        if (state.outline) state.outline.open = desktop;
      }
      const animate = !motion.matches && state.root.dataset.motionEnabled !== 'false';
      if (state.animate !== animate) {
        state.animate = animate;
        state.revealObserver.disconnect();
        toggleClass(state.root, 'article-has-motion', animate);
        if (animate) {
          state.reveals.forEach((element) => {
            if (element.classList.contains('is-reader-visible')) return;
            if (element.getBoundingClientRect().top < height * 0.92) {
              element.classList.add('is-reader-visible');
            } else {
              state.revealObserver.observe(element);
            }
          });
        }
      }
      state.drift = animate && desktop && height >= 480;
      state.pinCover = Boolean(animate && desktop && height >= 600 && state.stage && state.cover);
      state.coverHeight = Math.min(680, Math.max(240, height - state.top - 24));
      setCustomProperty(state.root, '--reader-top', `${state.top}px`);
      setCustomProperty(state.root, '--reader-rail-height', `${Math.max(120, height - state.top - 24)}px`);
      setCustomProperty(state.root, '--reader-cover-height', `${state.coverHeight}px`);
      setCustomProperty(state.root, '--reader-cover-stage-height', `${Math.round(state.coverHeight * 1.65)}px`);
      toggleClass(state.root, 'has-cover-pin', state.pinCover);
      if (!state.drift) {
        setCustomProperty(state.root, '--editorial-image-y', '0px');
        setCustomProperty(state.root, '--editorial-image-scale', '1');
        setCustomProperty(state.root, '--reader-title-y', '0px');
        setCustomProperty(state.root, '--reader-caption-y', '0px');
        setCustomProperty(state.root, '--reader-caption-opacity', '1');
        setCustomProperty(state.root, '--reader-cover-inset', '0%');
      }
    });
  };

  const update = ({ height }) => {
    states.forEach((state) => {
      if (!state.root.isConnected) return;
      if (state.drift && state.header) {
        const headerRect = state.header.getBoundingClientRect();
        if (isNearViewport(headerRect, height)) {
          const progress = clamp((state.top - headerRect.top) / Math.max(1, headerRect.height), 0, 1);
          setCustomProperty(state.root, '--reader-title-y', `${(-progress * 24).toFixed(2)}px`);
        }
      }
      if (state.drift && state.stage && state.cover) {
        const stageRect = state.stage.getBoundingClientRect();
        if (isNearViewport(stageRect, height)) {
          let progress;
          let imageY;
          let scale;
          if (state.pinCover) {
            progress = clamp((state.top - stageRect.top) / Math.max(1, stageRect.height - state.coverHeight), 0, 1);
            const entry = clamp((height - stageRect.top) / Math.max(1, height - state.top), 0, 1);
            imageY = lerp(18, 0, entry) - progress * 12;
            scale = lerp(1.22, 1.16, entry) - progress * 0.1;
          } else {
            progress = clamp((height - stageRect.top) / (height + stageRect.height), 0, 1);
            imageY = lerp(12, -12, progress);
            scale = lerp(1.12, 1.06, progress);
          }
          setCustomProperty(state.root, '--editorial-image-y', `${imageY.toFixed(2)}px`);
          setCustomProperty(state.root, '--editorial-image-scale', scale.toFixed(4));
          setCustomProperty(state.root, '--reader-cover-inset', `${state.pinCover ? lerp(4, 0, progress).toFixed(3) : 0}%`);
          setCustomProperty(state.root, '--reader-caption-y', `${lerp(8, 0, progress).toFixed(2)}px`);
          setCustomProperty(state.root, '--reader-caption-opacity', lerp(0.7, 1, progress).toFixed(3));
        }
      }
      if (!state.content) return;
      const rect = state.content.getBoundingClientRect();
      const distance = Math.max(1, rect.height - height + state.top + 24);
      const progress = rect.height > 0 ? clamp((state.top - rect.top) / distance, 0, 1) : 0;
      setCustomProperty(state.root, '--reading-progress', progress.toFixed(4));
      if (!state.nodes.length || rect.top > height * 1.35) return;
      let active = 0;
      state.nodes.forEach(({ heading }, index) => {
        if (heading.getBoundingClientRect().top <= state.top + 32) active = index;
      });
      if (active === state.active) return;
      state.active = active;
      state.nodes.forEach(({ link }, index) => {
        mutate(() => {
          if (index === active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    });
  };

  const observer = new ResizeObserver(requestResizeEffects);
  states.forEach((state) => {
    if (state.content) observer.observe(state.content);
    if (state.header) observer.observe(state.header);
  });
  motion.addEventListener('change', requestResizeEffects);
  registerScrollEffect({
    refresh,
    update,
    elements: states.map((state) => state.root),
    destroy: () => {
      observer.disconnect();
      motion.removeEventListener('change', requestResizeEffects);
      states.forEach((state) => state.revealObserver.disconnect());
    }
  });
};

const initProductEditorials = () => {
  document.querySelectorAll('[data-product-editorial]:not([data-product-editorial-ready])').forEach((root) => {
    const gallery = root.querySelector('.product__media-gallery');
    const info = root.querySelector('.product__info');
    if (!gallery || !info || !gallery.querySelector('.product-media__content')) return;
    root.dataset.productEditorialReady = 'true';
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const headers = [...document.querySelectorAll('.site-header, .announcement-bar')];
    const galleryChrome = [...gallery.children].filter((element) => !element.classList.contains('product__media-stage'));
    const captions = [...gallery.querySelectorAll('.product-media__caption')];
    const reveals = [...root.querySelectorAll('.product__policies, .product__complementary, .product__detail-nav, .product__detail-intro, .product__detail-panel > .rte, .product__fact-list, .product__policy-summaries')];
    reveals.forEach((element) => element.classList.add('product-reveal'));
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-product-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -4% 0px' });
    let animate = null;
    let top = 110;
    let layoutKey = '';

    const refresh = ({ width, height }) => {
      let headerBottom = 0;
      headers.forEach((header) => {
        const position = getComputedStyle(header).position;
        if (position === 'fixed' || position === 'sticky') {
          headerBottom = Math.max(headerBottom, header.getBoundingClientRect().bottom);
        }
      });
      top = Math.max(18, Math.ceil(headerBottom) + 18);
      const desktop = width >= 990 && height >= 600;
      const nextAnimate = !motion.matches && root.dataset.motionEnabled !== 'false';
      const gap = parseFloat(getComputedStyle(gallery).rowGap) || 0;
      const captionHeight = Math.max(0, ...captions.map((caption) => caption.offsetHeight));
      const chromeHeight = galleryChrome.reduce((total, element) => total + element.offsetHeight, 0)
        + captionHeight + gap * Math.max(0, gallery.children.length - 1) + 2;
      const nextLayoutKey = `${width}:${Math.floor(height)}:${top}:${chromeHeight}:${root.dataset.stickyGallery}`;
      if (layoutKey !== nextLayoutKey) {
        layoutKey = nextLayoutKey;
        const mediaHeight = Math.max(260, Math.min(740, Math.floor(height - top - chromeHeight - 24)));
        setCustomProperty(root, '--product-sticky-top', `${top}px`);
        setCustomProperty(root, '--product-media-height', `${mediaHeight}px`);
        toggleClass(root, 'is-product-desktop', desktop);
        toggleClass(root, 'is-product-sticky', desktop && root.dataset.stickyGallery !== 'false'
          && mediaHeight + chromeHeight <= height - top - 18);
      }
      if (animate !== nextAnimate) {
        animate = nextAnimate;
        revealObserver.disconnect();
        toggleClass(root, 'is-product-motion', animate);
        if (animate) {
          reveals.forEach((element) => {
            if (element.classList.contains('is-product-visible')) return;
            if (element.getBoundingClientRect().top < height * 0.96 && element.getClientRects().length) {
              element.classList.add('is-product-visible');
            } else {
              revealObserver.observe(element);
            }
          });
        }
      }
      if (!animate) setCustomProperty(root, '--product-scroll-progress', '0');
    };

    const update = ({ height }) => {
      if (!animate) return;
      const rect = root.getBoundingClientRect();
      if (!isNearViewport(rect, height)) return;
      const infoRect = info.getBoundingClientRect();
      const distance = Math.max(1, infoRect.height - (height - top - 18));
      const progress = clamp((top - infoRect.top) / distance, 0, 1);
      setCustomProperty(root, '--product-scroll-progress', progress.toFixed(4));
    };

    const observer = new ResizeObserver(requestResizeEffects);
    [info, ...headers, ...galleryChrome, ...captions].forEach((element) => observer.observe(element));
    motion.addEventListener('change', requestResizeEffects);
    registerScrollEffect({
      refresh,
      update,
      elements: [root],
      destroy: () => {
        observer.disconnect();
        revealObserver.disconnect();
        motion.removeEventListener('change', requestResizeEffects);
      }
    });
  });
};

export const initializePageMotion = () => {
  initCollectionEdits();
  initEditorialPages();
  initArticleReaders();
  initProductEditorials();
  initializeMotionLifecycle();
};
