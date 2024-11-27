export const BORDER_SIZE = 4;
export const panel = document.getElementById("excel-table-container");
export const toggleButton = document.getElementById("toggle-table-btn");
export let m_pos;

// Function to resize the panel dynamically
export function resize(e) {
    const dy = m_pos - e.y;
    m_pos = e.y;
    panel.style.height = (parseInt(getComputedStyle(panel, "").height) + dy) + "px";
    console.log("Panel resized, height: ", panel.style.height);
    updateToggleButtonPosition();
}

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
    $("#excel-data-table").DataTable({
        paging: true,
        searching: true,
        ordering: true,
        info: true,
        autoWidth: true,
        lengthMenu: [25, 50, 100], // Number of rows per page
        resposive: true,
        buttons: [
            'copy', 'excel'
        ]
    });
    console.log("DataTable initialized!");
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
    const tableHeight = parseInt(getComputedStyle(panel, "").height);
    console.log("Table height:", tableHeight);
    toggleButton.style.bottom = (tableHeight + 75) + "px"; // Adjust based on the panel height
}

// Function to reset the toggle button to its default position
function resetToggleButtonPosition() {
    toggleButton.style.bottom = "50px"; // Reset to the original position
}

export { highlightTableColumn, resetTableColumn, populateTable, updateToggleButtonPosition, resetToggleButtonPosition,
initializeDataTable}; // Export the functions