let lifecycleReady = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, progress) => start + (end - start) * progress;
const styleCache = new WeakMap();
let scrollEffects = [];
let scrollTicking = false;
let resizeTicking = false;

const getViewport = () => ({
  width: document.documentElement.clientWidth || window.innerWidth,
  height: window.visualViewport?.height || document.documentElement.clientHeight || window.innerHeight
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

const pruneScrollEffects = () => {
  scrollEffects = scrollEffects.filter((effect) => {
    const connected = !effect.elements || effect.elements.some((element) => element.isConnected);
    if (!connected) effect.destroy?.();
    return connected;
  });
};

const runScrollEffects = () => {
  pruneScrollEffects();
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
    pruneScrollEffects();
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
    window.visualViewport?.addEventListener('resize', requestResizeEffects);
  }

  const viewport = getViewport();
  effect.refresh?.(viewport);
  effect.update(viewport);
};

const initHoverPreviews = () => {
  document.querySelectorAll('[data-hover-preview]').forEach((root) => {
    if (root.dataset.hoverPreviewReady === 'true') return;
    const triggers = root.querySelectorAll('[data-preview-index]');
    const images = root.querySelectorAll('[data-preview-image]');
    if (!triggers.length || !images.length) return;
    root.dataset.hoverPreviewReady = 'true';

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
    if (stack.dataset.tiltStackReady === 'true') return;
    stack.dataset.tiltStackReady = 'true';
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
  const heroes = document.querySelectorAll('[data-scroll-hero]:not([data-scroll-hero-ready])');
  if (!heroes.length) return;

  const heroStates = Array.from(heroes).map((hero) => {
    hero.dataset.scrollHeroReady = 'true';
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

  registerScrollEffect({ update, refresh, elements: heroStates.map((state) => state.hero) });
};

const initImageSpread = () => {
  const spreads = document.querySelectorAll('[data-image-spread]:not([data-image-spread-ready])');
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

  const spreadStates = Array.from(spreads).map((section) => {
    section.dataset.imageSpreadReady = 'true';
    return {
      section,
      items: Array.from(section.querySelectorAll('[data-flow-item]')).map((item, index) => ({
        item,
        index,
        position: positions[index % positions.length],
        isCover: item.classList.contains('is-cover')
      })),
      scrollable: 1
    };
  }).filter((state) => state.items.length);

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

  registerScrollEffect({ update, refresh, elements: spreadStates.map((state) => state.section) });
};

const initAlexandraLoader = () => {
  const loaders = document.querySelectorAll('[data-alexandra-loader]:not([data-alexandra-loader-ready])');
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
    section.dataset.alexandraLoaderReady = 'true';
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
      state.targetHeroWidth = Math.min(
        width * (isMobile ? 0.8 : 0.25),
        galleryWidth * 0.86,
        Math.max(baseWidth, height * 0.58)
      );
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

  registerScrollEffect({ update, refresh, elements: loaderStates.map((state) => state.section) });
};

const initFeaturedProductStacks = () => {
  const stacks = document.querySelectorAll('[data-featured-product-stack]:not([data-featured-product-stack-ready])');
  if (!stacks.length) return;
  stacks.forEach((stack) => { stack.dataset.featuredProductStackReady = 'true'; });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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

  registerScrollEffect({ update, refresh, elements: stackStates.map((state) => state.section) });
};

const initCollectionDirectories = () => {
  const roots = document.querySelectorAll('[data-collection-directory]:not([data-collection-directory-ready])');
  if (!roots.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const states = Array.from(roots).map((root) => {
    root.dataset.collectionDirectoryReady = 'true';
    const rows = Array.from(root.querySelectorAll('[data-directory-row]')).map((row) => ({
      row,
      media: row.querySelector('[data-directory-media]'),
      title: row.querySelector('[data-directory-title]')?.textContent || '',
      number: row.querySelector('[data-directory-number]')?.textContent || ''
    }));
    const state = {
      root,
      rows,
      frames: root.querySelector('[data-directory-frames]'),
      captionTitle: root.querySelector('[data-directory-caption-title]'),
      captionNumber: root.querySelector('[data-directory-caption-number]'),
      previews: new Map(),
      activeIndex: -1,
      hoverIndex: -1,
      desktop: false,
      top: 130
    };

    state.activate = (index) => {
      if (state.activeIndex === index && (!state.desktop || state.previews.has(index))) return;
      state.activeIndex = index;
      rows.forEach(({ row }, rowIndex) => toggleClass(row, 'is-active', rowIndex === index));
      const current = rows[index];
      if (state.desktop && current.media && !state.previews.has(index)) {
        const preview = current.media.cloneNode(true);
        preview.className = 'collection-directory__preview-image';
        preview.removeAttribute('data-directory-media');
        const image = preview.querySelector('img');
        if (image) image.loading = 'eager';
        state.frames.append(preview);
        state.previews.set(index, preview);
      }
      state.previews.forEach((preview, previewIndex) => toggleClass(preview, 'is-active', previewIndex === index));
      if (state.captionTitle) state.captionTitle.textContent = current.title;
      if (state.captionNumber) state.captionNumber.textContent = current.number;
      setCustomProperty(root, '--directory-progress', ((index + 1) / rows.length).toFixed(4));
    };

    rows.forEach(({ row }, index) => {
      row.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'mouse' || !state.desktop) return;
        state.hoverIndex = index;
        state.activate(index);
      });
      row.addEventListener('pointerleave', () => {
        state.hoverIndex = -1;
        requestScrollEffects();
      });
      row.addEventListener('focus', () => state.activate(index));
      row.addEventListener('blur', requestScrollEffects);
    });
    return state;
  }).filter((state) => state.rows.length);
  if (!states.length) return;

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
      state.desktop = width >= 990 && height >= 480 && !motion.matches
        && state.root.dataset.motionEnabled !== 'false' && Boolean(state.frames);
      toggleClass(state.root, 'is-directory-enhanced', state.desktop);
      setCustomProperty(state.root, '--directory-top', `${state.top}px`);
      setCustomProperty(state.root, '--directory-height', `${Math.max(220, Math.min(680, height - state.top - 24))}px`);
      if (!state.desktop) {
        setCustomProperty(state.root, '--directory-title-y', '0px');
        setCustomProperty(state.root, '--directory-image-y', '0px');
        setCustomProperty(state.root, '--directory-image-scale', '1');
      }
    });
  };

  const update = ({ height }) => {
    states.forEach((state) => {
      if (!state.root.isConnected || !state.desktop) return;
      const rect = state.root.getBoundingClientRect();
      if (!isNearViewport(rect, height, 0.35)) return;
      const target = state.top + (height - state.top) * 0.45;
      let closest = 0;
      let nearest = Infinity;
      const rowRects = state.rows.map(({ row }, index) => {
        const rowRect = row.getBoundingClientRect();
        const distance = Math.abs(rowRect.top + rowRect.height / 2 - target);
        if (distance < nearest) {
          nearest = distance;
          closest = index;
        }
        return rowRect;
      });
      const focusedIndex = state.rows.findIndex(({ row }) => row === document.activeElement);
      const activeIndex = focusedIndex >= 0 ? focusedIndex : state.hoverIndex >= 0 ? state.hoverIndex : closest;
      state.activate(activeIndex);
      const activeRect = rowRects[activeIndex];
      const progress = clamp((height - activeRect.top) / (height + activeRect.height), 0, 1);
      const introProgress = clamp(-rect.top / height, 0, 1);
      setCustomProperty(state.root, '--directory-title-y', `${(-introProgress * 18).toFixed(2)}px`);
      setCustomProperty(state.root, '--directory-image-y', `${lerp(-12, 12, progress).toFixed(2)}px`);
      setCustomProperty(state.root, '--directory-image-scale', lerp(1.1, 1.06, progress).toFixed(4));
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
    return { root, content, outline, progress, nodes, desktop: null, active: -1, top: 130 };
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
      setCustomProperty(state.root, '--reader-top', `${state.top}px`);
      setCustomProperty(state.root, '--reader-rail-height', `${Math.max(120, height - state.top - 24)}px`);
    });
  };

  const update = ({ height }) => {
    states.forEach((state) => {
      if (!state.root.isConnected || !state.content) return;
      const rect = state.content.getBoundingClientRect();
      const distance = Math.max(1, rect.height - height + state.top + 24);
      const progress = rect.height > 0 ? clamp((state.top - rect.top) / distance, 0, 1) : 0;
      setCustomProperty(state.root, '--reading-progress', progress.toFixed(4));
      if (!state.nodes.length) return;
      if (rect.top > height * 1.35) return;
      let active = 0;
      state.nodes.forEach(({ heading }, index) => {
        if (heading.getBoundingClientRect().top <= state.top + 32) active = index;
      });
      if (active === state.active) return;
      state.active = active;
      state.nodes.forEach(({ link }, index) => {
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  };

  const observer = new ResizeObserver(requestResizeEffects);
  states.forEach((state) => {
    if (state.content) observer.observe(state.content);
  });
  registerScrollEffect({
    refresh,
    update,
    elements: states.map((state) => state.root),
    destroy: () => observer.disconnect()
  });
};

export const initializeMotionEffects = () => {
  initHoverPreviews();
  initTiltStacks();
  initScrollHero();
  initImageSpread();
  initAlexandraLoader();
  initFeaturedProductStacks();
  initCollectionDirectories();
  initCollectionEdits();
  initEditorialPages();
  initArticleReaders();

  if (!lifecycleReady) {
    lifecycleReady = true;
    document.addEventListener('shopify:section:unload', () => {
      window.requestAnimationFrame(() => {
        pruneScrollEffects();
        requestResizeEffects();
      });
    });
  }
};
