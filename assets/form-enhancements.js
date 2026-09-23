const initializeAddressToggles = (scope) => {
  scope.querySelectorAll('[data-address-toggle]').forEach((button) => {
    if (button.dataset.addressToggleReady === 'true') return;
    button.dataset.addressToggleReady = 'true';
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.addressToggle);
      if (target) target.hidden = !target.hidden;
    });
  });

  scope.querySelectorAll('[data-confirm-message]').forEach((form) => {
    if (form.dataset.confirmMessageReady === 'true') return;
    form.dataset.confirmMessageReady = 'true';
    form.addEventListener('submit', (event) => {
      if (!window.confirm(form.dataset.confirmMessage)) event.preventDefault();
    });
  });
};

const initializeRecipientForms = (scope) => {
  scope.querySelectorAll('[data-recipient-form]').forEach((root) => {
    if (root.dataset.recipientFormReady === 'true') return;

    const toggle = root.querySelector('[data-recipient-toggle]');
    const fields = root.querySelector('[data-recipient-fields]');
    const inputs = Array.from(root.querySelectorAll('[data-recipient-input]'));
    const email = root.querySelector('[data-recipient-email]');
    if (!toggle || !fields || !email) return;

    root.dataset.recipientFormReady = 'true';

    const update = () => {
      const enabled = toggle.checked;
      fields.hidden = !enabled;
      toggle.setAttribute('aria-expanded', String(enabled));
      inputs.forEach((input) => { input.disabled = !enabled; });
      email.required = enabled;
    };

    toggle.addEventListener('change', update);
    root.closest('form')?.addEventListener('submit', (event) => {
      if (!toggle.checked || email.checkValidity()) return;
      event.preventDefault();
      email.reportValidity();
    });
    update();
  });
};

export const initializeFormEnhancements = (scope = document) => {
  initializeAddressToggles(scope);
  initializeRecipientForms(scope);
};

