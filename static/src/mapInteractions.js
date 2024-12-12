import {whichGrid} from "/static/src/legendControls.js";

const DEBUG_STATUS = true;
const dC = (message) => {
    if (DEBUG_STATUS) {
        console.debug(message);
    }
};

function rangePercent(start, stop, step) {
    dC("Start: ", start, " Stop: ", stop, " Step: ", step);
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        dC("Step is undefined", step);
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    let result = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }
    result.push(100);
    const resSet = new Set(result);
    result = Array.from(resSet);
    dC("Result: ", result);
    return result;
}

// Function to disable text selection globally
export function disableTextSelection() {
    document.body.style.userSelect = "none";
    document.body.style.msUserSelect = "none";
    document.body.style.mozUserSelect = "none";
}

// Function to re-enable text selection
export function enableTextSelection() {
    document.body.style.userSelect = "";
    document.body.style.msUserSelect = "";
    document.body.style.mozUserSelect = "";
}

let unwanted = ["OID_", "OID", "OBJECTID", "GlobalID", "Shape__Area",
    "Shape__Length", "Shape__Are", "Shape__Len", "Shape__Area_", "States", "GlobalID"];
// List of unwanted substrings
let unwantedSubstrings = ["area", "acre", "sq_k", "final", "tie", "nee", "_ac", "mo", "shape", "nee",
" ac", "global", "legend"];

// Function to check if a property name contains any unwanted substrings
function containsUnwantedSubstring(property) {
    return unwantedSubstrings.some(substring => property.toLowerCase().includes(substring));
}


export function showIt(docElementPassed) {
    // docElementPassed.style.display = 'block';
    docElementPassed.classList.remove("hidden");
}

export function hideIt(docElementPassed) {
    // docElementPassed.style.display = 'none';
    docElementPassed.classList.add("hidden");
    docElementPassed.remove();
}

// Function to create popup content with table formatting
export async function areaPopupContent(clickedfeature, addONS, attributes) {
    let popupContent = '<div class="popup-table-title">Iowa BLE Area Info</div>';
    popupContent += '<table class="popup-table">';



    // Add feature properties
    for (let property in clickedfeature.properties) {
        if (!unwanted.includes(property) && !containsUnwantedSubstring(property)) {
            let displayValue, displayProperty;
            if (property === "which_grid") {
                displayValue = whichGrid[clickedfeature.properties[property]];
                displayProperty = "Grids TODO";
            } else {
                displayValue = clickedfeature.properties[property];
                displayProperty = property.replace(/_/g, ' ')
                                          .replace('  ', ' ')
                                          .replace("Su", "Submit")
                                          .replace("Mapping In", "Ph1 Mapped By")
                                          .replace("Perc", "%");
            }
            popupContent += `<tr><td><strong>${displayProperty}</strong></td><td>${displayValue}</td></tr>`;
        }
    }

    // Add attributes from the CSV
    const featureHUC8 = clickedfeature.properties?.HUC8; // Ensure the feature has a valid HUC8
    if (featureHUC8 && attributes && attributes[featureHUC8]) {
        const featureAttributes = attributes[featureHUC8];
        const featName = featureAttributes.Name || featureHUC8;
        popupContent += `<tr><td><strong>Name</strong></td><td>${featName}</td></tr>`;
        for (let [key, value] of Object.entries(featureAttributes)) {
            if (value !== featureHUC8 && value !== featName) {
                popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
            }
        }
    } else if (!featureHUC8) {
        console.warn('Feature is missing HUC8 for attribute matching.');
    } else {
        console.warn(`No additional attributes found for HUC8: ${featureHUC8}`);
    }

    // Add additional information if provided
    if (addONS !== undefined && addONS !== null && addONS !== "" && addONS !== " ") {
        for (let [key, value] of Object.entries(addONS)) {
            popupContent += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
        }
    }

    popupContent += '</tbody></table>';

    // Fit the map to the popup and feature
    const featureBounds = getFeatureBounds(clickedfeature);

    return [popupContent, featureBounds];
}

// Function to fit the map to the bounds of the popup and its feature
function getFeatureBounds(feature) {
    if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
        console.error('Invalid feature object provided:', feature);
        return null;
    }

    const featureBounds = new mapboxgl.LngLatBounds();

    // Flatten coordinates and validate each pair
    const coordinates = feature.geometry.coordinates.flat(Infinity);
    if (coordinates.length % 2 !== 0) {
        console.error('Invalid coordinates length. Expected pairs of longitude and latitude:', coordinates);
        return null;
    }

    for (let i = 0; i < coordinates.length; i += 2) {
        const lng = coordinates[i];
        const lat = coordinates[i + 1];
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            featureBounds.extend([lng, lat]);
        } else {
            console.error(`Invalid coordinate: [${lng}, ${lat}]`);
        }
    }

    return featureBounds.isEmpty() ? null : featureBounds;
}

// Function to close the popup
export function closePopup() {
    dC("closePopup function called");
    const popup = document.querySelector('.popup-container .close-btn, .mapboxgl-popup-content .close-btn');
    if (popup) {
        dC("Popup element found:", popup);
        popup.style.display = 'none';
        hideIt(popup);
        dC("Popup close clicked");
    } else {
        console.error('Popup element not found');
    }
}

