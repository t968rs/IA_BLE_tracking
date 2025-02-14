export function handleExportButtonClick() {
    // Send a request to the server to generate and download the Excel file
    fetch('/export-excel', {
        method: 'GET',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }
        return response.blob();
    })
    .then(blob => {
        // Create a link to download the file
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'IA_BLE_Tracking.xlsx');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
    })
    .catch(error => {
        console.error('Error downloading Excel file:', error);
        alert('Failed to download Excel file. Please try again.');
    });
}
