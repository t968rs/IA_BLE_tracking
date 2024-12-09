import { initializeMap } from "./src/mapManager.js";
import turfcentroid from 'https://cdn.jsdelivr.net/npm/@turf/centroid@7.1.0/+esm'
import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";


let fetchedSources = null; // This will store the JSON data fetched by the worker
let fetchPromise = null;   // A promise to resolve when the worker completes fetching

// Initialize the worker at the top of main.js
(async function initializeWorker() {
    const worker = new Worker("./static/src/workers/fetchAPImetadata.js", { type: "module" });
    const api = Comlink.wrap(worker);

    // Start fetching data immediately and save the promise
    fetchPromise = api.fetchAPImetadata()
        .then((data) => {
            if (data) {
                fetchedSources = data; // Save fetched data globally
            } else {
                console.error("Worker returned null or undefined data.");
            }
            worker.terminate(); // Clean up the worker
        })
        .catch((error) => {
            console.error("Error fetching data from the worker:", error);
        });
})();

// Function to get data when needed
async function getSourcesMeta() {
    if (fetchedSources) {
        return fetchedSources; // Return already-fetched data
    }
    if (fetchPromise) {
        await fetchPromise;    // Wait for the ongoing fetch to complete
        return fetchedSources;
    }
    throw new Error("Worker has not been initialized or failed to fetch data.");
}

mapboxgl.accessToken = MAPBOX_TOKEN;

const map = initializeMap({
    container: 'map',
    style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
    projection: 'albers', // Display the map as a globe, since satellite-v9 defaults to Mercator
    zoom: 6,
    minZoom: 0,
    center: [-93.5, 42]
});
let loc_popup;
const LOG = true;

// Add user control
map.addControl(new mapboxgl.NavigationControl({showCompass: true, showZoom: true}));

// Wait for the DOM to be loaded before querying DOM elements and adding UI event listeners
document.addEventListener('DOMContentLoaded', () => {

    // set up delayed mapIntersection.js import
    const { enableTextSelection, disableTextSelection, closePopup } = import ("./src/mapInteractions.js");

    const geojsonHeadPromise = fetch("/served/spatial/IA_BLE_Tracking.geojson", { method: "HEAD" });
    const lastUpdated = document.getElementById("timestamp-text");
    const panel = document.getElementById("status-table-container");
    const buttonContainer = document.getElementById("button-container");
    const uploadButton = document.getElementById("upload-data-button");
    const exportButton = document.getElementById("export-excel-button");

    // Upload button
    uploadButton.addEventListener("click", async () => {
        const module = await import('./src/uploadData.js');
        module.handleUploadButtonClick();
    });

    // EXport button
    exportButton.addEventListener("click", async () => {
        const module = await import('./src/exportData.js');
        module.handleExportButtonClick();
    });

    // Lazy-load the toggleTable function
    buttonContainer.addEventListener("click", async () => {
        const { toggleTable } = await import('./src/populateTable.js');
        toggleTable();
    });

    // Defer fetching timestamp
    if (lastUpdated) {
        updateLastUpdatedTimestamp(geojsonHeadPromise, lastUpdated).catch((error) => {
            console.error("Error updating timestamp:", error);
        });
    }

    // Close popup on click outside or on close buttons
    document.addEventListener('pointerdown', (e) => {
        [".popup-container", ".close-btn", ".mapboxgl-popup-content", ".close-btn"].forEach(selector => {
            if (e.target.classList.contains(selector)) {
                closePopup(loc_popup);
            }
        });
    });

    // Add resizing logic for the panel
    const BORDER_SIZE = 10; // Resize boundary size
    let isResizing = false;
    let m_pos = 0;

    panel.addEventListener("pointerdown", function (e) {
        const rect = panel.getBoundingClientRect();
        const pointerY = e.clientY - rect.top;
        if (pointerY < BORDER_SIZE) {
            isResizing = true;
            m_pos = e.clientY;
            document.body.style.cursor = "ns-resize";
        }
    });

    document.addEventListener("pointermove", function (e) {
        if (isResizing) {
            const rect = panel.getBoundingClientRect();
            const deltaY = e.clientY - m_pos;
            const newHeight = rect.height - deltaY;

            const maxHeight = window.innerHeight * 0.95;
            const minHeight = 50;

            if (newHeight >= minHeight && newHeight <= maxHeight) {
                panel.style.height = `calc(100% - ${e.clientY}px)`;
                m_pos = e.clientY;
            } else if (newHeight > maxHeight) {
                panel.style.height = `${maxHeight}px`;
            } else if (newHeight < minHeight) {
                panel.style.height = `${minHeight}px`;
            }

            // Dynamically import and call updateButtonsPosition only when resizing is needed
            (async () => {
                const { updateButtonsPosition } = await import('./src/populateTable.js');
                updateButtonsPosition();
            })();
        }
    });

    document.addEventListener("pointerup", function () {
        if (isResizing) {
            if (LOG) { console.debug("Pointer up detected. Resizing stopped."); }
        }
        isResizing = false;
        document.body.style.cursor = "";
    });

    // Disable text selection during drag to resize
    document.getElementById('status-table-container').addEventListener('mousedown', (event) => {
        if (event.target.matches('#status-table-container::before, #status-table-container::after')) {
            disableTextSelection();
            document.addEventListener('mouseup', () => {
                enableTextSelection();
            }, { once: true });
        }
    });
});

// On Load event
map.on('load', async () => {
    if (LOG) { console.debug('Map loaded'); }

    const mathModule = await import("./src/maths.js");
    const precisionRound = mathModule.precisionRound;
    const centroidPromise = fetch("/served/spatial/Centroids.json");

    // Function to remove aria-hidden from the close button
    function fixAriaHiddenOnCloseButton() {
        const closeButton = document.querySelector('.mapboxgl-popup-close-button');
        if (closeButton) {
            closeButton.removeAttribute('aria-hidden');
        }
    }

    // Call this function after the popup is created
    map.on('popupopen', fixAriaHiddenOnCloseButton);

    // Loop through each source and add it to the map
    let mapSources = null;
    let vectorSourceNames = null;
    const mapLayerMeta = await getSourcesMeta();
    if (LOG) { console.debug("data: ", mapLayerMeta); }
    if (mapLayerMeta) {
        mapSources = mapLayerMeta.mapbox_sources;
        // Loop through each source and add it to the map
        mapSources.forEach((source) => {
            try {
                if (source.type === 'vector') {
                    map.addSource(source.id, {
                        type: source.type,
                        url: source.url
                    });
                } else if (source.type === 'geojson') {
                    map.addSource(source.id, {
                        type: source.type,
                        data: source.data
                    });
                } else {
                    console.warn(`Unsupported source type: ${source.type}`);
                }
            } catch (sourceError) {
                console.error(`Error adding source "${source.id}":`, sourceError);
            }
        });

            if (LOG) { console.debug("All sources added successfully."); }
        } else {
            console.error("Failed to fetch or process sources data.");
        }

    if (LOG) { console.debug('All sources added'); }

    map.doubleClickZoom.enable();

    if (!mapLayerMeta || !mapLayerMeta.mapbox_vector_names) {
        console.error("Failed to fetch or process sources data.");
        return;
    }
    vectorSourceNames = mapLayerMeta.mapbox_vector_names;

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
        filter: ['!=', ['get', 'STATEFP'], '19'],
        "source-layer": vectorSourceNames.StateBoundary
    });

    map.addLayer({
        id: "state-boundary-white_bg"
        , type: "line"
        , source: "StateBoundary"
        , paint: {
            "line-color": 'rgb(210,255,163)',
            "line-width": 1.5
        }
        ,
        "source-layer": vectorSourceNames.StateBoundary
    });

    map.addLayer({
        id: 'state-boundary-dashed',
        type: 'line',
        source: 'StateBoundary',
        paint: {
            'line-color': 'rgb(64,108,32)',
            'line-width': 1.2,
            'line-dasharray': [2, 3] // Dashed line
        },
        "source-layer": vectorSourceNames.StateBoundary
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
        },
        "source-layer": vectorSourceNames.WorkAreas
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

    // Use the Flask route to fetch the GeoJSON data
    const mapManagerModule = await import("./src/mapManager.js")
    const fetchGeoJSON = mapManagerModule.fetchGeoJSON;
    const geoResponse = await fetchGeoJSON("/served/spatial/S_Submittal_Info_IA_BLE.geojson");
    const createColorStops = mapManagerModule.createColorStops;
    const colorStops = await createColorStops(geoResponse);

    // Apply to new layers
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
    const centroidResponse = await centroidPromise;
    const centroids = await centroidResponse.json();

    // Control and legend imports
    const { createLayerControls, updateLegendOnVisibilityChange, populateLegend, areaPopupContent }
        = await import ("./src/mapInteractions.js");
    createLayerControls(map, controlLayers, centroids);

    if (LOG) { console.debug("Sources: ", map.getStyle().sources) }
    if (LOG) { console.debug("Layers: ", map.getStyle().layers) }
    if (LOG) { console.debug('Layers added'); }
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
    await populateLegend(map, legendLayers);
    updateLegendOnVisibilityChange(map, legendLayers);

    // Click actions
    map.on("click", async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['areas-interaction', 'model-outlines-mod'],  // replace 'your-interaction-layer' with the id of your layer
        });
        if (!features.length) {
            if (LOG) { console.debug('No features found'); }
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
            if (LOG) { console.debug('Clicked feature is not part of areas-interaction'); }
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
            if (fid !== undefined) {
                map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
            }
            // Calculate the centroid of the polygon
            const centroid = turfcentroid(clickedfeature);
            const coordinates = centroid.geometry.coordinates;

            // Ensure coordinates are in the correct format
            if (!Array.isArray(coordinates) || coordinates.length !== 2) {
                console.error('Invalid coordinates format');
                continue;
            }
            if (clickedfeature.layer.id === 'areas-interaction') {
                // Get the popup content
                const [mapPopupContent, featureBounds] = await areaPopupContent(clickedfeature, addONS);
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
                if (mapZoom > camZoom) {
                    calcZoom = camZoom;
                } else if (mapZoom < camZoom) {
                    calcZoom = camZoom;
                }
                if (LOG) { console.debug('Feature Height:', featureHeight); }
                map.jumpTo({
                    center: cameraCenter,
                    zoom: calcZoom,
                })
            }
        }
    });

    // Add event listeners for mouse enter and leave -- NON CLICKs
    function addInteractionEvents(map, layer) {
        function highlightFeature(e) {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const fid = feature.properties.HUC8;
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
            map.getCanvas().style.cursor = 'pointer';
            highlightFeature(e);
        });

        map.on('pointerleave', layer, () => {
            map.setFilter('areas-highlight', ['==', 'HUC8', '']);
            map.getCanvas().style.cursor = '';
        });

        // Fallback event handlers using mouse events
        map.on('mouseenter', layer, (e) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features.length > 0) {
                const feature = e.features[0];
                const fid = feature.properties.HUC8;
                if (LOG) { console.debug('Feature ID:', fid); }
                if (fid !== undefined) {
                    map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
                }
            }
        });

        map.on('mouseleave', layer, () => {
            if (LOG) { console.debug('Mouse leave event detected'); }
            map.setFilter('areas-highlight', ['==', 'HUC8', '']);
            map.getCanvas().style.cursor = '';
        });
    }

    // Call the function to add event listeners
    addInteractionEvents(map, 'areas-interaction');
});

async function updateLastUpdatedTimestamp(headPromise, lastUpdated) {
    try {
        const response = await headPromise; // Use HEAD request to fetch headers
        if (response.ok) {
            const lastModified = response.headers.get('Last-Modified');
            if (lastModified) {
                const timeOptions = { hour: 'numeric', minute: 'numeric', timeZoneName: 'short' };
                const formattedDate = new Date(lastModified).toLocaleDateString();
                const formattedTime = new Date(lastModified).toLocaleTimeString([], timeOptions);

                lastUpdated.innerHTML = `Statuses last updated:<br><b>${formattedDate} ${formattedTime}</b>`;
                if (LOG) { console.debug(`Last-Modified fetched and displayed: ${formattedDate} ${formattedTime}`); }
            } else {
                console.warn('Last-Modified header not found.');
                lastUpdated.innerHTML = `Unable to fetch the last updated timestamp.`;
            }
        } else {
            console.error(`Error: HTTP response not OK. Status: ${response.status}`);
            lastUpdated.innerHTML = `Unable to fetch the last updated timestamp.`;
        }
    } catch (error) {
        console.error('Error fetching the geojson file:', error);
        lastUpdated.innerHTML = `Unable to fetch the last updated timestamp.`;
    }
}
