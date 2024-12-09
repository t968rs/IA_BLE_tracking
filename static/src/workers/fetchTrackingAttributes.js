import { expose } from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

export async function fetchTrackingAttributes() {

    // Fetch attributes from a served JSON file
    try {
        const attributesResponse = await fetch('/served/spatial/IA_BLE_Tracking_attributes.json');
        if (!attributesResponse.ok) {
            console.error(`Failed to fetch attributes: ${attributesResponse.statusText}`);
            return null; // Return null to indicate failure
        }
        const attributesData = await attributesResponse.json();
        if (!attributesData || typeof attributesData !== 'object') {
            console.error("Invalid structure for attributes data:", attributesData);
            return null; // Return null to indicate invalid structure
        }
        return attributesData;
    }
    catch (networkError) {
        console.error("Network or unexpected error loading attributes:", networkError);
        return null; // Return null to indicate failure
    }
}


// Expose the `fetchAPImetadata` function to the main thread
const api = {
  fetchTrackingAttributes
};

expose(api);
