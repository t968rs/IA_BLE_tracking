// /static/src/mapLoader.js

/**
 * Dynamically loads the Mapbox GL JS script and CSS.
 * @returns {Promise<void>} Resolves when both script and CSS are loaded.
 */
export function loadMapboxGL() {
    return new Promise((resolve, reject) => {
        // Check if Mapbox GL JS is already loaded
        if (window.mapboxgl) {
            resolve();
            return;
        }

        // Create and append the Mapbox GL JS script
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js';
        script.async = true;

        script.onload = () => {
            // Once the script is loaded, load the CSS
            const link = document.createElement('link');
            link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css';
            link.rel = 'stylesheet';
            link.onload = () => resolve();
            link.onerror = () => reject(new Error('Failed to load Mapbox GL CSS'));
            document.head.appendChild(link);
        };

        script.onerror = () => reject(new Error('Failed to load Mapbox GL JS'));

        document.head.appendChild(script);
    });
}

/**
 * Initializes the Mapbox map with given options.
 * @param {Object} options - Configuration options for the map.
 * @param {string} options.container - HTML element ID for the map container.
 * @param {string} options.style - Map style URL.
 * @param {Array} options.controls - Array of control configurations.
 * @param {string} options.token - Mapbox access token.
 * @returns {mapboxgl.Map} Initialized Mapbox map instance.
 */
export function initializeMapboxMap(options) {
    if (!window.mapboxgl) {
        console.error('Mapbox GL JS is not loaded.');
    }

    mapboxgl.accessToken = options.token;

    const map = new mapboxgl.Map({
        container: options.container,
        style: options.style,
        center: options.center,
        zoom: options.zoom,
        minZoom: options.minZoom,
        projection: options.projection,
    });

    // Add controls if any
    if (options.controls && Array.isArray(options.controls)) {
        options.controls.forEach(controlConfig => {
            if (controlConfig.type && mapboxgl[controlConfig.type]) {
                const Control = mapboxgl[controlConfig.type];
                const controlInstance = new Control(controlConfig.options || {});
                map.addControl(controlInstance);
            }
        });
    }

    return map;
}
