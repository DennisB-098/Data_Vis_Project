document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("heatmap-container");
    const tooltip = d3.select("#chart-tooltip");
    const backButton = document.createElement("button");
    const periodOrder = ["Jan-Jun", "Jul-Dec"];
    let periodData = [];
    let annualData = [];
    let years = [];
    let ageGroups = [];

    backButton.type = "button";
    backButton.className = "metric-btn";
    backButton.textContent = "← Back to yearly view";
    backButton.hidden = true;
    backButton.classList.add("q4-back-button");
    container.appendChild(backButton);

    d3.csv("Data/question4.1data.csv", d => ({
        period: d["6-monthly (#3)"],
        ageGroup: d["Age group"],
        year: +d["Calendar year"],
        stay: +d["Mean(Average_Hospital_Stay)"]
    })).then(data => {
        periodData = data;
        if (!periodData.length || periodData.some(d =>
            !periodOrder.includes(d.period) ||
            !d.ageGroup ||
            !Number.isInteger(d.year) ||
            !Number.isFinite(d.stay)
        )) {
            throw new Error("The CSV is empty or contains invalid heatmap values.");
        }

        years = Array.from(new Set(periodData.map(d => d.year))).sort(d3.ascending);
        ageGroups = Array.from(new Set(periodData.map(d => d.ageGroup)));
        annualData = d3.rollups(
            periodData,
            rows => d3.mean(rows, d => d.stay),
            d => d.year,
            d => d.ageGroup
        ).flatMap(([year, groups]) =>
            groups.map(([ageGroup, stay]) => ({ year, ageGroup, stay }))
        );

        renderHeatmap(annualData);
    }).catch(error => {
        container.innerHTML =
            `<p>Unable to load question4.1data.csv. Please run this page through a local server. Error details: ${error}</p>`;
    });

    backButton.addEventListener("click", () => {
        tooltip.style("opacity", 0);
        renderHeatmap(annualData);
    });

    function renderHeatmap(viewData, selectedYear = null) {
        container.querySelectorAll("svg").forEach(svg => svg.remove());

        const isDrilldown = selectedYear !== null;
        const title = isDrilldown
            ? `Average Hospital Stay by Age Group and 6-Month Period in ${selectedYear}`
            : "Average Hospital Stay by Age Group and Year";
        const xValues = isDrilldown
            ? periodOrder.filter(period => viewData.some(d => d.period === period))
            : years;
        const margin = { top: 50, right: 95, bottom: 70, left: 90 };
        const width = 900;
        const height = 460;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "group")
            .attr("aria-labelledby", "heatmap-title")
            .attr("aria-describedby", "heatmap-description")
            .style("opacity", 0);

        svg.append("title")
            .attr("id", "heatmap-title")
            .text(title);
        svg.append("desc")
            .attr("id", "heatmap-description")
            .text(isDrilldown
                ? `Heatmap showing average hospital stay in days for each age group across the two six-month periods in ${selectedYear}. Darker red indicates a longer stay.`
                : "Heatmap showing average hospital stay in days for each age group by year. Darker red indicates a longer stay. Select a cell to view the six-month breakdown for that year."
            );

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("fill", "#3b5668")
            .attr("font-size", 18)
            .attr("font-weight", 700)
            .text(title);

        const innerChart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand()
            .domain(xValues)
            .range([0, innerWidth])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(ageGroups)
            .range([0, innerHeight])
            .padding(0.05);

        const minStay = d3.min(periodData, d => d.stay);
        const maxStay = d3.max(periodData, d => d.stay);
        const colorScale = d3.scaleSequential()
            .domain([minStay, maxStay])
            .interpolator(d3.interpolateReds);

        const showTooltip = d => {
            tooltip
                .style("opacity", 1)
                .html(`<strong>Age group:</strong> ${d.ageGroup}<br>
                       <strong>${isDrilldown ? "Period" : "Year"}:</strong> ${isDrilldown ? formatPeriod(d.period) : d.year}<br>
                       ${isDrilldown ? `<strong>Year:</strong> ${d.year}<br>` : ""}
                       <strong>Average stay:</strong> ${d.stay.toFixed(2)} days`);
        };

        innerChart.selectAll("rect")
            .data(viewData)
            .join("rect")
            .attr("x", d => xScale(isDrilldown ? d.period : d.year))
            .attr("y", d => yScale(d.ageGroup))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", d => colorScale(d.stay))
            .attr("role", isDrilldown ? "img" : "button")
            .attr("tabindex", 0)
            .attr("aria-label", d => isDrilldown
                ? `${d.ageGroup}, ${formatPeriod(d.period)} ${d.year}: ${d.stay.toFixed(2)} days`
                : `View half-year average stay for ${d.ageGroup} in ${d.year}: ${d.stay.toFixed(2)} days`
            )
            .style("cursor", isDrilldown ? "default" : "pointer")
            .on("mouseenter", (event, d) => {
                showTooltip(d);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY - 70}px`);
            })
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
            })
            .on("focus", function (event, d) {
                showTooltip(d);
                const bounds = this.getBoundingClientRect();
                tooltip
                    .style("left", `${window.scrollX + bounds.left + bounds.width / 2 + 15}px`)
                    .style("top", `${window.scrollY + bounds.top - 70}px`);
            })
            .on("blur", () => {
                tooltip.style("opacity", 0);
            })
            .on("click", (event, d) => {
                if (!isDrilldown) {
                    tooltip.style("opacity", 0);
                    renderHeatmap(periodData.filter(row => row.year === d.year), d.year);
                }
            })
            .on("keydown", (event, d) => {
                if (!isDrilldown && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    tooltip.style("opacity", 0);
                    renderHeatmap(periodData.filter(row => row.year === d.year), d.year);
                    backButton.focus();
                }
            });

        innerChart.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickFormat(isDrilldown ? formatPeriod : d3.format("d"))
                .tickSizeOuter(0));

        innerChart.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(yScale).tickSizeOuter(0));

        innerChart.append("text")
            .attr("class", "axis-label")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + 55)
            .attr("text-anchor", "middle")
            .text(isDrilldown ? "Six-month period" : "Calendar year");

        innerChart.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -65)
            .attr("text-anchor", "middle")
            .text("Age group");

        const legend = svg.append("g")
            .attr("transform", `translate(${width - 65},${margin.top})`);

        const legendScale = d3.scaleLinear()
            .domain([minStay, maxStay])
            .range([innerHeight, 0]);

        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat(d => `${d.toFixed(1)}d`);

        const legendGradient = legend.append("defs")
            .append("linearGradient")
            .attr("id", "heatmap-gradient")
            .attr("x1", "0")
            .attr("x2", "0")
            .attr("y1", "1")
            .attr("y2", "0");

        legendGradient.selectAll("stop")
            .data(d3.range(0, 1.01, 0.1))
            .join("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => colorScale(minStay + d * (maxStay - minStay)));

        legend.append("rect")
            .attr("width", 14)
            .attr("height", innerHeight)
            .attr("fill", "url(#heatmap-gradient)");

        legend.append("g")
            .attr("transform", "translate(14,0)")
            .call(legendAxis);

        legend.append("text")
            .attr("x", 7)
            .attr("y", -12)
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Days");

        backButton.hidden = !isDrilldown;
        container.appendChild(backButton);
        svg.transition()
            .duration(250)
            .style("opacity", 1);
    }

    function formatPeriod(period) {
        return period.replace("-", "–");
    }
});
