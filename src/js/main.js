/**
 * Kostaryka Trip Map - Main Entry Point
 * Version: 2.0.0 (Vite + Modular)
 */

// Импорт стилей
import '../css/loader.css';

// Импорт модулей
import { showGlobalLoader, hideGlobalLoader, showError } from './loader.js';
import { ensureLeafletLoaded } from './leaflet-loader.js';
import {
  extractPostSlugFromButton,
  getPostIdFromSlug,
  loadTripLocations
} from './ajax.js';
import { initMap } from './map.js';
import { renderLocationsList } from './locations-list.js';
import { debugLog } from './utils.js';

/**
 * Инициализация кнопок карты
 */
function initTripMapButtons() {
  // Event delegation для кнопок
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.trip-preview-btn, .trip-preview-btn button');
    if (!button) return;
    handleButtonClick(e, button);
  });

  debugLog('Kostaryka Trip Map initialized (Vite + ES Modules)');
}

/**
 * Обработка клика по кнопке
 * @param {Event} e - событие клика
 * @param {HTMLElement} clickedElement - кликнутый элемент
 */
async function handleButtonClick(e, clickedElement) {
  e.preventDefault();

  showGlobalLoader('Ładowanie mapy lokacji...');

  try {
    // Шаг 1: Извлечь slug из URL
    const postSlug = extractPostSlugFromButton(clickedElement);

    // Шаг 2: Получить ID поста через REST API
    const tripId = await getPostIdFromSlug(postSlug);

    // Шаг 3: Параллельно загрузить Leaflet и данные
    const [, locationsData] = await Promise.all([
      ensureLeafletLoaded(),
      loadTripLocations(tripId)
    ]);

    // Шаг 4: Скрыть loader
    hideGlobalLoader();

    // Шаг 5: Отрендерить контент
    if (locationsData && locationsData.length > 0) {
      renderLocationsList(locationsData);
      initMap(locationsData);
    } else {
      showError('Brak lokacji dla tej wyprawy');
    }
  } catch (error) {
    console.error('Błąd:', error);
    hideGlobalLoader();
    showError(error.message || 'Wystąpił błąd podczas ładowania danych');
  }
}

/**
 * Debug info
 */
if (window.location.search.indexOf('debug_trip_map=1') !== -1) {
  debugLog('=== KOSTARYKA TRIP MAP DEBUG ===');
  debugLog('tripMapData:', typeof tripMapData !== 'undefined' ? tripMapData : 'NOT LOADED');
  debugLog('Mode: Vite + ES Modules + Lazy Loading');
  debugLog('================================');
}

/**
 * Инициализация при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  initTripMapButtons();
});
