import {getMap} from "./mapManager.js";

export const panel = document.getElementById("excel-table-container");
export const toggleButton = document.getElementById("toggle-table-btn");

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
        fetchAndDisplayExcel(); // Fetch and populate the table if not already loaded
        updateToggleButtonPosition();
    } else {
        panel.style.display = "none";
        resetToggleButtonPosition();
    }
    console.log("Table toggled");
}

// Function to fetch and display the Excel data
export async function fetchAndDisplayExcel() {
    try {
        const response = await fetch("/excel");
        if (!response.ok) throw new Error("Failed to fetch Excel file");

        const sheetName = response.headers.get("Sheet-Name") || "Sheet1";

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // Parse the workbook
        const workbook = XLSX.read(data, {type: "array"});

        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});

        populateTable(json);

        // Initialize DataTables on the dynamically created table
        initializeDataTable();

    } catch (error) {
        console.error("Error fetching and displaying Excel file:", error);
    }
}

function initializeDataTable() {
    // Check if DataTable is already initialized
    if ($.fn.DataTable.isDataTable("#excel-data-table")) {
        $("#excel-data-table").DataTable().destroy(); // Destroy the existing instance
    }

    // Initialize DataTables
    const dTable = $("#excel-data-table").DataTable({
        paging: false,
        searching: true,
        ordering: true,
        info: true,
        autoWidth: true,
        resposive: true,
        buttons: [
            'copy', 'excel'
        ],
        rowCallback: function (row, data) {
            // Get the MIP Case value from the row data
            console.log("Row Data:", data);
            const mipCase = data[17]; // Adjust the index based on your column layout
            console.log("MIP Case:", mipCase);
            const color = mipCaseColors[mipCase];

            if (color) {
                console.log("MIP Case:", mipCase, "Color:", color);
                $(row).css("background-color", color); // Apply the unique background color
            }
        }
    });

        // Add hover event listener
    $("#excel-data-table tbody").on("mouseenter", "tr", function () {
        const rowData = dTable.row(this).data(); // Get the data for the hovered row
        if (rowData && rowData[0]) {
            console.log("Hovered row data[0]:", rowData[0]);
            sendDataToMap(rowData[0], getMap()); // Send data[0] to the map/main.js
        }
    });

    console.log("DataTable initialized!");
}

function sendDataToMap(dataValue, map) {
    // Example: Highlight or focus on a map feature based on dataValue
    console.log("Sending to map:", dataValue);

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

// Function to populate the table with Excel data
function populateTable(data) {
    if (!data || data.length === 0) {
        console.error("No data available to populate the table.");
        return;
    }

    // Create the table element
    const tableContainer = document.getElementById("excel-table-container");
    const table = document.createElement("table");
    table.id = "excel-data-table"; // DataTables targets this ID
    table.classList.add("display"); // DataTables expects the "display" class

    const thead = document.createElement("thead");

    // Add the "info cells" row
    const infoRow = document.createElement("tr");

    const infoCell1 = document.createElement("th");
    infoCell1.colSpan = 3;
    infoCell1.textContent = "Delivery Area Info";
    infoRow.appendChild(infoCell1);

    const infoCell2 = document.createElement("th");
    infoCell2.colSpan = 3;
    infoCell2.textContent = "MIP Task Status";
    infoRow.appendChild(infoCell2);

    const infoCell3 = document.createElement("th");
    infoCell3.colSpan = 5;
    infoCell3.textContent = "Model Manager Uploads";
    infoRow.appendChild(infoCell3);

    const infoCell4 = document.createElement("th");
    infoCell4.colSpan = 1;
    infoCell4.textContent = "Overall";
    infoRow.appendChild(infoCell4);

    const infoCell5 = document.createElement("th");
    infoCell5.colSpan = 4;
    infoCell5.textContent = "Details";
    infoRow.appendChild(infoCell5);

    const infoCell6 = document.createElement("th");
    infoCell6.colSpan = 2;
    infoCell6.textContent = "Other";
    infoRow.appendChild(infoCell6);

    thead.appendChild(infoRow);
    infoRow.classList.add("info-row");

    // Create table header from the first row
    const headerRow = document.createElement("tr");
    data[0].forEach((header) => {
        const th = document.createElement("th");
        th.textContent = header || ""; // Use the header values from the first row
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body from the remaining rows
    const tbody = document.createElement("tbody");
    data.slice(1).forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((cell) => {
            const td = document.createElement("td");
            td.textContent = cell || ""; // Avoid undefined cells
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Clear previous content and append the new table
    tableContainer.innerHTML = "";
    tableContainer.appendChild(table);
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

export { highlightTableColumn, resetTableColumn, populateTable, updateToggleButtonPosition, resetToggleButtonPosition,
initializeDataTable, sendDataToMap}; // Export the functions