import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

// Function to initialize the worker
export function initSourcesWorker() {
    let fetchedSources = null; // This will store the JSON data fetched by the worker
    let fetchPromise = null;   // A promise to resolve when the worker completes fetching

// Initialize the worker at the top of main.js
    (async function initMetaWorker() {
        const worker = new Worker("/static/src/workers/fetchAPImetadata.js", {type: "module"});
        const api = Comlink.wrap(worker);

        // Start fetching data immediately and save the promise
        fetchPromise = api.fetchAPImetadata()
            .then((data) => {
                if (data) {
                    fetchedSources = data; // Save fetched data globally
                } else {
                    console.error("Worker returned null or undefined data.");
                }
                worker.terminate(); // Clean up the worker
            })
            .catch((error) => {
                console.error("Error fetching data from the worker:", error);
            });
    })();

// Function to get data when needed
    async function getSourcesMeta() {
        if (fetchedSources) {
            return fetchedSources; // Return already-fetched data
        }
        if (fetchPromise) {
            await fetchPromise;    // Wait for the ongoing fetch to complete
            return fetchedSources;
        }
        throw new Error("Worker has not been initialized or failed to fetch data.");
    }

    return getSourcesMeta;
}


export function initAttributesWorker() {
    let fetchPromise = null;
    let fetchedAttributes = null;


    // Initialize the worker at the top of main.js
    (async function initMetaWorker() {
        const worker = new Worker("/static/src/workers/fetchTrackingAttributes.js",
            {type: "module"});
        const api = Comlink.wrap(worker);

        // Start fetching data immediately and save the promise
        fetchPromise = api.fetchTrackingAttributes()
            .then((data) => {
                if (data) {
                    fetchedAttributes = data; // Save fetched data globally
                } else {
                    console.error("Worker returned null or undefined data.");
                }
                worker.terminate(); // Clean up the worker
            })
            .catch((error) => {
                console.error("Error fetching data from the worker:", error);
            });
    })();

// Function to get data when needed
    async function getTrackingAttributes() {
        if (fetchedAttributes) {
            return fetchedAttributes; // Return already-fetched data
        }
        if (fetchPromise) {
            await fetchPromise;    // Wait for the ongoing fetch to complete
            return fetchedAttributes;
        }
        throw new Error("Worker has not been initialized or failed to fetch data.");
    }

    return getTrackingAttributes;
}