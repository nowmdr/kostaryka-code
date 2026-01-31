/**
 * Kostaryka Trip Map - JavaScript (Vanilla JS + Lazy Loading)
 * Version: 1.2.0
 */

(function () {
  "use strict";

  // Zmienne globalne
  let map = null;
  let markers = [];
  let markersLayer = null;
  let leafletLoaded = false;

  /**
   * Inicjalizacja po załadowaniu DOM
   */
  document.addEventListener("DOMContentLoaded", function () {
    initTripMapButtons();
  });

  /**
   * Inicjalizacja przycisków mapy
   */
  function initTripMapButtons() {
    // Event delegation dla przycisków (div.trip-preview-btn lub button wewnątrz)
    document.addEventListener("click", function (e) {
      const button = e.target.closest(".trip-preview-btn, .trip-preview-btn button");
      if (!button) return;
      handleButtonClick(e, button);
    });

    console.log("Kostaryka Trip Map initialized (Vanilla JS + Lazy Loading)");
  }

  // ============================================
  // LAZY LOADING FUNCTIONS
  // ============================================

  /**
   * Pokazać globalny loader
   */
  function showGlobalLoader(message = "Ładowanie...") {
    let loader = document.getElementById("trip-map-global-loader");

    if (!loader) {
      loader = document.createElement("div");
      loader.id = "trip-map-global-loader";
      loader.className = "trip-map-loader";
      loader.innerHTML = `
        <div class="loader-content">
          <div class="loader-spinner"></div>
          <p class="loader-message">${escapeHtml(message)}</p>
        </div>
      `;
      document.body.appendChild(loader);
    } else {
      const messageEl = loader.querySelector(".loader-message");
      if (messageEl) messageEl.textContent = message;
      loader.style.display = "flex";
    }
  }

  /**
   * Ukryć globalny loader
   */
  function hideGlobalLoader() {
    const loader = document.getElementById("trip-map-global-loader");
    if (loader) {
      loader.style.display = "none";
    }
  }

  /**
   * Załadować Leaflet CSS
   */
  function loadLeafletCSS() {
    return new Promise((resolve, reject) => {
      // Sprawdź czy już załadowany
      if (document.querySelector('link[href*="leaflet.css"]')) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = tripMapData.leafletCssUrl;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("Nie udało się załadować Leaflet CSS"));
      document.head.appendChild(link);
    });
  }

  /**
   * Załadować Leaflet JS
   */
  function loadLeafletJS() {
    return new Promise((resolve, reject) => {
      // Sprawdź czy już załadowany
      if (typeof L !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = tripMapData.leafletJsUrl;
      script.onload = () => {
        if (typeof L !== "undefined") {
          resolve();
        } else {
          reject(new Error("Leaflet załadowany, ale L jest undefined"));
        }
      };
      script.onerror = () => reject(new Error("Nie udało się załadować Leaflet JS"));
      document.head.appendChild(script);
    });
  }

  /**
   * Upewnić się że Leaflet jest załadowany (z cache)
   */
  async function ensureLeafletLoaded() {
    if (leafletLoaded) {
      console.log("Leaflet już załadowany (z cache)");
      return;
    }

    console.log("Ładowanie Leaflet po raz pierwszy...");

    try {
      await Promise.all([loadLeafletCSS(), loadLeafletJS()]);
      leafletLoaded = true;
      console.log("Leaflet załadowany pomyślnie");
    } catch (error) {
      console.error("Błąd ładowania Leaflet:", error);
      throw error;
    }
  }

  // ============================================
  // MAIN FUNCTIONS
  // ============================================

  /**
   * Obsługa kliknięcia w przycisk
   */
  async function handleButtonClick(e, clickedElement) {
    e.preventDefault();

    // Znajdujemy kontejner .trip-preview-btn
    const wrapper = clickedElement.classList.contains("trip-preview-btn")
      ? clickedElement
      : clickedElement.closest(".trip-preview-btn");

    // Pokazujemy loader
    showGlobalLoader("Ładowanie mapy lokacji...");

    try {
      // Krok 1: Pobieramy slug z URL
      const loopItem = wrapper.closest(".bde-loop-item");
      const postLink = loopItem ? loopItem.querySelector('a[href*="/oferta/"]') : null;

      if (!postLink) {
        throw new Error("Nie znaleziono linku do wyprawy");
      }

      const postUrl = postLink.getAttribute("href");
      const urlParts = postUrl.split("/").filter(Boolean);
      const postSlug = urlParts[urlParts.length - 1];

      console.log("Znaleziono slug wyprawy:", postSlug);

      // Krok 2: Pobieramy ID postu przez REST API
      const postsResponse = await fetch(
        `/wp-json/wp/v2/oferta?slug=${encodeURIComponent(postSlug)}&_fields=id`
      );

      if (!postsResponse.ok) {
        throw new Error("Nie udało się pobrać ID wyprawy");
      }

      const posts = await postsResponse.json();

      if (!posts || posts.length === 0) {
        throw new Error("Nie znaleziono wyprawy");
      }

      const tripId = posts[0].id;
      console.log("ID wyprawy:", tripId);

      // Krok 3: Równolegle ładujemy Leaflet i dane lokacji
      const [, locationsData] = await Promise.all([
        ensureLeafletLoaded(),
        loadTripLocations(tripId),
      ]);

      // Krok 4: Ukrywamy loader
      hideGlobalLoader();

      // Krok 5: Renderujemy content
      if (locationsData && locationsData.length > 0) {
        renderLocationsList(locationsData);
        initMap(locationsData);
      } else {
        showError("Brak lokacji dla tej wyprawy");
      }
    } catch (error) {
      console.error("Błąd:", error);
      hideGlobalLoader();
      showError(error.message || "Wystąpił błąd podczas ładowania danych");
    }
  }

  /**
   * Ładowanie lokacji przez AJAX (zwraca Promise z danymi)
   */
  async function loadTripLocations(tripId) {
    // Sprawdzenie czy tripMapData istnieje
    if (typeof tripMapData === "undefined") {
      throw new Error("Błąd konfiguracji. Skontaktuj się z administratorem.");
    }

    const formData = new FormData();
    formData.append("action", "get_trip_locations");
    formData.append("trip_id", tripId);
    formData.append("nonce", tripMapData.nonce);

    const response = await fetch(tripMapData.ajaxUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Błąd sieci");
    }

    const data = await response.json();
    console.log("AJAX Response:", data);

    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.data || "Błąd ładowania lokacji");
    }
  }

  /**
   * Pokazywanie błędu
   */
  function showError(message) {
    // Ukryj loader jeśli widoczny
    hideGlobalLoader();

    const errorHtml = `<div class="trip-map-error" style="text-align:center; padding:40px; color:#d63638;"><p>${escapeHtml(message)}</p></div>`;

    const locationsList = document.getElementById("locations-list");
    const mapContainer = document.getElementById("map-container");

    if (locationsList) locationsList.innerHTML = errorHtml;
    if (mapContainer) mapContainer.innerHTML = errorHtml;
  }

  /**
   * Renderowanie listy lokacji
   */
  function renderLocationsList(locations) {
    let html = '<div class="locations-wrapper">';

    if (locations.length === 0) {
      html +=
        '<p style="text-align:center; padding:20px;">Brak lokacji do wyświetlenia.</p>';
    } else {
      const locationIcon =
        '<svg class="location-item__icon" width="16" height="19" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.625 7.625C9.625 7.09457 9.41413 6.58601 9.03906 6.21094C8.66399 5.83587 8.15543 5.625 7.625 5.625C7.09457 5.625 6.58601 5.83586 6.21094 6.21094C5.83586 6.58601 5.625 7.09457 5.625 7.625C5.625 8.15543 5.83587 8.66399 6.21094 9.03906C6.58601 9.41413 7.09457 9.625 7.625 9.625C8.15543 9.625 8.66399 9.41413 9.03906 9.03906C9.41413 8.66399 9.625 8.15543 9.625 7.625ZM11.125 7.625C11.125 8.55326 10.756 9.44323 10.0996 10.0996C9.44323 10.756 8.55326 11.125 7.625 11.125C6.69674 11.125 5.80677 10.756 5.15039 10.0996C4.49401 9.44323 4.125 8.55326 4.125 7.625C4.125 6.69674 4.49401 5.80677 5.15039 5.15039C5.80677 4.49401 6.69674 4.125 7.625 4.125C8.55326 4.125 9.44323 4.49401 10.0996 5.15039C10.756 5.80677 11.125 6.69674 11.125 7.625Z" fill="black"/><path d="M7.98535 18.5957C7.76096 18.7186 7.48904 18.7186 7.26465 18.5957L7.625 17.9375L7.98535 18.5957ZM13.75 7.625C13.75 6.00055 13.1047 4.44261 11.9561 3.29395C10.8792 2.21708 9.44258 1.58292 7.92871 1.50781L7.625 1.5C6.00055 1.5 4.44261 2.14529 3.29395 3.29395C2.14529 4.44261 1.5 6.00055 1.5 7.625C1.5 10.6231 3.07415 13.0229 4.72363 14.7119C5.54358 15.5514 6.36625 16.1978 6.9834 16.6338C7.23794 16.8136 7.45741 16.956 7.625 17.0615C7.79259 16.956 8.01206 16.8136 8.2666 16.6338C8.88375 16.1978 9.70642 15.5514 10.5264 14.7119C12.1759 13.0229 13.75 10.6231 13.75 7.625ZM15.25 7.625C15.25 11.1735 13.3865 13.9302 11.5986 15.7607C10.7001 16.6807 9.80362 17.3848 9.13184 17.8594C8.79531 18.0971 8.51333 18.2783 8.31348 18.4014C8.21352 18.4629 8.13394 18.5106 8.07812 18.543C8.05034 18.5591 8.02827 18.5713 8.0127 18.5801C8.0049 18.5845 7.99872 18.5883 7.99414 18.5908L7.98633 18.5947C7.98633 18.5947 7.98529 18.5953 7.625 17.9375L7.26367 18.5947L7.25586 18.5908C7.25128 18.5883 7.2451 18.5845 7.2373 18.5801C7.22173 18.5713 7.19966 18.5591 7.17188 18.543C7.11606 18.5106 7.03648 18.4629 6.93652 18.4014C6.73667 18.2783 6.45469 18.0971 6.11816 17.8594C5.44638 17.3848 4.5499 16.6807 3.65137 15.7607C1.86349 13.9302 0 11.1735 0 7.625C0 5.60272 0.803434 3.66336 2.2334 2.2334C3.66336 0.803434 5.60272 0 7.625 0L8.00293 0.00976562C9.8876 0.103226 11.676 0.89277 13.0166 2.2334C14.4466 3.66336 15.25 5.60272 15.25 7.625Z" fill="black"/></svg>';

      html += '<h2 class="locations-wrapper__title">Co zobaczymy</h2>';
      html += '<div class="locations-wrapper__list">';

      locations.forEach(function (loc, index) {
        html += '<div class="location-item" data-index="' + index + '">';

        if (loc.image) {
          html +=
            '<img class="location-item__image" src="' +
            loc.image +
            '" alt="' +
            escapeHtml(loc.name) +
            '">';
        }

        html += '<div class="location-item__content">';
        html +=
          '<h3 class="location-item__title">' +
          locationIcon +
          escapeHtml(loc.name) +
          "</h3>";
        html += "</div></div>";
      });

      html += "</div>";
    }

    html += "</div>";

    const locationsList = document.getElementById("locations-list");
    if (locationsList) {
      locationsList.innerHTML = html;
    }

    // Event delegation dla kliknięcia w lokację (na kontenerze)
    if (locationsList) {
      locationsList.addEventListener("click", function (e) {
        const locationItem = e.target.closest(".location-item");
        if (!locationItem) return;

        const index = parseInt(locationItem.dataset.index, 10);

        // Usuń active ze wszystkich
        const allItems = locationsList.querySelectorAll(".location-item");
        allItems.forEach(function (item) {
          item.classList.remove("active");
        });

        // Dodaj do klikniętego
        locationItem.classList.add("active");

        // Focus na markerze
        if (markers[index]) {
          markers[index].openPopup();
          map.setView(markers[index].getLatLng(), 10);
        }
      });
    }
  }

  /**
   * Inicjalizacja mapy Leaflet
   */
  function initMap(locations) {
    // Sprawdź czy Leaflet jest załadowany
    if (typeof L === "undefined") {
      console.error("Leaflet is not loaded");
      showError("Biblioteka map nie załadowała się. Odśwież stronę.");
      return;
    }

    // Usuń poprzednią mapę jeśli istnieje
    if (map !== null) {
      map.remove();
      map = null;
    }
    markers = [];

    // Wyczyść kontener
    const mapContainer = document.getElementById("map-container");
    if (mapContainer) {
      mapContainer.innerHTML = "";
    }

    // Filtruj tylko lokacje ze współrzędnymi
    const locationsWithCoords = locations.filter(function (loc) {
      return loc.has_coordinates;
    });

    if (locationsWithCoords.length === 0) {
      if (mapContainer) {
        mapContainer.innerHTML =
          '<p style="text-align:center; padding:40px; color:#666;">Brak lokacji z podanymi współrzędnymi.</p>';
      }
      return;
    }

    // Stwórz mapę
    try {
      map = L.map("map-container", {
        scrollWheelZoom: true,
        zoomControl: true,
      });

      // Dodaj tile layer z OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 2,
      }).addTo(map);

      // Stwórz layer group dla markerów
      markersLayer = L.layerGroup().addTo(map);

      // Dodaj markery
      locationsWithCoords.forEach(function (loc, index) {
        const marker = L.marker([loc.latitude, loc.longitude]).bindPopup(
          createPopupContent(loc)
        );

        marker.addTo(markersLayer);
        markers.push(marker);
      });

      // Centruj na pierwszej lokacji z lekkim oddaleniem
      if (locationsWithCoords.length > 0) {
        const firstLoc = locationsWithCoords[0];
        map.setView([firstLoc.latitude, firstLoc.longitude], 8);
      }

      // Fix dla potential display issues
      setTimeout(function () {
        map.invalidateSize();
      }, 100);
    } catch (error) {
      console.error("Error initializing map:", error);
      showError("Błąd inicjalizacji mapy: " + error.message);
    }
  }

  /**
   * Tworzenie contentu dla popup na mapie
   */
  function createPopupContent(loc) {
    let html = '<div class="map-popup">';

    if (loc.image) {
      html +=
        '<img src="' +
        loc.image +
        '" alt="' +
        escapeHtml(loc.name) +
        '" style="border-radius: 8px; margin-bottom: 0.5rem;">';
    }

    html +=
      '<h4 style="margin: 0; font-size: 1rem;">' +
      escapeHtml(loc.name) +
      "</h4>";
    html += "</div>";

    return html;
  }

  /**
   * Escape HTML dla bezpieczeństwa
   */
  function escapeHtml(text) {
    const htmlMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return String(text).replace(/[&<>"']/g, function (m) {
      return htmlMap[m];
    });
  }

  /**
   * Debug info (tylko w konsoli)
   */
  if (window.location.search.indexOf("debug_trip_map=1") !== -1) {
    console.log("=== KOSTARYKA TRIP MAP DEBUG ===");
    console.log(
      "tripMapData:",
      typeof tripMapData !== "undefined" ? tripMapData : "NOT LOADED"
    );
    console.log(
      "Leaflet (L):",
      typeof L !== "undefined" ? "LOADED" : "NOT LOADED (lazy)"
    );
    console.log("leafletLoaded flag:", leafletLoaded);
    console.log("Mode: Vanilla JS + Lazy Loading");
    console.log("================================");
  }
})();
