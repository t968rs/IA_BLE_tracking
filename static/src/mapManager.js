let mapInstance = null;

export function initializeMap(options) {
    if (!mapInstance) {
        mapInstance = new mapboxgl.Map(options);
    }
    return mapInstance;
}

export function getMap() {
    return mapInstance;
}
