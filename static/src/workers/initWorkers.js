import * as Comlink from '/static/src/comlink.mjs';
const DEBUG_STATUS = false;
import { debugConsole } from "/static/src/debugging.js";
let dC;
if (!DEBUG_STATUS) { dC = () => {}; } else { dC = debugConsole; }


// Function to initialize the worker
export function initSourcesWorker() {
    let fetchedSources = null; // This will store the JSON data fetched by the worker
    let fetchPromise = null;   // A promise to resolve when the worker completes fetching

    // Initialize the worker at the top of main.js
    (async function initMetaWorker() {
        const worker = new Worker("/static/src/workers/fetchAPImetadata.js", {type: "module"});
        dC("Meta worker", worker);
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


export function initAttributesWorker(csvUrl) {
    dC("Initialize attributes worker");
    let fetchPromise = null;
    let fetchedAttributes = null;

    // Initialize the worker at the top of main.js
    (async function initAttWorker() {
        const worker = new Worker("/static/src/workers/fetchTrackingAttributes.js",
            {type: "module"});
        const api = Comlink.wrap(worker);
        dC("Att worker", worker);

        // Start fetching data immediately and save the promise
        fetchPromise = api.fetchTrackingAttributes(csvUrl)
            .then((data) => {
                dC("Promise: ", fetchPromise)
                if (data) {
                    fetchedAttributes = data; // Save fetched data globally
                    dC("Fetched attributes worker", fetchedAttributes);
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