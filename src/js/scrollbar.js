/**
 * Kostaryka global scrollbar - CSS-only entry.
 * Vite needs a JS entry to emit dist/scrollbar.css. Only the CSS is enqueued (see
 * Kostaryka_Trip_Map::enqueue_global_styles()); dist/scrollbar.js is not loaded on the site.
 */
import '../css/scrollbar.css';
