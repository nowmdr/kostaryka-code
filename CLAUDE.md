# CLAUDE.md - История разработки плагина Kostaryka Trip Map

## 📋 СОДЕРЖАНИЕ
1. [Обзор проекта](#обзор-проекта)
2. [Исходная задача](#исходная-задача)
3. [Технический стек](#технический-стек)
4. [Процесс разработки](#процесс-разработки)
5. [Архитектура решения](#архитектура-решения)
6. [Проблемы и решения](#проблемы-и-решения)
7. [Текущее состояние](#текущее-состояние)
8. [Дальнейшее развитие](#дальнейшее-развитие)

---

## 📖 ОБЗОР ПРОЕКТА

### Назначение плагина
**Kostaryka Trip Map** - это WordPress плагин для кастомизации сайта, построенного на Breakdance builder. Основная функциональность - интерактивная карта локаций для Custom Post Type "Wyprawy" (Путешествия).

### Важно понимать
Этот плагин создан НЕ только для функциональности карты. Он служит **универсальной базой для всех будущих кастомизаций** сайта, которые требуют JavaScript, PHP или AJAX функциональности.

### Почему плагин, а не тема?
1. WordPress + Breakdance headless mode НЕ позволяет активировать child theme
2. Plugin работает независимо от темы
3. Легче управлять и обновлять
4. Можно добавлять любую кастомную функциональность в будущем

---

## 🎯 ИСХОДНАЯ ЗАДАЧА

### Описание проблемы
У пользователя есть сайт на WordPress с:
- **Breakdance builder** в headless режиме (без темы)
- **Custom Post Type**: "Wyprawy" (slug: `oferta`)
- **ACF Pro** с repeater полем для локаций

### Требования
Создать функциональность где:
1. На странице со списком постов CPT есть кнопка "Podgląd" (Предпросмотр)
2. При клике открывается Breakdance popup
3. В popup отображается:
   - **Слева** (35%): список локаций с фото и названием
   - **Справа** (65%): интерактивная карта с маркерами локаций
4. Клик по локации в списке → фокус на маркере на карте
5. Клик по маркеру → показать popup с фото и названием

### Технические требования
- Использовать **Leaflet.js** для карты
- Использовать **OpenStreetMap** (бесплатно, без API key)
- AJAX загрузка данных без перезагрузки страницы
- Responsive design для mobile
- Работа с ACF repeater fields

---

## 🛠️ ТЕХНИЧЕСКИЙ СТЕК

### WordPress окружение
- **WordPress**: 5.8+
- **PHP**: 7.4+
- **Breakdance Builder**: headless mode
- **ACF Pro**: для custom fields

### Frontend библиотеки
- **Leaflet.js**: 1.9.4 (карты)
- **OpenStreetMap tiles**: бесплатные тайлы карт
- **jQuery**: 3.7.1 (уже в WordPress)

### Структура данных ACF
```
Group: (любое название)
└── Repeater: location (ВАЖНО: точное название!)
    ├── Text: location_name
    ├── Textarea: location_description
    ├── Image: location_image
    ├── Number: location_latitude (-90 до 90)
    └── Number: location_longitude (-180 до 180)
```

---

## 🔨 ПРОЦЕСС РАЗРАБОТКИ

### Этап 1: Первоначальная попытка - Child Theme ❌

**Что пробовали:**
- Создание child theme с `functions.php` и JS файлами
- Попытка активировать тему в WordPress

**Проблема:**
WordPress при Breakdance в headless режиме НЕ позволяет активировать никакую тему. При попытке активации появлялась ошибка:
```
"Niekompletne motywy - Brak motywu nadrzędnego"
```

Даже после добавления `index.php` и исправления `style.css` тема **не активировалась**.

**Вывод:**
Child theme - неправильный подход для Breakdance headless.

---

### Этап 2: Создание плагина ✅

**Решение:**
Создать WordPress плагин вместо темы.

**Структура плагина:**
```
kostaryka-trip-map/
├── kostaryka-trip-map.php    # Главный файл плагина
├── assets/
│   └── js/
│       └── trip-map.js       # JavaScript логика
├── README.md                 # Документация
└── readme.txt                # WordPress.org формат
```

**Главный файл плагина** (`kostaryka-trip-map.php`):
- Класс `Kostaryka_Trip_Map` (Singleton pattern)
- Подключение Leaflet.js и кастомного JS
- AJAX endpoint `get_trip_locations`
- Проверка зависимостей (ACF)

---

## 🏗️ АРХИТЕКТУРА РЕШЕНИЯ

### PHP (Backend) - kostaryka-trip-map.php

#### 1. Структура класса
```php
class Kostaryka_Trip_Map {
    private static $instance = null;
    
    public static function get_instance() { ... }
    private function __construct() { ... }
    private function init_hooks() { ... }
    
    // Основные методы:
    public function enqueue_scripts() { ... }
    public function get_trip_locations() { ... }
    private function format_locations($locations) { ... }
    public function check_dependencies() { ... }
}
```

#### 2. Подключение скриптов
```php
public function enqueue_scripts() {
    // Leaflet CSS
    wp_enqueue_style('leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    
    // Leaflet JS
    wp_enqueue_script('leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    
    // Наш скрипт (зависит от jQuery и Leaflet)
    wp_enqueue_script('kostaryka-trip-map', 
        KOSTARYKA_TRIP_MAP_PLUGIN_URL . 'assets/js/trip-map.js',
        array('jquery', 'leaflet-js'),
        KOSTARYKA_TRIP_MAP_VERSION,
        true  // в footer
    );
    
    // Передаем данные в JS
    wp_localize_script('kostaryka-trip-map', 'tripMapData', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('trip_map_nonce'),
        'pluginUrl' => KOSTARYKA_TRIP_MAP_PLUGIN_URL,
        'version' => KOSTARYKA_TRIP_MAP_VERSION
    ));
}
```

#### 3. AJAX Handler
```php
public function get_trip_locations() {
    // 1. Проверка nonce (безопасность)
    check_ajax_referer('trip_map_nonce', 'nonce', false);
    
    // 2. Получение и валидация trip_id
    $trip_id = intval($_POST['trip_id']);
    
    // 3. Проверка существования и статуса поста
    $post_status = get_post_status($trip_id);
    if (!$post_status || $post_status !== 'publish') {
        wp_send_json_error('Trip not found or not published');
    }
    
    // 4. Получение данных из ACF
    $locations = get_field('location', $trip_id);
    
    // 5. Форматирование данных
    $formatted_locations = $this->format_locations($locations);
    
    // 6. Возврат успешного результата
    wp_send_json_success($formatted_locations);
}
```

#### 4. Форматирование данных
```php
private function format_locations($locations) {
    $formatted = array();
    
    foreach ($locations as $location) {
        // Координаты
        $latitude = floatval($location['location_latitude']);
        $longitude = floatval($location['location_longitude']);
        
        // Изображение (поддержка разных форматов ACF)
        $image_url = '';
        if (is_array($location['location_image'])) {
            $image_url = $location['location_image']['url'];
        } elseif (is_numeric($location['location_image'])) {
            $image_url = wp_get_attachment_image_url($location['location_image'], 'medium');
        }
        
        $formatted[] = array(
            'name' => $location['location_name'] ?? '',
            'description' => $location['location_description'] ?? '',
            'image' => $image_url,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'has_coordinates' => ($latitude !== null && $longitude !== null && $latitude !== 0 && $longitude !== 0)
        );
    }
    
    return $formatted;
}
```

---

### JavaScript (Frontend) - trip-map.js

#### 1. Структура
```javascript
(function($) {
    'use strict';

    // Глобальные переменные
    let map = null;
    let markers = [];
    let markersLayer = null;

    // Инициализация
    $(document).ready(function() {
        initTripMapButtons();
    });

    // Основные функции
    function initTripMapButtons() { ... }
    function handleButtonClick(e) { ... }
    function loadTripLocations(tripId) { ... }
    function renderLocationsList(locations) { ... }
    function initMap(locations) { ... }
    
    // Вспомогательные
    function showLoader() { ... }
    function showError(message) { ... }
    function createPopupContent(loc) { ... }
    function escapeHtml(text) { ... }

})(jQuery);
```

#### 2. Получение ID поста (критически важно!)

**ПРОБЛЕМА:** В Breakdance `%%ID%%` в data-атрибутах не работал корректно.

**РЕШЕНИЕ:** Извлекать ID из URL соседней ссылки через REST API:

```javascript
function handleButtonClick(e) {
    e.preventDefault();
    
    const $button = $(this);
    
    // 1. Находим ссылку на пост в той же карточке
    const $postLink = $button.closest('.bde-loop-item').find('a[href*="/oferta/"]');
    const postUrl = $postLink.attr('href');
    
    // 2. Извлекаем slug из URL
    // URL: https://site.com/oferta/klejnoty-kostaryki/
    // Slug: klejnoty-kostaryki
    const urlParts = postUrl.split('/').filter(Boolean);
    const postSlug = urlParts[urlParts.length - 1];
    
    // 3. Получаем ID поста через REST API
    $.ajax({
        url: '/wp-json/wp/v2/oferta',
        type: 'GET',
        data: {
            slug: postSlug,
            _fields: 'id'  // Только ID для скорости
        },
        success: function(posts) {
            if (posts && posts.length > 0) {
                const tripId = posts[0].id;
                loadTripLocations(tripId);  // Загружаем локации
            }
        }
    });
}
```

**Почему это надежно:**
- URL поста всегда корректный
- REST API - стандарт WordPress
- Не зависит от Breakdance динамических данных
- Работает всегда, даже если структура HTML изменится

#### 3. AJAX загрузка локаций
```javascript
function loadTripLocations(tripId) {
    $.ajax({
        url: tripMapData.ajaxUrl,
        type: 'POST',
        data: {
            action: 'get_trip_locations',
            trip_id: tripId,
            nonce: tripMapData.nonce
        },
        beforeSend: function() {
            showLoader();  // Показываем индикатор загрузки
        },
        success: function(response) {
            if (response.success && response.data) {
                renderLocationsList(response.data);  // Рендерим список
                initMap(response.data);              // Инициализируем карту
            } else {
                showError(response.data);
            }
        },
        error: function(xhr, status, error) {
            showError('Błąd połączenia. Spróbuj ponownie.');
        }
    });
}
```

#### 4. Рендеринг списка локаций
```javascript
function renderLocationsList(locations) {
    let html = '<div class="locations-wrapper">';
    
    locations.forEach(function(loc, index) {
        html += '<div class="location-item" data-index="' + index + '">';
        
        if (loc.image) {
            html += '<img src="' + loc.image + '" alt="' + escapeHtml(loc.name) + '">';
        }
        
        html += '<div class="location-content">';
        html += '<h3>' + escapeHtml(loc.name) + '</h3>';
        
        if (loc.description) {
            const shortDesc = loc.description.substring(0, 100);
            html += '<p class="location-desc">' + escapeHtml(shortDesc) + '...</p>';
        }
        
        html += '</div></div>';
    });
    
    html += '</div>';
    $('#locations-list').html(html);
    
    // Event handler для клика по локации
    $('.location-item').on('click', function() {
        const index = $(this).data('index');
        
        $('.location-item').removeClass('active');
        $(this).addClass('active');
        
        if (markers[index]) {
            markers[index].openPopup();
            map.setView(markers[index].getLatLng(), 10);
        }
    });
}
```

#### 5. Инициализация карты Leaflet
```javascript
function initMap(locations) {
    // Удаляем предыдущую карту если есть
    if (map !== null) {
        map.remove();
        map = null;
    }
    markers = [];
    
    // Фильтруем только локации с координатами
    const locationsWithCoords = locations.filter(function(loc) {
        return loc.has_coordinates;
    });
    
    if (locationsWithCoords.length === 0) {
        $('#map-container').html('<p>Brak lokacji z współrzędnymi.</p>');
        return;
    }
    
    // Создаем карту
    map = L.map('map-container', {
        scrollWheelZoom: true,
        zoomControl: true
    });
    
    // Добавляем OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2
    }).addTo(map);
    
    // Создаем layer group для маркеров
    markersLayer = L.layerGroup().addTo(map);
    
    // Bounds для автозума
    const bounds = L.latLngBounds();
    
    // Добавляем маркеры
    locationsWithCoords.forEach(function(loc, index) {
        const marker = L.marker([loc.latitude, loc.longitude])
            .bindPopup(createPopupContent(loc));
        
        marker.addTo(markersLayer);
        markers.push(marker);
        bounds.extend([loc.latitude, loc.longitude]);
    });
    
    // Автозум на все маркеры
    if (locationsWithCoords.length > 0) {
        map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 12
        });
    }
    
    // Fix для display issues
    setTimeout(function() {
        map.invalidateSize();
    }, 100);
}
```

---

### CSS - Структура Breakdance Popup

#### Breakdance структура
```
Popup (ID: 399 или другой)
└── Div
    ├── Class: popup-two-columns
    │
    ├── Div #1
    │   └── ID: locations-list    ← ОБЯЗАТЕЛЬНО!
    │
    └── Div #2
        └── ID: map-container     ← ОБЯЗАТЕЛЬНО!
```

#### CSS стили (в Custom CSS popup)
```css
/* Container для двух колонок */
.popup-two-columns {
    display: flex;
    gap: 20px;
    height: 600px;
    max-height: 80vh;
    padding: 20px;
}

/* Левая колонка - список */
#locations-list {
    width: 35%;
    overflow-y: auto;
    padding-right: 10px;
}

/* Правая колонка - карта */
#map-container {
    width: 65%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #ddd;
}

/* Элемент локации */
.location-item {
    padding: 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fff;
}

.location-item:hover {
    border-color: #2271b1;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transform: translateY(-2px);
}

.location-item.active {
    border-color: #2271b1;
    background: #f0f6fc;
}

/* Responsive */
@media (max-width: 768px) {
    .popup-two-columns {
        flex-direction: column;
    }
    
    #locations-list,
    #map-container {
        width: 100%;
        height: 300px;
    }
}
```

---

### Breakdance кнопка

#### HTML структура кнопки
```html
<a class="trip-preview-btn" 
   href="#" 
   data-type="action" 
   data-action='{"type":"popup","popupOptions":{"popupId":"399","popupAction":"open"}}'>
    Click Here
</a>
```

**Важно:**
- Class: `trip-preview-btn` - для JavaScript
- `data-action` - стандартная Breakdance акция для открытия popup
- `popupId` - ID созданного popup (проверить в Breakdance)

**НЕ НУЖНО** добавлять `data-trip-id` - ID извлекается из URL!

---

## 🐛 ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: Child theme не активируется ❌

**Симптомы:**
```
"Niekompletne motywy - Brak motywu nadrzędnego"
```

**Причина:**
Breakdance в headless режиме не позволяет использовать темы.

**Решение:**
Использовать плагин вместо темы.

---

### Проблема 2: `tripMapData is not defined` ❌

**Симптомы:**
```javascript
Uncaught ReferenceError: tripMapData is not defined
```

**Причина:**
- Plugin не активирован
- Или скрипт загружается раньше чем `wp_localize_script`

**Решение:**
1. Проверить что плагин активен: **Wtyczki** → "Kostaryka Trip Map" → **Aktywna**
2. Убедиться что в `enqueue_scripts()` правильный порядок:
   ```php
   wp_enqueue_script('kostaryka-trip-map', ..., array('jquery', 'leaflet-js'), ..., true);
   wp_localize_script('kostaryka-trip-map', 'tripMapData', ...);
   ```

---

### Проблема 3: `$ is not defined` ❌

**Симптомы:**
```javascript
Uncaught TypeError: Cannot read properties of undefined (reading 'ajax')
```

**Причина:**
WordPress использует `jQuery.noConflict()`, поэтому `$` не доступен глобально.

**Решение:**
Обернуть весь JS код в:
```javascript
(function($) {
    'use strict';
    // Весь код здесь, $ работает
})(jQuery);
```

**Проверка:**
```javascript
console.log('jQuery version:', jQuery.fn.jquery);  // Работает
console.log('$ defined:', typeof $ !== 'undefined');  // false (в глобале)
```

---

### Проблема 4: AJAX возвращает "Trip not found" ❌

**Симптомы:**
```javascript
{success: false, data: 'Trip not found or not published'}
```

**Причины:**
1. Неправильный ID поста
2. Пост не опубликован (статус не "publish")
3. ACF поле названо неправильно

**Решение - Debug:**
Добавить в PHP (временно):
```php
public function get_trip_locations() {
    $trip_id = intval($_POST['trip_id']);
    $post_status = get_post_status($trip_id);
    $post_type = get_post_type($trip_id);
    
    // DEBUG
    if (!$post_status) {
        wp_send_json_error('Post does not exist. ID: ' . $trip_id);
        return;
    }
    
    if ($post_status !== 'publish') {
        wp_send_json_error('Post status is: ' . $post_status . ', type: ' . $post_type);
        return;
    }
    
    // ... остальной код
}
```

**Проверка ID поста:**
```javascript
// В админке на странице редактирования поста
// URL: /wp-admin/post.php?post=389&action=edit
//                              ^^^
//                           Правильный ID
```

---

### Проблема 5: `%%ID%%` возвращает неправильный ID ❌

**Симптомы:**
Все кнопки имеют `data-trip-id="359"`, но реальный ID поста = 389.

**Причина:**
Breakdance динамические данные `%%ID%%` не всегда работают корректно в Query Loop.

**РЕШЕНИЕ (финальное):**
Извлекать ID из URL ссылки на пост:

```javascript
function handleButtonClick(e) {
    e.preventDefault();
    
    // 1. Найти ссылку на пост
    const $postLink = $(this).closest('.bde-loop-item').find('a[href*="/oferta/"]');
    const postUrl = $postLink.attr('href');
    
    // 2. Извлечь slug
    const postSlug = postUrl.split('/').filter(Boolean).pop();
    
    // 3. Получить ID через REST API
    $.ajax({
        url: '/wp-json/wp/v2/oferta',
        data: { slug: postSlug, _fields: 'id' },
        success: function(posts) {
            const tripId = posts[0].id;
            loadTripLocations(tripId);
        }
    });
}
```

**Почему это работает:**
- URL всегда правильный (генерируется WordPress)
- REST API стандартный для всех CPT
- Не зависит от Breakdance

---

### Проблема 6: REST API 404 для CPT ❌

**Симптомы:**
```
Failed to load resource: the server responded with a status of 404
/wp-json/wp/v2/oferta/389
```

**Причина:**
CPT не включен в REST API.

**Решение:**
В настройках CPT (ACF или код) включить:
```
Advanced Settings → Show in REST API: Yes
```

Или в коде регистрации CPT:
```php
register_post_type('oferta', array(
    'show_in_rest' => true,  // ← Добавить
    // ... другие параметры
));
```

---

## ✅ ТЕКУЩЕЕ СОСТОЯНИЕ

### Что работает
- ✅ Plugin успешно установлен и активирован
- ✅ Leaflet.js загружается корректно
- ✅ AJAX endpoint работает
- ✅ ID поста извлекается из URL через REST API
- ✅ Данные локаций загружаются из ACF
- ✅ Карта отображается с маркерами
- ✅ Список локаций отображается слева
- ✅ Клик по локации → фокус на маркере
- ✅ Клик по маркеру → popup с данными
- ✅ Responsive design работает

### Финальная проверка
```javascript
// В консоли на фронте:
console.log(tripMapData);           // Object {ajaxUrl, nonce, ...}
console.log(typeof L);              // "object"
console.log(jQuery.fn.jquery);      // "3.7.1"
```

### Тестовый запрос
```javascript
jQuery.ajax({
    url: tripMapData.ajaxUrl,
    type: 'POST',
    data: {
        action: 'get_trip_locations',
        trip_id: 389,  // Правильный ID
        nonce: tripMapData.nonce
    },
    success: function(response) {
        console.log('Success:', response);
        // {success: true, data: Array(2)}
    }
});
```

---

## 🚀 ДАЛЬНЕЙШЕЕ РАЗВИТИЕ

### Расширение плагина для других кастомизаций

Этот плагин создан как **универсальная база** для всех будущих кастомизаций сайта.

#### Как добавлять новые функции:

**1. Новые AJAX endpoints:**
```php
// В классе Kostaryka_Trip_Map
private function init_hooks() {
    // Существующие hooks
    add_action('wp_ajax_get_trip_locations', array($this, 'get_trip_locations'));
    
    // НОВЫЙ endpoint
    add_action('wp_ajax_custom_function', array($this, 'custom_function'));
    add_action('wp_ajax_nopriv_custom_function', array($this, 'custom_function'));
}

public function custom_function() {
    // Ваша логика
    wp_send_json_success($data);
}
```

**2. Новые JavaScript файлы:**
```php
public function enqueue_scripts() {
    // Существующие скрипты
    wp_enqueue_script('kostaryka-trip-map', ...);
    
    // НОВЫЙ скрипт
    wp_enqueue_script(
        'kostaryka-custom-feature',
        KOSTARYKA_TRIP_MAP_PLUGIN_URL . 'assets/js/custom-feature.js',
        array('jquery'),
        KOSTARYKA_TRIP_MAP_VERSION,
        true
    );
}
```

**3. Новые CSS стили:**
```php
public function enqueue_scripts() {
    // НОВЫЙ стиль
    wp_enqueue_style(
        'kostaryka-custom-styles',
        KOSTARYKA_TRIP_MAP_PLUGIN_URL . 'assets/css/custom-styles.css',
        array(),
        KOSTARYKA_TRIP_MAP_VERSION
    );
}
```

#### Структура для масштабирования:
```
kostaryka-trip-map/
├── kostaryka-trip-map.php       # Главный файл
├── includes/                     # Будущие PHP классы
│   ├── class-trip-map.php       # Функциональность карты
│   ├── class-bookings.php       # Бронирования
│   └── class-gallery.php        # Галерея
├── assets/
│   ├── js/
│   │   ├── trip-map.js          # Существующий
│   │   ├── bookings.js          # Новый
│   │   └── gallery.js           # Новый
│   ├── css/
│   │   ├── trip-map.css
│   │   └── custom.css
│   └── images/
│       └── markers/
└── languages/                    # Переводы
```

---

### Планируемые улучшения для карты

#### v1.1.0 - Улучшения UX
- [ ] **Clustering маркеров** для >20 локаций (Leaflet.markercluster)
- [ ] **Анимация** при открытии popup
- [ ] **Прогресс-бар** загрузки данных
- [ ] **Кэширование** данных в sessionStorage
- [ ] **Дебаунс** для кликов (предотвращение дубликатов)

#### v1.2.0 - Расширенная функциональность
- [ ] **Разные иконки** для разных типов локаций
- [ ] **Галерея фото** в popup маркера (не только одно фото)
- [ ] **Фильтры** локаций по категориям
- [ ] **Поиск** на карте по названию локации
- [ ] **Экспорт маршрута** в GPX/KML

#### v1.3.0 - Интеграция с сервисами
- [ ] **Mapbox** integration (красивые кастомные карты)
- [ ] **Elevation API** для высоты над уровнем моря
- [ ] **Weather API** для прогноза погоды в локации
- [ ] **Routing** между точками (Leaflet Routing Machine)

#### v2.0.0 - Admin панель
- [ ] **Settings page** в WordPress админке
- [ ] Выбор стиля карты (OpenStreetMap / Mapbox / etc)
- [ ] Настройка цветов и стилей
- [ ] Импорт/экспорт локаций через CSV
- [ ] Массовое добавление координат через геокодер

---

### Другие кастомизации сайта (примеры)

#### 1. Система бронирования
```php
// В init_hooks():
add_action('wp_ajax_create_booking', array($this, 'create_booking'));
add_action('wp_ajax_nopriv_create_booking', array($this, 'create_booking'));

public function create_booking() {
    // Валидация данных формы
    // Сохранение в БД или отправка на email
    // Интеграция с платежными системами
    wp_send_json_success($booking_data);
}
```

#### 2. Live чат с оператором
```php
// Интеграция с Crisp / Intercom / Tawk.to
public function enqueue_chat_widget() {
    wp_enqueue_script('chat-widget', 'https://...');
}
```

#### 3. Динамическая фильтрация постов
```javascript
// assets/js/filters.js
jQuery('.filter-button').on('click', function() {
    const category = $(this).data('category');
    
    $.ajax({
        url: tripMapData.ajaxUrl,
        data: {
            action: 'filter_trips',
            category: category
        },
        success: function(response) {
            $('.trips-list').html(response.data);
        }
    });
});
```

#### 4. Newsletter subscription
```php
add_action('wp_ajax_subscribe_newsletter', array($this, 'subscribe_newsletter'));
add_action('wp_ajax_nopriv_subscribe_newsletter', array($this, 'subscribe_newsletter'));

public function subscribe_newsletter() {
    $email = sanitize_email($_POST['email']);
    
    // Интеграция с MailChimp / SendGrid / etc
    // Или сохранение в локальную БД
    
    wp_send_json_success('Subscribed!');
}
```

---

## 📚 ВАЖНЫЕ ЗАМЕТКИ ДЛЯ РАЗРАБОТЧИКА

### Безопасность

#### 1. Всегда проверять nonce
```php
if (!check_ajax_referer('trip_map_nonce', 'nonce', false)) {
    wp_send_json_error('Invalid nonce');
    return;
}
```

#### 2. Санитизация входных данных
```php
$trip_id = intval($_POST['trip_id']);  // Для чисел
$email = sanitize_email($_POST['email']);  // Для email
$text = sanitize_text_field($_POST['text']);  // Для текста
```

#### 3. Escape выходных данных
```javascript
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}
```

---

### Performance оптимизация

#### 1. Минификация скриптов в продакшене
```php
// Использовать .min версии в продакшене
$suffix = (defined('SCRIPT_DEBUG') && SCRIPT_DEBUG) ? '' : '.min';
wp_enqueue_script('kostaryka-trip-map', 
    KOSTARYKA_TRIP_MAP_PLUGIN_URL . 'assets/js/trip-map' . $suffix . '.js'
);
```

#### 2. Кэширование AJAX запросов
```javascript
// Простой кеш в памяти
const locationsCache = {};

function loadTripLocations(tripId) {
    if (locationsCache[tripId]) {
        console.log('Loading from cache');
        renderLocationsList(locationsCache[tripId]);
        initMap(locationsCache[tripId]);
        return;
    }
    
    $.ajax({
        // ... запрос
        success: function(response) {
            locationsCache[tripId] = response.data;
            // ... рендеринг
        }
    });
}
```

#### 3. Lazy loading для изображений
```javascript
// В renderLocationsList:
html += '<img src="placeholder.jpg" data-src="' + loc.image + '" class="lazy">';

// Intersection Observer
const lazyImages = document.querySelectorAll('img.lazy');
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
        }
    });
});

lazyImages.forEach(img => imageObserver.observe(img));
```

---

### Debugging

#### 1. Debug mode в плагине
```php
// В главном файле плагина добавить:
define('KOSTARYKA_TRIP_MAP_DEBUG', true);

// Использовать в коде:
if (KOSTARYKA_TRIP_MAP_DEBUG) {
    error_log('Trip Map Debug: ' . print_r($data, true));
}
```

#### 2. Console logging в JS
```javascript
// URL с параметром: ?debug_trip_map=1
if (window.location.search.indexOf('debug_trip_map=1') !== -1) {
    console.log('=== TRIP MAP DEBUG ===');
    console.log('tripMapData:', tripMapData);
    console.log('Leaflet version:', L.version);
    console.log('jQuery version:', jQuery.fn.jquery);
}
```

#### 3. AJAX Debug в консоли
```javascript
// Детальное логирование AJAX
$.ajax({
    // ... параметры
    beforeSend: function(xhr, settings) {
        console.log('AJAX Request:', settings.url, settings.data);
    },
    success: function(response, status, xhr) {
        console.log('AJAX Success:', response);
        console.log('Response Headers:', xhr.getAllResponseHeaders());
    },
    error: function(xhr, status, error) {
        console.error('AJAX Error:', error);
        console.error('Response Text:', xhr.responseText);
        console.error('Status:', xhr.status);
    }
});
```

---

## 🔗 ПОЛЕЗНЫЕ ССЫЛКИ

### Документация
- **Leaflet.js**: https://leafletjs.com/reference.html
- **OpenStreetMap**: https://wiki.openstreetmap.org/wiki/Tile_servers
- **WordPress AJAX**: https://developer.wordpress.org/plugins/javascript/ajax/
- **ACF**: https://www.advancedcustomfields.com/resources/

### Инструменты
- **Координаты локаций**: https://www.google.com/maps (правый клик → "Co tu jest?")
- **Тестирование REST API**: https://site.com/wp-json/wp/v2/oferta
- **Валидатор coordinates**: https://www.latlong.net/

### Иконки для маркеров
- **Flaticon**: https://www.flaticon.com/
- **Icons8**: https://icons8.com/icons/set/map-marker
- **Font Awesome**: https://fontawesome.com/icons?d=gallery&q=map

---

## 📝 ЧЕКЛИСТ ПРИ РЕДАКТИРОВАНИИ

### Перед изменением кода:

- [ ] Сделать backup файла который изменяешь
- [ ] Проверить что плагин активен
- [ ] Открыть консоль браузера (F12) для проверки ошибок
- [ ] Если меняешь PHP - проверить PHP error log

### После изменения:

- [ ] Очистить cache браузера (Ctrl+Shift+R)
- [ ] Проверить консоль на ошибки JavaScript
- [ ] Проверить Network tab на AJAX запросы
- [ ] Протестировать на мобильном устройстве
- [ ] Проверить разные посты с разным количеством локаций

### Если что-то сломалось:

1. **Откатить изменения** (вернуть backup)
2. **Проверить консоль** - там обычно ясно написано что сломалось
3. **Проверить PHP errors** в `/wp-content/debug.log`
4. **Деактивировать/активировать** плагин
5. **Очистить все кеши** (WP cache, browser cache, CDN если есть)

---

## 🎓 ЗАКЛЮЧЕНИЕ

Этот плагин является **фундаментом** для всех будущих кастомизаций сайта. Он демонстрирует:

- ✅ Правильную структуру WordPress плагина
- ✅ Безопасную работу с AJAX
- ✅ Интеграцию внешних библиотек (Leaflet.js)
- ✅ Работу с ACF данными
- ✅ Responsive design
- ✅ Совместимость с Breakdance builder

**Ключевые преимущества подхода:**
1. Не зависит от темы (работает всегда)
2. Легко расширяется новой функциональностью
3. Модульная структура
4. Следует WordPress coding standards
5. Безопасный (nonce, sanitization, escaping)

**Следующие шаги:**
- Добавлять новые функции по мере необходимости
- Рефакторинг кода в отдельные классы при росте
- Добавление unit тестов для критической функциональности
- Создание admin settings page для удобства

---

**Автор**: Jauhien  
**Дата создания**: 25 января 2025  
**Последнее обновление**: 25 января 2025  
**Версия плагина**: 1.0.0  
**Статус**: ✅ Работает в продакшене
---

## 🔄 ТЕКУЩАЯ ЗАДАЧА: Рефакторинг на Vanilla JS

**Статус**: 🟡 В процессе  
**Дата начала**: [добавь дату]  
**Ответственный**: Claude Code

### Цель
Переписать `/assets/js/trip-map.js` с jQuery на чистый JavaScript (Vanilla JS) для улучшения производительности и уменьшения зависимостей.

### Контекст
Плагин **Kostaryka Trip Map** создан для интерактивной карты локаций в Breakdance popup. Текущая версия использует jQuery, но WordPress загружает jQuery даже там где он не нужен. Переход на Vanilla JS уменьшит зависимости и улучшит производительность.

### Что нужно изменить

#### Файл: `/assets/js/trip-map.js`

**Текущая структура:**
```javascript
(function($) {
    'use strict';
    
    let map = null;
    let markers = [];
    let markersLayer = null;

    $(document).ready(function() {
        initTripMapButtons();
    });
    
    // ... остальной код с jQuery
})(jQuery);
```

**Целевая структура:**
```javascript
(function() {
    'use strict';
    
    let map = null;
    let markers = [];
    let markersLayer = null;

    document.addEventListener('DOMContentLoaded', function() {
        initTripMapButtons();
    });
    
    // ... весь код на Vanilla JS
})();
```

### Таблица замен jQuery → Vanilla JS

| jQuery | Vanilla JS | Комментарий |
|--------|-----------|-------------|
| `$(document).ready(fn)` | `document.addEventListener('DOMContentLoaded', fn)` | Ждем загрузки DOM |
| `$(selector)` | `document.querySelector(selector)` | Один элемент |
| `$(selector)` | `document.querySelectorAll(selector)` | Несколько элементов |
| `$(this)` | `this` или `e.currentTarget` | В event handler |
| `$el.on('click', fn)` | `el.addEventListener('click', fn)` | Event listener |
| `$(document).on('click', sel, fn)` | Event delegation (см. ниже) | Делегирование |
| `$el.closest(sel)` | `el.closest(sel)` | Нативный метод |
| `$el.find(sel)` | `el.querySelector(sel)` | Поиск внутри |
| `$el.attr('href')` | `el.getAttribute('href')` | Получить атрибут |
| `$el.data('trip-id')` | `el.dataset.tripId` | Data атрибуты |
| `$el.html(html)` | `el.innerHTML = html` | Вставка HTML |
| `$el.addClass('active')` | `el.classList.add('active')` | Добавить класс |
| `$el.removeClass('active')` | `el.classList.remove('active')` | Убрать класс |
| `$.ajax({...})` | `fetch(...).then(...)` | AJAX запросы |

### Event Delegation (важно!)

**jQuery способ:**
```javascript
$(document).on('click', '.trip-preview-btn', function(e) {
    e.preventDefault();
    const tripId = $(this).data('trip-id');
    // ...
});
```

**Vanilla JS способ:**
```javascript
document.addEventListener('click', function(e) {
    // Проверяем что клик по нужному элементу
    const button = e.target.closest('.trip-preview-btn');
    if (!button) return;
    
    e.preventDefault();
    const tripId = button.dataset.tripId;
    // ...
});
```

### AJAX: $.ajax() → fetch()

**jQuery способ:**
```javascript
$.ajax({
    url: tripMapData.ajaxUrl,
    type: 'POST',
    data: {
        action: 'get_trip_locations',
        trip_id: tripId,
        nonce: tripMapData.nonce
    },
    success: function(response) {
        console.log(response);
    },
    error: function(xhr, status, error) {
        console.error(error);
    }
});
```

**Vanilla JS способ (современный async/await):**
```javascript
async function loadTripLocations(tripId) {
    try {
        // Создаем FormData для POST запроса
        const formData = new FormData();
        formData.append('action', 'get_trip_locations');
        formData.append('trip_id', tripId);
        formData.append('nonce', tripMapData.nonce);
        
        const response = await fetch(tripMapData.ajaxUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log(data.data);
        } else {
            throw new Error(data.data);
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}
```

### Важные функции для переписывания

#### 1. `initTripMapButtons()`
- Заменить event delegation с jQuery на Vanilla

#### 2. `handleButtonClick(e)`
- Заменить `$(this)` на `e.currentTarget` или `e.target.closest()`
- Заменить `.closest()`, `.find()` на нативные методы
- Заменить `.attr()` на `.getAttribute()`

#### 3. `loadTripLocations(tripId)`
- ПОЛНОСТЬЮ переписать с `$.ajax()` на `fetch()` + async/await
- Обработка ошибок через try/catch

#### 4. `renderLocationsList(locations)`
- Заменить `$('#locations-list').html(html)` на `document.getElementById('locations-list').innerHTML = html`
- Заменить `$('.location-item').on('click', ...)` на event delegation

#### 5. `showLoader()` и `showError()`
- Заменить jQuery селекторы на нативные

#### 6. `escapeHtml(text)`
- Оставить как есть (не использует jQuery)

### Критически важно

1. **Event delegation** - клики должны работать на динамически добавленных элементах
2. **Async/await** - использовать современный синтаксис для AJAX
3. **Error handling** - обязательно try/catch для всех fetch запросов
4. **Тестирование** - после изменений протестировать ВСЮ функциональность

### Файлы для изменения

1. **Главный файл**: `/wp-content/plugins/kostaryka-trip-map/assets/js/trip-map.js`
2. **PHP файл** (минимальные изменения): `/wp-content/plugins/kostaryka-trip-map/kostaryka-trip-map.php`

В PHP изменить только:
```php
wp_enqueue_script('kostaryka-trip-map', 
    KOSTARYKA_TRIP_MAP_PLUGIN_URL . 'assets/js/trip-map.js',
    array(),  // ← Убрать 'jquery' из зависимостей!
    KOSTARYKA_TRIP_MAP_VERSION,
    true
);
```

### Чеклист выполнения

- [ ] Заменены все jQuery селекторы на нативные
- [ ] Event delegation работает корректно
- [ ] AJAX переписан на fetch() с async/await
- [ ] Все функции работают без jQuery
- [ ] Нет ошибок в консоли
- [ ] Протестирована вся функциональность:
  - [ ] Клик по кнопке открывает popup
  - [ ] Загружаются данные локаций
  - [ ] Отображается список локаций
  - [ ] Отображается карта с маркерами
  - [ ] Клик по локации фокусирует карту
  - [ ] Клик по маркеру открывает popup
- [ ] Удалена зависимость от jQuery в PHP
- [ ] Обновлена документация

### Ожидаемый результат

**До:**
- Размер: ~6KB
- Зависимости: jQuery (30KB)
- Итого: 36KB

**После:**
- Размер: ~4-5KB
- Зависимости: нет
- Итого: 4-5KB

**Выигрыш**: ~31KB меньше загрузки

### Следующий этап

После завершения рефакторинга переходим к **Этапу 2: Lazy Loading**.
```
