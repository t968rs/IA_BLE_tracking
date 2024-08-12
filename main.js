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
    zoom: 3,
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

    console.log('Locations loaded')

    map.addLayer({
        id: 'pbl-areas',
        type: 'fill',
        source: 'ProjectAreas',
        paint: {
            'fill-color': [
                'match',
                ['get', 'PBL_Assign'],
                'RK',
                '#d65f00',
                'EC',
                '#005caf',
                'QB',
                '#5ee5cc',
                'MT',
                '#3ba3d0',
                '* other *',
                'rgba(204,204,204,0)',
                '#000000' // Default color for unmatched cases
            ]
        }
    });
    console.log('Layers added')

// Popups for each layer
    map.on('click', async (e) => {
        const features = map.queryRenderedFeatures(e.point);
        if (!features.length) {
            console.log('No features found')
            if (loc_popup) {
                loc_popup.remove(); // Close the popup if no feature is clicked
                loc_popup = null;
            }
            return;
        }

        console.log('Features found')
        // Remove any existing popup to prevent content from appending
        if (loc_popup) {
            loc_popup.remove();
        }

        // Handle the features found
        for (const clickedfeature of features) {
            const coordinates = clickedfeature.geometry.coordinates.slice();
            let hullid = features[0].properties["hull_no"];
            let hull_filter = ["==", ["get", "hull_no"], hullid];
            let locid = features[0].properties["loc_id"];
            let loc_filter = ["==", ["get", "loc_id"], locid];

            // Ensure that if the map is zoomed out such that multiple
            // copies of the feature are visible, the popup appears
            // over the copy being pointed to.
            if (['mercator', 'equirectangular'].includes(map.getProjection().name)) {
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }
            }
            const mapPopupContent = await areaPopupContent(clickedfeature);
            // Create the popup
            new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                anchor: 'bottom', // Adjust anchor as needed (bottom, top, left, right)
                offset: [0, -15] // Adjust offset as needed to make sure popup is visible
            })
            // Display a popup with attributes/columns from the clicked feature
            loc_popup = new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(mapPopupContent)
                .addTo(map);
        }
    });
});