import {
    areaPopupContent,
    fitMapToFeatureBounds,
    closePopup,
    ensurePopupFits,
    updateLegendOnVisibilityChange,
    populateLegend,
    createLayerControls,
} from './src/mapInteractions.js';

// import { getEditor } from "./src/editor_functionality.js";

mapboxgl.accessToken = 'pk.eyJ1IjoidDk2OHJzIiwiYSI6ImNpamF5cTcxZDAwY2R1bWx4cWJvd3JtYXoifQ.XqJkBCgSJeCCeF_yugpG5A';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
    projection: 'albers', // Display the map as a globe, since satellite-v9 defaults to Mercator
    zoom: 7,
    minZoom: 0,
    center: [-93, 42]
});

// Add user control
map.addControl(new mapboxgl.NavigationControl());

let loc_popup;

// On Load event
map.on('load', () => {
    console.log('Map loaded');
    // Function to remove aria-hidden from the close button
    function fixAriaHiddenOnCloseButton() {
        const closeButton = document.querySelector('.mapboxgl-popup-close-button');
        if (closeButton) {
            closeButton.removeAttribute('aria-hidden');
        }
    }

    // Call this function after the popup is created
    map.on('popupopen', fixAriaHiddenOnCloseButton);

    map.addSource('ProjectAreas', {
        type: 'geojson',
        data: './data/spatial/Iowa_BLE_Tracking.geojson'
    });
    map.addSource("CustomModelBoundaries", {
        type: "geojson",
        data: "./data/spatial/Iowa_WhereISmodel.geojson"
    })
    map.addSource('TODOPoints', {
        type: 'geojson',
        data: './data/spatial/TODO_points.geojson'
    })
    map.addSource('UPDATEPoints', {
        type: 'geojson',
        data: './data/spatial/UPDATE_points.geojson'
    })
    map.addSource('StateBoundary', {
        type: 'geojson',
        data: './data/spatial/US_states.geojson'
    })

    // Fit bounds
    // console.log(map.getStyle().sources);
    console.log("Map Added/Loaded");
    map.getSource('ProjectAreas').on('data', (e) => {
        if (e.isSourceLoaded) {
            map.fitBounds(turf.bbox(e.source.data), {
                padding: 30,  // Increase the padding to zoom out more
                maxZoom: 15,
                minZoom: 8,
                duration: 1000
            });
        }
    });
    map.doubleClickZoom.enable();


    // Assignments Layer pbl-areas
    map.addLayer({
        id: 'pbl-areas',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'PBL_Assign'],
                'RK',
                'rgba(214, 95, 0, 0.5)', // 50% transparency
                'EC',
                'rgba(0, 92, 175, 0.5)', // 50% transparency
                'QB',
                'rgba(94, 229, 204, 0.5)', // 50% transparency
                'MT',
                'rgba(59, 163, 208, 0.5)', // 50% transparency
                'MB',
                'rgba(149, 55, 237, 0.5)', // 50% transparency
                'AE',
                'rgba(55,188,237, 0.3)', // Match fill color
                '* other *',
                'rgba(204, 204, 204, 0)', // 0% transparency
                'rgba(0, 0, 0, 0)' // Default color for unmatched cases
            ]
        },
        filter: ['!=', ['get', 'PBL_Assign'], null]
    });

    // Add grid status layer
    map.addLayer({
        id: 'grid-status',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'which_grid'],
                '0, 1, 2',
                'rgba(255,90,88,0.35)', // 50% transparency
                '1, 2',
                'rgba(192,197,28,0.74)', // 50% transparency
                '2',
                'rgba(0,230,127,0.5)', // 50% transparency
                'All on MM',
                'rgba(5,205,52,0.8)', // 50% transparency
                '* other *',
                'rgba(204, 204, 204, 0)', // 0% transparency
                'rgba(0, 0, 0, 0)' // Default color for unmatched cases
            ]
        },
        filter: ['!=', ['get', 'which_grid'], null]
    });

    // Add specific to-do layer
    map.addLayer({
        id: 'bfe-todo',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'BFE_TODO'],
                'T',
                'rgba(214,50,0,0.5)', // 50% transparency
                'F',
                'rgba(22,220,0,0.75)', // 50% transparency
                '* other *',
                'rgba(204, 204, 204, 0)', // 0% transparency
                'rgba(0, 0, 0, 0)' // Default color for unmatched cases
            ]
        },

        filter: ['!=', ['get', 'BFE_TODO'], null]
    });

    // Add overall production layer
    map.addLayer({
        id: 'prod-status',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'visible'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'Prod Stage'],

                "Pass 2/2",
                'rgb(42,255,135)', // 50% transparency
                "Pass 1/2",
                'rgba(5,244,152,0.75)', // 50% transparency
                "DD Submit",
                'rgba(29,208,202,0.7)', // 50% transparency
                "DD Internal",
                'rgba(189,189,0,0.70)', // 50% transparency
                'DD Mapping',
                'rgba(255,252,88,0.68)', // 50% transparency
                'Phase 1',
                'rgba(182,6,2,0.56)', // 50% transparency
                '* other *',
                'rgba(126,126,126,0.5)', // 0% transparency
                'rgba(0, 0, 0, 0)' // Default color for unmatched cases
            ]
        }
    });
    // log("Layers added", map.getLayer('pbl-areas'), map.getLayer('grid-status'), map.getLayer('prod-status'));

    // Add FRP Status Layers
    map.addLayer({
        id: 'frp-status',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer invisible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'FRP_Perc_Complete_Legend'],
                "0%", 'rgba(255,0,0,0.19)', // Default color for values less than the first stop
                "33%", 'rgba(255,187,0,0.75)', // Color for values >= 30
                // 50, 'rgba(255, 165, 0, 0.5)', // Color for values >= 40
                "67%", 'rgba(255,251,0,0.66)', // Color for values >= 60
                // 76, 'rgb(0,92,175)', // Color for values >= 60
                "100%", 'rgba(42,221,1,0.5)', // Color for values >= 100
                'rgba(128,128,128,0)' // Default color for unmatched cases
            ]
        }
    });

    // Add outline layer
    map.addLayer({
        id: 'areas-outline',
        type: 'line',
        source: 'ProjectAreas',
        paint: {
            'line-color': 'rgb(247, 247, 247)',
            'line-width': 1
        }
    });


    // Ensure the source is added before the layer
    if (map.getSource('CustomModelBoundaries')) {
        console.log('Source CustomModelBoundaries found');

        // Add model outlines (CUSTOM OUTLINES)
        map.addLayer({
            id: 'model-outlines-mod',
            type: "fill",
            source: 'CustomModelBoundaries',
            layout: {'visibility': 'none'},
            paint: {
                'fill-color': [
                    "match",
                    ["get", "Model_ID"],
                    "1023000104", 'rgba(0,255,140,0.7)', // Color
                    "1023000605", 'rgba(247,255,0,0.7)',
                    "1023000703A", 'rgba(255,106,0,0.7)',
                    'rgba(0,0,0,0)'
                ],
                'fill-outline-color': 'rgb(200,108,255)',
                'fill-outline-width': 2
            }
        });
    }

    // Add highlight hover layer
    map.addLayer({
        id: 'areas-highlight',
        type: 'fill',
        source: 'ProjectAreas',
        paint: {
            'fill-color': 'rgba(255, 255, 255, 0.5)' // Transparent white for highlight
        },
        filter: ['==', 'HUC8', ''] // Initially no feature is highlighted
    });

    // Add grids notes layer 1
    map.addLayer({
        id: 'notes-update',
        type: "circle",
        source: 'UPDATEPoints',
        filter: ['!=', ['get', 'Notes'], null],
        paint: {
            'circle-color': "rgba(170,14,163,0.93)",
            "circle-stroke-color": "rgba(255,101,248,0.93)",
            "circle-stroke-width": 1,
            'circle-radius': 15,
    },
        layout: {
            // Make the layer visible by default.
            'visibility': 'visible'
        },
    });

    // Add grids notes layer 1
    map.addLayer({
        id: 'notes-todo',
        type: "circle",
        source: 'TODOPoints',
        filter: ['!=', ['get', 'Notes'], null],
        paint: {
            'circle-color': "rgba(0,43,128,0.93)",
            "circle-stroke-color": "rgba(108,164,255,0.93)",
            "circle-stroke-width": 1,
            "circle-emissive-strength": 0.5,
            'circle-radius': 15,
    },
        layout: {
            // Make the layer visible by default.
            'visibility': 'visible'
        },
    });
    // console.log("Circles added", map.getLayer('grid-notes-update'), map.getLayer('grid-notes-todo'));


    // Add state boundary layer
    map.addLayer({
        id: 'state-boundary-fill',
        type: 'fill',
        source: 'StateBoundary',
        paint: {'fill-color': 'rgba(255,255,255,0.85)'},
        filter: ['!=', ['get', 'STATEFP'], '19']
    });

    map.addLayer({
        id: "state-boundary-white_bg"
        , type: "line"
        , source: "StateBoundary"
        , paint: {
            "line-color":  'rgb(210,255,163)',
            "line-width": 1.5
        }
    });

    map.addLayer({
        id: 'state-boundary-dashed',
        type: 'line',
        source: 'StateBoundary',
        paint: {
            'line-color': 'rgb(64,108,32)',
            'line-width': 1.2,
            'line-dasharray': [2, 3] // Dashed line
        }
    });

    // Add labels for features with PBL_Assign values
    map.addLayer({
        id: 'pbl-areas-labels-with-pbl',
        type: 'symbol',
        source: 'ProjectAreas',
        anchor: 'center',
        layout: {
            'text-field': ['get', 'PBL_Assign'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], // Bold font
            'text-allow-overlap': true, // Allow overlapping labels
            'visibility': 'none',
        },
        paint: {
            'text-color': 'rgb(247, 247, 247)', // Text color
            'text-halo-color': [
                'match',
                ['get', 'PBL_Assign'],
                'RK', 'rgba(214, 95, 0, 0.5)', // Match fill color
                'EC', 'rgba(0, 92, 175, 0.5)', // Match fill color
                'QB', 'rgba(94, 229, 204, 0.5)', // Match fill color
                'MT', 'rgba(59, 163, 208, 0.5)', // Match fill color
                'MB', 'rgba(149, 55, 237, 0.5)', // Match fill color
                'AE', 'rgba(55,188,237, 0.3)', // Match fill color
                '* other *', 'rgba(204, 204, 204, 0)', // Default halo color
                'rgba(0, 0, 0, 0)' // Default halo color for unmatched cases
            ],
            'text-halo-width': 1 // Halo width
        },
        filter: ['!=', ['get', 'PBL_Assign'], null] // Filter to only include features with PBL_Assign
    });

    // Add labels for areas
    map.addLayer({
        id: 'areas-labels',
        type: 'symbol',
        source: 'ProjectAreas',
        layout: {
            'text-field': ['get', 'Name'],
            'text-size': 12,
            'text-anchor': 'bottom',
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'] // Regular font
        },
        paint: {
            'text-color': 'rgb(0,28,58)', // Text color
            'text-halo-color': 'rgba(90,185,255,0.68)', // No halo
            'text-halo-width': 2
        } // Filter to include features without PBL_Assign or PBL_Assign is an empty string
});

    // Add a transparent fill layer for interaction
    map.addLayer({
        id: 'areas-interaction',
        type: 'fill',
        source: 'ProjectAreas',
        paint: {
            'fill-color': 'rgba(0, 0, 0, 0)' // Fully transparent fill
        }
    });

    console.log(map.getStyle().layers)
    console.log('Layers added');
    // create legend
    const legendLayers  = {
        'BFE TODO': 'bfe-todo',
        'Production Status': 'prod-status',
        'Updates': 'notes-update',
        'TODOs': 'notes-todo',
        'Grid Status': 'grid-status',
        'Assignment': 'pbl-areas',
        'FRP Status': 'frp-status',
        'Mod Model Outlines': 'model-outlines-mod',};

    // Add more groups and layers as needed
    const mapLegend = populateLegend(map, legendLayers);
    updateLegendOnVisibilityChange(map, legendLayers);

    // Add layer-group control
    const controlLayers = {
        'FRP Status': ['frp-status'],
        'BFE TODO': ['bfe-todo'],
        'Production Status': ['prod-status'],
        'Mod Model Outlines': ['model-outlines-mod'],
        'Grid Status': ['grid-status'],
        'Updates': ['notes-update'],
        'ToDo': ['notes-todo'],
        'Assignment': ['pbl-areas', 'pbl-areas-labels-with-pbl',],
    // Add more groups and layers as needed
    };
    createLayerControls(map, controlLayers);

    // Add editor functionality
    // getEditor(map, ['areas-interaction']);

    map.on('click', async (e) => {
    const features = map.queryRenderedFeatures(e.point, {
        layers: ['areas-interaction', 'model-outlines-mod'],  // replace 'your-interaction-layer' with the id of your layer
    });
    if (!features.length) {
        console.log('No features found');
        if (loc_popup) {
            loc_popup.remove(); // Close the popup if no feature is clicked
            loc_popup = null;
        }
        return;
    }
    // Check if the feature belongs to the 'areas-interaction' layer
    let addONS = {};
    for (const clickedfeature of features) {
        // Calculate the centroid of the polygon
        if ("DS_1" in clickedfeature.properties) {
            const modelid = clickedfeature.properties["Model_ID"];
            addONS = {"Model_ID": modelid};
        }
    }
    const feature = features.find(f => f.layer.id === 'areas-interaction');
    if (!feature) {
        console.log('Clicked feature is not part of areas-interaction');
        if (loc_popup) {
            loc_popup.remove(); // Close the popup if no valid feature is clicked
            loc_popup = null;
        }
        return;
    }

    // Remove any existing popup to prevent content from appending
    if (loc_popup) {
        loc_popup.remove();
    }

    // Handle the features found
    for (const clickedfeature of features) {
        // Calculate the centroid of the polygon
        const centroid = turf.centroid(clickedfeature);
        const coordinates = centroid.geometry.coordinates;
        console.log('Clicked feature:', clickedfeature.layer.id);

        // Ensure coordinates are in the correct format
        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            console.error('Invalid coordinates format');
            continue;
        }

        if (clickedfeature.layer.id === 'areas-interaction') {
            const mapPopupContent = await areaPopupContent(clickedfeature, addONS);
            // Create the popup
            loc_popup = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                anchor: 'bottom', // Adjust anchor as needed (bottom, top, left, right)
                offset: [0, -15] // Adjust offset as needed to make sure popup is visible
            })
                .setLngLat(coordinates)
                .setHTML(mapPopupContent)
                .addTo(map);
        }


        // Ensure the popup fits within the current map bounds
        // fitMapToFeatureBounds(map, clickedfeature);
    }
    });


    // Add event listeners for mouse enter and leave
    map.on('mousemove', 'areas-interaction', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const fid = feature.properties.HUC8;
            if (fid !== undefined) {
                map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
            }
        }
    });

    map.on('mouseleave', 'areas-interaction', () => {
        map.setFilter('areas-highlight', ['==', 'HUC8', '']);
    });

    // Add event listeners for mouse enter and leave
    map.on('mouseenter', 'areas-interaction', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'areas-interaction', () => {
        map.getCanvas().style.cursor = '';
    });

    // Add event listener for the moveend event
    map.on('moveend', () => {
        // Get the current map bounds
        const bounds = map.getZoom();

        // Log the bounds to the console
        // console.log('Current Map Bounds:', bounds);
    });
});


/*// Excel Table
async function displayExcelTable(filePath) {
    const response = await fetch(filePath);
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const htmlString = XLSX.utils.sheet_to_html(worksheet);
    document.getElementById('excel-table-container').innerHTML = htmlString;
}

document.getElementById('toggle-table-btn').addEventListener('click', toggleTable);

// Call the function with the path to your Excel file
displayExcelTable('./data/tables/Iowa_BLE_Tracking.xlsx');*/

const BORDER_SIZE = 4;
const panel = document.getElementById("excel-table-container");
const toggleButton = document.getElementById("toggle-table-btn");

let m_pos;
function resize(e){
  const dy = m_pos - e.y;
  m_pos = e.y;
  panel.style.height = (parseInt(getComputedStyle(panel, '').height) + dy) + "px";
  console.log("Panel resized, height: ", panel.style.height);
  updateToggleButtonPosition();
}

panel.addEventListener("mousedown", function(e) {
  if (e.offsetY < BORDER_SIZE) {
    m_pos = e.y;
    document.addEventListener("mousemove", resize, false);
  }
}, false);

document.addEventListener("mouseup", function() {
  document.removeEventListener("mousemove", resize, false);
}, false);

function toggleTable() {
  const tableContainer = document.getElementById('excel-table-container');
  if (tableContainer.style.display === 'none' || tableContainer.style.display === '') {
    tableContainer.style.display = 'block';
    updateToggleButtonPosition();
  } else {
    tableContainer.style.display = 'none';
    resetToggleButtonPosition();
  }
  console.log('Table toggled');
  // tableFormatting(tableContainer);
}

function updateToggleButtonPosition() {
  const tableContainer = document.getElementById('excel-table-container');
  const tableHeight = parseInt(getComputedStyle(tableContainer, '').height);
  console.log('Table height:', tableHeight);
  toggleButton.style.bottom = (tableHeight + 75) + 'px'; // Adjust based on the height of the table container
}

function resetToggleButtonPosition() {
  toggleButton.style.bottom = '50px'; // Reset to the original position
}

/*// Table formatting
function tableFormatting(table) {
  const headerRow = table.rows[0]; // Example: 1st row
  const specificColumnIndex = 2; // Example: third column
    // Add class to the specific row
    headerRow.classList.add('highlight-row');

    // Add class to the specific column cells
    for (let i = 0; i < table.rows.length; i++) {
        table.rows[i].cells[specificColumnIndex].classList.add('highlight-column');
    }
}*/

document.getElementById('toggle-table-btn').addEventListener('click', toggleTable);