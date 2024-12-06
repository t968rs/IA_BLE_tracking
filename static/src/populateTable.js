import { getMap } from './mapManager.js'; // Access the map instance

export const panel = document.getElementById("status-table-container");
export const buttonContainer = document.getElementById("button-container");
const statusTableObj = document.getElementById("status-table");

const unwantedColumns = ["geometry"];

// Predefined color map for MIP Cases
const mipCaseColors = {
    "21-07-0002S": "#c38aff",
    "22-07-0035S": "#74ff74", // Light green
    "23-07-0036S": "#ff8bcd", // Light pink
    "23-07-0037S": "#84b3ff"  // Light yellow
};

// Function to toggle the table visibility
export function toggleTable() {
    if (panel.style.display === "none" || panel.style.display === "") {
        panel.style.display = "block";
        updateButtonsPosition();
    } else {
        statusTableObj.style.display = "none";
        panel.style.display = "none";
        resetButtonsPosition();
    }
    console.log("Table toggled");
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

        console.log("Col Metadata:", columnsMetadata);
        console.log("Column Order:", columnOrder);

        return { columnsMetadata, columnOrder };
    } catch (error) {
        console.error("Error fetching metadata:", error);
        throw error; // Re-throw the error to propagate it to the caller
    }
}

function filterColumns(tableData, columnList = null) {
    // Filter out unwanted columns while maintaining original order
    let columnsFiltered = columnList.filter(column => {
        const isUnwanted = unwantedColumns.includes(column);
        if (isUnwanted === true) {
            console.debug(column, isUnwanted);
        }
        const isInTableData = Object.keys(tableData[0]).includes(column);
        if (isInTableData === false) {
            console.debug(column, "In table data", isInTableData);
        }
        if (!isUnwanted && isInTableData) {
            console.debug(column, "both");
        }
        return !isUnwanted && isInTableData;
    });
    console.debug("Filtered Columns:", columnsFiltered);
    return columnsFiltered;
}

export async function fetchAndDisplayData() {
    try {
        const response = await fetch('/data-table.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        let tableData = await response.json();
        console.debug('Table Data json:\n', tableData);

        // Fetch column metadata
        const sourceFileFormat = "geojson"
        const { columnsMetadata, columnOrder } = await fetchMetadata(
            '/metadata-columns?source_file_format=' + sourceFileFormat);
        console.debug("Column Meta: ", columnsMetadata);
        
        // Create a reverse lookup map from sourceFormat name to the entire metadata object
        const sourceFormatMap = {};
        for (const [topLevelKey, formats] of Object.entries(columnsMetadata)) {
            const sourceFormatKey = formats.geojson;
            sourceFormatMap[sourceFormatKey] = formats;
        }

        const filteredCols = filterColumns(tableData, columnOrder);

        tableData = tableData.map(row => {
            const orderedRow = {};
            filteredCols.forEach(key => {
                orderedRow[key] = row[key] || null; // Add all keys in the correct order
            });
            return orderedRow;
        });

        // Define columns for DataTable
        const invisibleColumns = ["geometry"];

        const columns = filteredCols.map(key => ({
            data: key,
            title: sourceFormatMap[key]['excel'], // Use the dictionary value for title
            visible: !invisibleColumns.includes(key),
            render: function (data) {
                return data || ""; // Display data as plain text
            }
        }));

        // Initialize DataTable
        console.log("Column Length:", columns.length);
        await initDataTable(columns.length, columns);
        const dataTable = $('#status-table').DataTable({
            data: tableData,
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

        console.debug('thead\n', dataTable);

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

    console.debug("thead:\n", thead);
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

function highlightTableColumn(columnName) {
    const table = $("#excel-data-table").DataTable();

    // Get the column index by name
    const columnIndex = table.column(`${columnName}:name`).index();

    // Highlight all cells in the column
    table
        .column(columnIndex)
        .nodes()
        .to$()
        .addClass("highlight-column"); // Add a custom class
}

function resetTableColumn(columnName) {
    const table = $("#excel-data-table").DataTable();

    // Get the column index by name
    const columnIndex = table.column(`${columnName}:name`).index();

    // Remove highlight from all cells in the column
    table
        .column(columnIndex)
        .nodes()
        .to$()
        .removeClass("highlight-column");
}

// Function to update the toggle button's position dynamically
function updateButtonsPosition() {
    const rect = panel.getBoundingClientRect();
    const tableHeight = rect.height;

    buttonContainer.style.bottom = (tableHeight + 75) + "px"; // Adjust based on the panel height
}

// Function to reset the toggle button to its default position
function resetButtonsPosition() {
    buttonContainer.style.bottom = "50px"; // Reset to the original position
}

export { highlightTableColumn, resetTableColumn, updateButtonsPosition, resetButtonsPosition, sendDataToMap }; // Export the functions
