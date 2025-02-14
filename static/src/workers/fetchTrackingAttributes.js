import * as Comlink from '/static/src/comlink.mjs';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

console.log("Worker initialized: Fetching data");


async function fetchTrackingAttributes(csvUrl) {
    try {
        const data = await d3.csv(csvUrl);
        if (!data || !Array.isArray(data)) {
            throw new Error("Invalid or empty CSV data");
        }

        const attributes = {};
        data.forEach((row) => {
            // console.debug(row)
            const feat_id = row.project_id;
            if (feat_id) {
                attributes[feat_id] = { ...row };
            }
        });
        return attributes;
    } catch (error) {
        console.error("Error fetching attributes:", error);
        return { error: error.message };
    }
}

// Expose the function for Comlink
Comlink.expose({ fetchTrackingAttributes });
