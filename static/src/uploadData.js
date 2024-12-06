// Import getMap from mapManager.js
import { getMap } from './mapManager.js';

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
            updateMapData(); // Update map data source if needed
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

