let lifecycleReady = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, progress) => start + (end - start) * progress;
const styleCache = new WeakMap();
let scrollEffects = [];
let scrollTicking = false;
let resizeTicking = false;
let cachedViewport;
let frameMutations = null;

const mutate = (callback) => {
  if (frameMutations) frameMutations.push(callback);
  else callback();
};

const getViewport = () => ({
  width: document.documentElement.getBoundingClientRect().width || window.innerWidth,
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
  mutate(() => { element.style[property] = value; });
  cache[property] = value;
};

const setCustomProperty = (element, property, value) => {
  let cache = styleCache.get(element);
  if (!cache) {
    cache = {};
    styleCache.set(element, cache);
  }

  if (cache[property] === value) return;
  mutate(() => element.style.setProperty(property, value));
  cache[property] = value;
};

const toggleClass = (element, className, force) => {
  if (element.classList.contains(className) === force) return;
  mutate(() => element.classList.toggle(className, force));
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
  const viewport = cachedViewport || getViewport();
  frameMutations = [];
  try {
    scrollEffects.forEach((effect) => effect.update(viewport));
  } finally {
    const mutations = frameMutations;
    frameMutations = null;
    mutations.forEach((mutation) => mutation());
    scrollTicking = false;
  }
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
    cachedViewport = viewport;
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

  requestResizeEffects();
};

export const initializeMotionLifecycle = () => {
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

export { clamp, lerp, mutate, isNearViewport, setStyleValue, setCustomProperty, toggleClass, registerScrollEffect, requestScrollEffects, requestResizeEffects };
