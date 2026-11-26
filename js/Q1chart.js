(() => {
  const container = d3.select("#q1-chart");
  const tooltip = d3.select("#chart-tooltip");
  const formatValue = d3.format(",");
  let dataByYear = new Map();

  function showError(message) {
    container.html("").append("p").attr("class", "chart-error").text(message);
  }

  function showTooltip(event, datum, average) {
    const previousYear = dataByYear.get(datum.year - 1);
    const yearChange = previousYear
      ? d3.format("+.1%")((datum.hospitalisations - previousYear.hospitalisations) / previousYear.hospitalisations)
      : "First year in series";
    const averageDifference = Math.round(datum.hospitalisations - average);
    const differenceLabel = `${averageDifference >= 0 ? "+" : ""}${formatValue(averageDifference)}`;
    tooltip
      .html(`<strong>${datum.year}</strong><br>${formatValue(datum.hospitalisations)} hospitalisations<br><span>${differenceLabel} vs 11-year average</span><br><span>Year-on-year: ${yearChange}</span>`)
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
        .attr("aria-label", "Lollipop chart comparing annual road injury hospitalisations with the 11-year average from 2011 to 2021");
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, plotWidth]);
      const differences = data.map(d => d.hospitalisations - average);
      const [minimumDifference, maximumDifference] = d3.extent(differences);
      const y = d3.scaleLinear()
        .domain([Math.min(0, minimumDifference), Math.max(0, maximumDifference)])
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
        .attr("y1", y(0))
        .attr("y2", y(0));
      plot.append("text")
        .attr("class", "average-label")
        .attr("x", 8)
        .attr("y", y(0) - 8)
        .text(`${data.length}-year average: ${formatValue(Math.round(average))}`);

      plot.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${plotHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).tickSizeOuter(0));

      plot.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(value =>
          value > 0 ? `+${d3.format("~s")(value)}` : d3.format("~s")(value)
        ).tickSizeOuter(0));

      svg.append("text")
        .attr("class", "chart-label")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(20,${margin.top + plotHeight / 2}) rotate(-90)`)
        .text("Difference from average");

      const animationDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
      const stems = plot.selectAll(".lollipop-stem")
        .data(data)
        .join("line")
        .attr("class", "lollipop-stem")
        .classed("is-below-average", d => d.hospitalisations < average)
        .classed("is-peak", d => d.year === peak.year)
        .attr("x1", d => x(d.year))
        .attr("x2", d => x(d.year))
        .attr("y1", y(0))
        .attr("y2", y(0));
      stems.transition()
        .duration(animationDuration)
        .ease(d3.easeCubicOut)
        .attr("y2", d => y(d.hospitalisations - average));

      const focusLine = plot.append("line")
        .attr("class", "chart-focus-line")
        .attr("y1", 0)
        .attr("y2", plotHeight)
        .style("opacity", 0);

      const points = plot.selectAll(".line-point")
        .data(data)
        .join("circle")
        .attr("class", "line-point")
        .classed("is-below-average", d => d.hospitalisations < average)
        .classed("is-peak", d => d.year === peak.year)
        .attr("cx", d => x(d.year))
        .attr("cy", y(0))
        .attr("r", 6)
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr("aria-label", d => {
          const difference = Math.round(d.hospitalisations - average);
          const sign = difference >= 0 ? "+" : "";
          return `${d.year}: ${formatValue(d.hospitalisations)} hospitalisations, ${sign}${formatValue(difference)} versus average`;
        })
        .on("pointerenter", function (event, datum) {
          activatePoint(datum);
          showTooltip(event, datum, average);
        })
        .on("pointermove", (event, datum) => showTooltip(event, datum, average))
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
          }, datum, average);
        })
        .on("blur", () => {
          clearActivePoint();
        });

      function activatePoint(datum) {
        stems.classed("is-active", d => d.year === datum.year);
        points
          .classed("is-active", d => d.year === datum.year)
          .attr("r", d => d.year === datum.year ? 8 : 6);
        focusLine
          .attr("x1", x(datum.year))
          .attr("x2", x(datum.year))
          .style("opacity", 1);
      }

      function clearActivePoint() {
        stems.classed("is-active", false);
        points.classed("is-active", false).attr("r", 6);
        focusLine.style("opacity", 0);
        tooltip.style("opacity", 0);
      }

      points.transition()
        .duration(animationDuration)
        .ease(d3.easeCubicOut)
        .attr("cy", d => y(d.hospitalisations - average));
    }

    renderChart();
    window.addEventListener("resize", renderChart);
  }).catch(error => {
    console.error("Unable to load Question 1 data:", error);
    showError("Unable to load annual data. Open this page through a local web server and check that Data/q1_clean.csv is available.");
  });
})();
