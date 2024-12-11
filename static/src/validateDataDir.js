const LOG = false;

export async function updateLastUpdatedTimestamp(headPromise, lastUpdated) {
    try {
        const response = await headPromise; // Use HEAD request to fetch headers
        if (LOG) { console.debug('Response ', response); }
        if (response.ok) {

            if (LOG) { console.debug('Response headers:', response.headers); }
            const lastModified = response.headers.get('Last-Modified');
            if (lastModified) {
                const timeOptions = { hour: 'numeric', minute: 'numeric', timeZoneName: 'short' };
                const formattedDate = new Date(lastModified).toLocaleDateString();
                const formattedTime = new Date(lastModified).toLocaleTimeString([], timeOptions);

                lastUpdated.innerHTML = `Statuses last updated:<br><b>${formattedDate} ${formattedTime}</b>`;
                if (LOG) { console.debug(`Last-Modified fetched and displayed: ${formattedDate} ${formattedTime}`); }
            } else {
                console.warn('Last-Modified header not found.');
                lastUpdated.innerHTML = `Unable to fetch the last updated timestamp.`;
            }
        } else {
            console.error(`Error: HTTP response not OK. Status: ${response.status}`);
            lastUpdated.innerHTML = `Unable to fetch the last updated timestamp.`;
        }
    } catch (error) {
        console.error('Error fetching the geojson file:', error);
        lastUpdated.innerHTML = `Unable to fetch the last updated timestamp.`;
    }
}