import { clamp, lerp, mutate, isNearViewport, setCustomProperty, toggleClass, registerScrollEffect, requestScrollEffects, requestResizeEffects, initializeMotionLifecycle } from './motion-runtime.js';

export const initializeCollectionDirectories = () => {
  const desktopViewport = window.matchMedia('(min-width: 990px) and (min-height: 480px) and (prefers-reduced-motion: no-preference)');
  if (!desktopViewport.matches) return;
  const roots = document.querySelectorAll('[data-collection-directory]:not([data-collection-directory-ready])');
  if (!roots.length) return;

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
    const initialPreview = root.querySelector('[data-directory-initial-preview]');
    const initialProgress = root.querySelector('.collection-directory__progress');
    if (initialPreview) state.previews.set(0, initialPreview);

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
        if (image) {
          image.sizes = initialPreview?.querySelector('img')?.sizes || image.sizes;
          image.fetchPriority = 'auto';
          image.loading = 'eager';
        }
        mutate(() => state.frames.append(preview));
        state.previews.set(index, preview);
      }
      state.previews.forEach((preview, previewIndex) => toggleClass(preview, 'is-active', previewIndex === index));
      if (state.captionTitle) mutate(() => { state.captionTitle.textContent = current.title; });
      if (state.captionNumber) mutate(() => { state.captionNumber.textContent = current.number; });
      setCustomProperty(root, '--directory-progress', ((index + 1) / rows.length).toFixed(4));
      if (initialProgress?.style.getPropertyValue('--directory-progress')) {
        mutate(() => initialProgress.style.removeProperty('--directory-progress'));
      }
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

  const refresh = ({ height }) => {
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
      state.desktop = desktopViewport.matches
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

  initializeMotionLifecycle();
  desktopViewport.addEventListener('change', requestResizeEffects);
  registerScrollEffect({
    refresh,
    update,
    elements: states.map((state) => state.root),
    destroy: () => desktopViewport.removeEventListener('change', requestResizeEffects)
  });
};
