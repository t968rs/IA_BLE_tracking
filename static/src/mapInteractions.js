

function rangePercent(start, stop, step) {
    console.log("Start: ", start, " Stop: ", stop, " Step: ", step);
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        console.log("Step is undefined", step);
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
    console.log("Result: ", result);
    return result;
}

let whichGrid = {'0, 1, 2': "No Grids",
    '1, 2': "DRAFT, Add'l Ret", '2': "Add'l Ret", "All on MM": "All on MM"};

let unwanted = ["OID_", "OID", "OBJECTID", "GlobalID", "Shape__Area",
    "Shape__Length", "Shape__Are", "Shape__Len", "Shape__Area_", "States", "GlobalID"];
// List of unwanted substrings
let unwantedSubstrings = ["area", "acre", "sq_k", "final", "tie", "nee", "_ac", "mo", "shape", "nee",
" ac", "global", "legend"];

let allLegendValues = [];
let percentLegendRamp = {};

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
export async function areaPopupContent(clickedfeature, addONS) {
    let popupContent = '<div class="popup-table-title">Iowa BLE Area Info</div>';
    popupContent += '<table class="popup-table">';
    if (addONS !== undefined && addONS !== null && addONS !== "" && addONS !== " ") {
        for (let [key, value] of Object.entries(addONS)) {
            popupContent += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
        }
    }
    for (let property in clickedfeature.properties) {
        if (!unwanted.includes(property) && !containsUnwantedSubstring(property)) {
            let displayValue, displayProperty;
            if (property === "which_grid") {
                displayValue = whichGrid[clickedfeature.properties[property]];
                displayProperty = "Grids TODO"
            } else {
                displayValue = clickedfeature.properties[property];
                displayProperty = property.replace(/_/g, ' ')
                displayProperty = displayProperty.replace('  ', ' ').replace("Su", "Submit")
                    .replace("Mapping In", "Ph1 Mapped By")
                    .replace("Perc", "%")
            }
            popupContent += `<tr><td><strong>${displayProperty}</strong></td><td>${displayValue}</td></tr>`;
        }
    }

    popupContent += '</tbody></table>';

    // Fit the map to the popup and feature
    const featureBounds = getFeatureBounds(clickedfeature);

    return [popupContent, featureBounds];
}

// Function to fit the map to the bounds of the popup and its feature
function getFeatureBounds(feature) {
    // Get the bounding box of the feature
    const featureBounds = new mapboxgl.LngLatBounds();
    console.log("BOUNDS: ", featureBounds);
    feature.geometry.coordinates[0].forEach(coord => {
        const [lng, lat] = coord;
        // console.log("Lat: ", lat, " Lng: ", lng);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            featureBounds.extend(coord);
        } else {
            console.error(`Invalid coordinate: [${lng}, ${lat}]`);
        }
    });

    // Fit the map to the feature bounds
    console.log("With popup Bounds: ", featureBounds);
    return featureBounds;
}

// Function to close the popup
export function closePopup() {
    console.log("closePopup function called");
    const popup = document.querySelector('.popup-container .close-btn, .mapboxgl-popup-content .close-btn');
    if (popup) {
        console.log("Popup element found:", popup);
        popup.style.display = 'none';
        hideIt(popup);
        console.log("Popup close clicked");
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

                const aliasItem = await createLegendItem('', group, true);

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
            console.log("Group: ", group);
            let thisCentroid = Centroids[group]["Centroid"];
            let thisZoom = Centroids[group]["Zoom"];
            console.log("Centroid: ", thisCentroid);
            const zoomCell = document.createElement('td');
            const zoomToLayerButton = document.createElement('zoom-to-button');
            console.log("Zoom Button: ", zoomToLayerButton);
            zoomToLayerButton.textContent = 'Z2L';
            zoomToLayerButton.addEventListener('click', () => {
                // const center = getCenterFromSourceData(map, layers[0]);
                let currentZoom = map.getZoom();
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
    // console.log("Layers: ", typeof layers);
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

