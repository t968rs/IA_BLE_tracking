import { whichGrid} from "/static/src/legendControls.js";


let unwanted = ["OID_", "OID", "OBJECTID", "GlobalID", "Shape__Area",
    "Shape__Length", "Shape__Are", "Shape__Len", "Shape__Area_", "States", "GlobalID"];
// List of unwanted substrings
let unwantedSubstrings = ["area", "acre", "sq_k", "final", "tie", "nee", "_ac", "mo", "shape", "nee",
    " ac", "global", "legend"];

// Function to check if a property name contains any unwanted substrings
function containsUnwantedSubstring(property) {
    return unwantedSubstrings.some(substring => property.toLowerCase().includes(substring));
}


function formatKeyValueNames(key, value) {
    let displayValue, displayKey;
    if (key === "which_grid") {
        displayValue = whichGrid[key];
        displayKey = "Grids TODO";
    } else {
        displayValue = value;
        displayKey = key
            .replace(/_/g, ' ')
            .replace('  ', ' ')
            .replace("Su", "Submit")
            .replace("Mapping In", "Ph1 Mapped By")
            .replace("Perc", "%");
    }
    return [displayKey, displayValue];
}

// Function to create popup content with table formatting
export async function areaPopupContent(clickedfeature, addONS, attributes) {
    let popupContent = `
        <div class="popup-table-title">Iowa BLE Area Info</div>
        <div class="popup-table-wrapper">
            <table id="this-popup-table" class="popup-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
    `;

    // Add feature properties
    const propertiesAdded = []
    for (let property in clickedfeature.properties) {
        if (!unwanted.includes(property) && !containsUnwantedSubstring(property)) {
            let displayValue, displayProperty;
            [displayProperty, displayValue] = formatKeyValueNames(property,
                clickedfeature.properties[property]);
            if (!propertiesAdded.includes(displayProperty)) {
                popupContent += `<tr><td><strong>${displayProperty}</strong></td><td>${displayValue}</td></tr>`;
                propertiesAdded.push(displayProperty);
            }
        }
    }

    // Add attributes from CSV
    const featureHUC8 = clickedfeature.properties?.HUC8;
    if (featureHUC8 && attributes && attributes[featureHUC8]) {
        const featureAttributes = attributes[featureHUC8];
        const featName = featureAttributes.Name || featureHUC8;

        for (let [key, value] of Object.entries(featureAttributes)) {
            if (value !== featureHUC8 && value !== featName && !propertiesAdded.includes(key)) {
                [key, value] = formatKeyValueNames(key, value);
                popupContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                propertiesAdded.push(key);
            }
        }
    } else if (!featureHUC8) {
        console.warn('Feature is missing HUC8 for attribute matching.');
    } else {
        console.warn(`No additional attributes found for HUC8: ${featureHUC8}`);
    }

    // Add additional info if provided
    if (addONS !== undefined && addONS !== null && addONS !== "") {
        for (let [key, value] of Object.entries(addONS)) {
            if (!propertiesAdded.includes(key)) {
                [key, value] = formatKeyValueNames(key, value);
                popupContent += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
                propertiesAdded.push(key);}
        }
    }

    // Close the table and wrapper
    popupContent += `
              </tbody>
            </table>
        </div>
    `;

    // Fit map to feature bounds
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


// Initialize DataTables on the popup table
export async function initializeDataTable(tableId) {
    if ( !$.fn.dataTable.isDataTable(tableId) ) {
        $(tableId).DataTable({
            paging: false,
            searching: false,
            destroy: true,
            info: false,
            autoWidth: false,
            ordering: false, // Disable all column ordering
            dom: 't',
            columnDefs: [{
                targets: '_all',
                className: 'wrap-cell' // A custom class to enable wrapping
            }],
            scrollY: '30vh',
            scrollCollapse: true,
            responsive: true,
            initComplete: function() {
                $('body').find('.dt-scroll-body').addClass("scrollbar");
            },
        });
    }
}