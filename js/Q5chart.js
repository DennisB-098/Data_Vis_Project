const Q5_CHART_CONFIG = {
    dataPath: "data/question5.2data.csv",
    ageOrder: ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+"],
    metricLabels: {
        hospitalisations: "Hospitalisations",
        averageHospitalStay: "Average hospital stay"
    },
    width: 1000,
    height: 540,
    margin: { top: 68, right: 38, bottom: 76, left: 112 }
};

function parseQ5Row(d, index) {
    const year = +d["Calendar year"];
    const hospitalisations = +d["Sum(Hospitalisations)"];
    const averageHospitalStay = +d["Average_Hospital_Stay"];
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
}

function loadQ5Data() {
    return d3.csv(Q5_CHART_CONFIG.dataPath, parseQ5Row);
}

function aggregateQ5Data(data, selectedYear, selectedMetric, ageOrder) {
    const filtered = selectedYear === "All"
        ? data
        : data.filter(d => d.year === Number(selectedYear));

    const totals = d3.rollup(
        filtered,
        rows => {
            const hospitalisations = d3.sum(rows, d => d.hospitalisations);
            return {
                hospitalisations,
                // Weight the all-years average by its hospitalization count.
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

document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("butterfly-chart-container");
    const yearSlider = document.getElementById("year-slider");
    const yearSliderValue = document.getElementById("year-slider-value");
    const yearSliderStops = document.getElementById("year-slider-stops");
    const metricButtons = d3.selectAll(".metric-btn");
    const tooltip = d3.select("#chart-tooltip");
    const { ageOrder, metricLabels, width, height, margin } = Q5_CHART_CONFIG;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const formatCount = d3.format(",");
    const formatStay = d3.format(".2f");

    let selectedMetric = "hospitalisations";
    let years = [];
    const formatValue = value => selectedMetric === "hospitalisations"
        ? formatCount(value)
        : formatStay(value);

    try {
        const sourceData = await loadQ5Data();

        if (sourceData.length === 0) {
            throw new Error("The CSV contains no data rows.");
        }

        years = Array.from(new Set(sourceData.map(d => d.year))).sort(d3.ascending);
        yearSlider.max = String(years.length);
        yearSlider.value = String(years.length);

        [...years.map(String), "All"].forEach((label, index) => {
            const stop = document.createElement("span");
            stop.className = "year-slider-stop";
            if (index === years.length) {
                stop.classList.add("all-stop");
            }

            const dot = document.createElement("span");
            dot.className = "year-slider-dot";
            const text = document.createElement("span");
            text.className = "year-slider-label";
            text.textContent = label;

            stop.append(dot, text);
            yearSliderStops.appendChild(stop);
        });

        function getSelectedYear() {
            const index = Number(yearSlider.value);
            return index === years.length ? "All" : String(years[index]);
        }

        function updateYearSlider() {
            const selectedIndex = Number(yearSlider.value);
            yearSliderValue.textContent = getSelectedYear();
            yearSlider.setAttribute("aria-valuetext", getSelectedYear());
            yearSliderStops.querySelectorAll(".year-slider-stop").forEach((stop, index) => {
                stop.classList.toggle("is-selected", index === selectedIndex);
            });
        }

        const chartSvg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr("aria-label", "Hospitalisations by Sex and Age Group");

        const svgTitle = chartSvg.append("title");
        const visibleTitle = chartSvg.append("text")
            .attr("class", "butterfly-chart-title")
            .attr("x", width / 2)
            .attr("y", 28)
            .attr("text-anchor", "middle")
            .attr("fill", "#3b5668")
            .attr("font-size", 20)
            .attr("font-weight", 700);

        const legend = chartSvg.append("g")
            .attr("class", "butterfly-svg-legend")
            .attr("transform", `translate(${width - margin.right - 190},28)`)
            .attr("role", "group")
            .attr("aria-label", "Male and female");

        const legendEntries = [
            { sex: "Male", color: "#3977a8" },
            { sex: "Female", color: "#d65b78" }
        ];
        const legendItems = legend.selectAll(".butterfly-svg-legend-item")
            .data(legendEntries)
            .join("g")
            .attr("class", "butterfly-svg-legend-item")
            .attr("transform", (d, index) => `translate(${index * 92},0)`);

        legendItems.append("rect")
            .attr("width", 13)
            .attr("height", 13)
            .attr("y", -10)
            .attr("rx", 3)
            .attr("fill", d => d.color);

        legendItems.append("text")
            .attr("x", 19)
            .attr("y", 1)
            .attr("fill", "#3b5668")
            .attr("font-size", 14)
            .attr("font-weight", 600)
            .text(d => d.sex);

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
            return aggregateQ5Data(
                sourceData,
                getSelectedYear(),
                selectedMetric,
                ageOrder
            );
        }

        function render(animate) {
            const title = selectedMetric === "hospitalisations"
                ? "Hospitalisations by Sex and Age Group"
                : "Average Hospital Stay by Sex and Age Group";
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
            // A symmetric domain keeps male and female magnitudes directly comparable.
            xScale.domain([-domainMax, domainMax]).nice();

            const axis = d3.axisBottom(xScale)
                .ticks(6)
                .tickSize(-innerHeight)
                .tickPadding(9)
                .tickFormat(value => formatValue(Math.abs(value)));

            chartSvg.attr("aria-label", title);
            svgTitle.text(title);
            visibleTitle.text(title);

            chartSvg.select(".butterfly-axis-label")
                .text(selectedMetric === "hospitalisations"
                    ? "Hospitalisations (absolute values)"
                    : "Average hospital stay (days)");

            const showTooltip = d => {
                tooltip
                    .style("opacity", 1)
                    .html(`<strong>Age group:</strong> ${d.ageGroup}<br>
                           <strong>Sex:</strong> ${d.sex === "male" ? "Male" : "Female"}<br>
                           <strong>${metricLabels[selectedMetric]}:</strong> ${formatValue(d.value)}`);
            };

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
                .attr("tabindex", 0)
                .attr("role", "img")
                .attr("aria-label", d => `${d.ageGroup}, ${d.sex === "male" ? "Male" : "Female"}: ${metricLabels[selectedMetric]} ${formatValue(d.value)}`)
                .on("mouseenter", (event, d) => {
                    showTooltip(d);
                })
                .on("mousemove", event => {
                    tooltip
                        .style("left", `${event.pageX + 14}px`)
                        .style("top", `${event.pageY - 64}px`);
                })
                .on("focus", function (event, d) {
                    showTooltip(d);
                    const bounds = this.getBoundingClientRect();
                    tooltip
                        .style("left", `${window.scrollX + bounds.left + bounds.width / 2 + 14}px`)
                        .style("top", `${window.scrollY + bounds.top - 64}px`);
                })
                .on("blur", () => tooltip.style("opacity", 0))
                .on("mouseleave", () => tooltip.style("opacity", 0));

            // Negative male values position bars to the left of the central zero line.
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

        yearSlider.addEventListener("input", () => {
            updateYearSlider();
            render(true);
        });
        metricButtons.on("click", function () {
            selectedMetric = this.dataset.metric;
            // Keep the visual selection and accessible pressed state in sync.
            metricButtons
                .classed("active", function () {
                    return this.dataset.metric === selectedMetric;
                })
                .attr("aria-pressed", function () {
                    return this.dataset.metric === selectedMetric;
                });
            render(true);
        });

        updateYearSlider();
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
