import * as Comlink from '/static/src/comlink.mjs';

async function fetchAPImetadata() {
  try {
    const response = await fetch("/api/sources");
    if (!response.ok) {
      console.error(`Failed to fetch sources: ${response.statusText}`);
      return null; // Return null to indicate failure
    }
    const jsonResponse = await response.json();
    if (!jsonResponse.mapbox_sources || !Array.isArray(jsonResponse.mapbox_sources)) {
      console.error("Invalid structure for sources data:", jsonResponse);
      return null; // Return null to indicate invalid structure
    }
    return jsonResponse;
  } catch (networkError) {
    console.error("Network or unexpected error loading sources:", networkError);
    return null; // Return null to indicate failure
  }
}

// Expose the `fetchAPImetadata` function to the main thread
const api = {
  fetchAPImetadata
};

Comlink.expose(api);
