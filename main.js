import {
    areaPopupContent,
    fitMapToFeatureBounds,
    closePopup,
    ensurePopupFits,
    updateLegendOnVisibilityChange,
    populateLegend,
    createLayerControls,
} from './src/mapInteractions.js';

mapboxgl.accessToken = 'pk.eyJ1IjoidDk2OHJzIiwiYSI6ImNpamF5cTcxZDAwY2R1bWx4cWJvd3JtYXoifQ.XqJkBCgSJeCCeF_yugpG5A';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
    projection: 'albers', // Display the map as a globe, since satellite-v9 defaults to Mercator
    zoom: 7,
    minZoom: 0,
    center: [-93, 41]
});

// Add user control
map.addControl(new mapboxgl.NavigationControl());

// Attach the closePopup function to the global window object
window.closePopup = closePopup;

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
    map.addSource('StateBoundary', {
        type: 'geojson',
        data: './data/spatial/US_states.geojson'
    })

    // Fit bounds
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
            'visibility': 'visible'
        },
        paint: {
            'fill-color': [
                'match',
                ['get', 'which_grid'],
                '0, 1, 2',
                'rgba(255,90,88,0.35)', // 50% transparency
                '1, 2',
                'rgba(0,255,196,0.6)', // 50% transparency
                '2',
                'rgba(230,152,0,0.5)', // 50% transparency
                'All on MM',
                'rgba(5,205,52,0.75)', // 50% transparency
                '* other *',
                'rgba(204, 204, 204, 0)', // 0% transparency
                'rgba(0, 0, 0, 0)' // Default color for unmatched cases
            ]
        },
        filter: ['!=', ['get', 'which_grid'], null]
    });

    /*    // Fit bounds
    console.log("Layer added");
    map.on('data', (e) => {
    if (e.dataType === 'source' && e.sourceId === 'ProjectAreas' && map.getLayer('pbl-areas')) {
        const features = map.querySourceFeatures('ProjectAreas', { sourceLayer: 'pbl-areas' });
        if (features.length > 0) {
            const bbox = turf.bbox({
                type: 'FeatureCollection',
                features: features
                });
            map.fitBounds(bbox, {
                padding: 30,  // Increase the padding to zoom out more
                maxZoom: 15,
                minZoom: 3,
                duration: 1000
                });
            }
        }
    });*/

    // Add highlight hover layer
    map.addLayer({
        id: 'areas-highlight',
        type: 'fill',
        source: 'ProjectAreas',
        paint: {
            'fill-color': 'rgba(255, 255, 255, 0.5)' // Transparent white for highlight
        },
        filter: ['==', 'loc_id', ''] // Initially no feature is highlighted
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
            'text-allow-overlap': true // Allow overlapping labels
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
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-anchor': 'bottom',
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'] // Regular font
        },
        paint: {
            'text-color': 'rgb(0,28,58)', // Text color
            'text-halo-color': 'rgba(218,255,184,0)', // No halo
            'text-halo-width': 0.5
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

    console.log('Layers added');
    // create legend
    const layersToInclude = [
        { id: 'pbl-areas', alias: 'Assignments' },
        { id: 'grid-status', alias: 'Grid Status' },
        // Add more layers as needed
    ];
    const mapLegend = populateLegend(map, layersToInclude);
    // Assuming `map` and `layersToInclude` are already defined
    updateLegendOnVisibilityChange(map, layersToInclude);

    const layerGroups = {
    'Grid Statuses': ['grid-status'],
    'Assignments': ['pbl-areas', 'pbl-areas-labels-with-pbl',],
    // Add more groups and layers as needed
    };
    createLayerControls(map, layerGroups);


    map.on('click', async (e) => {
    const features = map.queryRenderedFeatures(e.point);
    if (!features.length) {
        console.log('No features found');
        if (loc_popup) {
            loc_popup.remove(); // Close the popup if no feature is clicked
            loc_popup = null;
        }
        return;
    }
    // Check if the feature belongs to the 'areas-interaction' layer
    const feature = features.find(f => f.layer.id === 'areas-interaction');
    if (!feature) {
        console.log('Clicked feature is not part of areas-interaction');
        if (loc_popup) {
            loc_popup.remove(); // Close the popup if no valid feature is clicked
            loc_popup = null;
        }
        return;
    }

    console.log('Features found');
    // Remove any existing popup to prevent content from appending
    if (loc_popup) {
        loc_popup.remove();
    }

    // Handle the features found
    for (const clickedfeature of features) {
        // Calculate the centroid of the polygon
        const centroid = turf.centroid(clickedfeature);
        const coordinates = centroid.geometry.coordinates;
        let locid = features[0].properties["loc_id"];
        console.log("Feature ID: ", locid);

        // Ensure coordinates are in the correct format
        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            console.error('Invalid coordinates format');
            continue;
        }

        const mapPopupContent = await areaPopupContent(clickedfeature);
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


        // Ensure the popup fits within the current map bounds
        // fitMapToFeatureBounds(map, clickedfeature);
    }
    });


    // Add event listeners for mouse enter and leave
    map.on('mousemove', 'areas-interaction', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const fid = feature.properties.loc_id;
            if (fid !== undefined) {
                map.setFilter('areas-highlight', ['==', 'loc_id', fid]);
            }
        }
    });

    map.on('mouseleave', 'areas-interaction', () => {
        map.setFilter('areas-highlight', ['==', 'loc_id', '']);
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
        console.log('Current Map Bounds:', bounds);
    });
});