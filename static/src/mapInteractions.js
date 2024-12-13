const DEBUG_STATUS = true;
const dC = (message) => {
    if (DEBUG_STATUS) {
        console.debug(message);
    }
};

function rangePercent(start, stop, step) {
    dC("Start: ", start, " Stop: ", stop, " Step: ", step);
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        dC("Step is undefined", step);
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    let result = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }
    result.push(100);
    const resSet = new Set(result);
    result = Array.from(resSet);
    dC("Result: ", result);
    return result;
}

// Function to disable text selection globally
export function disableTextSelection() {
    document.body.style.userSelect = "none";
    document.body.style.msUserSelect = "none";
    document.body.style.mozUserSelect = "none";
}

// Function to re-enable text selection
export function enableTextSelection() {
    document.body.style.userSelect = "";
    document.body.style.msUserSelect = "";
    document.body.style.mozUserSelect = "";
}


export function showIt(docElementPassed) {
    // docElementPassed.style.display = 'block';
    docElementPassed.classList.remove("hidden");
}

export function hideIt(docElementPassed) {
    // docElementPassed.style.display = 'none';
    docElementPassed.classList.add("hidden");
    docElementPassed.remove();
}



