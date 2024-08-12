import {
    areaPopupContent,
    fitMapToFeatureBounds,
    closePopup,
    convertCoordinates
} from './src/mapInteractions.js';

mapboxgl.accessToken = 'pk.eyJ1IjoidDk2OHJzIiwiYSI6ImNpamF5cTcxZDAwY2R1bWx4cWJvd3JtYXoifQ.XqJkBCgSJeCCeF_yugpG5A';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/t968rs/clzn9s7ej006e01r31wsob7kj',
    projection: 'albers', // Display the map as a globe, since satellite-v9 defaults to Mercator
    zoom: 6,
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
    map.addSource('ProjectAreas', {
        type: 'geojson',
        data: './data/spatial/Iowa_BLE_Tracking.geojson'
    });

    // Fit bounds
    console.log("Map Added/Loaded");
    map.getSource('ProjectAreas').on('data', (e) => {
        if (e.isSourceLoaded) {
            map.fitBounds(turf.bbox(e.source.data), {
                padding: 30,  // Increase the padding to zoom out more
                maxZoom: 15,
                minZoom: 3,
                duration: 1000
            });
        }
    });

    // Add layers and symbology
    map.addLayer({
        id: 'pbl-areas',
        type: 'fill',
        source: 'ProjectAreas',
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
                '* other *',
                'rgba(204, 204, 204, 0)', // 0% transparency
                'rgba(0, 0, 0, 0)' // Default color for unmatched cases
            ]
        }
    });

    map.addLayer({
        id: 'pbl-areas-outline',
        type: 'line',
        source: 'ProjectAreas',
        paint: {
            'line-color': 'rgb(247, 247, 247)',
            'line-width': 1
        }
    });

    // Add labels for features with PBL_Assign values
    map.addLayer({
        id: 'pbl-areas-labels-with-pbl',
        type: 'symbol',
        source: 'ProjectAreas',
        layout: {
            'text-field': ['concat', ['get', 'PBL_Assign'], ', ', ['get', 'Name__HUC8']],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] // Bold font
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
                '* other *', 'rgba(204, 204, 204, 0)', // Default halo color
                'rgba(0, 0, 0, 0)' // Default halo color for unmatched cases
            ],
            'text-halo-width': 1 // Halo width
        },
        filter: ['any', ['has', 'PBL_Assign'], ['!=', ['get', 'PBL_Assign'], '']] // Filter to only include features with PBL_Assign
    });

    // Add labels for features without PBL_Assign values
    map.addLayer({
        id: 'pbl-areas-labels-without-pbl',
        type: 'symbol',
        source: 'ProjectAreas',
        layout: {
            'text-field': ['get', 'Name__HUC8'],
            'text-size': 12,
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'] // Regular font
        },
        paint: {
            'text-color': 'rgb(247, 247, 247)', // Text color
            'text-halo-color': 'rgba(0, 0, 0, 0)', // No halo
            'text-halo-width': 0 // No halo width
        },
        filter: ['any', ['!', ['has', 'PBL_Assign']], ['==', ['get', 'PBL_Assign'], '']] // Filter to include features without PBL_Assign or PBL_Assign is an empty string
    });

    // Add highlight hover
    map.addLayer({
        id: 'pbl-areas-highlight',
        type: 'fill',
        source: 'ProjectAreas',
        paint: {
            'fill-color': 'rgba(255, 255, 255, 0.5)' // Transparent white for highlight
        },
        filter: ['==', 'HUC8', ''] // Initially no feature is highlighted
    });

    console.log('Layers added')
    console.log('ProjectAreas', map.getSource('ProjectAreas'));

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
            const featureBounds = turf.bbox(clickedfeature);
            let locid = features[0].properties["loc_id"];
            console.log(" FeatureBounds: ", featureBounds);

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


            // Convert feature bounds
            const convertedFeatureBounds = [
                convertCoordinates([featureBounds[0], featureBounds[1]]),
                convertCoordinates([featureBounds[2], featureBounds[3]])
            ];

            // Create a new LngLatBounds object from the converted feature bounds
            const popupBounds = new mapboxgl.LngLatBounds(convertedFeatureBounds[0],
                convertedFeatureBounds[1]);


/*            /!*!// Extend the bounding box to include the popup dimensions
            const popupWidth = 2; // Adjust based on your popup width
            const popupHeight = 1; // Adjust based on your popup height
*!/
            popupBounds.extend(popupWidth);
            popupBounds.extend(popupHeight);*/
            console.log("Popup Bounds: ", popupBounds);

            map.fitBounds(popupBounds, {
                padding: 30,
                maxZoom: 15,
                minZoom: 5,
                duration: 1000
                });
        }
    });



    // Add event listeners for mouse enter and leave
    map.on('mousemove', 'pbl-areas', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const pblAssign = feature.properties.PBL_Assign;
            if (pblAssign !== undefined) {
                map.setFilter('pbl-areas-highlight', ['==', 'PBL_Assign', pblAssign]);
            }
        }
    });

    map.on('mouseleave', 'pbl-areas', () => {
        map.setFilter('pbl-areas-highlight', ['==', 'PBL_Assign', '']);
    });

    // Add event listeners for mouse enter and leave
    map.on('mouseenter', 'pbl-areas', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'pbl-areas', () => {
        map.getCanvas().style.cursor = '';
    });
});