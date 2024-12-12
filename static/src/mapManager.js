// mapManager.js
const DEBUG_STATUS = true;
const dC = (message) => {
    if (DEBUG_STATUS) {
        console.debug(message);
    }
};

export async function getMapBoxToken() {
       try {
           const response = await fetch('/mapbox-token/');
           const data = await response.json();
           dC("env:", data);  // Check the exact key name here
           mapboxgl.accessToken = data.MAPBOX_TOKEN;  // Check this key name matches server-side response
           return mapboxgl.accessToken;
       } catch (error) {
           console.error("Error fetching Mapbox token:", error);
           throw error;
       }
   }

let mapInstance;
let tableLoaded = false; // This will store the table load state

export function getMap() {
    return mapInstance;
}

export function setMap(map) {
    // receive a map instance from another js
    mapInstance = map;
}

export async function createColorStops(featureCollection, fieldName = "HUC8") {
    try {
        // Ensure featureCollection has a 'features' array
        if (!featureCollection.features || !Array.isArray(featureCollection.features)) {
            try {
                featureCollection = convertNestedDictToFeatureCollection(featureCollection)
            } catch (e) {
                console.error(e);
            }
        }
        const fieldValues = featureCollection.features.map(feature => Number(feature.properties[fieldName]));
        const uniqueValues = [...new Set(fieldValues)].sort((a, b) => a - b);
        if (DEBUG_STATUS) {console.debug("Unique Field", fieldName, "Values:", uniqueValues);}

        let colorRamp = [
            '#8c0700', '#9f00c3', '#0045ac', '#00370d',
            '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'
        ];

        colorRamp = colorRamp.slice(0, Math.min(colorRamp.length, uniqueValues.length));

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
        return response.json();
    } catch (error) {
        console.error("Error fetching GeoJSON:", error);
        throw error;
    }
}

/**
 * Converts a nested dictionary of attributes into a GeoJSON FeatureCollection.
 * Each key in the dictionary becomes a Feature with that key as the Feature id.
 * Since no geometry is provided, geometry is set to null.
 *
 * @param {Object} nestedDict - The nested dictionary with HUC8 as keys and their attributes as values.
 * @returns {Object} - A GeoJSON FeatureCollection.
 */
export function convertNestedDictToFeatureCollection(nestedDict) {
    try {
        const features = Object.entries(nestedDict).map(([outerKey, attributes]) => {
            if (typeof attributes !== 'object' || attributes === null) {
                throw new Error(`Attributes for key ${outerKey} must be a non-null object.`);
            }

            // Ensure the HUC8 field is consistent and present (if desired)
            // If not needed, you could omit this step.
            if (!attributes.HUC8) {
                attributes.HUC8 = outerKey;
            }

            return {
                type: "Feature",
                id: outerKey,
                properties: { ...attributes },
                geometry: null // No geometry provided in the data, set to null
            };
        });

        return {
            type: "FeatureCollection",
            features: features
        };
    } catch (error) {
        console.error("Error converting nested dictionary to FeatureCollection:", error);
        return {
            type: "FeatureCollection",
            features: []
        };
    }
}

// Functions to manage table load state
export function isTableLoaded() {
    return tableLoaded;
}

export function setTableLoaded(status) {
    tableLoaded = status;
}

