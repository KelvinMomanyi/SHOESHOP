let documentListenersReady = false;

export const initializeHeaderDrawers = () => {
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const getFocusableElements = (container) => {
    return Array.from(container?.querySelectorAll(focusableSelector) || []).filter((element) => {
      return element.getClientRects().length > 0;
    });
  };

  const syncDrawerState = () => {
    document.body.classList.toggle('drawer-open', Boolean(document.querySelector('[data-modal-drawer][open]')));
  };

  const focusDrawer = (details) => {
    const panel = details?.querySelector('[data-modal-panel]');
    if (!panel) return;
    const focusableElements = getFocusableElements(panel);
    (focusableElements[0] || panel).focus({ preventScroll: true });
  };

  const closeDetails = (details, restoreFocus = false) => {
    if (!details || !details.hasAttribute('open')) return;

    const returnFocusElement = details.returnFocusElement || details.querySelector('summary');
    details.returnFocusElement = null;
    details.removeAttribute('open');
    details.querySelectorAll('[data-predictive-search-results]').forEach((results) => {
      results.classList.remove('is-open');
    });
    details.querySelectorAll('input[aria-expanded]').forEach((input) => {
      input.setAttribute('aria-expanded', 'false');
    });

    syncDrawerState();
    if (restoreFocus) {
      window.requestAnimationFrame(() => returnFocusElement?.focus({ preventScroll: true }));
    }
  };

  const closeGroup = (selector, except = null) => {
    document.querySelectorAll(selector).forEach((details) => {
      if (details !== except) closeDetails(details);
    });
  };

  document.querySelectorAll('[data-search-drawer]').forEach((details) => {
    if (details.dataset.headerDrawerReady === 'true') return;
    details.dataset.headerDrawerReady = 'true';
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      closeGroup('[data-modal-drawer][open]');
      window.requestAnimationFrame(() => details.querySelector('[data-search-input]')?.focus());
    });
  });

  document.querySelectorAll('[data-modal-drawer]').forEach((details) => {
    if (details.dataset.headerDrawerReady === 'true') return;
    details.dataset.headerDrawerReady = 'true';
    details.addEventListener('toggle', () => {
      if (!details.open) {
        details.returnFocusElement = null;
        syncDrawerState();
        return;
      }

      details.returnFocusElement ||= document.activeElement;
      closeGroup('[data-search-drawer][open]');
      closeGroup('[data-modal-drawer][open]', details);
      syncDrawerState();
      window.requestAnimationFrame(() => focusDrawer(details));
    });
  });

  document.querySelectorAll('[data-cart-open]').forEach((button) => {
    if (button.dataset.cartOpenReady === 'true') return;
    button.dataset.cartOpenReady = 'true';
    button.addEventListener('click', () => {
      const cartDrawer = document.querySelector('[data-cart-drawer]');
      if (!cartDrawer) return;

      closeGroup('[data-search-drawer][open]');
      closeDetails(button.closest('[data-modal-drawer]'));
      cartDrawer.returnFocusElement = cartDrawer.querySelector('summary');
      cartDrawer.setAttribute('open', '');
    });
  });

  if (!documentListenersReady) {
    documentListenersReady = true;
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
      if (event.key === 'Escape') {
        document.querySelectorAll('[data-search-drawer][open], [data-modal-drawer][open]').forEach((details) => {
          closeDetails(details, true);
        });
        return;
      }

      if (event.key !== 'Tab') return;
      const openDrawer = document.querySelector('[data-modal-drawer][open]');
      const panel = openDrawer?.querySelector('[data-modal-panel]');
      if (!panel) return;

      const focusableElements = getFocusableElements(panel);
      if (!focusableElements.length) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const focusIsOutside = !panel.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === firstElement || focusIsOutside)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutside)) {
        event.preventDefault();
        firstElement.focus();
      }
    });
  }

  syncDrawerState();
  const openModal = document.querySelector('[data-modal-drawer][open]');
  const openSearch = document.querySelector('[data-search-drawer][open]');
  if (openModal) {
    window.requestAnimationFrame(() => focusDrawer(openModal));
  } else if (openSearch) {
    window.requestAnimationFrame(() => openSearch.querySelector('[data-search-input]')?.focus());
  }
};

