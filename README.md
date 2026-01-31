# 🗺️ Kostaryka Trip Map Plugin

**Wersja:** 1.0.0  
**Wymaga:** WordPress 5.8+, ACF Pro  
**Testowane do:** WordPress 6.4  
**Licencja:** GPL v2 lub nowsza

---

## 📖 Opis

Plugin dodający interaktywną mapę lokacji dla Custom Post Type "Wyprawy" z użyciem Leaflet.js i OpenStreetMap.

**Dlaczego plugin zamiast theme:**
- ✅ Działa niezależnie od aktywnej theme
- ✅ Idealny dla Breakdance w trybie headless
- ✅ Łatwiejsza aktywacja/deaktywacja
- ✅ Nie wymaga zmiany theme
- ✅ Łatwiejsze updates

---

## ⚡ Szybki Start

### Instalacja:

1. **Pobierz** `kostaryka-trip-map.zip`
2. **WordPress → Wtyczki → Dodaj nową → Wyślij wtyczkę na serwer**
3. Wybierz plik ZIP
4. Kliknij **Zainstaluj**
5. Kliknij **Aktywuj**

### Weryfikacja:

Otwórz konsolę przeglądarki (F12) i wpisz:
```javascript
console.log(tripMapData);
console.log(typeof L);
```

Oba powinny zwrócić wartości (nie `undefined`)!

---

## 🛠️ Konfiguracja

### 1. Wymagane pola ACF

Plugin wymaga następującej struktury w CPT "Wyprawy":

```
Grupa: (dowolna nazwa)
└── Repeater: location (WAŻNE: dokładnie ta nazwa!)
    ├── Text: location_name
    ├── Textarea: location_description
    ├── Image: location_image
    ├── Number: location_latitude (-90 do 90)
    └── Number: location_longitude (-180 do 180)
```

### 2. Struktura Breakdance Popup

Stwórz popup z następującą strukturą:

```
Popup (zapamiętaj ID, np. 399)
└── Div
    └── Class: popup-two-columns
    
    ├── Div
    │   └── ID: locations-list
    
    └── Div
        └── ID: map-container
```

### 3. CSS dla Popup

W **Popup → Advanced → Custom CSS** dodaj style z pliku `popup-styles.css`.

### 4. Przycisk w Query Loop

Dodaj do przycisku następujące atrybuty:

```html
class="trip-preview-btn"
data-trip-id="%%ID%%"
```

Plus standardową akcję Breakdance do otwierania popup.

---

## 📁 Struktura Plików

```
kostaryka-trip-map/
├── kostaryka-trip-map.php    # Główny plik pluginu
├── assets/
│   └── js/
│       └── trip-map.js       # JavaScript
└── readme.txt                # WordPress readme
```

---

## 🔧 Funkcje

- 🗺️ Interaktywna mapa OpenStreetMap (Leaflet.js)
- 📍 Automatyczne markery z współrzędnych
- 🖼️ Popup z obrazkiem i nazwą
- 📱 Responsywny design
- ⚡ AJAX loading bez przeładowania
- 🔒 Bezpieczne AJAX z nonce verification
- 🎨 Łatwa customizacja CSS

---

## 🧪 Testowanie

### Test 1: Sprawdź czy plugin jest aktywny

**Wtyczki** → znajdź "Kostaryka Trip Map" → powinien być **Aktywny**

### Test 2: Sprawdź skrypty

F12 → **Network** → odśwież stronę → szukaj:
- `leaflet.css` (status 200)
- `leaflet.js` (status 200)
- `trip-map.js` (status 200)

### Test 3: Test przycisku

1. Kliknij przycisk podglądu
2. W konsoli powinno pojawić się: `Loading trip locations for ID: XXX`
3. AJAX Response powinien pokazać dane

### Test 4: Debug mode

Dodaj do URL: `?debug_trip_map=1`

W konsoli zobaczysz:
```
=== KOSTARYKA TRIP MAP DEBUG ===
tripMapData: Object
Leaflet (L): LOADED
jQuery: 3.x.x
================================
```

---

## 🐛 Rozwiązywanie Problemów

### Plugin się nie aktywuje

**Sprawdź:**
1. Wersja PHP (min. 7.4)
2. Wersja WordPress (min. 5.8)
3. Logi błędów PHP

### tripMapData is undefined

**Rozwiązanie:**
1. Upewnij się że plugin jest **aktywny**
2. Wyczyść cache (WP + przeglądarka)
3. Sprawdź czy `trip-map.js` się ładuje (Network tab)

### "ACF not available"

**Rozwiązanie:**
- Zainstaluj i aktywuj Advanced Custom Fields Pro

### Brak lokacji

**Sprawdź:**
1. Czy pole nazywa się dokładnie `location` (małe litery!)
2. Czy dodałeś lokacje w poście
3. Czy post jest opublikowany

### Mapa się nie wyświetla

**Sprawdź:**
1. Czy DIV ma ID: `map-container`
2. Czy współrzędne są wypełnione
3. Czy Leaflet się załadował: `console.log(typeof L)`

---

## 🎨 Customizacja

### Zmiana szerokości kolumn

W CSS popup:

```css
#locations-list {
    width: 40%;  /* domyślnie 35% */
}

#map-container {
    width: 60%;  /* domyślnie 65% */
}
```

### Własne ikony markerów

Edytuj `assets/js/trip-map.js`, znajdź funkcję `initMap()`:

```javascript
// Zamień:
const marker = L.marker([loc.latitude, loc.longitude])

// Na:
const customIcon = L.icon({
    iconUrl: tripMapData.pluginUrl + 'assets/images/marker.png',
    iconSize: [32, 32]
});
const marker = L.marker([loc.latitude, loc.longitude], {icon: customIcon})
```

---

## 🔄 Update Pluginu

1. **Deaktywuj** plugin
2. **Usuń** starą wersję
3. **Zainstaluj** nową wersję
4. **Aktywuj**

Dane nie zostaną utracone.

---

## ❓ FAQ

**Q: Czy plugin działa z Breakdance headless?**  
A: Tak! To główny powód dlaczego powstał.

**Q: Czy mogę używać innej mapy niż OpenStreetMap?**  
A: Tak, możesz zmienić tile provider w `trip-map.js`.

**Q: Czy plugin wymaga API key?**  
A: Nie! OpenStreetMap i Leaflet.js są całkowicie darmowe.

**Q: Czy działa na mobile?**  
A: Tak, CSS jest responsywny.

---

## 📝 Changelog

### 1.0.0 (2025-01-25)
- Pierwsza wersja
- Integracja z Leaflet.js 1.9.4
- AJAX endpoint dla lokacji
- Obsługa ACF repeater fields
- Responsive design

---

## 👨‍💻 Autor

**Jauhien**  
Website: https://kostaryka.pl

---

## 📄 Licencja

GPL v2 lub nowsza - tak jak WordPress.

---

## 🙏 Credits

- **Leaflet.js** - https://leafletjs.com/
- **OpenStreetMap** - https://www.openstreetmap.org/
- **Breakdance** - https://breakdance.com/
- **ACF** - https://www.advancedcustomfields.com/
