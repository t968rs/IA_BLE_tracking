// mapManager.js
let mapInstance;
let tableLoaded = false; // This will store the table load state

export function initializeMap(options) {
    mapInstance = new mapboxgl.Map(options);
    return mapInstance;
}

export function getMap() {
    return mapInstance;
}

export async function createColorStops(serverResponse, fieldName = "HUC8") {
    try {
        const data = await serverResponse.json();
        const fieldValues = data.features.map(feature => Number(feature.properties[fieldName]));
        const uniqueValues = [...new Set(fieldValues)].sort((a, b) => a - b);
        console.debug("Unique Field", fieldName, "Values:", uniqueValues);

        const colorRamp = [
            '#8c0700', '#9f00c3', '#0045ac', '#00370d',
            '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'
        ];

        return uniqueValues.flatMap((value, index) => [
            value, colorRamp[index % colorRamp.length]
        ]);
    } catch (error) {
        console.error("Error creating color stops:", error);
        return [];
    }
}

export async function fetchGeoJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
        }
        return response;
    } catch (error) {
        console.error("Error fetching GeoJSON:", error);
        throw error;
    }
}

// Functions to manage table load state
export function isTableLoaded() {
    return tableLoaded;
}

export function setTableLoaded(status) {
    tableLoaded = status;
}
