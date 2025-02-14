const DEBUG_STATUS = false;
const dC = (message) => {
    if (DEBUG_STATUS) {
        console.debug(message);
    }
};

export let whichGrid = {
    '0, 1, 2': "No Grids",
    '1, 2': "DRAFT, Add'l Ret", '2': "Add'l Ret", "All on MM": "All on MM"
};

function legendKeyReplacements(value) {
    value = value.replace(/<br>/g, '\n');
    value = value.replace("NaT", "")
    return value;
}

// Function to create legend items
export async function createLegendItem(color, label, isAlias = false, isCircle = false) {
    const item = document.createElement('div');
    const key = document.createElement('span');
    if (isAlias) {
        key.className = 'legend-title';
    }
    if (isCircle) {
        key.className = 'legend-key-circle';
    } else {
        key.className = 'legend-key';
    }
    key.style.backgroundColor = color;

    const value = document.createElement('span');

    value.innerHTML = legendKeyReplacements(label);
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
                const aliasItem = await createLegendItem(colorProperty, "", true);
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
    checkViewportDims();
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

// Find containers to toggle
const controlsContainer = document.getElementById('controls-container');
const legendContainer = document.getElementById('legend-container');
const layerControls = document.getElementById('layer-controls');

// Individual toggles
const toggleLegendButton = document.getElementById('toggle-legend-btn');
toggleLegendButton.addEventListener('click', () => {
    // Only toggle if parent isn't collapsed
    if (!controlsContainer.classList.contains('collapsed')) {
        legendContainer.classList.toggle('collapsed');
        toggleLegendButton.textContent = legendContainer.classList.contains('collapsed') ? '▶' : '▼';
    }
});

const toggleControlsButton = document.getElementById('toggle-controls-btn');
toggleControlsButton.addEventListener('click', () => {
    // Only toggle if parent isn't collapsed
    if (!controlsContainer.classList.contains('collapsed')) {
        layerControls.classList.toggle('collapsed');
        toggleControlsButton.textContent = layerControls.classList.contains('collapsed') ? '▶' : '▼';
    }
});

function checkViewportDims() {
    // Check viewport width
    const iW = window.innerWidth;
    const iH = window.innerHeight;
    console.log("innerWidth", iW, "innerHeight", iH);
    if (iW < 1000) {
        // Collapse both containers if small screen
        legendContainer.classList.add('collapsed');
        layerControls.classList.add('collapsed');
        // Update button text to match collapsed state
        toggleLegendButton.textContent = '▶';
        toggleControlsButton.textContent = '▶';
    }
    if (iH < 1000) {
        layerControls.classList.add('collapsed');
        toggleControlsButton.textContent = "▶";
    }
    if (iH < 600) {
        legendContainer.classList.add('collapsed');
        toggleLegendButton.textContent = "▶";
    }
}
