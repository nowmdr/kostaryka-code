/**
 * Kostaryka Trip Map - Contact Form Module
 * Handles: initialization, validation, submit with console logging, message display
 */

import { debugLog } from './utils.js';

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
 * Collect form data from a form element
 * @param {HTMLFormElement} form
 * @param {string} postTitle
 * @returns {Object}
 */
function collectFormData(form, postTitle) {
  const dateSelect = form.querySelector('.trip-contact-form__select');
  const selectedOption = dateSelect
    ? dateSelect.options[dateSelect.selectedIndex]
    : null;

  return {
    postTitle,
    selectedDate: dateSelect
      ? {
          value: dateSelect.value,
          display: selectedOption ? selectedOption.textContent.trim() : '',
        }
      : null,
    name: (form.querySelector('.trip-contact-form__input[type="text"]') || {}).value?.trim() || '',
    email: (form.querySelector('.trip-contact-form__input[type="email"]') || {}).value?.trim() || '',
    message: (form.querySelector('.trip-contact-form__textarea') || {}).value?.trim() || '',
    consent: !!(form.querySelector('.trip-contact-form__checkbox') || {}).checked,
    timestamp: new Date().toISOString(),
  };
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

  // Form submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Clear previous messages
    messagesContainer.innerHTML = '';

    // Validate all fields
    let allValid = true;
    requiredFields.forEach((field) => {
      if (!validateField(field)) allValid = false;
    });

    if (!allValid) {
      showMessage(messagesContainer, 'error', 'Wypełnij poprawnie wszystkie wymagane pola.');
      // Focus first invalid field
      const firstError = form.querySelector('.trip-contact-form__field--error [required]');
      if (firstError) firstError.focus();
      return;
    }

    // Disable button during processing
    submitBtn.disabled = true;
    submitBtn.classList.add('trip-contact-form__submit--disabled');

    // Collect data
    const data = collectFormData(form, postTitle);

    // Console log structured data (current implementation)
    console.log('=== Trip Contact Form Submission ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('====================================');

    // TODO: Replace with AJAX call when backend integration is ready
    // Simulate async processing
    setTimeout(() => {
      showMessage(messagesContainer, 'success', 'Dziękujemy! Wiadomość została wysłana.');
      form.reset();

      // Remove all error states after reset
      form.querySelectorAll('.trip-contact-form__field--error').forEach((el) => {
        el.classList.remove('trip-contact-form__field--error');
      });
      form.querySelectorAll('.trip-contact-form__field-error').forEach((el) => {
        el.remove();
      });

      submitBtn.disabled = false;
      submitBtn.classList.remove('trip-contact-form__submit--disabled');

      debugLog('Contact form submitted:', data);
    }, 300);
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
