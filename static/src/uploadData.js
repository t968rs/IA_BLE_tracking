// static/src/uploadData.js
const DEBUG_STATUS = false;
const dC = (message) => {
    if (DEBUG_STATUS) {
        console.debug(message);
    }
};


import { getMap, setTableLoaded } from '/static/src/mapManager.js';
import { initSourcesWorker, initAttributesWorker } from "/static/src/workers/initWorkers.js";

// Main function to handle the upload button click
export function handleUploadButtonClick() {
    const fileInput = getFileInput(); // Get or create the file input element

    // Trigger the file picker immediately as part of the user interaction
    fileInput.click();
}

// Function to handle file selection
async function handleFileSelection(event) {
    const files = event.target.files;

    if (files && files.length > 0) {
        // Perform password validation after file selection
        const passwordValid = await validatePassword();
        if (!passwordValid) {
            alert("Invalid password. Upload cancelled.");
            return;
        }

        // Proceed with file upload
        try {
            await uploadFilesToServer(files);
            alert("Files uploaded successfully!");
            await updateMapData(); // Update map data source if needed
        } catch (error) {
            console.error("Error uploading files:", error);
            alert("Failed to upload files. Please try again.");
        }
    }
}

// Function to validate the password
async function validatePassword() {
    const userInput = prompt("Please enter the upload password:");
    if (!userInput) {
        alert("Password is required to proceed.");
        return false;
    }

    try {
        const response = await fetch('/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: userInput,
                password_variable: "UPLOAD_PASSWORD", // Replace with your actual variable
            }),
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message || "Password accepted.");
            return true;
        } else {
            const result = await response.json();
            alert(result.message || "Sorry, you can't upload.");
            return false;
        }
    } catch (error) {
        console.error("Error during password verification:", error);
        alert("An error occurred during password verification. Please try again.");
        return false;
    }
}


async function uploadFilesToServer(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    const response = await fetch("/update-tracking-geojson", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(`Server error: ${result.message}`);
    }

    // Set table status to not loaded
    setTableLoaded(false);
}

// Function to update the map data source
async function updateMapData() {
    // const socket = io(); // e.g., http://localhost:5000
    //
    // socket.on('connect', () => {
    //     console.log('WebSocket connection established!');
    // });
    //
    // socket.on('data_updated', async (data) => {
    // console.log(data.message);
    // Re-fetch the CSV attributes

    const [jsonUrl, csvUrl] = ['/served/mapbox_metadata/mapbox_sources.json',
    '/served/spatial/IA_BLE_Tracking_attributes.csv'];

    try {

        // Once updatedAttributes is ready, you can reapply the attributes using setFeatureState
        const map = getMap(); // assuming getMap returns your Mapbox instance

        // If your table is displayed somewhere, re-fetch that or update it as needed
        const [sourcesData, attributesData] = await Promise.all([
            initSourcesWorker(jsonUrl),
            initAttributesWorker(csvUrl)
        ]);

        const vectorSourceNames = sourcesData.mapbox_vector_names;

        dC("Fetched attributes: ", attributesData)

        // Apply attributes to Mapbox feature states
        Object.entries(attributesData).forEach(([project_id, attributes]) => {
            map.setFeatureState(
                {source: 'ProjectAreas', id: project_id, sourceLayer: vectorSourceNames.ProjectAreas}, // Ensure HUC8 aligns with the `id` used in your vector tileset
                attributes // Attributes as key-value pairs
            ); // TODO switch from HUC8 to project_id
        });

        console.log("Attributes reloaded from updated CSV.");
    } catch (err) {
        console.error("Error updating attributes from CSV:", err);
    }
}

// Function to create or retrieve the file input element
function getFileInput() {
    let fileInput = document.getElementById("file-upload-input");

    if (!fileInput) {
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "file-upload-input";
        fileInput.accept = ".geojson,.shp,.dbf,.shx,.prj,.cpg";
        fileInput.multiple = true;
        fileInput.style.display = "none"; // Hide the input element
        document.body.appendChild(fileInput);

        // Add event listener for file selection
        fileInput.addEventListener("change", handleFileSelection);
    }

    return fileInput;
}

