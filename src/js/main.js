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
  extractPostIdFromBody,
  getPostIdFromSlug,
  loadTripLocations
} from './ajax.js';
import { initMap } from './map.js';
import { renderLocationsList } from './locations-list.js';
import { debugLog } from './utils.js';
import { initGallery } from './gallery.js';

/**
 * Инициализация кнопок карты на homepage
 */
function initTripMapButtons() {
  // Event delegation для кнопок homepage
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.trip-preview-btn, .trip-preview-btn button');
    if (!button) return;
    handleButtonClick(e, button);
  });

  debugLog('Kostaryka Trip Map: Homepage buttons initialized');
}

/**
 * Инициализация кнопки карты на single странице oferta
 */
function initSinglePageButton() {
  // Проверка: только на single-oferta
  if (!document.body.classList.contains('single-oferta')) {
    debugLog('Kostaryka Trip Map: Not on single-oferta page, skipping single page button init');
    return;
  }

  debugLog('Kostaryka Trip Map: Initializing single page button...');

  // Найти кнопку
  const button = document.querySelector('.single-trip-gallery__preview-btn');

  if (!button) {
    debugLog('Kostaryka Trip Map: Single page preview button not found');
    return;
  }

  // Добавить обработчик клика
  button.addEventListener('click', handleSinglePageButtonClick);

  debugLog('Kostaryka Trip Map: Single page button initialized');
}

/**
 * Загрузить и отрендерить контент карты
 * Универсальная функция для homepage и single страниц
 * @param {number} tripId - ID поста
 */
async function loadAndRenderMapContent(tripId) {
  showGlobalLoader('Ładowanie mapy lokacji...');

  try {
    // Параллельно загрузить Leaflet и данные
    const [, locationsData] = await Promise.all([
      ensureLeafletLoaded(),
      loadTripLocations(tripId)
    ]);

    // Скрыть loader
    hideGlobalLoader();

    // Отрендерить контент
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
 * Обработка клика по кнопке на homepage
 * @param {Event} e - событие клика
 * @param {HTMLElement} clickedElement - кликнутый элемент
 */
async function handleButtonClick(e, clickedElement) {
  e.preventDefault();

  try {
    // Шаг 1: Извлечь slug из URL
    const postSlug = extractPostSlugFromButton(clickedElement);

    // Шаг 2: Получить ID поста через REST API
    const tripId = await getPostIdFromSlug(postSlug);

    // Шаг 3: Загрузить и отрендерить контент
    await loadAndRenderMapContent(tripId);
  } catch (error) {
    console.error('Błąd:', error);
    hideGlobalLoader();
    showError(error.message || 'Wystąpił błąd podczas ładowania danych');
  }
}

/**
 * Обработка клика по кнопке на single странице
 * @param {Event} e - событие клика
 */
async function handleSinglePageButtonClick(e) {
  e.preventDefault();

  try {
    // Шаг 1: Извлечь ID из body class
    const tripId = extractPostIdFromBody();

    if (!tripId) {
      throw new Error('Nie udało się pobrać ID wyprawy ze strony');
    }

    // Шаг 2: Загрузить и отрендерить контент
    await loadAndRenderMapContent(tripId);
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
  initTripMapButtons();      // Кнопки на homepage
  initSinglePageButton();    // Кнопка на single странице
  initGallery();             // Модуль галереи
});
