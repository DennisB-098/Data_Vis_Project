window.loadChartCsv = (path, parseRow, errorEl) => d3.csv(path, parseRow)
    .catch(err => {
        if (errorEl) {
            errorEl.innerHTML = "";
            const message = document.createElement("p");
            message.className = "chart-error";
            message.textContent = `Unable to load ${path}. ${err.message || err}`;
            errorEl.appendChild(message);
        }
        throw err;
    });