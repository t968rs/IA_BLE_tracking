import * as Comlink from '/static/src/comlink.mjs';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
const DEBUG_STATUS = false;
import { debugConsole } from "/static/src/debugging.js";

let dC;
if (!DEBUG_STATUS) { dC = () => {}; } else { dC = debugConsole; }
if (DEBUG_STATUS){console.log("Debug is on for fetchTrackingAttributes");}


async function fetchTrackingAttributes(csvUrl) {

   try {
       console.debug("Start: ", csvUrl);
       const data = await parseCSV(csvUrl);
       if (!data || !Array.isArray(data)) {
           console.error("Invalid or empty CSV data", data);
           return null;
       }
       const attributes = {};
       data.forEach((row) => {
           const HUC8 = row.HUC8; // Ensure 'HUC8' column exists in CSV
           if (HUC8) {
               attributes[HUC8] = { ...row }; // Add row data keyed by HUC8
           }
       });
       return attributes;
   } catch (err) {
       console.error("Error fetching or parsing CSV", err);
       return null;
   }
}

async function parseCSV(url) {
    if (DEBUG_STATUS) {
        console.log("CSV Link", url);
    }
    const data = await d3.csv(url);
    if (!data || !Array.isArray(data)) {
        console.error("Invalid or empty CSV data", data);
        return null;
    } else {
        if (DEBUG_STATUS) {
            console.log("CSV Data", data);
        }
        return data;
    }
}

// Expose the `fetchAPImetadata` function to the main thread
const api = {
 fetchTrackingAttributes
};

Comlink.expose(api);