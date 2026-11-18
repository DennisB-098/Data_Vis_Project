document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("butterfly-chart-container");
    const yearSelect = document.getElementById("year-select");
    const metricButtons = d3.selectAll(".metric-btn");
    const tooltip = d3.select("#chart-tooltip");
    const ageOrder = ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+"];
    const metricLabels = {
        hospitalisations: "Hospitalisations",
        averageHospitalStay: "Average hospital stay"
    };
    const width = 1000;
    const height = 540;
    const margin = { top: 24, right: 38, bottom: 76, left: 112 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const formatCount = d3.format(",");
    const formatStay = d3.format(".2f");

    let selectedMetric = "hospitalisations";
    const formatValue = value => selectedMetric === "hospitalisations"
        ? formatCount(value)
        : formatStay(value);

    try {
        const sourceData = await d3.csv("data/question5.2data.csv", (d, index) => {
            const year = Number(d["Calendar year"]);
            const hospitalisations = Number(d["Sum(Hospitalisations)"]);
            const averageHospitalStay = Number(d["Average_Hospital_Stay"]);
            const sex = d.Sex.trim().toLowerCase();

            if (!Number.isFinite(year) || !Number.isFinite(averageHospitalStay) ||
                !Number.isFinite(hospitalisations)) {
                throw new Error(`Invalid numeric value in CSV row ${index + 2}.`);
            }
            if (sex !== "male" && sex !== "female") {
                throw new Error(`Unexpected sex value "${d.Sex}" in CSV row ${index + 2}.`);
            }

            return {
                year,
                ageGroup: d["Age group"],
                sex,
                hospitalisations,
                averageHospitalStay
            };
        });

        if (sourceData.length === 0) {
            throw new Error("The CSV contains no data rows.");
        }

        const chartSvg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr("aria-label", "Butterfly chart comparing male and female values by age group");

        const plot = chartSvg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleLinear().range([0, innerWidth]);
        const yScale = d3.scaleBand()
            .domain(ageOrder)
            .range([0, innerHeight])
            .padding(0.24);

        const zeroLine = plot.append("line")
            .attr("class", "butterfly-zero-line")
            .attr("y1", 0)
            .attr("y2", innerHeight);

        const xAxisGroup = plot.append("g")
            .attr("class", "butterfly-axis butterfly-x-axis")
            .attr("transform", `translate(0,${innerHeight})`);

        plot.append("g")
            .attr("class", "butterfly-axis butterfly-y-axis")
            .call(d3.axisLeft(yScale).tickSizeOuter(0));

        chartSvg.append("text")
            .attr("class", "butterfly-axis-label")
            .attr("x", margin.left + innerWidth / 2)
            .attr("y", height - 19)
            .attr("text-anchor", "middle")
            .text("Hospitalisations (absolute values)");

        const series = ageOrder.flatMap(ageGroup => [
            { ageGroup, sex: "male" },
            { ageGroup, sex: "female" }
        ]);

        function processData() {
            const selectedYear = yearSelect.value;
            const filtered = selectedYear === "All"
                ? sourceData
                : sourceData.filter(d => d.year === Number(selectedYear));

            const totals = d3.rollup(
                filtered,
                rows => {
                    const hospitalisations = d3.sum(rows, d => d.hospitalisations);
                    return {
                        hospitalisations,
                        averageHospitalStay: hospitalisations > 0
                            ? d3.sum(rows, d => d.averageHospitalStay * d.hospitalisations) /
                                hospitalisations
                            : 0
                    };
                },
                d => d.ageGroup,
                d => d.sex
            );

            return ageOrder.map(ageGroup => {
                const bySex = totals.get(ageGroup);
                const male = bySex && bySex.get("male");
                const female = bySex && bySex.get("female");
                return {
                    ageGroup,
                    maleValue: male ? male[selectedMetric] : 0,
                    femaleValue: female ? female[selectedMetric] : 0
                };
            });
        }

        function render(animate) {
            const rows = processData();
            const valuesByAge = new Map(rows.map(d => [d.ageGroup, d]));
            const bars = series.map(d => {
                const row = valuesByAge.get(d.ageGroup);
                return {
                    ...d,
                    value: d.sex === "male" ? row.maleValue : row.femaleValue
                };
            });

            const maxValue = d3.max(bars, d => d.value) || 0;
            const domainMax = maxValue > 0 ? maxValue : 1;
            xScale.domain([-domainMax, domainMax]).nice();

            const axis = d3.axisBottom(xScale)
                .ticks(6)
                .tickSize(-innerHeight)
                .tickPadding(9)
                .tickFormat(value => formatValue(Math.abs(value)));

            chartSvg.select(".butterfly-axis-label")
                .text(selectedMetric === "hospitalisations"
                    ? "Hospitalisations (absolute values)"
                    : "Average hospital stay (days)");

            const barSelection = plot.selectAll(".butterfly-bar")
                .data(bars, d => `${d.ageGroup}-${d.sex}`)
                .join(
                    enter => enter.append("rect")
                        .attr("class", d => `butterfly-bar ${d.sex}-bar`)
                        .attr("rx", 4)
                        .attr("ry", 4)
                        .attr("y", d => yScale(d.ageGroup) + yScale.bandwidth() * 0.12)
                        .attr("height", yScale.bandwidth() * 0.76)
                        .attr("x", xScale(0))
                        .attr("width", 0),
                    update => update
                )
                .attr("fill", d => d.sex === "male" ? "#3977a8" : "#d65b78")
                .on("mouseenter", (event, d) => {
                    tooltip
                        .style("opacity", 1)
                        .html(`<strong>Age group:</strong> ${d.ageGroup}<br>
                               <strong>Sex:</strong> ${d.sex === "male" ? "Male" : "Female"}<br>
                               <strong>${metricLabels[selectedMetric]}:</strong> ${formatValue(d.value)}`);
                })
                .on("mousemove", event => {
                    tooltip
                        .style("left", `${event.pageX + 14}px`)
                        .style("top", `${event.pageY - 64}px`);
                })
                .on("mouseleave", () => tooltip.style("opacity", 0));

            const updateBars = selection => selection
                .attr("x", d => xScale(d.sex === "male" ? -d.value : 0))
                .attr("width", d => Math.abs(
                    xScale(d.sex === "male" ? -d.value : d.value) - xScale(0)
                ));

            if (animate) {
                const transition = d3.transition().duration(750);
                barSelection.transition(transition).call(updateBars);
                xAxisGroup.transition(transition).call(axis);
                zeroLine.transition(transition)
                    .attr("x1", xScale(0))
                    .attr("x2", xScale(0));
            } else {
                updateBars(barSelection);
                xAxisGroup.call(axis);
                zeroLine
                    .attr("x1", xScale(0))
                    .attr("x2", xScale(0));
            }
        }

        yearSelect.addEventListener("change", () => render(true));
        metricButtons.on("click", function () {
            selectedMetric = this.dataset.metric;
            metricButtons
                .classed("active", function () {
                    return this.dataset.metric === selectedMetric;
                })
                .attr("aria-pressed", function () {
                    return this.dataset.metric === selectedMetric;
                });
            render(true);
        });

        render(false);
    } catch (error) {
        container.innerHTML = "";
        const message = document.createElement("p");
        message.className = "chart-error";
        message.textContent =
            `Unable to load question5.2data.csv. Please run this page through a local server. Error details: ${error.message}`;
        container.appendChild(message);
    }
});
