/**
 * Kostaryka Trip Map - Locations List Functions
 */

import { escapeHtml } from './utils.js';
import { getMarkers, getMap } from './map.js';

// SVG иконка для локаций
const locationIcon = `<svg class="location-item__icon" width="16" height="19" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.625 7.625C9.625 7.09457 9.41413 6.58601 9.03906 6.21094C8.66399 5.83587 8.15543 5.625 7.625 5.625C7.09457 5.625 6.58601 5.83586 6.21094 6.21094C5.83586 6.58601 5.625 7.09457 5.625 7.625C5.625 8.15543 5.83587 8.66399 6.21094 9.03906C6.58601 9.41413 7.09457 9.625 7.625 9.625C8.15543 9.625 8.66399 9.41413 9.03906 9.03906C9.41413 8.66399 9.625 8.15543 9.625 7.625ZM11.125 7.625C11.125 8.55326 10.756 9.44323 10.0996 10.0996C9.44323 10.756 8.55326 11.125 7.625 11.125C6.69674 11.125 5.80677 10.756 5.15039 10.0996C4.49401 9.44323 4.125 8.55326 4.125 7.625C4.125 6.69674 4.49401 5.80677 5.15039 5.15039C5.80677 4.49401 6.69674 4.125 7.625 4.125C8.55326 4.125 9.44323 4.49401 10.0996 5.15039C10.756 5.80677 11.125 6.69674 11.125 7.625Z" fill="black"/><path d="M7.98535 18.5957C7.76096 18.7186 7.48904 18.7186 7.26465 18.5957L7.625 17.9375L7.98535 18.5957ZM13.75 7.625C13.75 6.00055 13.1047 4.44261 11.9561 3.29395C10.8792 2.21708 9.44258 1.58292 7.92871 1.50781L7.625 1.5C6.00055 1.5 4.44261 2.14529 3.29395 3.29395C2.14529 4.44261 1.5 6.00055 1.5 7.625C1.5 10.6231 3.07415 13.0229 4.72363 14.7119C5.54358 15.5514 6.36625 16.1978 6.9834 16.6338C7.23794 16.8136 7.45741 16.956 7.625 17.0615C7.79259 16.956 8.01206 16.8136 8.2666 16.6338C8.88375 16.1978 9.70642 15.5514 10.5264 14.7119C12.1759 13.0229 13.75 10.6231 13.75 7.625ZM15.25 7.625C15.25 11.1735 13.3865 13.9302 11.5986 15.7607C10.7001 16.6807 9.80362 17.3848 9.13184 17.8594C8.79531 18.0971 8.51333 18.2783 8.31348 18.4014C8.21352 18.4629 8.13394 18.5106 8.07812 18.543C8.05034 18.5591 8.02827 18.5713 8.0127 18.5801C8.0049 18.5845 7.99872 18.5883 7.99414 18.5908L7.98633 18.5947C7.98633 18.5947 7.98529 18.5953 7.625 17.9375L7.26367 18.5947L7.25586 18.5908C7.25128 18.5883 7.2451 18.5845 7.2373 18.5801C7.22173 18.5713 7.19966 18.5591 7.17188 18.543C7.11606 18.5106 7.03648 18.4629 6.93652 18.4014C6.73667 18.2783 6.45469 18.0971 6.11816 17.8594C5.44638 17.3848 4.5499 16.6807 3.65137 15.7607C1.86349 13.9302 0 11.1735 0 7.625C0 5.60272 0.803434 3.66336 2.2334 2.2334C3.66336 0.803434 5.60272 0 7.625 0L8.00293 0.00976562C9.8876 0.103226 11.676 0.89277 13.0166 2.2334C14.4466 3.66336 15.25 5.60272 15.25 7.625Z" fill="black"/></svg>`;

/**
 * Создать HTML для одной локации
 * @param {Object} loc - объект локации
 * @param {number} index - индекс локации
 * @returns {string} - HTML элемента локации
 */
function createLocationItemHTML(loc, index) {
  let html = `<div class="location-item" data-index="${index}">`;

  if (loc.image) {
    html += `<img class="location-item__image" src="${loc.image}" alt="${escapeHtml(loc.name)}">`;
  }

  html += '<div class="location-item__content">';
  html += `<h3 class="location-item__title">${locationIcon}${escapeHtml(loc.name)}</h3>`;
  html += '</div></div>';

  return html;
}

/**
 * Отрендерить список локаций
 * @param {Array} locations - массив локаций
 */
export function renderLocationsList(locations) {
  let html = '<div class="locations-wrapper">';

  if (locations.length === 0) {
    html += '<p style="text-align:center; padding:20px;">Brak lokacji do wyświetlenia.</p>';
  } else {
    html += '<h2 class="locations-wrapper__title">Co zobaczymy</h2>';
    html += '<div class="locations-wrapper__list">';

    locations.forEach((loc, index) => {
      html += createLocationItemHTML(loc, index);
    });

    html += '</div>';
  }

  html += '</div>';

  const locationsList = document.getElementById('locations-list');
  if (locationsList) {
    locationsList.innerHTML = html;
  }

  // Настроить обработчик кликов
  setupLocationClickHandlers(locationsList);
}

/**
 * Настроить обработчики кликов для списка локаций
 * @param {HTMLElement} locationsList - контейнер списка
 */
function setupLocationClickHandlers(locationsList) {
  if (!locationsList) return;

  locationsList.addEventListener('click', (e) => {
    const locationItem = e.target.closest('.location-item');
    if (!locationItem) return;

    const index = parseInt(locationItem.dataset.index, 10);

    // Убрать active со всех элементов
    const allItems = locationsList.querySelectorAll('.location-item');
    allItems.forEach((item) => {
      item.classList.remove('active');
    });

    // Добавить к кликнутому
    locationItem.classList.add('active');

    // Фокус на маркере
    const markers = getMarkers();
    const map = getMap();

    if (markers[index] && map) {
      markers[index].openPopup();
      map.setView(markers[index].getLatLng(), 10);
    }
  });
}
