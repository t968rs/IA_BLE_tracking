// Function to create popup content


let unwanted = ["OID_", "OID", "OBJECTID", "info_src", "cur_miss", "route_id"];
export async function areaPopupContent(clickedfeature) {
    // Fetch the alias mapping JSON file
    let popupContent = '<strong><p style="font-size: 16px;">Iowa BLE Area Info</strong><p>';
    for (let property in clickedfeature.properties) {

        if (!unwanted.includes(property)) {
            let value = clickedfeature.properties[property];
            if (property.toLowerCase().includes('date') && typeof value === 'string'
            && value.toLowerCase().match("t"))
            console.log("T Value: ", value);
            popupContent += `<p><strong>${property}</strong>: ${value}</p>`

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
    const coordinates = feature.geometry.coordinates;
    const geo = feature.geometry;

    const turfBbox = turf.bbox(geo);
    console.log("Turf BBOX: ", turfBbox);

    // Fit the map to the bounds with a larger padding to zoom out more, a max zoom of 15, and a duration of 1000
    map.fitBounds(turfBbox, {
        padding: 30,  // Increase the padding to zoom out more
        maxZoom: 15,
        minZoom: 3,
        duration: 1000
    });
    const currentZoom = map.getZoom();
    console.log("Current Zoom: ", currentZoom);
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

// Import proj4 library
export function convertCoordinates(coords) {
    // Define the EPSG:3417 and EPSG:4326 projections
    const epsg3417 = '+proj=lcc +lat_1=42.066667 +lat_2=43.266667 +lat_0=41.5 +lon_0=-93.5 +x_0=152400.3048 +y_0=30480.06096 +datum=NAD83 +units=m +no_defs';
    const epsg4326 = proj4.WGS84;

    // Convert coordinates from EPSG:3417 to EPSG:4326
    return proj4(epsg3417, epsg4326, coords);
}
import proj4 from 'proj4';


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
