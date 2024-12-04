export function getEditor(map, editableLayers) {
    // Add the button and form to the map container
    const mapContainer = document.getElementById('map');
    mapContainer.insertAdjacentHTML('beforeend', document.getElementById('edit-form').outerHTML);

    const editModeBtn = document.getElementById('edit-mode-btn');
    const editForm = document.getElementById('edit-form');
    const featureEditForm = document.getElementById('feature-edit-form');
    const exitEditModeBtn = document.getElementById('exit-edit-mode-btn');
    const saveBtn = document.getElementById('save-btn');
    let selectedFeature = null;

    // Enable edit mode
    editModeBtn.addEventListener('click', () => {
        map.getCanvas().style.cursor = 'crosshair';
        map.on('click', onMapClick);
    });

    // Handle map click to select a feature
    function onMapClick(e) {
        const features = map.queryRenderedFeatures(e.point, {
            layers: editableLayers
        });

        if (features.length) {
            selectedFeature = features[0];
            populateEditForm(selectedFeature.properties);
            editForm.style.display = 'block';
            map.getCanvas().style.cursor = '';
            map.off('click', onMapClick);
        }
    }

    // Populate the edit form with feature properties
    function populateEditForm(properties) {
        featureEditForm.innerHTML = '';
        for (const [key, value] of Object.entries(properties)) {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = key;
            input.value = value;
            input.placeholder = key;
            featureEditForm.appendChild(input);
        }
        // Ensure the save button is appended
        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.id = 'save-btn';
        saveButton.textContent = 'Save';
        featureEditForm.appendChild(saveButton);
    }

    // Handle form submission to save updated values
    featureEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(featureEditForm);
        const updatedProperties = {};
        formData.forEach((value, key) => {
            updatedProperties[key] = value;
        });

        // Update the feature properties in the GeoJSON source
        const source = map.getSource('ProjectAreas');
        if (source) {
            console.log("Source: ", source);
            const data = source._data || source._options.data || source._data.data;
            if (data && data.features) {
                const feature = data.features.find(f => f.id === selectedFeature.id);
                if (feature) {
                    feature.properties = updatedProperties;
                    source.setData(data);
                    editForm.style.display = 'none';
                    selectedFeature = null;
                } else {
                    console.error('Feature not found');
                }
            } else {
                console.error('Data or features not found');
            }
        } else {
            console.error('Source not found');
        }
    });

    // Handle save button click to trigger form submission
    saveBtn.addEventListener('click', () => {
        featureEditForm.dispatchEvent(new Event('submit'));
    });

    // Handle exit edit mode button click
    exitEditModeBtn.addEventListener('click', () => {
        map.getCanvas().style.cursor = '';
        map.off('click', onMapClick);
        editForm.style.display = 'none';
        selectedFeature = null;
    });
}