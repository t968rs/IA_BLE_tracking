import { getMap } from './mapManager.js'; // Access the map instance
import { updateGeoJSONLayer } from '../main.js'; // Notify map updates

export const panel = document.getElementById("status-table-container");
export const toggleButton = document.getElementById("toggle-table-btn");

const unwantedColumns = ["geometry"]

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
        fetchAndDisplayData(); // Fetch and populate the table if not already loaded
        updateToggleButtonPosition();
    } else {
        panel.style.display = "none";
        resetToggleButtonPosition();
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
            console.debug(column, isUnwanted)
        }
        const isInTableData = Object.keys(tableData[0]).includes(column);
        if (isInTableData === false) {
            console.debug(column, "In table data", isInTableData)
        }
        if (!isUnwanted && isInTableData) {
            console.debug(column, "both")
        }
        return !isUnwanted && isInTableData;
    });
    console.debug("Filtered Columns:", columnsFiltered)
    return columnsFiltered;
}

// Function to fetch and display the Excel data
export async function fetchAndDisplayData() {
    try {
        const response = await fetch('/data-table.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        let tableData = await response.json();
        console.debug('Table Data json:\n', tableData)

        // Fetch column metadata
        const { columnsMetadata, columnOrder } = await fetchMetadata('/metadata-columns')
        console.debug("Column Meta: ", columnsMetadata)

        const filteredCols = filterColumns(tableData, columnOrder);

        tableData = tableData.map(row => {
            const orderedRow = {};
            filteredCols.forEach(key => {
                orderedRow[key] = row[key] || null; // Add all keys in the correct order
            });
            return orderedRow;
        });

        // Define editable and locked columns
        const editableColumns = ['Draft_MIP', 'FP_MIP', "Hydra_MIP", "DFIRM_Grd_MM", "Prod Stage", "FRP_Perc_Complete", "Notes"]; // Define columns you want editable
        const invisibleColumns = ["geometry"]

        const columns = filteredCols.map(key => ({
            data: key,
            title: columnsMetadata[key]['excel'], // Use the dictionary value for title
            visible: !invisibleColumns.includes(key),
            render: function (data) {
                if (editableColumns.includes(key)) {
                    return `<span class="editable" data-column="${key}">${data}</span>`;
                }
                return data || ""; // Locked cells are plain text
            }
        }));

        // Append the info header
        console.log("Column Length:", columns.length)
        await initDataTable(columns.length, columns)
        const dataTable = $('#status-table').DataTable({
                    data: tableData,
                    paging: false,
                    columns: columns,
                    destroy: true,
                    autoWidth: true,
                    responsive: true,
                    });

        console.debug('thead\n', dataTable)

        // Add in-line editing event listener for editable cells
        $('#status-table').on('click', '.editable', function () {
            const cell = $(this);
            const currentValue = cell.text();
            const column = cell.data('column');

            // Create an input field for editing
            const input = $(`<input type="text" value="${currentValue}">`);
            cell.empty().append(input);

            // Handle save on blur
            input.on('blur', function () {
                const newValue = input.val();
                cell.text(newValue);

                // Update the DataTable cell value
                const rowIdx = dataTable.row(cell.closest('tr')).index();
                const rowData = dataTable.row(rowIdx).data();
                rowData[column] = newValue;
                dataTable.row(rowIdx).data(rowData);
            });

            // Automatically focus the input
            input.focus();
        });

        // Add hover event listener
        $("#status-table tbody").on("mouseenter", "tr", function () {
            const rowData = dataTable.row(this).data(); // Get the data for the hovered row
            $(this).addClass('row-hover'); // Add a hover class for custom styling
            console.log("Entered row");

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

    console.debug("thead:\n", thead)
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


// Add Save Table functionality
document.getElementById("saveTableButton").addEventListener("click", saveTableUpdates);


async function saveTableUpdates() {
    const table = $('#status-table').DataTable();
    const updatedData = table.rows().data().toArray();
    console.debug("Updated Data to Save:", updatedData);

    try {
        const response = await fetch('/update-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData),
        });

        const result = await response.json();
        if (result.success) {
            alert("Changes saved successfully!");

            // Trigger GeoJSON update
            const map = getMap(); // Get the map instance
            const source = map.getSource("ProjectAreas");
            // get source url
            const src_url = source.url || '../data/spatial/IA_BLE_Tracking.geojson';
            console.debug("Source: ", src_url);
            if (map) {
                await updateGeoJSONLayer('ProjectAreas', src_url);
            } else {
                console.error("Map instance not available.");
            }
        } else {
            alert("Error saving changes: " + result.error);
        }
    } catch (error) {
        console.error("Error saving table data:", error);
    }
}

document.getElementById("saveTableButton").addEventListener("click", saveTableUpdates);


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
function updateToggleButtonPosition() {
    const rect = panel.getBoundingClientRect();
    const tableHeight = rect.height// parseInt(getComputedStyle(panel, "").height);

    toggleButton.style.bottom = (tableHeight + 75) + "px"; // Adjust based on the panel height
}

// Function to reset the toggle button to its default position
function resetToggleButtonPosition() {
    toggleButton.style.bottom = "50px"; // Reset to the original position
}

export { highlightTableColumn, resetTableColumn, updateToggleButtonPosition, resetToggleButtonPosition, sendDataToMap}; // Export the functions