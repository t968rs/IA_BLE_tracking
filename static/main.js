import { initializeMap, getMapBoxToken, fetchGeoJSON, createColorStops } from "/static/src/mapManager.js";
import { updateLastUpdatedTimestamp } from "/static/src/validateDataDir.js";
import turfcentroid from 'https://cdn.jsdelivr.net/npm/@turf/centroid@7.1.0/+esm'
import { initSourcesWorker, initAttributesWorker, debugWorkers } from "/static/src/workers/initWorkers.js";
import {enableTextSelection,
    disableTextSelection,
    closePopup,
    createLayerControls,
    updateLegendOnVisibilityChange,
    populateLegend,
    areaPopupContent} from "/static/src/mapInteractions.js";
import { handleUploadButtonClick } from "/static/src/uploadData.js";
import { handleExportButtonClick } from "/static/src/exportData.js";
import {precisionRound} from "/static/src/maths.js";
import { toggleTable, fetchAndDisplayData } from "/static/src/populateTable.js"
const LOG = true;

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM doc state:", document.readyState);
    if (document.readyState === 'complete') {
        initPage().then(() => {
            console.log("Page loaded successfully.");
        }).catch((error) => {
            console.error("Error initializing page:", error);
        }
        );
    } else {
        document.addEventListener('readystatechange', () => {
            if (document.readyState === 'complete') {
                initPage().then(() => {
                    console.log("Page loaded successfully.");
                }).catch((error) => {
                    console.error("Error initializing page:", error);
                }
                );
            }
        });
    }
});

async function initPage() {
    console.log("Initializing page...");
    try {
        await setupUI();

        const [jsonUrl, csvUrl] = ['/served/mapbox_metadata/mapbox_sources.json',
        '/served/spatial/IA_BLE_Tracking_attributes.csv'];

        debugWorkers(jsonUrl, csvUrl);
        const [sourcesMeta, trackingAttributes] = await fetchDataAndSetup(
            jsonUrl,
            csvUrl
        );

        await setupMap(sourcesMeta, csvUrl, trackingAttributes);
        console.log("Page initialized successfully.");
    } catch (error) {
        console.error("Error initializing page:", error);
    }
}


let loc_popup;

async function setupUI() {
    console.debug("Setting up UI...");
    const trackingLastUpdatedPromise = fetch("/served/spatial/IA_BLE_Tracking_attributes.csv",
    { method: "HEAD" });
    const lastUpdated = document.getElementById("timestamp-text");
    if (!lastUpdated) {
        console.error("Element with id 'timestamp-text' not found in DOM.");
    } else {
        updateLastUpdatedTimestamp(trackingLastUpdatedPromise, lastUpdated).catch((error) => {
            console.error("Error updating timestamp:", error);
        });
    }

    const tablePanel = document.getElementById("status-table-container");

    try {
        const buttonContainer = document.getElementById("button-container");
        buttonContainer.addEventListener("click", async () => {
            toggleTable();
        });
    } catch (error) {
        console.error("Error initializing button container:", error);
    }

    // Upload button elements
    try {
        const uploadButton = document.getElementById("upload-data-button");
        uploadButton.addEventListener("click", async () => {
            handleUploadButtonClick();
        });
    } catch (error) {
        console.error("Error initializing upload button elements:", error);
    }

    // Export button
    try {
        const exportButton = document.getElementById("export-excel-button");
        exportButton.addEventListener("click", async () => {
            handleExportButtonClick();
        });
    } catch (error) {
        console.error("Error initializing export button elements:", error);
    }

    // Defer fetching timestamp
    updateLastUpdatedTimestamp(trackingLastUpdatedPromise, lastUpdated).catch((error) => {
        console.error("Error updating timestamp:", error);
    });

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

    tablePanel.addEventListener("pointerdown", function (e) {
        const rect = tablePanel.getBoundingClientRect();
        const pointerY = e.clientY - rect.top;
        if (pointerY < BORDER_SIZE) {
            isResizing = true;
            m_pos = e.clientY;
            document.body.style.cursor = "ns-resize";
        }
    });

    document.addEventListener("pointermove", function (e) {
        if (isResizing) {
            const rect = tablePanel.getBoundingClientRect();
            const deltaY = e.clientY - m_pos;
            const newHeight = rect.height - deltaY;

            const maxHeight = window.innerHeight * 0.95;
            const minHeight = 50;

            if (newHeight >= minHeight && newHeight <= maxHeight) {
                tablePanel.style.height = `calc(100% - ${e.clientY}px)`;
                m_pos = e.clientY;
            } else if (newHeight > maxHeight) {
                tablePanel.style.height = `${maxHeight}px`;
            } else if (newHeight < minHeight) {
                tablePanel.style.height = `${minHeight}px`;
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

}

async function fetchDataAndSetup(jsonUrl, csvUrl) {
    try {
        await setupUI();
        console.debug("Initializing sources and attributes workers...");
        const [sourcesData, attributesData] = await Promise.all([
            initSourcesWorker(jsonUrl),
            initAttributesWorker(csvUrl)
        ]);

        return [sourcesData, attributesData];
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

async function setupMap(sourcesMeta, csvUrl, trackingAttributes) {
    if (LOG) {
    console.debug("sourcesMeta: ", sourcesMeta);
    console.debug("csvUrl: ", csvUrl);
    console.debug("trackingAttributes: ", trackingAttributes);
    }

    // Fetch table data
    if (sourcesMeta && trackingAttributes) {
        await fetchAndDisplayData(sourcesMeta, trackingAttributes)
    }
    const token = await getMapBoxToken();
    const map = initializeMap({
        container: 'map',
        style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
        projection: 'albers', // Display the map as a globe, since satellite-v9 defaults to Mercator
        zoom: 6,
        minZoom: 0,
        center: [-93.5, 42],
        token: token,
    });

    // Add user control
    map.addControl(new mapboxgl.NavigationControl({showCompass: true, showZoom: true}));

    // On Load event
    map.on('load', async () => {
        if (LOG) {
            console.debug('Map loaded');
        }

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


        if (sourcesMeta) {
            mapSources = sourcesMeta.mapbox_sources;
            // Loop through each source and add it to the map
            mapSources.forEach((source) => {
                try {
                    if (source.type === 'vector' && source.url) {
                        map.addSource(source.id, {
                            type: source.type,
                            url: source.url
                        });
                    } else if (source.type === "vector" && source.tiles) {
                        map.addSource(source.id, {
                            type: source.type,
                            tiles: source.tiles,
                            minzoom: source.minzoom,
                            maxzoom: source.maxzoom
                        })

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

            if (LOG) {
                console.debug("All sources added successfully.");
            }
        } else {
            console.error("Failed to fetch or process sources data.");
        }
        if (LOG) {
            console.debug('All sources added');
        }

        map.doubleClickZoom.enable();

        // Get metadata
        if (!sourcesMeta || !sourcesMeta.mapbox_vector_names) {
            console.error("Failed to fetch or process sources data.");
            return;
        }
        vectorSourceNames = sourcesMeta.mapbox_vector_names;

        // Get tracking attributes
        if (LOG) {
            console.debug("Fetched attributes: ", trackingAttributes);
        }
        // Apply attributes to Mapbox feature states
        Object.entries(trackingAttributes).forEach(([HUC8, attributes]) => {
            map.setFeatureState(
                {source: 'ProjectAreas', id: HUC8, sourceLayer: vectorSourceNames.ProjectAreas}, // Ensure HUC8 aligns with the `id` used in your vector tileset
                attributes // Attributes as key-value pairs
            );
        });
        if (LOG) {
            console.debug("Added tracking attributes.", trackingAttributes);
        }

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
                    ['feature-state', 'Draft_MIP'],
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
            "source-layer": vectorSourceNames.ProjectAreas
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
                    ['feature-state', 'FP_MIP'],
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
            "source-layer": vectorSourceNames.ProjectAreas
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
                    ['feature-state', 'Hydra_MIP'],
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
            "source-layer": vectorSourceNames.ProjectAreas
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
                    ['feature-state', 'which_grid'],
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
            "source-layer": vectorSourceNames.ProjectAreas
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
                    ['feature-state', 'Prod_Stage'],
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
            "source-layer": vectorSourceNames.ProjectAreas
        });

        // Add FRP Status Layers
        map.addLayer({
            id: 'frp-status',
            source: 'ProjectAreas',
            type: 'fill',
            layout: {
                // Make the layer visible by default.
                'visibility': 'none'
            },
            paint: {
                'fill-color': [
                    'match',
                    ['feature-state', 'FRP_Perc_Complete'],
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
            "source-layer": vectorSourceNames.ProjectAreas
        });

        // Add outline layer
        map.addLayer({
            id: 'areas-outline',
            type: 'line',
            source: 'ProjectAreas',
            paint: {
                'line-color': 'rgb(247, 247, 247)',
                'line-width': 1
            },
            "source-layer": vectorSourceNames.ProjectAreas
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
            filter: ['==', 'HUC8', ''],
            "source-layer": vectorSourceNames.ProjectAreas
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
        const geoResponse = await fetchGeoJSON("/served/spatial/S_Submittal_Info_IA_BLE.geojson");
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
            },
            "source-layer": vectorSourceNames.ProjectAreas
        });

        // Add a transparent fill layer for interaction
        map.addLayer({
            id: 'areas-interaction',
            type: 'fill',
            source: 'ProjectAreas',
            paint: {
                'fill-color': 'rgba(0, 0, 0, 0)' // Fully transparent fill
            },
            "source-layer": vectorSourceNames.ProjectAreas
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
        createLayerControls(map, controlLayers, centroids);

        if (LOG) {
            console.debug("Sources: ", map.getStyle().sources)
        }
        if (LOG) {
            console.debug("Layers: ", map.getStyle().layers)
        }
        if (LOG) {
            console.debug('Layers added');
        }
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
                if (LOG) {
                    console.debug('No features found');
                }
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
                if (LOG) {
                    console.debug('Clicked feature is not part of areas-interaction');
                }
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
                    const [mapPopupContent, featureBounds] = await areaPopupContent(feature, addONS,
                        trackingAttributes);
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
                    let camZoom = newCameraTransform.zoom * featureHeight;
                    if (camZoom < 5) {
                        camZoom = 5;
                    }
                    if (camZoom > 11) {
                        camZoom = 11;
                    }
                    camZoom = precisionRound(camZoom, 1);
                    let centerArray = featureCenter.toArray();
                    centerArray[1] = centerArray[1] + featureHeight * 0.3;
                    let cameraCenter = new mapboxgl.LngLat(centerArray[0], centerArray[1]);

                    if (LOG) {
                        console.debug('Feature Height:', featureHeight, "Zoom:", camZoom, "Center:", cameraCenter);
                    }
                    map.jumpTo({
                        center: cameraCenter,
                        zoom: camZoom,
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
                    if (LOG) {
                        console.debug('Feature ID:', fid);
                    }
                    if (fid !== undefined) {
                        map.setFilter('areas-highlight', ['==', 'HUC8', fid]);
                    }
                }
            });

            map.on('mouseleave', layer, () => {
                if (LOG) {
                    console.debug('Mouse leave event detected');
                }
                map.setFilter('areas-highlight', ['==', 'HUC8', '']);
                map.getCanvas().style.cursor = '';
            });
        }

        // Call the function to add event listeners
        addInteractionEvents(map, 'areas-interaction');
    });

}



