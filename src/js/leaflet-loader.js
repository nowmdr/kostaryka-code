/**
 * Kostaryka Trip Map - Leaflet Loader
 * Использует NPM пакет leaflet вместо динамической загрузки с CDN
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { debugLog } from './utils.js';

let leafletLoaded = false;

/**
 * Убедиться что Leaflet загружен
 * Теперь это просто проверка что модуль импортирован
 * @returns {Promise<void>}
 */
export async function ensureLeafletLoaded() {
  if (leafletLoaded) {
    debugLog('Leaflet już załadowany (z cache)');
    return;
  }

  debugLog('Inicjalizacja Leaflet...');

  // Проверяем что L доступен
  if (typeof L === 'undefined') {
    throw new Error('Leaflet nie został załadowany poprawnie');
  }

  // Проверяем что tripMapData доступен
  if (typeof window.tripMapData === 'undefined' || !window.tripMapData.pluginUrl) {
    throw new Error('tripMapData.pluginUrl nie jest dostępny');
  }

  // Строим полные пути к иконкам используя pluginUrl
  const pluginUrl = window.tripMapData.pluginUrl;
  const iconPath = pluginUrl + 'dist/assets/';

  const markerIcon = iconPath + 'marker-icon.png';
  const markerIcon2x = iconPath + 'marker-icon-2x.png';
  const markerShadow = iconPath + 'marker-shadow.png';

  // Исправляем пути к иконкам маркеров
  // Это необходимо при использовании Leaflet через bundler (Vite/Webpack)
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  leafletLoaded = true;
  debugLog('Leaflet gotowy do użycia');
  debugLog('Marker icons:', { markerIcon, markerIcon2x, markerShadow });
}

/**
 * Экспортируем Leaflet для использования в других модулях
 */
export { L };
