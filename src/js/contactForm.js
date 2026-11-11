/**
 * Kostaryka Trip Map - Contact Form Module
 * Handles: initialization, validation, submit to admin-ajax (kdc_trip_form), Turnstile, message display
 */

import { debugLog } from './utils.js';
import {
  msg,
  postForm,
  setFieldError,
  hasTurnstile,
  requestTurnstileToken,
  resetTurnstile,
} from './formApi.js';

const PREFIX = 'trip-contact-form';

/**
 * Validate a single form field
 * @param {HTMLElement} field - input/select/textarea/checkbox
 * @returns {boolean}
 */
function validateField(field) {
  const wrapper = field.closest('.trip-contact-form__field');
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
    wrapper.classList.add('trip-contact-form__field--error');
    let errorEl = wrapper.querySelector('.trip-contact-form__field-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'trip-contact-form__field-error';
      errorEl.setAttribute('role', 'alert');
      wrapper.appendChild(errorEl);
    }
    errorEl.textContent = errorMsg;
  } else {
    wrapper.classList.remove('trip-contact-form__field--error');
    const errorEl = wrapper.querySelector('.trip-contact-form__field-error');
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
  msg.className = `trip-contact-form__message trip-contact-form__message--${type}`;
  msg.setAttribute('role', type === 'error' ? 'alert' : 'status');
  msg.textContent = text;
  container.appendChild(msg);
}

/**
 * Initialize a single contact form instance
 * @param {HTMLElement} wrapper - .trip-contact-form element
 */
function initFormInstance(wrapper) {
  const form = wrapper.querySelector('.trip-contact-form__form');
  const messagesContainer = wrapper.querySelector('.trip-contact-form__messages');
  const submitBtn = wrapper.querySelector('.trip-contact-form__submit');
  const postTitle = wrapper.dataset.postTitle || document.title;

  if (!form || !messagesContainer || !submitBtn) {
    debugLog('Contact form: required elements not found', wrapper);
    return;
  }

  const requiredFields = form.querySelectorAll('[required]');

  // Real-time validation on blur/change
  requiredFields.forEach((field) => {
    field.addEventListener('blur', () => validateField(field));
    field.addEventListener('change', () => validateField(field));
  });

  let sending = false;

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
      // Focus first invalid field
      const firstError = form.querySelector('.trip-contact-form__field--error [required]');
      if (firstError) firstError.focus();
      return;
    }

    sending = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('trip-contact-form__submit--disabled');

    // Cloudflare Turnstile (only when both keys are set on the options page): the challenge
    // starts now and is invisible unless Cloudflare needs the visitor to confirm something.
    if (hasTurnstile(form)) {
      const token = await requestTurnstileToken(form, () =>
        showMessage(messagesContainer, 'error', msg('captchaConfirm', 'Potwierdź, że nie jesteś robotem, aby wysłać wiadomość.'))
      );
      if (!token) {
        showMessage(messagesContainer, 'error', msg('captchaFailed', 'Nie udało się zweryfikować zabezpieczenia. Odśwież stronę i spróbuj ponownie.'));
        resetTurnstile(form);
        sending = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('trip-contact-form__submit--disabled');
        return;
      }
      messagesContainer.innerHTML = '';
    }

    const result = await postForm('kdc_trip_form', form);

    if (result.ok) {
      showMessage(messagesContainer, 'success', result.message || msg('success', 'Dziękujemy! Wiadomość została wysłana.'));
      form.reset();

      // Remove all error states after reset
      form.querySelectorAll('.trip-contact-form__field--error').forEach((el) => {
        el.classList.remove('trip-contact-form__field--error');
      });
      form.querySelectorAll('.trip-contact-form__field-error').forEach((el) => {
        el.remove();
      });
      resetTurnstile(form);
      debugLog('Contact form sent for post:', postTitle);
    } else {
      const text = result.network
        ? msg('network', 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.')
        : result.message || msg('error', 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.');
      showMessage(messagesContainer, 'error', text);

      Object.keys(result.fields || {}).forEach((name) => {
        const field = form.querySelector(`[name="${name}"]`);
        if (field) setFieldError(field, PREFIX, result.fields[name]);
      });
      // The token is single-use: after a captcha or server error ask for a new one
      // (a plain field validation error leaves the token valid)
      if (result.code === 'captcha' || !Object.keys(result.fields || {}).length) resetTurnstile(form);
    }

    sending = false;
    submitBtn.disabled = false;
    submitBtn.classList.remove('trip-contact-form__submit--disabled');
  });

  debugLog('Contact form initialized for post:', postTitle);
}

/**
 * Initialize all contact forms on the page
 */
export function initContactForm() {
  const forms = document.querySelectorAll('.trip-contact-form');

  if (!forms.length) {
    debugLog('Contact form: no forms found on page');
    return;
  }

  forms.forEach((wrapper) => initFormInstance(wrapper));
  debugLog(`Contact form: initialized ${forms.length} form(s)`);
}
