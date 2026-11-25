(() => {
  const container = d3.select("#q1-chart");
  const tooltip = d3.select("#chart-tooltip");
  const formatValue = d3.format(",");
  let dataByYear = new Map();

  function showError(message) {
    container.html("").append("p").attr("class", "chart-error").text(message);
  }

  function showTooltip(event, datum) {
    const previousYear = dataByYear.get(datum.year - 1);
    const yearChange = previousYear
      ? d3.format("+.1%")((datum.hospitalisations - previousYear.hospitalisations) / previousYear.hospitalisations)
      : "First year in series";
    tooltip
      .html(`<strong>${datum.year}</strong><br>${formatValue(datum.hospitalisations)} hospitalisations<br><span>Year-on-year: ${yearChange}</span>`)
      .style("opacity", 1);
    window.positionChartTooltip(event, tooltip);
  }

  window.loadChartCsv("Data/q1_clean.csv", row => ({
    year: Number(row["Calendar year"]),
    hospitalisations: Number(row["Sum(Hospitalisations)"])
  })).then(data => {
    if (data.length === 0 || data.some(d => !Number.isFinite(d.year) || !Number.isFinite(d.hospitalisations))) {
      showError("The annual data could not be read. Check the columns in Data/q1_clean.csv.");
      return;
    }

    dataByYear = new Map(data.map(d => [d.year, d]));
    const total = d3.sum(data, d => d.hospitalisations);
    const average = d3.mean(data, d => d.hospitalisations);
    const peak = data.reduce((highest, current) =>
      current.hospitalisations > highest.hospitalisations ? current : highest
    );
    const firstYear = d3.least(data, d => d.year);
    const lastYear = d3.greatest(data, d => d.year);
    const periodChange = (lastYear.hospitalisations - firstYear.hospitalisations) / firstYear.hospitalisations;
    d3.select("#q1-total").text(formatValue(total));
    d3.select("#q1-peak-year").text(peak.year);
    d3.select("#q1-peak-value").text(`${formatValue(peak.hospitalisations)} hospitalisations`);
    d3.select("#q1-change").text(d3.format("+.1%")(periodChange));

    let renderedNarrow = null;
    function renderChart() {
      const narrow = container.node().clientWidth < 620;
      if (renderedNarrow === narrow) {
        return;
      }
      renderedNarrow = narrow;
      const width = narrow ? 420 : 900;
      const height = narrow ? 520 : 440;
      const margin = narrow
        ? { top: 28, right: 20, bottom: 62, left: 60 }
        : { top: 24, right: 28, bottom: 58, left: 76 };
      tooltip.style("opacity", 0);
      const svg = container.html("").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("width", "100%")
        .style("height", "auto")
        .attr("role", "group")
        .attr("aria-label", "Line chart of annual road injury hospitalisations from 2011 to 2021");
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, plotWidth]);
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.hospitalisations) * 1.12])
        .nice()
        .range([plotHeight, 0]);
      const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      plot.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-plotWidth).tickFormat(""));

      plot.append("line")
        .attr("class", "average-line")
        .attr("x1", 0)
        .attr("x2", plotWidth)
        .attr("y1", y(average))
        .attr("y2", y(average));
      plot.append("text")
        .attr("class", "average-label")
        .attr("x", 8)
        .attr("y", y(average) - 8)
        .text(`${data.length}-year average: ${formatValue(Math.round(average))}`);

      plot.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${plotHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).tickSizeOuter(0));

      plot.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")).tickSizeOuter(0));

      svg.append("text")
        .attr("class", "chart-label")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(20,${margin.top + plotHeight / 2}) rotate(-90)`)
        .text("Hospitalisations");

      const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.hospitalisations))
        .curve(d3.curveMonotoneX);

      const linePath = plot.append("path")
        .datum(data)
        .attr("class", "line-path")
        .attr("d", line);

      const pathLength = linePath.node().getTotalLength();
      linePath
        .attr("stroke-dasharray", `${pathLength} ${pathLength}`)
        .attr("stroke-dashoffset", pathLength)
        .transition()
        .duration(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      const focusLine = plot.append("line")
        .attr("class", "chart-focus-line")
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .style("opacity", 0);

      const points = plot.selectAll(".line-point")
        .data(data)
        .join("circle")
        .attr("class", "line-point")
        .classed("is-peak", d => d.year === peak.year)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.hospitalisations))
        .attr("r", 6)
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr("aria-label", d => `${d.year}: ${formatValue(d.hospitalisations)} hospitalisations`)
        .on("pointerenter", function (event, datum) {
          activatePoint(datum);
          showTooltip(event, datum);
        })
        .on("pointermove", showTooltip)
        .on("pointerleave", () => {
          clearActivePoint();
        })
        .on("focus", function (event, datum) {
          activatePoint(datum);
          const bounds = this.getBoundingClientRect();
          showTooltip({
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top,
            pageX: window.scrollX + bounds.left + bounds.width / 2,
            pageY: window.scrollY + bounds.top
          }, datum);
        })
        .on("blur", () => {
          clearActivePoint();
        });

      function activatePoint(datum) {
        points
          .classed("is-active", d => d.year === datum.year)
          .attr("r", d => d.year === datum.year ? 8 : 6);
        focusLine
          .attr("x1", x(datum.year))
          .attr("x2", x(datum.year))
          .style("opacity", 1);
      }

      function clearActivePoint() {
        points.classed("is-active", false).attr("r", 6);
        focusLine.style("opacity", 0);
        tooltip.style("opacity", 0);
      }
    }

    renderChart();
    window.addEventListener("resize", renderChart);
  }).catch(error => {
    console.error("Unable to load Question 1 data:", error);
    showError("Unable to load annual data. Open this page through a local web server and check that Data/q1_clean.csv is available.");
  });
})();
