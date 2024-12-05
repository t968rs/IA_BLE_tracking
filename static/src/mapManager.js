// In mapManager.js
let mapInstance;

export function initializeMap(options) {
    mapInstance = new mapboxgl.Map(options);
    return mapInstance;
}

export function getMap() {
    return mapInstance;
}
