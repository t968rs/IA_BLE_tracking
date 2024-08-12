// Function to create popup content


let unwanted = ["OID_", "OID", "OBJECTID", "info_src", "cur_miss", "route_id", "GlobalID", "Shape__Area",
    "Shape__Length", "Shape__Are", "Shape__Len", "Shape__Area_", "States"];
// List of unwanted substrings
let unwantedSubstrings = ["area", "acre", "sq_k", "final", "tie", "nee", "_ac", "mo"];

// Function to check if a property name contains any unwanted substrings
function containsUnwantedSubstring(property) {
    return unwantedSubstrings.some(substring => property.toLowerCase().includes(substring));
}

export async function areaPopupContent(clickedfeature) {
    // Fetch the alias mapping JSON file
    let popupContent = '<strong><p style="font-size: 14px;">Iowa BLE Area Info</strong><p>';
    for (let property in clickedfeature.properties) {

        if (!unwanted.includes(property) && !containsUnwantedSubstring(property)) {
            let value = clickedfeature.properties[property];
            let displayProperty = property.replace(/_/g, ' ')
                .replace('  ', ' ').replace("Su", "Submit")
                .replace("Mapping In", "Ph1 Mapped By");
            popupContent += `<p><strong>${displayProperty}</strong>: ${value}</p>`

        }
    }
    return popupContent;
}

export async function createRouteLinePopupContent(clickedfeature) {
    // Fetch the alias mapping JSON file
    let popupContent = '<strong><p style="font-size: 16px;">Route Information </strong><p>';
    const response = await fetch('./data/routes_columns.json');
    const columnDictionaries = await response.json();
    const aliasMapping = columnDictionaries['field_aliases'];
    console.log("Route Alias Mapping: ", Object.keys(aliasMapping));

    // Generate the popup content
    for (let property in clickedfeature.properties) {
        // Use alias if available, otherwise use the original property name
        const aliasProperty = aliasMapping[property] || property;
        if (!unwanted.includes(property)) {
            let value = clickedfeature.properties[property];

            // Check if the property name includes 'date' and matches the specific pattern
            if (property.toLowerCase().includes('date') && typeof value === 'string'
                && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                value = value.substring(0, 10); // Extract the date part
            } else if (typeof value === "number") {
                // Check if the value is a float and limit the decimals
                if (!Number.isInteger(value)) {
                    value = value.toFixed(1); // Limit to 2 decimal places
                }
            } else if (property === "cur_miss") {
                let shorterText = value.substring(0, 42);
                popupContent += `<p><strong>${aliasProperty}</strong>: ${shorterText}</p>`;
                continue; // Skip the default addition for this property
            }

            popupContent += `<p><strong>${aliasProperty}</strong>: ${value}</p>`;
        }
    }
    return popupContent;
}

// Function to fit map to the bounds of the specified layer
export function fitMapToFeatureBounds(map, feature) {
    // Create a new LngLatBounds object
    const bounds = new mapboxgl.LngLatBounds();

    // Get the coordinates of the feature
    const geo = feature.geometry;

    const turfBbox = turf.bbox(geo);
    console.log("Turf BBOX: ", turfBbox);
    const bboxBounds = new mapboxgl.LngLatBounds(
        [turfBbox[0], turfBbox[1]], // Southwest corner
        [turfBbox[2], turfBbox[3]]  // Northeast corner
    );

    // Fit the map to the bounds with a larger padding to zoom out more, a max zoom of 15, and a duration of 1000
    map.fitBounds(bboxBounds, {
        padding: 30,  // Increase the padding to zoom out more
        maxZoom: 15,
        minZoom: 3,
        duration: 1000
    });
    const currentZoom = map.getZoom();
    // Log the new map bounds and zoom level after fitting
    map.once('moveend', () => {
        const newBounds = map.getBounds();
        const newZoom = map.getZoom();
        console.log("New Map Bounds after fitting:", newBounds);
        console.log("New Zoom after fitting:", newZoom);

        // Workaround: Manually set the map bounds if the automatic fitBounds method fails
        if (newBounds._sw.lat < -90 || newBounds._ne.lat > - 75 || newBounds._sw.lng < 30 || newBounds._ne.lng > 50) {
            console.warn("Automatic fitBounds failed, manually setting bounds.");
            map.fitBounds(new mapboxgl.LngLatBounds(swCorner, neCorner));
        }
    });
    console.log("SW: ", swCorner, "NE: ", neCorner);
    console.log("Current Zoom: ", currentZoom);
}

// Function to ensure the popup fits within the current map bounds
export function ensurePopupFits(map, popup, coordinates) {
    // Get the current map bounds
    const mapBounds = map.getBounds();

    // Create a new LngLatBounds object for the popup
    const popupBounds = new mapboxgl.LngLatBounds();

    // Calculate the popup's bounding box
    const popupWidth = 200; // Approximate width of the popup in pixels
    const popupHeight = 100; // Approximate height of the popup in pixels
    const popupOffset = popup.options.offset || [0, 0];

    // Convert pixel dimensions to map coordinates
    const sw = map.unproject([coordinates[0] - popupWidth / 2 + popupOffset[0], coordinates[1] + popupHeight / 2 + popupOffset[1]]);
    const ne = map.unproject([coordinates[0] + popupWidth / 2 + popupOffset[0], coordinates[1] - popupHeight / 2 + popupOffset[1]]);

    popupBounds.extend(sw);
    popupBounds.extend(ne);

    // Check if the popup's bounding box fits within the current map bounds
    if (!mapBounds.contains(popupBounds.getSouthWest()) || !mapBounds.contains(popupBounds.getNorthEast())) {
        // Adjust the map center to ensure the popup is fully visible
        const newCenter = [
            (popupBounds.getWest() + popupBounds.getEast()) / 2,
            (popupBounds.getSouth() + popupBounds.getNorth()) / 2
        ];
        map.setCenter(newCenter);
    }
}

// Function to close the popup
export function closePopup() {
    const popup = document.getElementById('top-left-popup');
    if (popup) {
        popup.style.display = 'none';
    } else {
        console.error('Popup element not found');
    }
}


/*// Example of updating the popup content and displaying the popup
function updatePopupContent(content) {
    const popup = document.getElementById('top-left-popup');
    const contentElement = document.getElementById('popup-content');
    if (!popup || !contentElement) {
        console.error('Popup or content element not found');
        return;
    }
    contentElement.innerHTML = content;
    popup.style.display = 'block';
}*/
