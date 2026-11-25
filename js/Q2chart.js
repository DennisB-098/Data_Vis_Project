const Q2_CHART_CONFIG = {
    dataPath: "Data/q2_clean.csv",
    // Place states.geojson in the Data/ folder (vendored copy of
    // https://raw.githubusercontent.com/rowanhogan/australian-states/master/states.geojson)
    geoJsonPath: "Data/states.geojson",
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

const Q2_STATE_CODES_BY_NAME = {
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

const Q2_COLUMN_NAMES = {
    half: "6-monthly (#1)",
    roadUser: "road user",
    state: "state or territory (#1)",
    year: "calendar year (#1)",
    cases: "Sum(count of cases excluding died in hospitals within 30 days (#1))"
};

document.addEventListener("DOMContentLoaded", async () => {
    const container = d3.select("#australia-map-container");
    const tooltip = d3.select("#chart-tooltip");
    const zoomInButton = document.getElementById("q2-map-zoom-in");
    const zoomOutButton = document.getElementById("q2-map-zoom-out");
    const zoomResetButton = document.getElementById("q2-map-zoom-reset");
    const zoomLevel = document.getElementById("q2-map-zoom-level");
    const roadUserSelect = document.getElementById("road-user-select");
    const yearSlider = document.getElementById("year-slider");
    const yearStops = document.getElementById("year-slider-stops");
    const selectedYearOutput = document.getElementById("year-slider-value");
    let selectedYear = "All";
    let selectedRoadUser = "All";
    let mapSvg;
    let mapPaths;
    let mapLabels;
    let mapZoom;
    let mapLegend;
    let mapGradientStops;
    let mapRendered = false;
    let stateTotals;
    let selectedYearLabel;
    let selectedRoadUserLabel;

    const minMapZoom = 1;
    const maxMapZoom = 8;

    function updateZoomControls(scale) {
        zoomLevel.textContent = `${Math.round(scale * 100)}%`;
        zoomOutButton.disabled = scale <= minMapZoom;
        zoomInButton.disabled = scale >= maxMapZoom;
        zoomResetButton.disabled = scale <= minMapZoom;
    }

    zoomInButton.addEventListener("click", () => {
        if (mapSvg && mapZoom) {
            mapSvg.transition().duration(200).call(mapZoom.scaleBy, 1.5);
        }
    });
    zoomOutButton.addEventListener("click", () => {
        if (mapSvg && mapZoom) {
            mapSvg.transition().duration(200).call(mapZoom.scaleBy, 1 / 1.5);
        }
    });
    zoomResetButton.addEventListener("click", () => {
        if (mapSvg && mapZoom) {
            mapSvg.transition().duration(200).call(mapZoom.transform, d3.zoomIdentity);
        }
    });

    const parseRow = (row, index) => {
        const half = row[Q2_COLUMN_NAMES.half];
        const roadUser = row[Q2_COLUMN_NAMES.roadUser];
        const state = row[Q2_COLUMN_NAMES.state];
        const year = Number(row[Q2_COLUMN_NAMES.year]);
        const casesText = row[Q2_COLUMN_NAMES.cases];
        const cases = Number(casesText);

        if (!["Jan-Jun", "Jul-Dec"].includes(half)) {
            throw new Error(`Unexpected half-year value in CSV row ${index + 2}.`);
        }
        if (!Q2_CHART_CONFIG.roadUsers.includes(roadUser)) {
            throw new Error(`Unexpected road user in CSV row ${index + 2}.`);
        }
        if (!Q2_CHART_CONFIG.states.includes(state)) {
            throw new Error(`Unexpected state or territory in CSV row ${index + 2}.`);
        }
        if (!Q2_CHART_CONFIG.years.includes(year) || !Number.isInteger(year)) {
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
        [...Q2_CHART_CONFIG.years.map(String), "All"].forEach((year, index) => {
            const stop = document.createElement("span");
            stop.className = "year-slider-stop";
            stop.dataset.year = year;
            if (index === Q2_CHART_CONFIG.years.length) {
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
        selectedYear = selectedIndex === Q2_CHART_CONFIG.years.length
            ? "All"
            : Q2_CHART_CONFIG.years[selectedIndex];
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
        const stateCode = geoName && Q2_STATE_CODES_BY_NAME[String(geoName).trim().toLowerCase()];
        if (!stateCode) {
            return null;
        }
        return stateCode;
    }

    try {
        const [sourceRows, geoJson] = await Promise.all([
            window.loadChartCsv(Q2_CHART_CONFIG.dataPath, parseRow, container.node()),
            d3.json(Q2_CHART_CONFIG.geoJsonPath)
        ]);

        if (!sourceRows.length) {
            throw new Error("The Q2 CSV contains no data rows.");
        }
        if (!geoJson || geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
            throw new Error("The Australia GeoJSON is not a valid FeatureCollection.");
        }

        const features = geoJson.features
            .map(feature => ({ feature, state: resolveStateCode(feature) }))
            .filter(d => d.state);
        if (features.length !== geoJson.features.length) {
            const skippedCount = geoJson.features.length - features.length;
            console.warn(`Skipped GeoJSON features with unknown state: ${skippedCount}`);
        }
        const mappedStates = new Set(features.map(d => d.state));
        const missingStates = Q2_CHART_CONFIG.states.filter(state => !mappedStates.has(state));
        if (missingStates.length) {
            throw new Error(`The Australia GeoJSON is missing: ${missingStates.join(", ")}.`);
        }

        const yearlyData = aggregateYearlyCases(sourceRows);
        const formatCount = window.SHARED.formatCount;

        function renderMap() {
            stateTotals = new Map(Q2_CHART_CONFIG.states.map(state => [state, 0]));
            yearlyData.forEach(row => {
                if (selectedYear !== "All" && row.year !== selectedYear) return;
                if (selectedRoadUser !== "All" && row.roadUser !== selectedRoadUser) return;
                stateTotals.set(row.state, stateTotals.get(row.state) + row.cases);
            });

            const maximum = d3.max(stateTotals.values()) || 1;
            const colorScale = d3.scaleSequential()
                .domain([0, maximum])
                .interpolator(t => d3.interpolateBlues(0.15 + t * 0.85));
            const { width, height } = Q2_CHART_CONFIG;
            selectedYearLabel = selectedYear === "All" ? "All Years" : selectedYear;
            selectedRoadUserLabel = selectedRoadUser === "All" ? "All road users" : selectedRoadUser;

            function positionTooltip(event) {
                window.positionChartTooltip(event, tooltip);
            }

            function showTooltip(feature, state, event) {
                const stateName = Q2_CHART_CONFIG.stateNames[state];
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
                    positionTooltip({
                        clientX: bounds.left + bounds.width / 2,
                        clientY: bounds.top,
                        pageX: window.scrollX + bounds.left + bounds.width / 2,
                        pageY: window.scrollY + bounds.top
                    });
                }
            }

            if (!mapSvg) {
                mapSvg = container.append("svg")
                    .attr("class", "q2-map-svg")
                    .attr("viewBox", `0 0 ${width} ${height}`)
                    .attr("role", "group")
                    .attr("aria-labelledby", "q2-map-title")
                    .attr("aria-describedby", "q2-map-description");

                mapSvg.append("title")
                    .attr("id", "q2-map-title")
                    .text("Australian hospitalised road crash cases choropleth");
                mapSvg.append("desc").attr("id", "q2-map-description");

                const projection = d3.geoMercator()
                    .fitExtent([[24, 48], [width - 24, height - 108]], geoJson);
                const path = d3.geoPath(projection);

                mapPaths = mapSvg.append("g")
                    .attr("class", "q2-map-states")
                    .selectAll("path")
                    .data(features)
                    .join("path")
                    .attr("class", "q2-map-state")
                    .attr("d", d => path(d.feature))
                    .attr("fill", "#e7f0f8")
                    .attr("opacity", 0)
                    .attr("tabindex", 0)
                    .attr("role", "img")
                    .on("mouseenter", function (event, d) {
                        showTooltip(this, d.state, event);
                    })
                    .on("mousemove", event => positionTooltip(event))
                    .on("mouseleave", () => tooltip.style("opacity", 0))
                    .on("focus", function (event, d) {
                        showTooltip(this, d.state);
                    })
                    .on("blur", () => tooltip.style("opacity", 0));

                mapLabels = mapSvg.append("g")
                    .attr("class", "q2-map-labels")
                    .attr("aria-hidden", "true")
                    .selectAll("text")
                    .data(features)
                    .join("text")
                    .attr("class", "q2-map-label")
                    .attr("x", d => path.centroid(d.feature)[0])
                    .attr("y", d => path.centroid(d.feature)[1])
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .text(d => d.state)
                    .attr("aria-hidden", "true")
                    .style("pointer-events", "none");

                mapZoom = d3.zoom()
                    .scaleExtent([minMapZoom, maxMapZoom])
                    .extent([[0, 0], [width, height]])
                    .translateExtent([[0, 0], [width, height]])
                    .on("zoom", event => {
                        mapPaths.attr("transform", event.transform);
                        mapLabels.attr("transform", event.transform);
                        updateZoomControls(event.transform.k);
                    });
                mapSvg.call(mapZoom).on("dblclick.zoom", null);
                updateZoomControls(minMapZoom);

                const legendWidth = 250;
                const legendX = (width - legendWidth) / 2;
                const legendY = height - 57;
                const gradient = mapSvg.append("defs")
                    .append("linearGradient")
                    .attr("id", "q2-map-gradient");
                mapGradientStops = gradient.selectAll("stop")
                    .data([
                        { offset: "0%", value: 0 },
                        { offset: "100%", value: 1 }
                    ])
                    .join("stop")
                    .attr("offset", d => d.offset);

                mapLegend = mapSvg.append("g")
                    .attr("class", "q2-map-legend")
                    .attr("role", "img")
                    .attr("opacity", 0);
                mapLegend.append("text")
                    .attr("x", legendX)
                    .attr("y", legendY - 8)
                    .text("Hospitalisations");
                mapLegend.append("rect")
                    .attr("x", legendX)
                    .attr("y", legendY)
                    .attr("width", legendWidth)
                    .attr("height", 12)
                    .attr("rx", 4)
                    .attr("fill", "url(#q2-map-gradient)");
                mapLegend.append("text")
                    .attr("class", "q2-map-legend-min")
                    .attr("x", legendX)
                    .attr("y", legendY + 28);
                mapLegend.append("text")
                    .attr("class", "q2-map-legend-mid")
                    .attr("x", legendX + legendWidth / 2)
                    .attr("y", legendY + 28)
                    .attr("text-anchor", "middle");
                mapLegend.append("text")
                    .attr("class", "q2-map-legend-max")
                    .attr("x", legendX + legendWidth)
                    .attr("y", legendY + 28)
                    .attr("text-anchor", "end");
            }

            mapSvg.select("#q2-map-description")
                .text(`Map shaded by total hospitalisations for ${selectedRoadUserLabel}, ${selectedYearLabel}. Darker blue indicates more cases. Focus a state to hear its total.`);

            mapPaths.attr("aria-label", d =>
                `${Q2_CHART_CONFIG.stateNames[d.state]}. Year: ${selectedYearLabel}. ` +
                `Road user: ${selectedRoadUserLabel}. Total hospitalisations: ` +
                `${formatCount(stateTotals.get(d.state))}.`
            );
            mapLegend
                .attr("aria-label", `Color scale from 0 to ${formatCount(maximum)} hospitalisations`)
                .select(".q2-map-legend-min")
                .text("0");
            mapLegend.select(".q2-map-legend-mid").text(formatCount(maximum / 2));
            mapLegend.select(".q2-map-legend-max").text(formatCount(maximum));

            const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 0
                : mapRendered ? 450 : 800;
            const transition = d3.transition()
                .duration(duration)
                .ease(d3.easeCubicOut);

            mapPaths.transition(transition)
                .attr("fill", d => colorScale(stateTotals.get(d.state)))
                .attr("opacity", 1);
            mapGradientStops.transition(transition)
                .attr("stop-color", d => colorScale(d.value === 0 ? 0 : maximum));
            mapLegend.transition(transition).attr("opacity", 1);
            mapRendered = true;
        }

        yearSlider.max = String(Q2_CHART_CONFIG.years.length);
        yearSlider.value = String(Q2_CHART_CONFIG.years.length);
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
            .text(`Unable to load or render the Q2 map. ${error.message}`);
    }
});
