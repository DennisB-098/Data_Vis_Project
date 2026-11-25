window.loadChartCsv = (path, parseRow, errorEl) => d3.csv(path, parseRow)
    .catch(err => {
        if (errorEl) {
            const element = errorEl.node ? errorEl.node() : errorEl;
            element.innerHTML = "";
            const message = document.createElement("p");
            message.className = "chart-error";
            message.textContent = `Unable to load ${path}. ${err.message || err}`;
            element.appendChild(message);
        }
        throw err;
    });