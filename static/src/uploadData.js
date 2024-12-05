// Import getMap from mapManager.js
import { getMap } from './mapManager.js';

export async function handleUploadButtonClick() {
    // Prompt user for input
    const userInput = prompt("Please enter the upload password:");

    try {
        const response = await fetch('/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: userInput ,
            password_variable: "UPLOAD_PASSWORD"}),
        });

        if (response.ok) {
            const result = response.json();
            alert(result.message || "Password accepted. You can now upload data.");
            fileInput()
        } else {
            const result = response.json();
            alert(result.message || "Sorry, you can't upload.");
        }
    } catch (error) {
        console.error("Error during password verification:", error);
        alert("An error occurred. Please try again.");
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
}

// Function to update the map data source
function updateMapData() {
    const map = getMap();
    if (map && map.getSource("ProjectAreas")) {
        // Update the data of the source with a cache-busting parameter
        map.getSource("ProjectAreas").setData('/data/spatial/IA_BLE_Tracking.geojson?timestamp=' + new Date().getTime());
    } else {
        console.error("Map or ProjectAreas source not found.");
    }
}

function fileInput() {
        // Create a file input element
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".geojson,.shp,.dbf,.shx,.prj,.cpg"; // Accept GeoJSON and shapefile components
    fileInput.multiple = true; // Allow multiple file selection
    fileInput.style.display = "none";

    // Listen for file selection
    fileInput.addEventListener("change", async (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            try {
                // Upload the files to the server
                await uploadFilesToServer(files);
                alert("Files uploaded successfully!");

                // Update the map data source
                updateMapData();
            } catch (error) {
                console.error("Error uploading files:", error);
                alert("Failed to upload files. Please try again.");
            }
        }
    });

    // Trigger the file dialog
    document.body.appendChild(fileInput);
    fileInput.click();

    // Remove the file input after use
    fileInput.remove();

}
