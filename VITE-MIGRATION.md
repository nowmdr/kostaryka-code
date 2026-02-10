# Миграция на Vite - Завершена ✅

## Что изменилось

### Структура проекта (новая)
```
kostaryka-trip-map/
├── src/                        # Исходники (NEW)
│   ├── js/
│   │   ├── main.js            # Точка входа
│   │   ├── loader.js          # Loader функции
│   │   ├── leaflet-loader.js  # Leaflet импорт из NPM
│   │   ├── ajax.js            # AJAX запросы
│   │   ├── map.js             # Инициализация карты
│   │   ├── locations-list.js  # Рендеринг списка
│   │   └── utils.js           # Вспомогательные функции
│   └── css/
│       └── loader.css         # Стили loader'а
├── dist/                       # Скомпилированные файлы (NEW)
│   ├── main.js                # Bundle с Leaflet + все модули
│   ├── main.css               # Все стили
│   └── main.js.map            # Source map
├── assets/                     # Старая структура (можно удалить)
├── package.json               # NPM конфиг
├── vite.config.js             # Vite конфиг
└── kostaryka-trip-map.php     # PHP (обновлен для dist/)
```

### Модульная архитектура

Монолитный `assets/js/trip-map.js` (474 строки) разбит на 7 модулей:

1. **main.js** - точка входа, инициализация, event handlers
2. **loader.js** - showGlobalLoader, hideGlobalLoader, showError
3. **leaflet-loader.js** - импорт Leaflet из NPM (вместо CDN)
4. **ajax.js** - loadTripLocations, getPostIdFromSlug
5. **map.js** - initMap, resetMap, createPopupContent
6. **locations-list.js** - renderLocationsList, click handlers
7. **utils.js** - escapeHtml, debugLog

### PHP изменения

**Было:**
```php
wp_enqueue_style(..., "assets/css/loader.css", ...);
wp_enqueue_script(..., "assets/js/trip-map.js", ...);
wp_localize_script(..., [
    "leafletCssUrl" => "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "leafletJsUrl" => "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
]);
```

**Стало:**
```php
wp_enqueue_style(..., "dist/main.css", ...);
wp_enqueue_script(..., "dist/main.js", ...);
wp_localize_script(..., [
    // leafletCssUrl и leafletJsUrl удалены (Leaflet внутри bundle)
]);
```

## Команды для работы

### Установка зависимостей (один раз)
```bash
npm install
```

### Режим разработки (с hot reload)
```bash
npm run dev
```
Запускает dev server на http://localhost:5173 с hot module replacement.

### Сборка для продакшена
```bash
npm run build
```
Создает минифицированные файлы в `dist/`:
- `main.js` (~154KB) - все модули + Leaflet
- `main.css` (~16KB) - все стили

### Preview собранного проекта
```bash
npm run preview
```

## Преимущества новой структуры

### 1. Модульность
- Легко найти и изменить конкретную функциональность
- Каждый модуль отвечает за свою область
- Переиспользуемый код (export/import)

### 2. Leaflet из NPM
- Было: динамическая загрузка с CDN (2 запроса)
- Стало: один bundle с Leaflet внутри
- Версия Leaflet зафиксирована в package.json

### 3. Tree-shaking
Vite автоматически удаляет неиспользуемый код из bundle.

### 4. Source Maps
Файл `main.js.map` позволяет debug'ать оригинальный код в DevTools.

### 5. Готовность к расширению
Легко добавлять новые модули:
```javascript
// src/js/bookings.js
export function createBooking() { ... }

// src/js/main.js
import { createBooking } from './bookings.js';
```

## Размеры файлов

### До миграции
- `trip-map.js`: ~5KB (без Leaflet)
- Leaflet CSS (CDN): ~12KB
- Leaflet JS (CDN): ~40KB
- **Итого: 57KB (3 запроса)**

### После миграции
- `main.css`: 16KB (loader + Leaflet CSS)
- `main.js`: 154KB (все модули + Leaflet)
- **Итого: 170KB (2 запроса)**

Примечание: gzip сжатие уменьшает main.js до ~47KB.

## Workflow разработки

1. Внести изменения в `src/js/` или `src/css/`
2. Запустить `npm run build`
3. Проверить сайт (WordPress использует `dist/main.js`)
4. При необходимости debug: добавить `?debug_trip_map=1` к URL

## Функциональность

✅ Все функции работают идентично старой версии:
- Lazy loading (Leaflet загружается при первом клике)
- AJAX запросы к WordPress
- Интерактивная карта Leaflet
- Список локаций с кликами
- Loader при загрузке
- Error handling

## Дальнейшие улучшения

### Можно добавить:
1. **TypeScript** - типизация для безопасности
2. **CSS Modules** - изолированные стили
3. **PostCSS** - autoprefixer, nesting
4. **ESLint** - линтер для JS
5. **Prettier** - форматирование кода
6. **Vitest** - unit тесты

### Пример добавления нового модуля:
```javascript
// src/js/gallery.js
export function initGallery(images) {
  // Ваша логика галереи
}

// src/js/main.js
import { initGallery } from './gallery.js';
```

## Важные заметки

1. **Git**: Коммитить `src/`, `package.json`, `vite.config.js`
2. **dist/**: Можно либо коммитить, либо генерировать при деплое
3. **node_modules/**: НЕ коммитить (в .gitignore)
4. **assets/**: Старую папку можно удалить

## Troubleshooting

### Ошибка "terser not found"
```bash
npm install --save-dev terser
```

### Ошибка "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

### CSS не применяется
Проверить что WordPress правильно подключает `dist/main.css`

### JS не работает
1. Проверить консоль браузера (F12)
2. Проверить что `tripMapData` доступен глобально
3. Добавить `?debug_trip_map=1` к URL для debug логов

---

**Версия**: 2.0.0
**Дата миграции**: 10 февраля 2026
**Статус**: ✅ Завершено и протестировано
