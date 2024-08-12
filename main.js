import {
    areaPopupContent,
    fitMapToFeatureBounds,
    closePopup
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

    // Add labels
    map.addLayer({
        id: 'pbl-areas-labels',
        type: 'symbol',
        source: 'ProjectAreas',
        layout: {
            'text-field': [
                'case',
                ['has', 'PBL_Assign'],
                ['concat', ['get', 'PBL_Assign'], ', ', ['get', 'Name__HUC8']],
                ['get', 'Name__HUC8']
            ],
            'text-size': 12,
            'text-font': [
                'case',
                ['has', 'PBL_Assign'],
                ['Open Sans Bold', 'Arial Unicode MS Bold'],
                ['Open Sans Regular', 'Arial Unicode MS Regular']
            ]
        },
        paint: {
            'text-color': 'rgb(247, 247, 247)', // Change text color
            'text-halo-color': [
                'case',
                ['has', 'PBL_Assign'],
                [
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
                'rgba(0, 0, 0, 0)' // No halo if PBL_Assign is not defined
            ],
            'text-halo-width': [
                'case',
                ['has', 'PBL_Assign'],
                1,
                0
            ] // Define halo width
        }
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
            let locid = features[0].properties["loc_id"];
            console.log("Coordinates: ", coordinates);

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