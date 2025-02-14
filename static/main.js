import { setMap, getMapBoxToken, fetchGeoJSON, createColorStops } from "/static/src/mapManager.js";
import { updateLastUpdatedTimestamp } from "/static/src/validateDataDir.js";
import turfcentroid from 'https://cdn.jsdelivr.net/npm/@turf/centroid@7.1.0/+esm'
import { initSourcesWorker, initAttributesWorker, debugWorkers } from "/static/src/workers/initWorkers.js";
import {enableTextSelection,
    disableTextSelection,
} from "/static/src/mapInteractions.js";
import {
    createLayerControls,
    updateLegendOnVisibilityChange,
    populateLegend } from "/static/src/legendControls.js"
import { handleUploadButtonClick } from "/static/src/uploadData.js";
import { handleExportButtonClick } from "/static/src/exportData.js";
import {precisionRound} from "/static/src/maths.js";
import { toggleTable, fetchAndDisplayData, updateButtonsPosition } from "/static/src/populateTable.js"
import { loadMapboxGL, initializeMapboxMap } from "/static/src/mapLoader.js";
import {    closePopup,
    areaPopupContent} from "/static/src/mapFeaturePopups.js"
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

        await setupLazyLoadMap(sourcesMeta, csvUrl, trackingAttributes)

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
        document.getElementById('status-table-button').addEventListener('click', () => {
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
    const tableContainer = document.getElementById('status-table-container');
    const statusTable = document.getElementById('status-table');
    const BORDER_SIZE = 10;
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    tableContainer.addEventListener(
        'pointerdown', (e) => {
        if (e.target.id === 'table-bars-header') {
            // Start resizing
            isResizing = true;
            startY = e.clientY;
            startHeight = tableContainer.getBoundingClientRect().height;
            document.body.style.cursor = 'ns-resize';
        }
    });

    document.addEventListener("pointermove", (e) => {
        if (isResizing) {
            disableTextSelection();
            const deltaY = e.clientY - startY;
            let newHeight = startHeight - deltaY;


            // Get table scoll height
            const tableHeight = statusTable.scrollHeight + 50

            // Enforce min and max if desired
            const minHeight = 50; // pixels
            const maxHeight = Math.min(window.innerHeight * 0.8, tableHeight);
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            tableContainer.style.height = `${newHeight}px`;
            if (LOG) {console.debug("New height:", newHeight, "Window Inner", window.innerHeight);}
            updateButtonsPosition(newHeight);
        }
    });

    document.addEventListener("pointerup", function () {
        if (isResizing) {
            if (LOG) { console.debug("Pointer up detected. Resizing stopped."); }
        }
        isResizing = false;
        enableTextSelection();
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

async function setupMap(map, sourcesMeta, csvUrl, trackingAttributes) {
    if (LOG) {
    console.debug("sourcesMeta: ", sourcesMeta);
    console.debug("csvUrl: ", csvUrl);
    console.debug("trackingAttributes: ", trackingAttributes);
    }

    // Fetch table data
    if (sourcesMeta && trackingAttributes) {
        await fetchAndDisplayData(sourcesMeta, trackingAttributes)
    }

    // On Load event
    map.on('load', async () => {
        if (LOG) {
            console.debug('Map loaded');
        }

        const centroidPromise = fetch("/served/spatial/Centroids.json");

        if (!sourcesMeta || !sourcesMeta["mapbox_sources"]) {
            console.error("Failed to fetch or process sources data.");
            return;
        }

        // Pull out subcomponents
        const mapSources = sourcesMeta["mapbox_sources"];
        const {ProjectAreas, StateBoundary, WorkAreas} = sourcesMeta["mapbox_vector_names"];

        // Loop through each source and add it to the map
        if (sourcesMeta) {

            mapSources.forEach(( {id, ...rest} ) => {
                try {
                    const source = {id, ...rest};
                    map.addSource(id, {
                        ...rest
                    });
                } catch (sourceError) {
                    console.error(`Error adding source "${id}":`, sourceError);
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
        if (!sourcesMeta || !sourcesMeta["mapbox_vector_names"]) {
            console.error("Failed to fetch or process sources data.");
            return;
        }


        if (LOG) {
            console.debug("Fetched attributes: ", trackingAttributes);
        }
        // Apply attributes to Mapbox feature states
        Object.entries(trackingAttributes).forEach(([project_id, attributes]) => {
            map.setFeatureState(
                {
                    source: 'ProjectAreas',
                    id: project_id,
                    sourceLayer: ProjectAreas
                }, // Ensure id aligns with the `id` used in your vector tileset
                attributes // Attributes as key-value pairs
            );
        });
        if (LOG) {
            console.debug("Added tracking attributes.", trackingAttributes);
        }

        // const fsTest = map.getFeatureState(source: 'ProjectAreas')
        // console.debug("fsTest", fsTest)

        // Background
        // map.addLayer({
        //     id: 'background',
        //     type: 'background',
        //     maxzoom: 8,
        //     paint: {
        //         'background-color': 'rgb(135,75,75)',
        //         'background-opacity': 0.5,
        //     }
        // })

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
                'fill-antialias': true,
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
            "source-layer": ProjectAreas
        });

        // P02 Submission
        map.addLayer({
          id: 'P02_MM',
          type: 'fill',
          source: 'ProjectAreas',
          layout: {
            'visibility': 'none'
          },
          paint: {
              'fill-color': [
                'match',
                ['feature-state', 'P02_MM'],
                null, 'rgba(126,125,125,0.75)',  // Color if value is null
                'NaT', 'rgba(126,125,125,0.75)', // Color if value is 'NaT'
                '', 'rgba(126,125,125,0.58)',    // Color if value is an empty string
                'rgba(0,255,0,0.73)'             // Fallback (else)
              ]
          },
            "source-layer": ProjectAreas

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
            "source-layer": ProjectAreas
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
            "source-layer": ProjectAreas
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
                    'All on MM',
                    'rgba(2,248,138,0.69)', // 50% transparency
                    '2',
                    'rgba(225,250,0,0.69)', // 50% transparency
                    '1, 2',
                    'rgba(2,226,246,0.67)', // 50% transparency
                    'rgba(204, 204, 204, 0)', // 0% transparency
                ]
            },
            "source-layer": ProjectAreas
        });

        // // Add overall production layer
        // map.addLayer({
        //     id: 'prod-status',
        //     type: 'fill',
        //     source: 'ProjectAreas',
        //     layout: {
        //         // Make the layer visible by default.
        //         'visibility': 'none'
        //     },
        //     paint: {
        //         'fill-color': [
        //             'match',
        //             ['feature-state', 'Prod_Stage'],
        //             'Approved',
        //             'rgba(2,248,138,0.69)', // 50% transparency
        //             'In Backcheck',
        //             'rgba(225,250,0,0.69)', // 50% transparency
        //             'Submitted',
        //             'rgba(2,226,246,0.67)', // 50% transparency
        //             'In-Progress',
        //             'rgba(251,113,2,0.67)', // 50% transparency
        //             'Next',
        //             'rgba(0,84,112,0.3)', // Match fill color
        //             'rgba(204, 204, 204, 0)', // 0% transparency
        //         ]
        //     },
        //     "source-layer": vectorSourceNames.ProjectAreas
        // });

        // Add FRP Status Layers
        const frpColorStops = await createColorStops(trackingAttributes, 'FRP_Perc_Complete');
        if (LOG) {console.debug("frpColorStops", frpColorStops);}
        map.addLayer({
            id: 'frp-status',
            type: 'fill',
            source: 'ProjectAreas', // Ensure this matches your vector tile source name
            layout: {
                'visibility': 'none' // Set to 'visible' to display the layer by default
            },
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['to-number', ['feature-state', 'FRP_Perc_Complete']],
                    ...frpColorStops
                ],
                'fill-opacity': 0.5
            },
            "source-layer": ProjectAreas // Ensure this matches the layer name within your vector tileset
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
            "source-layer": ProjectAreas
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
            filter: ['==', 'project_id', ''],
            "source-layer": ProjectAreas
        });

        // Add state boundary layer
        map.addLayer({
            id: 'state-boundary-fill',
            type: 'fill',
            source: 'StateBoundary',
            paint: {'fill-color': 'rgba(255,255,255,0.85)'},
            filter: ['!=', ['get', 'STATEFP'], '19'],
            "source-layer": StateBoundary
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
            "source-layer": StateBoundary
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
            "source-layer": StateBoundary
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
                    "22-07-0035S", 'rgb(97,191,69)', // Color for FY21_2A
                    "23-07-0036S", 'rgb(193,3,47)', // Color for FY22_3A
                    "23-07-0037S", 'rgb(0,19,142)', // Color for FY22_3A
                    'rgba(0,0,0,0)' // Default color for unmatched cases
                ],
                'line-width': 3
            },
            "source-layer": WorkAreas
        });

        // Add labels for areas
        map.addLayer({
            id: 'areas-labels',
            type: 'symbol',
            source: 'ProjectAreas',
            minzoom: 7,
            layout: {
                'text-field': '{Name}',
                'text-size': 11,
                'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
                // 'text-radial-offset': 0.5,
                'text-justify': 'auto',
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'] // Regular font
            },
            paint: {
                'text-color': 'rgb(14,15,19)', // Text color
                'text-halo-color': 'rgba(247,247,247,0.65)', // No halo
                'text-halo-width': 1
            },
            "source-layer": ProjectAreas
        });

        // Add work area labels
        map.addLayer({
            id: 'work-area-labels',
            type: 'symbol',
            source: 'WorkAreas',
            "source-layer": WorkAreas,
            layout: {
                'text-field': ['get', 'MIP_Case'],
                'text-font': ['Arial Unicode MS Bold'], // Bold font
                'text-allow-overlap': false, // Allow overlapping labels
                'text-offset': [0, -1],
                'text-anchor': 'top',
                // 'text-radial-offset': 1,
                'text-justify': 'auto',
                'visibility': 'visible',
                'text-size': 16,
            },
            paint: {
                'text-color': [
                    'match', ['get', 'MIP_Case'],
                    "21-07-0002S", 'rgb(43,17,53)', // Color for FY20_1A
                    "22-07-0035S", 'rgb(17,34,13)', // Color for FY21_2A
                    "23-07-0036S", 'rgb(39,5,14)', // Color for FY22_3A
                    "23-07-0037S", 'rgb(2,8,48)', // Color for FY22_3A
                    'rgba(0,0,0,0)' // Default color for unmatched cases
                ],
                'text-halo-color': [
                    'match', ['get', 'MIP_Case'],
                    "21-07-0002S", 'rgb(194,167,204)', // Color for FY20_1A
                    "22-07-0035S", 'rgb(179,186,174)', // Color for FY21_2A
                    "23-07-0036S", 'rgb(182,163,178)', // Color for FY22_3A
                    "23-07-0037S", 'rgb(142,146,175)', // Color for FY22_3A
                    'rgba(0,0,0,0)' // Default color for unmatched cases
                ], // Halo color
                'text-halo-width': 1
            } // Filter to include features without PBL_Assign or PBL_Assign is an empty string
        });

        // Use the Flask route to fetch the GeoJSON data
        const jsonData = await fetchGeoJSON("/served/spatial/S_Submittal_Info_IA_BLE.geojson");
        const colorStops = await createColorStops(jsonData);
        if (LOG) {console.debug("colorStops", colorStops);}

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



        // Add a transparent fill layer for interaction
        map.addLayer({
            id: 'areas-interaction',
            type: 'fill',
            source: 'ProjectAreas',
            paint: {
                'fill-color': 'rgba(0, 0, 0, 0)' // Fully transparent fill
            },
            "source-layer": ProjectAreas
        });

        // Add layer-group control
        const controlLayers = {
            'P02 GDB': ["P02_MM"],
            'Draft MIP': ['draft-mip'],
            'FP MIP': ['fp-mip'],
            'Hydraulics MIP': ['hydraulics-mip'],
            'FRP Status': ['frp-status'],
            // 'Draft Status Detail': ['prod-status'],
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
            "P02 GDB Status": "P02_MM",
            'FP MIP Status': 'fp-mip',
            'Hydra MIP Status': 'hydraulics-mip',
            // 'Production Status': 'prod-status',
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
                let fid = feature.properties.project_id;
                if (fid !== undefined) {
                    map.setFilter('areas-highlight', ['==', 'project_id', fid]);
                }
                // Calculate the centroid of the polygon
                const centroid = turfcentroid(clickedfeature);
                const coordinates = e.lngLat;

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
                }
            }
        });

        // Add event listeners for mouse enter and leave -- NON CLICKs
        function addInteractionEvents(map, layer) {


            function highlightFeature(fid) {

                map.setFilter('areas-highlight', ['==', 'project_id', fid]);

            }

            map.on("hover", layer, (e) => {
                map.getCanvas().style.cursor = 'pointer';
                highlightFeature(e);
            });

            // Primary event handlers using pointer events
            map.on('pointermove', layer, (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    const fid = feature.properties.project_id;
                    if (fid !== undefined) {
                        map.getCanvas().style.cursor = 'pointer';
                        highlightFeature(fid);
                    }
                }
            });

            map.on('pointerleave', layer, () => {
                map.setFilter('areas-highlight', ['==', 'project_id', '']);
                map.getCanvas().style.cursor = '';
            });

            // Fallback event handlers using mouse events
            map.on('mousemove', layer, (e) => {
                map.getCanvas().style.cursor = 'pointer';
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    const fid = feature.properties.project_id;
                    if (LOG) {
                        console.debug('Feature ID:', fid);
                    }
                    if (fid !== undefined) {
                        map.setFilter('areas-highlight', ['==', 'project_id', fid]);
                    }
                }
            });

            map.on('mouseleave', layer, () => {
                if (LOG) {
                    console.debug('Mouse leave event detected');
                }
                map.setFilter('areas-highlight', ['==', 'project_id', '']);
                map.getCanvas().style.cursor = '';
            });
        }

        // Call the function to add event listeners
        addInteractionEvents(map, 'areas-interaction');
    });

}

/**
 * Set up lazy loading for Mapbox GL JS using Intersection Observer.
 * @param {Object} sourcesMeta - Metadata for map sources.
 * @param {string} csvUrl - URL to the CSV data.
 * @param {Object} trackingAttributes - Attributes for tracking.
 */
async function setupLazyLoadMap(sourcesMeta, csvUrl, trackingAttributes) {
    // Select the map container
    const mapContainer = document.getElementById('map');

    if (!mapContainer) {
        console.error("Map container not found.");
        return;
    }

    // Define Intersection Observer options
    const options = {
        root: null, // Use the viewport as the root
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of the map is visible
    };

    // Create the Intersection Observer
    const observer = new IntersectionObserver(
        async (entries, observerInstance) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                try {
                    console.log("Map container is in view. Loading Mapbox GL JS...");
                    // Load Mapbox GL JS and CSS
                    await loadMapboxGL();

                    // Retrieve Mapbox access token
                    const token = await getMapBoxToken();

                    // Initialize the Mapbox map
                    const map = initializeMapboxMap({
                        container: 'map',
                        style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
                        projection: 'albers',
                        zoom: 6,
                        minZoom: 0,
                        center: [-93.5, 42],
                        token: token,
                        controls: [
                            { type: 'NavigationControl', options: { showCompass: true, showZoom: true } }
                        ]
                    });
                    setMap(map);

                    // Proceed with additional map setup
                    await setupMap(map, sourcesMeta, csvUrl, trackingAttributes);

                    console.log("Map initialized successfully.");
                } catch (error) {
                    console.error("Error loading Mapbox GL JS or initializing map:", error);
                } finally {
                    // Stop observing after the map has been loaded and initialized
                    observerInstance.unobserve(entry.target);
                }
            }
        }
        }, options);

    // Start observing the map container
    observer.observe(mapContainer);
}



