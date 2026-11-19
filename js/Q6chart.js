const Q6_CHART_CONFIG = {
    dataPath: "Data/question6data.csv",
    geoJsonPath: "https://raw.githubusercontent.com/rowanhogan/australian-states/master/states.geojson",
    years: d3.range(2011, 2022),
    roadUsers: [
        "Car driver, passenger or unknown position",
        "Motorcyclist",
        "Pedal cyclist",
        "Pedestrian",
        "Bus occupant",
        "Heavy transport driver, passenger or unknown position",
        "Other or unknown",
        "Pick-up truck or van occupant"
    ],
    states: ["ACT", "NSW", "NT", "Qld", "SA", "Tas", "Vic", "WA"],
    stateNames: {
        ACT: "Australian Capital Territory",
        NSW: "New South Wales",
        NT: "Northern Territory",
        Qld: "Queensland",
        SA: "South Australia",
        Tas: "Tasmania",
        Vic: "Victoria",
        WA: "Western Australia"
    },
    width: 1000,
    height: 620
};

const Q6_STATE_CODES_BY_NAME = {
    "australian capital territory": "ACT",
    "new south wales": "NSW",
    "northern territory": "NT",
    queensland: "Qld",
    "south australia": "SA",
    tasmania: "Tas",
    victoria: "Vic",
    "western australia": "WA",
    act: "ACT",
    nsw: "NSW",
    nt: "NT",
    qld: "Qld",
    sa: "SA",
    tas: "Tas",
    vic: "Vic",
    wa: "WA"
};

const Q6_COLUMN_NAMES = {
    half: "6-monthly (#1)",
    roadUser: "road user",
    state: "state or territory (#1)",
    year: "calendar year (#1)",
    cases: "Sum(count of cases excluding died in hospitals within 30 days (#1))"
};

document.addEventListener("DOMContentLoaded", async () => {
    const container = d3.select("#australia-map-container");
    const tooltip = d3.select("#chart-tooltip");
    const roadUserSelect = document.getElementById("road-user-select");
    const yearSlider = document.getElementById("year-slider");
    const yearStops = document.getElementById("year-slider-stops");
    const selectedYearOutput = document.getElementById("year-slider-value");
    let selectedYear = "All";
    let selectedRoadUser = "All";

    const parseRow = (row, index) => {
        const half = row[Q6_COLUMN_NAMES.half];
        const roadUser = row[Q6_COLUMN_NAMES.roadUser];
        const state = row[Q6_COLUMN_NAMES.state];
        const year = Number(row[Q6_COLUMN_NAMES.year]);
        const casesText = row[Q6_COLUMN_NAMES.cases];
        const cases = Number(casesText);

        if (!["Jan-Jun", "Jul-Dec"].includes(half)) {
            throw new Error(`Unexpected half-year value in CSV row ${index + 2}.`);
        }
        if (!Q6_CHART_CONFIG.roadUsers.includes(roadUser)) {
            throw new Error(`Unexpected road user in CSV row ${index + 2}.`);
        }
        if (!Q6_CHART_CONFIG.states.includes(state)) {
            throw new Error(`Unexpected state or territory in CSV row ${index + 2}.`);
        }
        if (!Q6_CHART_CONFIG.years.includes(year) || !Number.isInteger(year)) {
            throw new Error(`Invalid calendar year in CSV row ${index + 2}.`);
        }
        if (casesText === "" || !Number.isInteger(cases) || cases < 0) {
            throw new Error(`Invalid hospitalisation count in CSV row ${index + 2}.`);
        }

        return { half, roadUser, state, year, cases };
    };

    function aggregateYearlyCases(rows) {
        const totalsByStateAndUser = d3.rollup(
            rows,
            yearRows => d3.sum(yearRows, row => row.cases),
            row => row.state,
            row => row.roadUser,
            row => row.year
        );
        const yearlyData = [];

        totalsByStateAndUser.forEach((roadUserMap, state) => {
            roadUserMap.forEach((yearMap, roadUser) => {
                yearMap.forEach((cases, year) => {
                    yearlyData.push({ state, roadUser, year, cases });
                });
            });
        });

        return yearlyData;
    }

    function addYearStops() {
        [...Q6_CHART_CONFIG.years.map(String), "All"].forEach((year, index) => {
            const stop = document.createElement("span");
            stop.className = "year-slider-stop";
            stop.dataset.year = year;
            if (index === Q6_CHART_CONFIG.years.length) {
                stop.classList.add("all-stop");
            }
            stop.setAttribute("aria-hidden", "true");
            const dot = document.createElement("span");
            dot.className = "year-slider-dot";
            const label = document.createElement("span");
            label.className = "year-slider-label";
            label.textContent = year;
            stop.append(dot, label);
            yearStops.appendChild(stop);
        });
    }

    function updateYearSlider() {
        const selectedIndex = Number(yearSlider.value);
        selectedYear = selectedIndex === Q6_CHART_CONFIG.years.length
            ? "All"
            : Q6_CHART_CONFIG.years[selectedIndex];
        const selectedLabel = selectedYear === "All" ? "All Years" : String(selectedYear);
        selectedYearOutput.textContent = selectedLabel;
        yearSlider.setAttribute("aria-valuetext", selectedLabel);
        yearStops.querySelectorAll(".year-slider-stop").forEach((stop, index) => {
            stop.classList.toggle("is-selected", index === selectedIndex);
        });
    }

    function resolveStateCode(feature) {
        const properties = feature.properties || {};
        const geoName = properties.STATE_NAME || properties.state || properties.STATE ||
            properties.name || properties.NAME_1;
        const stateCode = geoName && Q6_STATE_CODES_BY_NAME[String(geoName).trim().toLowerCase()];
        if (!stateCode) {
            throw new Error(`Unable to match GeoJSON feature "${geoName || "unknown"}" to an Australian state or territory.`);
        }
        return stateCode;
    }

    try {
        const [sourceRows, geoJson] = await Promise.all([
            d3.csv(Q6_CHART_CONFIG.dataPath, parseRow),
            d3.json(Q6_CHART_CONFIG.geoJsonPath)
        ]);

        if (!sourceRows.length) {
            throw new Error("The Q6 CSV contains no data rows.");
        }
        if (!geoJson || geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
            throw new Error("The Australia GeoJSON is not a valid FeatureCollection.");
        }

        const features = geoJson.features.map(feature => ({ feature, state: resolveStateCode(feature) }));
        const mappedStates = new Set(features.map(d => d.state));
        const missingStates = Q6_CHART_CONFIG.states.filter(state => !mappedStates.has(state));
        if (missingStates.length) {
            throw new Error(`The Australia GeoJSON is missing: ${missingStates.join(", ")}.`);
        }

        const yearlyData = aggregateYearlyCases(sourceRows);
        const formatCount = d3.format(",");

        function renderMap() {
            const stateTotals = new Map(Q6_CHART_CONFIG.states.map(state => [state, 0]));
            yearlyData.forEach(row => {
                if (selectedYear !== "All" && row.year !== selectedYear) return;
                if (selectedRoadUser !== "All" && row.roadUser !== selectedRoadUser) return;
                stateTotals.set(row.state, stateTotals.get(row.state) + row.cases);
            });

            const maximum = d3.max(stateTotals.values()) || 1;
            const colorScale = d3.scaleSequential()
                .domain([0, maximum])
                .interpolator(d3.interpolateBlues);
            const { width, height } = Q6_CHART_CONFIG;
            const svg = container.html("").append("svg")
                .attr("class", "q6-map-svg")
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("role", "group")
                .attr("aria-labelledby", "q6-map-title")
                .attr("aria-describedby", "q6-map-description");

            svg.append("title")
                .attr("id", "q6-map-title")
                .text("Australian hospitalised road crash cases choropleth");
            svg.append("desc")
                .attr("id", "q6-map-description")
                .text(`Map shaded by total hospitalisations for ${selectedRoadUser === "All" ? "all road users" : selectedRoadUser}, ${selectedYear === "All" ? "all years" : selectedYear}. Darker blue indicates more cases. Focus a state to hear its total.`);

            const projection = d3.geoMercator()
                .fitExtent([[24, 48], [width - 24, height - 108]], geoJson);
            const path = d3.geoPath(projection);
            const selectedYearLabel = selectedYear === "All" ? "All Years" : selectedYear;
            const selectedRoadUserLabel = selectedRoadUser === "All" ? "All road users" : selectedRoadUser;

            function positionTooltip(event) {
                tooltip
                    .style("left", `${event.pageX + 14}px`)
                    .style("top", `${event.pageY - 64}px`);
            }

            function showTooltip(feature, state, event) {
                const stateName = Q6_CHART_CONFIG.stateNames[state];
                const total = stateTotals.get(state);
                tooltip
                    .style("opacity", 1)
                    .html(`<strong>${stateName}</strong><br>
                           <strong>Year:</strong> ${selectedYearLabel}<br>
                           <strong>Road user:</strong> ${selectedRoadUserLabel}<br>
                           <strong>Total hospitalisations:</strong> ${formatCount(total)}`);
                if (event) {
                    positionTooltip(event);
                } else {
                    const bounds = feature.getBoundingClientRect();
                    tooltip
                        .style("left", `${window.scrollX + bounds.left + bounds.width / 2 + 14}px`)
                        .style("top", `${window.scrollY + bounds.top - 64}px`);
                }
            }

            svg.append("g")
                .attr("class", "q6-map-states")
                .selectAll("path")
                .data(features)
                .join("path")
                .attr("class", "q6-map-state")
                .attr("d", d => path(d.feature))
                .attr("fill", d => colorScale(stateTotals.get(d.state)))
                .attr("tabindex", 0)
                .attr("role", "img")
                .attr("aria-label", d =>
                    `${Q6_CHART_CONFIG.stateNames[d.state]}. Year: ${selectedYearLabel}. ` +
                    `Road user: ${selectedRoadUserLabel}. Total hospitalisations: ` +
                    `${formatCount(stateTotals.get(d.state))}.`
                )
                .on("mouseenter", function (event, d) {
                    showTooltip(this, d.state, event);
                })
                .on("mousemove", event => positionTooltip(event))
                .on("mouseleave", () => tooltip.style("opacity", 0))
                .on("focus", function (event, d) {
                    showTooltip(this, d.state);
                })
                .on("blur", () => tooltip.style("opacity", 0));

            const legendWidth = 250;
            const legendX = (width - legendWidth) / 2;
            const legendY = height - 57;
            const gradient = svg.append("defs")
                .append("linearGradient")
                .attr("id", "q6-map-gradient");
            gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(0));
            gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(maximum));

            const legend = svg.append("g")
                .attr("class", "q6-map-legend")
                .attr("role", "img")
                .attr("aria-label", `Color scale from 0 to ${formatCount(maximum)} hospitalisations`);
            legend.append("text")
                .attr("x", legendX)
                .attr("y", legendY - 8)
                .text("Hospitalisations");
            legend.append("rect")
                .attr("x", legendX)
                .attr("y", legendY)
                .attr("width", legendWidth)
                .attr("height", 12)
                .attr("rx", 4)
                .attr("fill", "url(#q6-map-gradient)");
            legend.append("text")
                .attr("x", legendX)
                .attr("y", legendY + 28)
                .text("0");
            legend.append("text")
                .attr("x", legendX + legendWidth)
                .attr("y", legendY + 28)
                .attr("text-anchor", "end")
                .text(formatCount(maximum));
        }

        yearSlider.max = String(Q6_CHART_CONFIG.years.length);
        yearSlider.value = String(Q6_CHART_CONFIG.years.length);
        addYearStops();
        updateYearSlider();
        yearSlider.addEventListener("input", () => {
            updateYearSlider();
            renderMap();
        });
        roadUserSelect.addEventListener("change", () => {
            selectedRoadUser = roadUserSelect.value;
            renderMap();
        });
        renderMap();
    } catch (error) {
        container.html("")
            .append("p")
            .attr("class", "chart-error")
            .text(`Unable to load or render the Q6 map. ${error.message}`);
    }
});
