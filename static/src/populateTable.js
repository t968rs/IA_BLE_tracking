import { getMap, setTableLoaded, isTableLoaded } from '/static/src/mapManager.js'; // Access the map instance
const DEBUG_STATUS = true;
const dC = (message) => {
    if (DEBUG_STATUS) {
        console.debug(message);
    }
};


export const tablePanel = document.getElementById("status-table-container");
export const tableButton = document.getElementById("status-table-button");
const buttonContainer = document.getElementById("button-container");

// Predefined color map for MIP Cases
const mipCaseColors = {
    "21-07-0002S": "#c38aff",
    "22-07-0035S": "#74ff74", // Light green
    "23-07-0036S": "#ff8bcd", // Light pink
    "23-07-0037S": "#84b3ff"  // Light yellow
};

export function toggleTable() {
    if (!tablePanel) {
        console.error("Table panel element is missing.");
        return;
    }

    if (DEBUG_STATUS) { console.debug(`Table container exists. ${tablePanel}`); }

    if (!tablePanel.style.height){
        tablePanel.style.height = "15vh";
        tableButton.textContent = "▲"
    } else if (tablePanel.style.height === '15vh') {
        tablePanel.style.height = '80vh';
        tableButton.textContent = '▼';
    } else if (tablePanel.style.height === '80vh') {
        tablePanel.style.height = '2vh';
        tableButton.textContent = "▲"
    } else {
        tablePanel.style.height = '15vh';
        tableButton.textContent = '▼';
    }
    updateButtonsPosition();
}


async function fetchMetadata(servePath) {
    try {
        const columnsMetaResponse = await fetch(servePath);
        if (!columnsMetaResponse.ok) {
            throw new Error(`Failed to fetch columns: ${columnsMetaResponse.statusText}`);
        }

        const metadata = await columnsMetaResponse.json();

        const columnsMetadata = metadata?.meta ?? {};
        const columnOrder = metadata?.order ?? [];

        if (!columnsMetadata) {
            console.error("meta not found in json:", metadata);
        }

        if (DEBUG_STATUS) {console.debug('columnOrder:', columnOrder);}

        return { columnsMetadata, columnOrder };
    } catch (error) {
        console.error("Error fetching metadata:", error);
        throw error; // Re-throw the error to propagate it to the caller
    }
}

export async function fetchAndDisplayData(sourceData, attributesData) {
    const loadingMessage = document.getElementById("loading-message");
    if (!loadingMessage) {
        console.error("Loading message element is missing.");
        return;
    }

    // Show the loading message
    loadingMessage.style.display = "block";

    if (isTableLoaded()) {
        loadingMessage.style.display = "none";
        dC("Table already loaded, no need to fetch again.");
        return;
    }

    try {

        if (DEBUG_STATUS) {console.debug('Table Data json:', attributesData);}

        // Fetch column metadata
        const sourceFileFormat = "geojson"
        const { columnsMetadata, columnOrder } = await fetchMetadata(
            '/metadata-columns?source_file_format=' + sourceFileFormat);
        if (DEBUG_STATUS) {console.debug('columnsMetadata:', columnsMetadata);}
        if (DEBUG_STATUS) {console.debug('columnOrder:', columnOrder);}

        // Create a reverse lookup map from sourceFormat name to the entire metadata object
        const sourceFormatMap = {};
        for (const [topLevelKey, formats] of Object.entries(columnsMetadata)) {
            const sourceFormatKey = formats.geojson;
            sourceFormatMap[sourceFormatKey] = formats;
        }
        if (DEBUG_STATUS) {console.debug('sourceFormatMap:', sourceFormatMap);}

        // Filter and Reorder Rows
        const filteredAndOrderedData = Object.values(attributesData).map(row => {
            // Filter out keys not in sourceFormatMap
            const filteredRow = Object.keys(row)
                .filter(key => key in sourceFormatMap)
                .reduce((acc, key) => {
                    acc[key] = row[key];
                    return acc;
                }, {});

            // Reorder keys according to columnOrder
            return columnOrder.reduce((acc, key) => {
                if (key in filteredRow) {
                    acc[key] = filteredRow[key];
                } else {
                    acc[key] = null; // Add missing keys with null
                }
                return acc;
            }, {});
        });

        // Define columns for DataTable
        const invisibleColumns = ["geometry"];

        if (DEBUG_STATUS) {console.debug('filteredAndOrderedData:', filteredAndOrderedData);}
        const keys = Object.keys(filteredAndOrderedData[0] || {});
        const columns = keys.map(key => ({
            data: key, // Key used to match column with data field
            title: sourceFormatMap[key]?.excel || key, // Use the dictionary value for the title
            visible: !invisibleColumns.includes(key), // Hide columns if specified
            render: function (data) {
                return data || ""; // Handle null/undefined values
            }
        }));

        // Initialize DataTable
        if (DEBUG_STATUS) {console.debug('columns:', columns.length, columns);}
        await initDataTable(columns.length, columns);
        const dataTable = $('#status-table').DataTable({
            data: filteredAndOrderedData,
            paging: false,
            columns: columns,
            destroy: true,
            autoWidth: true,
            responsive: true,
            searching: false,
            orderClasses: true,
            // fixedHeader: true,
            createdRow: function (row, data, dataIndex) {
                // Assuming "MIP Case" is at a specific key in your data, adjust according to your data structure
                const mipCase = data["MIP_Case"]; // adjust key name based on your actual data

                // Set the background color based on mipCaseColors
                if (mipCaseColors[mipCase]) {
                    $(row).css('background-color', mipCaseColors[mipCase]);
                }
            }
        });

        if (DEBUG_STATUS) {console.debug('dataTable:', dataTable);}

        // Add hover event listener
        $("#status-table tbody").on("mouseenter", "tr", function () {
            const rowData = dataTable.row(this).data(); // Get the data for the hovered row
            $(this).addClass('row-hover'); // Add a hover class for custom styling

            if (rowData) {
                sendDataToMap(rowData["HUC8"], getMap()); // Send data to the map
            }
        });

        // Remove hover effect when mouse leaves the row
        $("#status-table tbody").on("mouseleave", "tr", function () {
            $(this).removeClass('row-hover'); // Remove hover class
        });

    } catch (error) {
        console.error("Error fetching and displaying data:", error);
    } finally {
        loadingMessage.style.display = "none";
        setTableLoaded(true)
    }
}

async function initDataTable(columnLength, columns) {
    const table = document.getElementById("status-table");
    if (!table || table.tagName !== "TABLE") {
        throw new Error("Table element is missing or invalid.");
    }

    // Clear existing content
    table.innerHTML = "";

    // Ensure <thead> exists
    let thead = table.querySelector("thead");
    if (!thead) {
        thead = document.createElement("thead");
        table.appendChild(thead);
    }
    thead.innerHTML = ""; // Clear existing content in thead

    // Add the infoRow
    const infoRow = await prepInfoRows(columnLength);
    thead.appendChild(infoRow);

    // Add column headers
    const headerRow = document.createElement("tr");
    columns.forEach(column => {
        const th = document.createElement("th");
        th.textContent = column.title; // Use the title from DataTables columns array
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Ensure <tbody> exists
    let tbody = table.querySelector("tbody");
    if (!tbody) {
        tbody = document.createElement("tbody");
        table.appendChild(tbody);
    }

    dC("thead:\n", thead);
    return thead;
}

async function prepInfoRows(actualLength) {
    const firstThreeLength = 11; // Adjust total columns if necessary
    const lengthDiff = actualLength - firstThreeLength;

    const infoRow = document.createElement("tr");
    infoRow.classList.add("info-row");

    const infoCells = [
        { text: "Delivery Area Info", colspan: 3 },
        { text: "MIP Task Status", colspan: 3 },
        { text: "Model Manager Uploads", colspan: 5 },
        { text: "Details", colspan: lengthDiff },
    ];

    infoCells.forEach(cell => {
        const th = document.createElement("th");
        th.colSpan = cell.colspan;
        th.textContent = cell.text;
        th.classList.add("info-header");
        infoRow.appendChild(th);
    });

    return infoRow;
}

function sendDataToMap(dataValue, map) {
    // Assuming you have a Mapbox GL JS map instance
    map.setFilter("areas-highlight", ["==", "HUC8", dataValue]); // Adjust logic as needed
}

// Function to update the toggle button's position dynamically
function updateButtonsPosition(tableHeight) {
    let newTableHeight;
    if (!tableHeight) {
        dC("input tableHeight", tableHeight);
        const rect = tablePanel.getBoundingClientRect();
        newTableHeight = rect.height;
    } else {
        newTableHeight = tableHeight;
    }
    dC("newTableHeight", newTableHeight);
    buttonContainer.style.bottom = (newTableHeight + 75) + "px"; // Adjust based on the panel height
}

// Function to reset the toggle button to its default position
function resetButtonsPosition() {
    buttonContainer.style.bottom = "50px"; // Reset to the original position
}

export { updateButtonsPosition, resetButtonsPosition, sendDataToMap }; // Export the functions
