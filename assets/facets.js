let facetsDocumentListenerReady = false;

export const initializeFacets = () => {
  document.querySelectorAll('.facets').forEach((form) => {
    if (form.dataset.facetsReady === 'true') return;
    form.dataset.facetsReady = 'true';
    const groups = Array.from(form.querySelectorAll('.facets__group'));
    const sort = form.querySelector('[data-facets-sort]');

    groups.forEach((group) => {
      group.addEventListener('toggle', () => {
        if (!group.open) return;
        groups.forEach((otherGroup) => {
          if (otherGroup !== group) otherGroup.removeAttribute('open');
        });
      });
    });

    sort?.addEventListener('change', () => {
      if (form.requestSubmit) form.requestSubmit();
      else form.submit();
    });

    form.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      groups.forEach((group) => group.removeAttribute('open'));
    });
  });

  if (!facetsDocumentListenerReady) {
    facetsDocumentListenerReady = true;
    document.addEventListener('click', (event) => {
      document.querySelectorAll('.facets[data-facets-ready="true"]').forEach((form) => {
        if (form.contains(event.target)) return;
        form.querySelectorAll('.facets__group').forEach((group) => group.removeAttribute('open'));
      });
    });
  }
};

initializeFacets();

