/**
 * Kostaryka Trip Map - Loader Functions
 */

import { escapeHtml } from './utils.js';

/**
 * Показать глобальный loader
 * @param {string} message - сообщение для отображения
 */
export function showGlobalLoader(message = 'Ładowanie...') {
  let loader = document.getElementById('trip-map-global-loader');

  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'trip-map-global-loader';
    loader.className = 'trip-map-loader';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="loader-spinner"></div>
        <p class="loader-message">${escapeHtml(message)}</p>
      </div>
    `;
    document.body.appendChild(loader);
  } else {
    const messageEl = loader.querySelector('.loader-message');
    if (messageEl) messageEl.textContent = message;
    loader.style.display = 'flex';
  }
}

/**
 * Скрыть глобальный loader
 */
export function hideGlobalLoader() {
  const loader = document.getElementById('trip-map-global-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Показать ошибку в контейнерах
 * @param {string} message - текст ошибки
 */
export function showError(message) {
  hideGlobalLoader();

  const errorHtml = `<div class="trip-map-error" style="text-align:center; padding:40px; color:#d63638;"><p>${escapeHtml(message)}</p></div>`;

  const locationsList = document.getElementById('locations-list');
  const mapContainer = document.getElementById('map-container');

  if (locationsList) locationsList.innerHTML = errorHtml;
  if (mapContainer) mapContainer.innerHTML = errorHtml;
}
