import * as Comlink from '/static/src/comlink.mjs';

function initSourcesWorker(jsonUrl) {
    const worker = new Worker('/static/src/workers/fetchAPImetadata.js', { type: 'module' });
    const api = Comlink.wrap(worker);
    return api.fetchSourcesData(jsonUrl); // Call exposed function
}

function initAttributesWorker(csvUrl) {
    const worker = new Worker('/static/src/workers/fetchTrackingAttributes.js', { type: 'module'});
    const api = Comlink.wrap(worker);
    return api.fetchTrackingAttributes(csvUrl); // Call exposed function
}

async function debugWorkers(jsonUrl, csvUrl) {
    console.log("Initializing sources worker...");
    const sourcesData = await initSourcesWorker(jsonUrl);
    console.log("Sources Data:", sourcesData);

    console.log("Initializing attributes worker...");
    const attributesData = await initAttributesWorker(csvUrl);
    console.log("Attributes Data:", attributesData);
}

export { initSourcesWorker, initAttributesWorker, debugWorkers };
