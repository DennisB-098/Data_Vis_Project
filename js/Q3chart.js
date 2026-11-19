document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("bar-chart-container");
    const tooltip = d3.select("#chart-tooltip");
    let currentMetric = "Average_Bed_Days";
    let rawData = [];

    const metricMeta = {
        "Average_Bed_Days": {
            label: "Average Bed Days (Days)",
            format: d => d.toFixed(1) + " days"
        },
        "Sum(Count of cases)": {
            label: "Total Hospitalised Cases",
            format: d => d3.format(",")(d)
        },
        "Sum(Bed days)": {
            label: "Total Bed Days",
            format: d => d3.format(",")(d)
        }
    };

    d3.csv("data/Q3.csv").then(data => {
        data.forEach(d => {
            d["Sum(Bed days)"] = +d["Sum(Bed days)"];
            d["Sum(Count of cases)"] = +d["Sum(Count of cases)"];
            d["Average_Bed_Days"] = +d["Average_Bed_Days"];
        });
        rawData = data;
        renderChart(currentMetric);
        renderTable(currentMetric);

        document.querySelectorAll(".metric-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".metric-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                document.querySelectorAll(".metric-btn").forEach(b => {
                    b.setAttribute("aria-pressed", String(b === btn));
                });
                currentMetric = btn.getAttribute("data-metric");
                renderChart(currentMetric);
                renderTable(currentMetric);
            });
        });

        window.addEventListener("resize", () => {
            renderChart(currentMetric);
        });
    }).catch(err => {
        container.innerHTML = `<p>Unable to load Q3.csv. Please ensure you are running the page through a local server (e.g., VS Code Live Server). Error details: ${err}</p>`;
    });

    function renderChart(metric) {
        container.innerHTML = "";

        const rect = container.getBoundingClientRect();
        const margin = { top: 20, right: 75, bottom: 75, left: 265 };
        const width = Math.max(300, rect.width - margin.left - margin.right);
        const height = Math.max(250, rect.height - margin.top - margin.bottom);

        const sortedData = [...rawData].sort((a, b) => d3.descending(a[metric], b[metric]));

        const chartSvg = d3.select("#bar-chart-container")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("role", "group")
            .attr("aria-labelledby", "q3-chart-title")
            .attr("aria-describedby", "q3-chart-description");

        chartSvg.append("title")
            .attr("id", "q3-chart-title")
            .text(`Counterparty crash configurations by ${metricMeta[metric].label}`);
        chartSvg.append("desc")
            .attr("id", "q3-chart-description")
            .text("Horizontal bars compare counterparty crash configurations. Focus a bar to hear its average bed days, total cases, and total bed days.");

        const svg = chartSvg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, d3.max(sortedData, d => d[metric]) * 1.12])
            .range([0, width]);

        const y = d3.scaleBand()
            .domain(sortedData.map(d => d.Counterparty))
            .range([0, height])
            .padding(0.28);

        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(6).tickSize(-height).tickFormat(""));

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(6));

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 42)
            .attr("fill", "#3b5668")
            .style("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .text(metricMeta[metric].label);

        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y));

        const showTooltip = d => {
            tooltip.style("opacity", 1)
                .html(`
                    <strong>${d.Counterparty}</strong><br>
                    Avg Bed Days: <b>${d.Average_Bed_Days}</b> days<br>
                    Total Cases: <b>${d3.format(",")(d["Sum(Count of cases)"])}</b><br>
                    Total Bed Days: <b>${d3.format(",")(d["Sum(Bed days)"])}</b>
                `);
        };

        svg.selectAll(".bar")
            .data(sortedData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("tabindex", 0)
            .attr("role", "img")
            .attr("aria-label", d => `${d.Counterparty}. Average bed days: ${d.Average_Bed_Days}. Total cases: ${d3.format(",")(d["Sum(Count of cases)"])}. Total bed days: ${d3.format(",")(d["Sum(Bed days)"])}`)
            .attr("y", d => y(d.Counterparty))
            .attr("height", y.bandwidth())
            .attr("x", 0)
            .attr("rx", 4)
            .attr("fill", (d, i) => i === 0 ? "#284b68" : "#5c7d91")
            .attr("width", 0)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("fill", "#C0CBCD");
                showTooltip(d);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 70) + "px")
                    .style("left", (event.pageX + 15) + "px");
            })
            .on("focus", function (event, d) {
                d3.select(this).attr("fill", "#C0CBCD");
                showTooltip(d);
                const bounds = this.getBoundingClientRect();
                tooltip.style("top", `${window.scrollY + bounds.top - 70}px`)
                    .style("left", `${window.scrollX + bounds.left + 15}px`);
            })
            .on("mouseout", function (event, d, i) {
                const index = sortedData.indexOf(d);
                d3.select(this).attr("fill", index === 0 ? "#284b68" : "#5c7d91");
                tooltip.style("opacity", 0);
            })
            .on("blur", function (event, d) {
                const index = sortedData.indexOf(d);
                d3.select(this).attr("fill", index === 0 ? "#284b68" : "#5c7d91");
                tooltip.style("opacity", 0);
            })
            .transition()
            .duration(800)
            .attr("width", d => x(d[metric]));
    }

    function renderTable(metric) {
        const tableContainer = document.getElementById("data-table-container");
        const sortedData = [...rawData].sort((a, b) => d3.descending(a[metric], b[metric]));
        const columns = [
            { key: "Counterparty", label: "Counterparty" },
            { key: "Average_Bed_Days", label: "Average Bed Days" },
            { key: "Sum(Count of cases)", label: "Total Cases" },
            { key: "Sum(Bed days)", label: "Total Bed Days" }
        ];

        tableContainer.innerHTML = "";
        d3.select(tableContainer)
            .append("h3")
            .attr("class", "table-title")
            .text(`Data sorted by ${metricMeta[metric].label}`);

        const table = d3.select(tableContainer)
            .append("table")
            .attr("class", "data-table")
            .attr("aria-label", `Counterparty data sorted by ${metricMeta[metric].label}`);

        table.append("thead")
            .append("tr")
            .selectAll("th")
            .data(columns)
            .enter()
            .append("th")
            .attr("scope", "col")
            .attr("class", d => d.key === "Counterparty" ? null : "num")
            .text(d => d.label);

        table.append("tbody")
            .selectAll("tr")
            .data(sortedData)
            .enter()
            .append("tr")
            .selectAll("td")
            .data(row => columns.map(column => ({ column, value: row[column.key] })))
            .enter()
            .append("td")
            .attr("class", d => [
                d.column.key === "Counterparty" ? "" : "num",
                d.column.key === metric ? "active-col" : ""
            ].filter(Boolean).join(" "))
            .text(d => d.column.key === "Counterparty"
                ? d.value
                : d.column.key === "Average_Bed_Days"
                    ? `${d.value.toFixed(1)} days`
                    : d3.format(",")(d.value));
    }
});