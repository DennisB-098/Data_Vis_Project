(() => {
  const container = d3.select("#q2-chart");
  const tooltip = d3.select("#chart-tooltip");
  const totalLabel = d3.select("#q2-total");
  const formatValue = d3.format(",");
  const colors = {
    "Car occupant": "#263d54",
    "Motorcyclist": "#0b3b8b",
    "Pedal cyclist": "#1689be",
    "Pedestrian": "#b39b81",
    "Other or unknown": "#d9f3f5",
    "Heavy transport occupant": "#687f87",
    "Pick-up truck or van occupant": "#789db0",
    "Bus occupant": "#d7bda0"
  };
  let chartData = [];
  let currentMetric = "count";

  function showError(message) {
    container.html("").append("p").attr("class", "chart-error").text(message);
  }

  function positionTooltip(event) {
    const node = tooltip.node();
    const bounds = node.getBoundingClientRect();
    const pointerX = event.pageX != null ? event.pageX : event.clientX + window.scrollX;
    const pointerY = event.pageY != null ? event.pageY : event.clientY + window.scrollY;
    let left = pointerX + 14;
    let top = pointerY - bounds.height - 12;

    if (left + bounds.width > window.scrollX + window.innerWidth - 8) {
      left = pointerX - bounds.width - 14;
    }
    if (top < window.scrollY + 8) {
      top = pointerY + 14;
    }
    tooltip.style("left", `${left}px`).style("top", `${top}px`);
  }

  function showTooltip(event, datum) {
    const percent = d3.format(".1%")(datum.count / d3.sum(chartData, d => d.count));
    const measure = currentMetric === "percentage"
      ? `${percent} of included hospitalisations`
      : `${formatValue(datum.count)} hospitalisations`;
    tooltip.html(`<strong>${datum.name}</strong><br>${measure}`).style("opacity", 1);
    positionTooltip(event);
  }

  function render() {
    const narrow = container.node().clientWidth < 620;
    const width = narrow ? 420 : 900;
    const height = narrow ? 700 : 500;
    const centerX = narrow ? 210 : 290;
    const centerY = narrow ? 190 : 250;
    const radius = narrow ? 165 : 190;
    const total = d3.sum(chartData, d => d.count);
    const svg = container.html("").append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "auto")
      .attr("role", "img")
      .attr("aria-label", `Pie chart of hospitalisations by road user type, displayed as ${currentMetric === "count" ? "total numbers" : "percentages"}`);

    totalLabel.text(`Dataset total: ${formatValue(total)}`);
    const pie = d3.pie()
      .sort(null)
      .value(d => d.count);
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius);
    const chart = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);
    const slices = chart.selectAll(".pie-slice")
      .data(pie(chartData))
      .join("path")
      .attr("class", "pie-slice")
      .attr("d", arc)
      .attr("fill", d => colors[d.data.name] || "#789db0")
      .attr("tabindex", 0)
      .attr("role", "img")
      .attr("aria-label", d => `${d.data.name}: ${formatValue(d.data.count)} hospitalisations, ${d3.format(".1%")(d.data.count / total)}`)
      .on("pointerenter pointermove", (event, datum) => showTooltip(event, datum.data))
      .on("pointerleave", () => tooltip.style("opacity", 0))
      .on("focus", function (event, datum) {
        const bounds = this.getBoundingClientRect();
        showTooltip({
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top,
          pageX: window.scrollX + bounds.left + bounds.width / 2,
          pageY: window.scrollY + bounds.top
        }, datum.data);
      })
      .on("blur", () => tooltip.style("opacity", 0));

    const legend = svg.append("g")
      .attr("transform", narrow ? `translate(24,${centerY + radius + 48})` : "translate(535,72)");
    const legendItems = legend.selectAll(".legend-item")
      .data(chartData)
      .join("g")
      .attr("class", "legend-item")
      .attr("transform", (d, index) => `translate(0,${index * (narrow ? 34 : 48)})`)
      .attr("tabindex", 0)
      .attr("role", "img")
      .attr("aria-label", d => `${d.name}, ${formatValue(d.count)} hospitalisations`)
      .on("pointerenter", (event, datum) => {
        slices.attr("opacity", d => d.data.name === datum.name ? 1 : 0.35);
        showTooltip(event, datum);
      })
      .on("pointermove", showTooltip)
      .on("pointerleave", () => {
        slices.attr("opacity", 1);
        tooltip.style("opacity", 0);
      })
      .on("focus", (event, datum) => {
        slices.attr("opacity", d => d.data.name === datum.name ? 1 : 0.35);
        const bounds = event.currentTarget.getBoundingClientRect();
        showTooltip({
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top,
          pageX: window.scrollX + bounds.left + bounds.width / 2,
          pageY: window.scrollY + bounds.top
        }, datum);
      })
      .on("blur", () => {
        slices.attr("opacity", 1);
        tooltip.style("opacity", 0);
      });

    legendItems.append("circle")
      .attr("cx", 8)
      .attr("cy", 0)
      .attr("r", 7)
      .attr("fill", d => colors[d.name] || "#789db0");
    legendItems.append("text")
      .attr("class", "legend-label")
      .attr("x", 24)
      .attr("y", 4)
      .text(d => d.name);
    legendItems.append("text")
      .attr("class", "legend-label")
      .attr("x", 24)
      .attr("y", 21)
      .attr("font-size", 11)
      .text(d => currentMetric === "percentage"
        ? d3.format(".1%")(d.count / total)
        : `${formatValue(d.count)} hospitalisations`);
  }

  d3.csv("Data/q2_clean.csv", row => ({
    name: row.prediction,
    count: Number(row["Sum(Hospitalisations)"])
  })).then(data => {
    if (data.length === 0 || data.some(d => !d.name || !Number.isFinite(d.count) || d.count < 0)) {
      showError("The road user data could not be read. Check the columns in Data/q2_clean.csv.");
      return;
    }

    chartData = data;
    d3.selectAll(".metric-btn").on("click", function () {
      currentMetric = this.dataset.metric;
      d3.selectAll(".metric-btn")
        .classed("active", false)
        .attr("aria-pressed", "false");
      d3.select(this)
        .classed("active", true)
        .attr("aria-pressed", "true");
      render();
    });
    window.addEventListener("resize", render);
    render();
  }).catch(error => {
    console.error("Unable to load Question 2 data:", error);
    showError("Unable to load road user data. Open this page through a local web server and check that Data/q2_clean.csv is available.");
  });
})();
