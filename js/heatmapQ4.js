document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("heatmap-container");
    const tooltip = d3.select("#chart-tooltip");

    d3.csv("data/question4data.csv", d => ({
        ageGroup: d["Age group"],
        year: +d["Calendar year"],
        stay: +d["Mean(Average_Hospital_Stay)"]
    })).then(data => {
        renderHeatmap(data);
    }).catch(error => {
        container.innerHTML =
            `<p>Unable to load question4data.csv. Please run this page through a local server. Error details: ${error}</p>`;
    });

    function renderHeatmap(data) {
        container.innerHTML = "";

        const margin = { top: 30, right: 95, bottom: 70, left: 90 };
        const width = 900;
        const height = 460;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const years = Array.from(new Set(data.map(d => d.year))).sort(d3.ascending);
        const ageGroups = Array.from(new Set(data.map(d => d.ageGroup)));

        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("aria-label", "Heatmap of average hospital stay by age group and year");

        const innerChart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand()
            .domain(years)
            .range([0, innerWidth])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(ageGroups)
            .range([0, innerHeight])
            .padding(0.05);

        const minStay = d3.min(data, d => d.stay);
        const maxStay = d3.max(data, d => d.stay);

        const colorScale = d3.scaleSequential()
            .domain([minStay, maxStay])
            .interpolator(d3.interpolateReds);

        innerChart.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", d => xScale(d.year))
            .attr("y", d => yScale(d.ageGroup))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", d => colorScale(d.stay))
            .on("mouseenter", (event, d) => {
                tooltip
                    .style("opacity", 1)
                    .html(`<strong>Age group:</strong> ${d.ageGroup}<br>
                           <strong>Year:</strong> ${d.year}<br>
                           <strong>Average stay:</strong> ${d.stay.toFixed(2)} days`);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY - 70}px`);
            })
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
            });

        innerChart.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format("d")).tickSizeOuter(0));

        innerChart.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(yScale).tickSizeOuter(0));

        innerChart.append("text")
            .attr("class", "axis-label")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + 55)
            .attr("text-anchor", "middle")
            .text("Calendar year");

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
    }
});