// In mapManager.js
let mapInstance;

export function initializeMap(options) {
    mapInstance = new mapboxgl.Map(options);
    return mapInstance;
}

export function getMap() {
    return mapInstance;
}

export async function createColorStops(serverResponse, fieldName="HUC8") {
    try {

        const data = await serverResponse.json();

        // Extract and process unique field values
        const fieldValues = data.features.map(feature => Number(feature.properties.fieldName));
        const uniqueValues = [...new Set(fieldValues)].sort((a, b) => a - b);
        console.debug("Unique Field",  fieldName, "Values:", uniqueValues);

        // Define the diverging color scheme
        const colorRamp = [
            '#8c0700', '#9f00c3', '#0045ac', '#00370d', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'
        ];

        // Create color stops based on unique field values
        return uniqueValues.flatMap((value, index) => [
            value, colorRamp[index % colorRamp.length]
        ]);
    } catch (error) {
        console.error("Error creating color stops:", error);
        return []; // Return an empty array as a fallback
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
        throw error; // Re-throw to handle it further up the chain if needed
    }
}
