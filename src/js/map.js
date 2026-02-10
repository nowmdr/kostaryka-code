/**
 * Kostaryka Trip Map - Map Functions
 */

import { L } from './leaflet-loader.js';
import { escapeHtml } from './utils.js';
import { showError } from './loader.js';

let map = null;
let markers = [];
let markersLayer = null;

/**
 * Создать HTML для popup на карте
 * @param {Object} loc - объект локации
 * @returns {string} - HTML содержимое popup
 */
function createPopupContent(loc) {
  let html = '<div class="map-popup">';

  if (loc.image) {
    html += `<img src="${loc.image}" alt="${escapeHtml(loc.name)}" style="border-radius: 8px; margin-bottom: 0.5rem;">`;
  }

  html += `<h4 style="margin: 0; font-size: 1rem;">${escapeHtml(loc.name)}</h4>`;
  html += '</div>';

  return html;
}

/**
 * Инициализировать карту Leaflet
 * @param {Array} locations - массив локаций
 */
export function initMap(locations) {
  // Проверка что Leaflet загружен
  if (typeof L === 'undefined') {
    console.error('Leaflet is not loaded');
    showError('Biblioteka map nie załadowała się. Odśwież stronę.');
    return;
  }

  // Удалить предыдущую карту
  if (map !== null) {
    map.remove();
    map = null;
  }
  markers = [];

  // Очистить контейнер
  const mapContainer = document.getElementById('map-container');
  if (mapContainer) {
    mapContainer.innerHTML = '';
  }

  // Фильтровать локации с координатами
  const locationsWithCoords = locations.filter((loc) => loc.has_coordinates);

  if (locationsWithCoords.length === 0) {
    if (mapContainer) {
      mapContainer.innerHTML =
        '<p style="text-align:center; padding:40px; color:#666;">Brak lokacji z podanymi współrzędnymi.</p>';
    }
    return;
  }

  // Создать карту
  try {
    map = L.map('map-container', {
      scrollWheelZoom: true,
      zoomControl: true
    });

    // Добавить OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 2
    }).addTo(map);

    // Создать layer group для маркеров
    markersLayer = L.layerGroup().addTo(map);

    // Добавить маркеры
    locationsWithCoords.forEach((loc, index) => {
      const marker = L.marker([loc.latitude, loc.longitude]).bindPopup(
        createPopupContent(loc)
      );

      marker.addTo(markersLayer);
      markers.push(marker);
    });

    // Центрировать на первой локации
    if (locationsWithCoords.length > 0) {
      const firstLoc = locationsWithCoords[0];
      map.setView([firstLoc.latitude, firstLoc.longitude], 8);
    }

    // Fix для display issues
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  } catch (error) {
    console.error('Error initializing map:', error);
    showError('Błąd inicjalizacji mapy: ' + error.message);
  }
}

/**
 * Сбросить карту
 */
export function resetMap() {
  if (map) {
    map.remove();
    map = null;
  }
  markers = [];
}

/**
 * Получить массив маркеров (для использования в locations-list)
 * @returns {Array} - массив маркеров
 */
export function getMarkers() {
  return markers;
}

/**
 * Получить объект карты (для использования в locations-list)
 * @returns {Object|null} - объект карты Leaflet
 */
export function getMap() {
  return map;
}
