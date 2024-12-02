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
        fetchAndDisplayData(); // Fetch and populate the table if not already loaded
        updateToggleButtonPosition();
    } else {
        panel.style.display = "none";
        resetToggleButtonPosition();
    }
    console.log("Table toggled");
}

// Function to fetch and display the Excel data
export async function fetchAndDisplayData() {
    try {
        const response = await fetch('/data-table.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const tableData = await response.json();

        // Define editable and locked columns
        const editableColumns = ['Draft_MIP', 'FP_MIP',
        "Hydra_MIP", "DFIRM_Grd_MM", "Prod Stage", "FRP_Perc_Complete",
        "Notes"]; // Define columns you want editable

        const columns = Object.keys(tableData[0]).map(key => ({
            data: key,
            title: key,
            render: function (data, type, row, meta) {
                // Render editable cells as spans; locked cells as plain text
                if (editableColumns.includes(key)) {
                    return `<span class="editable" data-column="${key}">${data}</span>`;
                }
                return data; // Locked cells are plain text
            }
        }));

        const table = $('#status-table').DataTable({
            data: tableData,
            columns: columns,
            destroy: true
        });

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
                const rowIdx = table.row(cell.closest('tr')).index();
                const rowData = table.row(rowIdx).data();
                rowData[column] = newValue;
                table.row(rowIdx).data(rowData);
            });

            // Automatically focus the input
            input.focus();
        });

    } catch (error) {
        console.error("Error fetching and displaying data:", error);
    }
}


// Add Save Table functionality
document.getElementById("saveTableButton").addEventListener("click", saveTableUpdates);

async function saveTableUpdates() {
    // Access the DataTable instance
    const table = $('#status-table').DataTable();

    // Get all table rows as an array
    const updatedData = table.rows().data().toArray();
    console.log("Updated Data to Save:", updatedData);

    try {
        // Send updated data to the backend
        const response = await fetch('/update-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();
        if (result.success) {
            alert("Changes saved successfully!");
        } else {
            alert("Error saving changes: " + result.error);
        }
    } catch (error) {
        console.error("Error saving table data:", error);
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
            // console.log("Row Data:", data);
            const mipCase = data[17]; // Adjust the index based on your column layout
            // console.log("MIP Case:", mipCase);
            const color = mipCaseColors[mipCase];

            if (color) {
                // console.log("MIP Case:", mipCase, "Color:", color);
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