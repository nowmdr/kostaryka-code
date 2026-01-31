=== Kostaryka Trip Map ===
Contributors: jauhien
Tags: map, leaflet, locations, custom post type, breakdance
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Interaktywna mapa lokacji dla Custom Post Type z Leaflet.js i OpenStreetMap.

== Description ==

Plugin dodający interaktywną mapę lokacji dla Custom Post Type "Wyprawy" z użyciem Leaflet.js i OpenStreetMap.

**Funkcje:**

* 🗺️ Interaktywna mapa OpenStreetMap
* 📍 Automatyczne markery z współrzędnych
* 🖼️ Popup z obrazkiem i nazwą lokacji
* 📱 Responsywny design
* ⚡ AJAX loading bez przeładowania
* 🔒 Bezpieczne AJAX z nonce verification

**Wymagania:**

* Advanced Custom Fields (ACF) Pro
* Repeater field o nazwie "location"
* Pola: location_name, location_description, location_image, location_latitude, location_longitude

**Idealny dla:**

* Stron turystycznych
* Travel blogów
* Stron z Breakdance builder (headless mode)

== Installation ==

1. Wgraj plugin do `/wp-content/plugins/kostaryka-trip-map/`
2. Aktywuj plugin przez menu 'Wtyczki' w WordPress
3. Upewnij się że masz zainstalowany ACF Pro
4. Stwórz wymagane pola ACF
5. Skonfiguruj Breakdance popup
6. Gotowe!

Szczegółowa instrukcja w README.md

== Frequently Asked Questions ==

= Czy plugin wymaga API key? =

Nie! OpenStreetMap i Leaflet.js są całkowicie darmowe.

= Czy działa z Breakdance headless? =

Tak! To główny powód powstania tego pluginu.

= Jakie pola ACF są wymagane? =

Repeater "location" z polami: location_name, location_description, location_image, location_latitude, location_longitude

== Screenshots ==

1. Mapa z markerami lokacji
2. Popup z informacjami o lokacji
3. Lista lokacji obok mapy
4. Responsywny design na mobile

== Changelog ==

= 1.0.0 =
* Pierwsza wersja publiczna
* Integracja z Leaflet.js 1.9.4
* AJAX endpoint dla lokacji
* Obsługa ACF repeater fields
* Responsive design

== Upgrade Notice ==

= 1.0.0 =
Pierwsza wersja pluginu.
