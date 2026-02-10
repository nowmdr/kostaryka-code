# Исправление проблемы с иконками Leaflet

## Проблема

После миграции на Vite маркеры на карте не отображались корректно. В консоли были ошибки 404:
```
GET https://serwer403392.lh.pl/assets/marker-icon-2x.png 404 (Not Found)
GET https://serwer403392.lh.pl/assets/marker-shadow.png 404 (Not Found)
```

## Причина

Когда Leaflet загружается через NPM/bundler (Vite/Webpack), он теряет ссылки на свои дефолтные иконки. Vite генерировал пути относительно корня сайта (`/assets/...`), но они должны быть относительно плагина (`/wp-content/plugins/kostaryka-trip-map/dist/assets/...`).

## Решение

### 1. Использование `tripMapData.pluginUrl` для путей

В `src/js/leaflet-loader.js` теперь пути строятся динамически:

```javascript
// Строим полные пути к иконкам используя pluginUrl
const pluginUrl = window.tripMapData.pluginUrl;
const iconPath = pluginUrl + 'dist/assets/';

const markerIcon = iconPath + 'marker-icon.png';
const markerIcon2x = iconPath + 'marker-icon-2x.png';
const markerShadow = iconPath + 'marker-shadow.png';

// Исправляем пути в Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
```

**Результат:**
Пути теперь правильные:
```
/wp-content/plugins/kostaryka-trip-map/dist/assets/marker-icon.png
/wp-content/plugins/kostaryka-trip-map/dist/assets/marker-icon-2x.png
/wp-content/plugins/kostaryka-trip-map/dist/assets/marker-shadow.png
```

### 2. Копирование иконок в dist/assets/

Добавлен npm script в `package.json`:

```json
"scripts": {
  "build": "vite build && npm run copy-leaflet-icons",
  "copy-leaflet-icons": "cp node_modules/leaflet/dist/images/marker-*.png dist/assets/ && cp node_modules/leaflet/dist/images/marker-shadow.png dist/assets/"
}
```

При выполнении `npm run build` автоматически:
1. Собирается проект через Vite
2. Копируются иконки из `node_modules/leaflet/dist/images/` в `dist/assets/`

### 3. Настройка Vite

В `vite.config.js` добавлена настройка для копирования изображений:

```javascript
build: {
  assetsInlineLimit: 0, // Отключаем inline - копируем файлы
  rollupOptions: {
    output: {
      assetFileNames: (assetInfo) => {
        // Для изображений создаем папку assets/
        if (assetInfo.name.match(/\.(png|jpe?g|svg|gif|webp)$/i)) {
          return 'assets/[name].[ext]';
        }
        return '[name].[ext]';
      }
    }
  }
}
```

## Итоговая структура

```
dist/
├── assets/
│   ├── marker-icon.png       ✅ (1.4 KB)
│   ├── marker-icon-2x.png    ✅ (2.4 KB)
│   ├── marker-shadow.png     ✅ (618 B)
│   ├── layers.png            ✅ (696 B)
│   └── layers-2x.png         ✅ (1.2 KB)
├── main.css
├── main.js
└── main.js.map
```

## Проверка работы

### 1. Запустите сборку:
```bash
npm run build
```

### 2. Обновите страницу и откройте консоль с debug:
```
URL: ?debug_trip_map=1
```

### 3. В консоли должны увидеть:
```
[Trip Map Debug] Marker icons: {
  markerIcon: "/wp-content/plugins/kostaryka-trip-map/dist/assets/marker-icon.png",
  markerIcon2x: "/wp-content/plugins/kostaryka-trip-map/dist/assets/marker-icon-2x.png",
  markerShadow: "/wp-content/plugins/kostaryka-trip-map/dist/assets/marker-shadow.png"
}
```

### 4. Маркеры на карте должны отображаться с синими иконками и тенью

## Важные замечания

1. **WordPress путь** - `tripMapData.pluginUrl` автоматически содержит правильный путь к плагину, независимо от конфигурации сайта

2. **Cross-platform** - команда копирования работает на Mac/Linux. Для Windows может потребоваться пакет `copyfiles`:
   ```bash
   npm install --save-dev copyfiles
   ```
   И изменить script на:
   ```json
   "copy-leaflet-icons": "copyfiles -f node_modules/leaflet/dist/images/marker-*.png node_modules/leaflet/dist/images/marker-shadow.png dist/assets"
   ```

3. **Git** - файлы в `dist/assets/` можно коммитить, либо генерировать при каждом деплое через `npm run build`

## Альтернативные решения (не использованы)

1. **Импорт иконок через Vite** - не работает т.к. генерирует относительные пути
2. **base в vite.config.js** - не подходит т.к. путь к плагину может меняться
3. **Кастомные иконки** - можно использовать, но дефолтные Leaflet иконки проще

## Статус

✅ **Исправлено и протестировано**
- Маркеры отображаются корректно
- Нет ошибок 404 в консоли
- Иконки загружаются с правильных путей
- Автоматическое копирование при сборке

---

**Дата исправления:** 10 февраля 2026
**Версия плагина:** 2.0.0
