// Add event listeners to the close buttons
document.addEventListener('DOMContentLoaded', () => {
    const closeLegendButton = document.querySelector('#legend .close-btn');
    if (closeLegendButton) {
        closeLegendButton.addEventListener('click', closeLegend);
    }

    const closePopupButton = document.querySelector('.popup-container .close-btn');
    if (closePopupButton) {
        closePopupButton.addEventListener('click', closePopup);
    }
});

let whichGrid = {'0, 1, 2': "No Grids",
    '1, 2': "DRAFT, Add'l", '2': "Add'l", "All on MM": "All on MM"};

let unwanted = ["OID_", "OID", "OBJECTID", "info_src", "cur_miss", "route_id", "GlobalID", "Shape__Area",
    "Shape__Length", "Shape__Are", "Shape__Len", "Shape__Area_", "States", "GlobalID"];
// List of unwanted substrings
let unwantedSubstrings = ["area", "acre", "sq_k", "final", "tie", "nee", "_ac", "mo", "shape", "nee",
" ac", "global"];

// Function to check if a property name contains any unwanted substrings
function containsUnwantedSubstring(property) {
    return unwantedSubstrings.some(substring => property.toLowerCase().includes(substring));
}

// Function to create popup content with table formatting
export async function areaPopupContent(clickedfeature) {
    let popupContent = '<strong><p style="font-size: 14px;">Iowa BLE Area Info</strong><p>';
    popupContent += '<table class="popup-table"><thead><tr><th></th><th></th></tr></thead><tbody>';

    for (let property in clickedfeature.properties) {
        if (!unwanted.includes(property) && !containsUnwantedSubstring(property)) {
            let displayValue, displayProperty;
            if (property === "which_grid") {
                displayValue = whichGrid[clickedfeature.properties[property]];
                displayProperty = "Grids TODO"
            } else {
                displayValue = clickedfeature.properties[property];
                displayProperty = property.replace(/_/g, ' ')
                    .replace('  ', ' ').replace("Su", "Submit")
                    .replace("Mapping In", "Ph1 Mapped By")
            }
            popupContent += `<tr><td><strong>${displayProperty}</strong></td><td>${displayValue}</td></tr>`;
        }
    }

    popupContent += '</tbody></table>';
    return popupContent;
}

// Function to create legend items
export async function createLegendItem(color, label, isAlias = false) {
    const item = document.createElement('div');
    const key = document.createElement('span');
    if (!isAlias) {key.className = 'legend-key';}
    else {key.className = 'legend-title';}
    key.style.backgroundColor = color;

    const value = document.createElement('span');
    value.innerHTML = label;
    if (isAlias) {
        value.style.fontWeight = 'bold';
        value.style.fontFamily = 'Century Gothic';
    }

    item.appendChild(key);
    item.appendChild(value);
    return item;
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
// Function to close the popup
export function closePopup() {
    const popup = document.querySelector('.popup-container');
    if (popup) {
        popup.style.display = 'none';
    } else {
        console.error('Popup element not found');
    }
}


// Function to populate the legend
export async function populateLegend(map, layersToInclude) {
    const legend = document.getElementById('legend');
    if (!legend) {
        console.error('Legend element not found');
        return;
    }
    legend.innerHTML = ''; // Clear existing legend items

    const mapStyle = map.getStyle();
    if (!mapStyle || !mapStyle.layers) {
        console.error('Map style or layers not found');
        return;
    }
    const mapLayers = mapStyle.layers;
    console.log("Map Layers: ", mapLayers);

    // Iterate through the specified layers
    const groupLayers = {};
    for (const layer of mapLayers) {
        for (const [group, groupLayersList] of Object.entries(layersToInclude)) {
            if (allVisibleinGroup(map, groupLayersList) === 'visible' && groupLayersList.includes(layer.id)) {
                groupLayers[group] = layer; // Skip groups that do not have all layers visible
                break;
            }
        }
    }

    // console.log("Group Layers: ", groupLayers);
    for (const [group, layer] of Object.entries(groupLayers)) {
            const layerId = layer.id;
            console.log("Layer ID: ", layerId, " Layer: ", layer);
            if (layer && layer.paint) {
                const paint = layer.paint;
                console.log(" Paint TYPE: ", typeof paint);

                const colorProperty = paint['fill-color'];
                console.log("  Color Property: ", colorProperty);
                if (colorProperty && Array.isArray(colorProperty) && colorProperty[0] === 'match') {
                    const colorMapping = colorProperty.slice(2, -1);

                    // Add alias name once
                    const aliasItem = await createLegendItem('', group, true);
                    legend.appendChild(aliasItem);

                    for (let i = 0; i < colorMapping.length; i += 2) {
                        const propertyValue = colorMapping[i];
                        const color = colorMapping[i + 1];

                        // Skip "other" or "*" values
                        if (propertyValue !== '* other *') {
                            const displayValue = whichGrid[propertyValue] || propertyValue;
                            const item = await createLegendItem(color, displayValue);
                            legend.appendChild(item);
                        }
                    }
                }
        }
        }
}

// Function to update the legend based on layer visibility
export function updateLegendOnVisibilityChange(map, layersToInclude) {
    map.on('data', async (e) => {
        if (e.dataType === 'source' && e.isSourceLoaded) {
            await populateLegend(map, layersToInclude);
        }
    });

    // Add event listener for layer visibility change
    map.on('idle', async () => {
        await populateLegend(map, layersToInclude);
    });
}

export function createLayerControls(map, layerGroups) {
    const controlTable = document.getElementById('layer-controls-table');
    if (!controlTable) {
        console.error('Layer controls table not found');
        return;
    }

    for (const [group, layers] of Object.entries(layerGroups)) {
        const groupRow = document.createElement('tr');

        const checkboxCell = document.createElement('td');
        const groupCheckbox = document.createElement('input');
        groupCheckbox.type = 'checkbox';

        groupCheckbox.checked = allVisibleinGroup(map, layers) === 'visible';

        groupCheckbox.addEventListener('change', () => toggleLayerGroup(map, layers, groupCheckbox.checked));
        checkboxCell.appendChild(groupCheckbox);

        const labelCell = document.createElement('td');
        const groupLabel = document.createElement('label');
        groupLabel.textContent = group;
        labelCell.appendChild(groupLabel);

        groupRow.appendChild(checkboxCell);
        groupRow.appendChild(labelCell);
        controlTable.appendChild(groupRow);
    }
}

function toggleLayerGroup(map, layers, visibility) {
    layers.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visibility ? 'visible' : 'none');
        }
    });
}

function allVisibleinGroup(map, layers) {
    console.log("Layers: ", typeof layers);
    layers = convertToArray(layers);
    const allVisible = layers.every(layerId => {
        const visibility = map.getLayoutProperty(layerId, 'visibility');
        return visibility !== 'none';
    });
    return allVisible ? 'visible' : 'none';
}

function convertToArray(obj) {
    if (Array.isArray(obj)) {
        return obj; // Already an array
    } else {
        return Object.values(obj); // Convert object to array
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
