const draw = new MapboxDraw({
        displayControlsDefault: false,
        // Select which mapbox-gl-draw control buttons to add to the map.
        controls: {
            polygon: true,
            trash: true
        },
        // Set mapbox-gl-draw to draw by default.
        // The user does not have to click the polygon control button first.
        // defaultMode: 'draw_polygon'
    });
    console.log("Draw: ", draw.controls)
    map.addControl(draw, 'top-right');


    // Retrieve the current data from the userDataSource
    const currentData = map.querySourceFeatures('user', {sourceLayer: 'user-draw-layer'});
    console.log("Current Data: ", currentData);
    // Event listener for when a feature is created
    map.on('draw.create', (e) => {
        const feature = e.features[0];
        const initials = prompt("Enter your initials:");
        if (initials) {
            feature.properties.initials = initials;
            console.log("Feature saved with initials:", feature);
        }
        const userInput = prompt("Enter text for the feature:");
        if (userInput) {
            feature.properties.description = userInput;
            console.log("Feature saved with user input:", feature);
        } else {
            console.log("No input provided. Feature not saved.");
        }

        // Retrieve the current data from the userDataSource
        const currentData = map.querySourceFeatures('user');
        console.log("Current Data: ", currentData);

        // Add the new feature to the current data
        // currentData.features.push(feature);

        // Update the data source with the new GeoJSON
        map.getSource('user').setData(feature);
    });