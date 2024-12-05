import {
    areaPopupContent, closePopup,
    createLayerControls,
    hideIt,
    populateLegend,
    showIt,
    updateLegendOnVisibilityChange
} from './src/mapInteractions.js';

import {precisionRound} from "./src/maths.js";
import {
    fetchAndDisplayData,
    panel,
    buttonContainer,
    toggleTable,
    updateButtonsPosition,
} from "./src/populateTable.js";

import { initializeMap } from "./src/mapManager.js";
import { handleUploadButtonClick } from "./src/uploadData.js";


mapboxgl.accessToken = MAPBOX_TOKEN;
const map = initializeMap({
    container: 'map',
    style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
    projection: 'albers', // Display the map as a globe, since satellite-v9 defaults to Mercator
    zoom: 6,
    minZoom: 0,
    center: [-93.5, 42]
});

// Add user control
map.addControl(new mapboxgl.NavigationControl({showCompass: true, showZoom: true}));

let loc_popup;
// Add event listeners to the close buttons
document.addEventListener('DOMContentLoaded', () => {
    const geojsonFileUrl = './data/spatial/IA_BLE_Tracking.geojson';
    const lastUpdated = document.getElementById("timestamp-text");
    fetchAndDisplayData();

    // Upload button listener
    const uploadButton = document.getElementById("upload-data-button");
    uploadButton.addEventListener("click", handleUploadButtonClick);

    if (lastUpdated) {
    fetch(geojsonFileUrl, { method: 'HEAD' }) // HEAD request fetches only headers
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const lastModified = response.headers.get('Last-Modified');
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            // Dont show seconds in the time
            const timeOptions = { hour: 'numeric', minute: 'numeric', timeZoneName: 'short' };
             if (lastModified) {
                const formattedDate = new Date(lastModified).toLocaleDateString();
                const formattedTime = new Date(lastModified).toLocaleTimeString([], timeOptions);
                lastUpdated.innerHTML = `statuses last updated:<br><b>${formattedDate} ${formattedTime}</b>`;
            } else {
                console.warn('Last-Modified header not found');
                lastUpdated.innerHTML = `The <b>statuses</b> were last updated: <b>Unknown</b>`;
            }
        })
        .catch(error => {
            console.error('Error fetching the geojson file:', error);
            lastUpdated.innerHTML = `The <b>statuses</b> were last updated: <b>Unknown</b>`;
        });
    }

    // Add event listeners to area popup close buttons
    document.addEventListener('pointerdown', (e) => {
        [".popup-container", ".close-btn", ".mapboxgl-popup-content", ".close-btn"].forEach(selector => {
            if (e.target.classList.contains(selector)) {
                closePopup(loc_popup);
            }
        });
    });
});

const response = await fetch("../data/spatial/Centroids.json");
const Centroids = await response.json();
console.log("Centroids: ", Centroids);

// On Load event
map.on('load', async () => {
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

    map.addSource('WorkAreas', {
        type: 'geojson',
        data: '/data/spatial/Work_Areas.geojson'
    });
    map.addSource('ProjectAreas', {
        type: 'geojson',
        data: '/data/spatial/IA_BLE_Tracking.geojson'
    });
    map.addSource('WorkAreaLabels', {
        type: 'geojson',
        data: '/data/spatial/Work_Area_Labels.geojson'
    });
    map.addSource("CustomModelBoundaries", {
        type: "geojson",
        data: "/data/spatial/Iowa_WhereISmodel.geojson"
    });
    map.addSource('StateBoundary', {
        type: 'geojson',
        data: '/data/spatial/US_states.geojson'
    });
    map.addSource('S_Submittal_Info', {
        type: 'geojson',
        data: '/data/spatial/S_Submittal_Info_IA_BLE.geojson',
    });

    // const userDataSource = map.addSource('user', {
    //     type: 'geojson',
    //     data: './data/user_data/IA_user_data.geojson',
    //     dynamic: true,
    //     generateId: true
    // })

    console.log("Map Added/Loaded");

    map.doubleClickZoom.enable();

    // MIP Submission, Draft
    map.addLayer({
        id: 'draft-mip',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'visible'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'Draft_MIP'],
                'Approved',
                'rgba(2,248,138,0.69)', // 50% transparency
                'In Backcheck',
                'rgba(225,250,0,0.69)', // 50% transparency
                'Submitted',
                'rgba(2,226,246,0.67)', // 50% transparency
                'In-Progress',
                'rgba(251,113,2,0.67)', // 50% transparency
                'Next',
                'rgba(0,84,112,0.3)', // Match fill color
                'rgba(204, 204, 204, 0)', // 0% transparency
            ]
        },
    });

    // MIP Submission, Floodplain
    map.addLayer({
        id: 'fp-mip',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'FP_MIP'],
                'Approved',
                'rgba(2,248,138,0.69)', // 50% transparency
                'In Backcheck',
                'rgba(225,250,0,0.69)', // 50% transparency
                'Submitted',
                'rgba(2,226,246,0.67)', // 50% transparency
                'In-Progress',
                'rgba(251,113,2,0.67)', // 50% transparency
                'Next',
                'rgba(0,84,112,0.3)', // Match fill color
                'rgba(204, 204, 204, 0)', // 0% transparency
            ]
        },
    });

    // MIP Submission, Hydraulics
    map.addLayer({
        id: 'hydraulics-mip',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'Hydra_MIP'],
                'Approved',
                'rgba(2,248,138,0.69)', // 50% transparency
                'In Backcheck',
                'rgba(225,250,0,0.69)', // 50% transparency
                'Submitted',
                'rgba(2,226,246,0.67)', // 50% transparency
                'In-Progress',
                'rgba(251,113,2,0.67)', // 50% transparency
                'Next',
                'rgba(0,84,112,0.3)', // Match fill color
                'rgba(204, 204, 204, 0)', // 0% transparency
            ]
        },
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

    // Add overall production layer
    map.addLayer({
        id: 'prod-status',
        type: 'fill',
        source: 'ProjectAreas',
        layout: {
            // Make the layer visible by default.
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'Prod_Stage'],

                "Pass 2/2",
                'rgba(5,48,37,0.75)', // 50% transparency
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
                "25%", 'rgba(255,187,0,0.75)', // Color for values >= 30
                "50%", 'rgba(0,187,255,0.73)', // Color for values >= 40
                "75%", 'rgba(55,237,195,0.75)', // Color for values >= 60
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
                'rgb(0,0,0)'
            ],
            'fill-outline-color': 'rgb(200,108,255)'
        }
    });

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
            "line-color": 'rgb(210,255,163)',
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

    // Add work areas layer
    map.addLayer({
        id: 'work-areas',
        type: 'line',
        source: "WorkAreas",
        layout: {
            'visibility': 'visible'
        },
        paint: {
            'line-color': [
                'match', ['get', 'MIP_Case'],
                "21-07-0002S", 'rgb(152,0,213)', // Color for FY20_1A
                "22-07-0035S", 'rgb(15,71,0)', // Color for FY21_2A
                "23-07-0036S", 'rgb(193,3,47)', // Color for FY22_3A
                "23-07-0037S", 'rgb(0,19,142)', // Color for FY22_3A
                'rgba(0,0,0,0)' // Default color for unmatched cases
            ],
            'line-width': 3
        }
    });

    // Add work area labels
    map.addLayer({
        id: 'work-area-labels',
        type: 'symbol',
        source: 'WorkAreaLabels',
        layout: {
            'text-field': ['get', 'MIP_Case'],
            'text-font': ['Arial Unicode MS Bold'], // Bold font
            'text-allow-overlap': false, // Allow overlapping labels
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            'text-justify': 'auto',
            'visibility': 'visible',
            'text-size': 16,
        },
        paint: {
            'text-color': [
                'match', ['get', 'MIP_Case'],
                "21-07-0002S", 'rgb(152,0,213)', // Color for FY20_1A
                "22-07-0035S", 'rgb(15,71,0)', // Color for FY21_2A
                "23-07-0036S", 'rgb(193,3,47)', // Color for FY22_3A
                "23-07-0037S", 'rgb(0,19,142)', // Color for FY22_3A
                'rgba(0,0,0,0)' // Default color for unmatched cases
            ],
            'text-halo-color': 'rgba(0,196,255,1)', // Halo color
            'text-halo-width': 2
        } // Filter to include features without PBL_Assign or PBL_Assign is an empty string
    });

    // Add submittal info layer
    async function createColorStops() {
        const response = await fetch("./data/spatial/S_Submittal_Info_IA_BLE.geojson");
        const data = await response.json();
        const HUC8Values = data.features.map(feature => Number(feature.properties.HUC8));
        const uniqueHUC8Values = [...new Set(HUC8Values)].sort((a, b) => a - b);
        console.log("Unique HUC8 Values:", uniqueHUC8Values);

        // Use a diverging color scheme from colorbrewer
        const colorRamp = [
            '#8c0700', '#9f00c3', '#0045ac', '#00370d', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'
        ]; // Example diverging color ramp

        const colorStops = uniqueHUC8Values.flatMap((value, index) => [
            value, colorRamp[index % colorRamp.length]
        ]);
        return colorStops;
    }

    const colorStops = await createColorStops();
    map.addLayer({
        id: 'submittal-info',
        type: 'fill',
        source: 'S_Submittal_Info',
        layout: {
            'visibility': 'none'
        },
        paint: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['to-number', ['get', 'HUC8']],
                ...colorStops
            ],
            'fill-opacity': 0.5,

        },
    });
    map.addLayer({
        id: 'submittal-info_outline',
        type: 'line',
        source: 'S_Submittal_Info',
        layout: {
            'visibility': 'none'
        },
        paint: {
            'line-color': [
                'interpolate',
                ['linear'],
                ['to-number', ['get', 'HUC8']],
                ...colorStops
            ],
            'line-width': 3
        },
    });

    // Add labels for areas
    map.addLayer({
        id: 'areas-labels',
        type: 'symbol',
        source: 'ProjectAreas',
        layout: {
            'text-field': ['get', 'Name'],
            'text-size': 11,
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            // 'text-radial-offset': 0.5,
            'text-justify': 'auto',
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'] // Regular font
        },
        paint: {
            'text-color': 'rgb(0,28,58)', // Text color
            'text-halo-color': 'rgba(90,185,255,0.68)', // No halo
            'text-halo-width': 2
        }
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

    // add draw layer transparent
    // map.addLayer({
    //     id: 'user-draw-layer',
    //     type: 'fill',
    //     source: 'user',
    //     paint: {
    //         'fill-color': 'rgba(0, 0, 0, 0)' // Fully transparent fill
    //     }
    // });

    // Add layer-group control
    const controlLayers = {

        'Draft MIP': ['draft-mip'],
        'FP MIP': ['fp-mip'],
        'Hydraulics MIP': ['hydraulics-mip'],
        'FRP Status': ['frp-status'],
        'Draft Status Detail': ['prod-status'],
        'Grid Status': ['grid-status'],
        'Mod Model Outlines': ['model-outlines-mod'],
        'Submitted Proj Outlines': ['submittal-info', 'submittal-info_outline'],
        'TO Areas': ['work-areas'],
        // Add more groups and layers as needed
    };
    createLayerControls(map, controlLayers, Centroids);

    console.log("Sources: ", map.getStyle().sources)
    console.log("Layers: ", map.getStyle().layers)
    console.log('Layers added');
    // create legend
    const legendLayers = {
        'Draft MIP Status': 'draft-mip',
        'FP MIP Status': 'fp-mip',
        'Hydra MIP Status': 'hydraulics-mip',
        'Production Status': 'prod-status',
        'Grid Status': 'grid-status',
        'FRP Status': 'frp-status',
        'Mod Model Outlines': 'model-outlines-mod',
        'Task Order Outline': 'work-areas',
    };

    // Add more groups and layers as needed
    const mapLegend = populateLegend(map, legendLayers);
    updateLegendOnVisibilityChange(map, legendLayers);


    // Click actions
    map.on("click", async (e) => {
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
            let fid = feature.properties.HUC8;
            // console.log('Feature ID:', fid);
            if (fid !== undefined) {
                map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
            }
            // Calculate the centroid of the polygon
            const centroid = turf.centroid(clickedfeature);
            const coordinates = centroid.geometry.coordinates;
            // console.log('Clicked feature:', clickedfeature.layer.id);

            // Ensure coordinates are in the correct format
            if (!Array.isArray(coordinates) || coordinates.length !== 2) {
                console.error('Invalid coordinates format');
                continue;
            }

            if (clickedfeature.layer.id === 'areas-interaction') {
                // Get the popup content
                const [mapPopupContent, featureBounds] = await areaPopupContent(clickedfeature, addONS);
                // console.log('Clicked feature and popup bounds:', clickedfeature, featureBounds);
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

                // Calc feature specs and zoom specs
                const mapZoom = precisionRound(map.getZoom(), 1);
                let featureCenter = featureBounds.getCenter();
                let featureHeight = featureBounds.getNorth() - featureBounds.getSouth();
                const cameraOffset = [0, featureHeight];

                const newCameraTransform = map.cameraForBounds(featureBounds, {
                    offset: cameraOffset,
                    padding: {top: 5, bottom: 0, left: 5, right: 5}
                });
                let calcZoom = 7;
                let camZoom = newCameraTransform.zoom + 2 * featureHeight;
                camZoom = precisionRound(camZoom, 1);
                let centerArray = featureCenter.toArray();
                centerArray[1] = centerArray[1] + featureHeight * 0.3;
                let cameraCenter = new mapboxgl.LngLat(centerArray[0], centerArray[1]);
                // console.log('Camera Center: ', cameraCenter);
                // console.log('Feature Center: ', featureCenter);
                if (mapZoom > camZoom) {
                    // console.log('Map Zoom is greater than calculated zoom', mapZoom, camZoom);
                    calcZoom = camZoom;
                } else if (mapZoom < camZoom) {
                    // console.warn('Map Zoom is less than calculated zoom', mapZoom, camZoom);
                    calcZoom = camZoom;
                }
                // console.log('Feature Bounds:', featureBounds);
                // console.log('Calc Zoom:', calcZoom);
                // console.log('Map Zoom:', mapZoom);
                console.log('Feature Height:', featureHeight);
                // console.log('Center of bounds:', featureCenter);
                map.jumpTo({
                    center: cameraCenter,
                    zoom: calcZoom,
                })

            }


            // Ensure the popup fits within the current map bounds
            // fitMapToFeatureBounds(map, clickedfeature);
        }
    });

    // Add event listeners for mouse enter and leave -- NON CLICKs
    function addInteractionEvents(map, layer) {
        function highlightFeature(e) {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const fid = feature.properties.HUC8;
                // console.log('Feature ID:', fid);
                if (fid !== undefined) {
                    map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
                }
            }
        }
        map.on("hover", layer, (e) => {
            map.getCanvas().style.cursor = 'pointer';
            highlightFeature(e);
        });

        // Primary event handlers using pointer events
        map.on('pointerenter', layer, (e) => {
            // console.log('Pointer enter event detected');
            map.getCanvas().style.cursor = 'pointer';
            highlightFeature(e);
        });

        map.on('pointerleave', layer, () => {
            // console.log('Pointer leave event detected');
            map.setFilter('areas-highlight', ['==', 'HUC8', '']);
            map.getCanvas().style.cursor = '';
        });

        // Fallback event handlers using mouse events
        map.on('mouseenter', layer, (e) => {
            // console.log('Mouse enter event detected');
            map.getCanvas().style.cursor = 'pointer';
            if (e.features.length > 0) {
                const feature = e.features[0];
                const fid = feature.properties.HUC8;
                console.log('Feature ID:', fid);
                if (fid !== undefined) {
                    map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
                }
            }
        });

        map.on('mouseleave', layer, () => {
            console.log('Mouse leave event detected');
            map.setFilter('areas-highlight', ['==', 'HUC8', '']);
            map.getCanvas().style.cursor = '';
        });
    }

    // Call the function to add event listeners
    addInteractionEvents(map, 'areas-interaction');
});


const BORDER_SIZE = 10; // Resize boundary size
let isResizing = false;
let m_pos = 0;

// Start resizing
panel.addEventListener("pointerdown", function (e) {
  const rect = panel.getBoundingClientRect();
  const pointerY = e.clientY - rect.top;

  // Check if the pointer is near the top border
  if (pointerY < BORDER_SIZE) {
    isResizing = true;
    m_pos = e.clientY; // Set initial pointer position
    document.body.style.cursor = "ns-resize"; // Change cursor to resize style
  }
});

// Perform resizing with max height constraint
document.addEventListener("pointermove", function (e) {
  if (isResizing) {
    const rect = panel.getBoundingClientRect();
    const deltaY = e.clientY - m_pos; // Movement difference
    const newHeight = rect.height - deltaY; // Adjust height based on upward/downward drag

    const maxHeight = window.innerHeight * 0.95; // Maximum height as 95% of the frame
    const minHeight = 50; // Minimum height to prevent collapsing

    if (newHeight >= minHeight && newHeight <= maxHeight) {
        // panel.style.height = `${newHeight}px`;
        panel.style.height = `calc(100% - ${e.clientY}px)`; // Resize based on the pointer position
        // panel.style.top = `${rect.top}px`; // Adjust the top position to maintain alignment
        m_pos = e.clientY; // Update reference position
    } else if (newHeight > maxHeight) {
        panel.style.height = `${maxHeight}px`; // Snap to max height
    } else if (newHeight < minHeight) {
        panel.style.height = `${minHeight}px`; // Snap to min height
    }
    updateButtonsPosition(); // Update the toggle button position
  }
});

// Stop resizing
document.addEventListener("pointerup", function () {
  if (isResizing) {
    console.log("Pointer up detected. Resizing stopped.");
  }
  isResizing = false; // Reset state
  document.body.style.cursor = ""; // Reset cursor style
});

// Attach the toggle functionality to the button
buttonContainer.addEventListener("click", toggleTable);

const uploadButton = document.getElementById("upload-data-button");

// Attach event listener to the upload button
uploadButton.addEventListener("click", handleUploadButtonClick);
