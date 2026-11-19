(() => {
  const container = d3.select("#q2-chart");
  const tooltip = d3.select("#chart-tooltip");
  const totalLabel = d3.select("#q2-total");
  const clearSelectionButton = d3.select("#q2-clear-selection");
  const selectionStatus = d3.select("#q2-selection-status");
  const defaultSelectionStatus = "Hover or focus a group to preview it, then click or tap to pin its details.";
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
  let selectedCategory = null;

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
    tooltip
      .html(`<strong>${datum.name}</strong><br>${formatValue(datum.count)} hospitalisations<br><span>${percent} of included total</span>`)
      .style("opacity", 1);
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
    let activeCategory = null;
    const svg = container.html("").append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "auto")
      .attr("role", "group")
      .attr("aria-label", `Interactive donut chart of hospitalisations by road user type, displayed as ${currentMetric === "count" ? "total numbers" : "percentages"}`);

    totalLabel.text(formatValue(total));
    const pie = d3.pie()
      .sort(null)
      .value(d => d.count);
    const arc = d3.arc()
      .innerRadius(72)
      .outerRadius(radius);
    const hoverArc = d3.arc()
      .innerRadius(72)
      .outerRadius(radius + 10);
    const chart = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);
    const slices = chart.selectAll(".pie-slice")
      .data(pie(chartData))
      .join("path")
      .attr("class", "pie-slice")
      .attr("d", arc)
      .attr("fill", d => colors[d.data.name] || "#789db0")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-pressed", d => selectedCategory === d.data.name ? "true" : "false")
      .attr("aria-label", d => `${d.data.name}: ${formatValue(d.data.count)} hospitalisations, ${d3.format(".1%")(d.data.count / total)}. Click to pin details.`)
      .on("pointerenter", (event, datum) => {
        activateCategory(datum.data.name);
        showTooltip(event, datum.data);
      })
      .on("pointermove", (event, datum) => showTooltip(event, datum.data))
      .on("pointerleave", () => {
        clearActiveCategory();
        tooltip.style("opacity", 0);
      })
      .on("click", (event, datum) => {
        event.stopPropagation();
        toggleCategory(datum.data.name);
      })
      .on("keydown", (event, datum) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleCategory(datum.data.name);
        }
      })
      .on("focus", function (event, datum) {
        activateCategory(datum.data.name);
        const bounds = this.getBoundingClientRect();
        showTooltip({
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top,
          pageX: window.scrollX + bounds.left + bounds.width / 2,
          pageY: window.scrollY + bounds.top
        }, datum.data);
      })
      .on("blur", () => {
        clearActiveCategory();
        tooltip.style("opacity", 0);
      });

    const center = chart.append("g")
      .attr("class", "donut-center");
    const centerTitle = center.append("text")
      .attr("class", "donut-title")
      .attr("y", -25);
    const centerValue = center.append("text")
      .attr("class", "donut-value")
      .attr("y", 4);
    const centerCaption = center.append("text")
      .attr("class", "donut-caption")
      .attr("y", 24);

    const legend = svg.append("g")
      .attr("transform", narrow ? `translate(24,${centerY + radius + 48})` : "translate(535,72)");
    const legendItems = legend.selectAll(".legend-item")
      .data(chartData)
      .join("g")
      .attr("class", "legend-item")
      .attr("transform", (d, index) => `translate(0,${index * (narrow ? 34 : 48)})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-pressed", d => selectedCategory === d.name ? "true" : "false")
      .attr("aria-label", d => `${d.name}, ${formatValue(d.count)} hospitalisations, ${d3.format(".1%")(d.count / total)}. Click to pin details.`)
      .on("pointerenter", (event, datum) => {
        activateCategory(datum.name);
        showTooltip(event, datum);
      })
      .on("pointermove", showTooltip)
      .on("pointerleave", () => {
        clearActiveCategory();
        tooltip.style("opacity", 0);
      })
      .on("click", (event, datum) => {
        event.stopPropagation();
        toggleCategory(datum.name);
      })
      .on("keydown", (event, datum) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleCategory(datum.name);
        }
      })
      .on("focus", (event, datum) => {
        activateCategory(datum.name);
        const bounds = event.currentTarget.getBoundingClientRect();
        showTooltip({
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top,
          pageX: window.scrollX + bounds.left + bounds.width / 2,
          pageY: window.scrollY + bounds.top
        }, datum);
      })
      .on("blur", () => {
        clearActiveCategory();
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

    updateSelectionStatus();
    if (selectedCategory) {
      activateCategory(selectedCategory);
    } else {
      updateDonutCenter(null);
    }

    function toggleCategory(name) {
      selectedCategory = selectedCategory === name ? null : name;
      if (selectedCategory) {
        activateCategory(selectedCategory);
      } else if (activeCategory) {
        activateCategory(activeCategory);
      } else {
        clearActiveCategory();
      }
      updateSelectionStatus();
    }

    function updateSelectionStatus(previewName) {
      clearSelectionButton.property("hidden", !selectedCategory);
      selectionStatus.text(selectedCategory
        ? previewName && previewName !== selectedCategory
          ? `${selectedCategory} pinned; previewing ${previewName}.`
          : `${selectedCategory} pinned. Click or tap it again, or use Clear highlight.`
        : defaultSelectionStatus);
    }

    function activateCategory(name) {
      activeCategory = name;
      slices
        .interrupt()
        .transition()
        .duration(160)
        .attr("opacity", d => d.data.name === name ? 1 : 0.35)
        .attr("d", d => d.data.name === name ? hoverArc(d) : arc(d));
      slices.attr("aria-pressed", d => selectedCategory === d.data.name ? "true" : "false");
      legendItems
        .classed("is-active", d => d.name === name)
        .classed("is-muted", d => d.name !== name)
        .attr("aria-pressed", d => selectedCategory === d.name ? "true" : "false");
      updateDonutCenter(chartData.find(d => d.name === name));
      updateSelectionStatus(name);
    }

    function clearActiveCategory() {
      if (selectedCategory) {
        activateCategory(selectedCategory);
        return;
      }
      activeCategory = null;
      slices
        .interrupt()
        .transition()
        .duration(160)
        .attr("opacity", 1)
        .attr("d", arc);
      slices.attr("aria-pressed", "false");
      legendItems
        .classed("is-active", false)
        .classed("is-muted", false)
        .attr("aria-pressed", "false");
      updateDonutCenter(null);
      updateSelectionStatus();
    }

    function updateDonutCenter(datum) {
      centerTitle
        .attr("font-size", datum && datum.name.length > 18 ? 10 : 12)
        .text(datum ? datum.name : "All road users");
      centerValue.text(formatValue(datum ? datum.count : total));
      centerCaption.text(datum
        ? `${d3.format(".1%")(datum.count / total)} of total`
        : "hospitalisations");
    }
  }

  d3.csv("data/q2_clean.csv", row => ({
    name: row.prediction,
    count: Number(row["Sum(Hospitalisations)"])
  })).then(data => {
    if (data.length === 0 || data.some(d => !d.name || !Number.isFinite(d.count) || d.count < 0)) {
      showError("The road user data could not be read. Check the columns in data/q2_clean.csv.");
      return;
    }

    chartData = data;
    const total = d3.sum(chartData, d => d.count);
    const largest = chartData.reduce((highest, current) =>
      current.count > highest.count ? current : highest
    );
    const topThreeCount = chartData
      .slice()
      .sort((a, b) => d3.descending(a.count, b.count))
      .slice(0, 3)
      .reduce((sum, d) => sum + d.count, 0);
    totalLabel.text(formatValue(total));
    d3.select("#q2-largest").text(largest.name);
    d3.select("#q2-largest-detail").text(
      `${formatValue(largest.count)} · ${d3.format(".1%")(largest.count / total)}`
    );
    d3.select("#q2-top-three").text(d3.format(".1%")(topThreeCount / total));

    d3.selectAll(".metric-btn[data-metric]").on("click", function () {
      currentMetric = this.dataset.metric;
      d3.selectAll(".metric-btn[data-metric]")
        .classed("active", false)
        .attr("aria-pressed", "false");
      d3.select(this)
        .classed("active", true)
        .attr("aria-pressed", "true");
      render();
    });
    clearSelectionButton.on("click", () => {
      selectedCategory = null;
      render();
    });
    window.addEventListener("resize", render);
    render();
  }).catch(error => {
    console.error("Unable to load Question 2 data:", error);
    showError("Unable to load road user data. Open this page through a local web server and check that data/q2_clean.csv is available.");
  });
})();
