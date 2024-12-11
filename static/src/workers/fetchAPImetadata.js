import * as Comlink from '/static/src/comlink.mjs';

console.log("Worker initialized: Fetching data");

async function fetchSourcesData(jsonUrl) {
    console.log(`Fetching JSON from ${jsonUrl}`);
    try {
        const response = await fetch(jsonUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch JSON: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Fetched JSON:", data); // Verify data is received
        return data;
    } catch (error) {
        console.error("Error fetching sources data in worker:", error);
        return { error: error.message };
    }
}

Comlink.expose({ fetchSourcesData });

