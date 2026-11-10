/**
 * Kostaryka — Kontakt Form Module
 * Handles: initialization, validation, submit to admin-ajax (kdc_contact_form), Turnstile, message display
 * Mirrors the pattern in contactForm.js for the /kontakt/ page form.
 */

import { debugLog } from './utils.js';
import {
  msg,
  postForm,
  setFieldError,
  setupTurnstile,
  ensureTurnstile,
  hasTurnstile,
  getTurnstileToken,
  resetTurnstile,
} from './formApi.js';

const PREFIX = 'kontakt-form';

/**
 * Validate a single form field
 * @param {HTMLElement} field - input/textarea/checkbox
 * @returns {boolean}
 */
function validateField(field) {
  const wrapper = field.closest('.kontakt-form__field');
  if (!wrapper) return true;

  let valid = true;
  let errorMsg = '';

  if (field.tagName === 'INPUT' && field.type === 'checkbox') {
    valid = field.checked;
    errorMsg = 'To pole jest wymagane';
  } else if (field.type === 'email') {
    if (!field.value.trim()) {
      valid = false;
      errorMsg = 'To pole jest wymagane';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) {
      valid = false;
      errorMsg = 'Podaj poprawny adres e-mail';
    }
  } else {
    if (!field.value.trim()) {
      valid = false;
      errorMsg = 'To pole jest wymagane';
    }
  }

  if (!valid) {
    wrapper.classList.add('kontakt-form__field--error');
    let errorEl = wrapper.querySelector('.kontakt-form__field-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'kontakt-form__field-error';
      errorEl.setAttribute('role', 'alert');
      wrapper.appendChild(errorEl);
    }
    errorEl.textContent = errorMsg;
  } else {
    wrapper.classList.remove('kontakt-form__field--error');
    const errorEl = wrapper.querySelector('.kontakt-form__field-error');
    if (errorEl) errorEl.remove();
  }

  return valid;
}

/**
 * Display success or error message in the messages container
 * @param {HTMLElement} container
 * @param {'success'|'error'} type
 * @param {string} text
 */
function showMessage(container, type, text) {
  container.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = `kontakt-form__message kontakt-form__message--${type}`;
  msg.setAttribute('role', type === 'error' ? 'alert' : 'status');
  msg.textContent = text;
  container.appendChild(msg);
}

/**
 * Initialize a single kontakt form instance
 * @param {HTMLElement} wrapper - .kontakt-form element
 */
function initFormInstance(wrapper) {
  const form = wrapper.querySelector('.kontakt-form__form');
  const messagesContainer = wrapper.querySelector('.kontakt-form__messages');
  const submitBtn = wrapper.querySelector('.kontakt-form__submit');

  if (!form || !messagesContainer || !submitBtn) {
    debugLog('Kontakt form: required elements not found', wrapper);
    return;
  }

  const requiredFields = form.querySelectorAll('[required]');

  // Real-time validation on blur/change
  requiredFields.forEach((field) => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('change', () => validateField(field));
  });

  let sending = false;

  // Cloudflare Turnstile (only when keys are configured on the options page)
  setupTurnstile(form);

  // Form submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;

    // Clear previous messages
    messagesContainer.innerHTML = '';

    // Validate all fields
    let allValid = true;
    requiredFields.forEach((field) => {
      if (!validateField(field)) allValid = false;
    });

    if (!allValid) {
      showMessage(messagesContainer, 'error', msg('fixFields', 'Wypełnij poprawnie wszystkie wymagane pola.'));
      const firstError = form.querySelector('.kontakt-form__field--error [required]');
      if (firstError) firstError.focus();
      return;
    }

    // Turnstile token must be ready (the widget solves itself in the background)
    if (hasTurnstile(form) && !getTurnstileToken(form)) {
      ensureTurnstile(form);
      showMessage(messagesContainer, 'error', msg('captchaWait', 'Poczekaj chwilę na zakończenie weryfikacji i wyślij ponownie.'));
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('kontakt-form__submit--disabled');

    const result = await postForm('kdc_contact_form', form);

    if (result.ok) {
      showMessage(messagesContainer, 'success', result.message || msg('success', 'Dziękujemy! Wiadomość została wysłana.'));
      form.reset();

      form.querySelectorAll('.kontakt-form__field--error').forEach((el) => {
        el.classList.remove('kontakt-form__field--error');
      });
      form.querySelectorAll('.kontakt-form__field-error').forEach((el) => {
        el.remove();
      });
      resetTurnstile(form);
      debugLog('Kontakt form sent');
    } else {
      const text = result.network
        ? msg('network', 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.')
        : result.message || msg('error', 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.');
      showMessage(messagesContainer, 'error', text);

      Object.keys(result.fields || {}).forEach((name) => {
        const field = form.querySelector(`[name="${name}"]`);
        if (field) setFieldError(field, PREFIX, result.fields[name]);
      });
      if (result.code === 'captcha') resetTurnstile(form);
    }

    sending = false;
    submitBtn.disabled = false;
    submitBtn.classList.remove('kontakt-form__submit--disabled');
  });

  debugLog('Kontakt form initialized');
}

/**
 * Initialize all kontakt forms on the page
 */
export function initKontaktForm() {
  const forms = document.querySelectorAll('.kontakt-form');

  if (!forms.length) {
    debugLog('Kontakt form: no forms found on page');
    return;
  }

  forms.forEach((wrapper) => initFormInstance(wrapper));
  debugLog(`Kontakt form: initialized ${forms.length} form(s)`);
}
