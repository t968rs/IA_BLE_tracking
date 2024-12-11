const DEBUG_STATUS = true;
import { debugConsole } from "./debugging.js";
let dC;
if (!DEBUG_STATUS) { dC = () => {}; } else { dC = debugConsole; }

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

let whichGrid = {'0, 1, 2': "No Grids",
    '1, 2': "DRAFT, Add'l Ret", '2': "Add'l Ret", "All on MM": "All on MM"};

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

// Function to create legend items
export async function createLegendItem(color, label, isAlias = false, isCircle = false) {
    const item = document.createElement('div');
    const key = document.createElement('span');
    if (isAlias) {key.className = 'legend-title';}
    if (isCircle) {key.className = 'legend-key-circle';}
    else {key.className = 'legend-key';}
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

    // Iterate through the specified layers
    const groupLayers = {};
    for (const layer of mapLayers) {
        for (const [group, layer_id] of Object.entries(layersToInclude)) {
            if (layer_id.includes(layer.id)) {
                const visibility = map.getLayoutProperty(layer_id, 'visibility');
                if (visibility === 'visible') {
                    groupLayers[group] = layer;
                }
            }
        }
    }

    for (const [group, map_lyr] of Object.entries(groupLayers)) {
        if (map_lyr && map_lyr.paint) {
            if (!["Updates", "TODOs"].includes(group)) {
                // Group Heading
                const heading = document.createElement('div');
                heading.className = 'legend-group';
                const headingWords = document.createElement('span');
                headingWords.style.height = '11px'; // Adjust the height as needed
                headingWords.innerHTML = group;
                heading.appendChild(headingWords);
                legend.appendChild(heading);
            }

            const paint = map_lyr.paint;
            let colorProperty = "";
            const colorProps = Object.keys(paint).filter(c => c.includes('color'));
            if ("fill-color" in colorProps) {
                colorProperty = paint['fill-color'];
            } else {
                colorProperty = paint[colorProps[0]];
            }

            if (colorProperty && typeof colorProperty === 'string') {
                const aliasItem = await createLegendItem('', "", true);
                legend.appendChild(aliasItem);

                if (colorProperty !== '* other *') {
                    const c = await createLegendItem(colorProperty, group, false, true);
                    legend.appendChild(c);
                }
            }

            if (colorProperty && Array.isArray(colorProperty)) {
                let colorMapping = colorProperty.slice(2, -1);

                await createLegendItem('', group, true);

                for (let i = 0; i < colorMapping.length; i += 2) {
                    let propertyValue = colorMapping[i];
                    const color = colorMapping[i + 1];

                    if (propertyValue !== '* other *') {
                        if (group === "Grid Status") {
                            const displayValue = whichGrid[propertyValue] || propertyValue;
                            const item = await createLegendItem(color, displayValue);
                            legend.appendChild(item);
                        } else if (group === "Production Status" || group === "BFE TODO") {
                            const item = await createLegendItem(color, propertyValue);
                            legend.appendChild(item);
                        } else {
                            const item = await createLegendItem(color, propertyValue);
                            legend.appendChild(item);
                        }
                    }
                }
            }
        }
    // Add a small gap between legend items
    const gap = document.createElement('div');
    gap.style.height = '10px'; // Adjust the height as needed
    legend.appendChild(gap);
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

export function createLayerControls(map, layerGroups, Centroids) {
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
        if (group in Centroids) {
            dC("Group: ", group);
            let thisCentroid = Centroids[group]["Centroid"];
            let thisZoom = Centroids[group]["Zoom"];
            dC("Centroid: ", thisCentroid);
            const zoomCell = document.createElement('td');
            const zoomToLayerButton = document.createElement('zoom-to-button');
            dC("Zoom Button: ", zoomToLayerButton);
            zoomToLayerButton.textContent = 'Z2L';
            zoomToLayerButton.addEventListener('click', () => {
                map.jumpTo({
                    center: thisCentroid,
                    zoom: thisZoom,
                });
            });
            zoomCell.appendChild(zoomToLayerButton);
            groupRow.appendChild(zoomCell);
        }
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
    // dC("Layers: ", typeof layers);
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

