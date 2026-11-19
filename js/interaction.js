function setupTooltips(selection) {
    selection
        .on("mouseenter", (event, d) => {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`<b>Age:</b> ${d.ageGroup}<br /><b>Year:</b> ${d.year}<br /><b>Avg Stay:</b> ${d.stay.toFixed(2)} days`);
        })
        .on("mouseleave", () => {
            d3.select("#tooltip").style("opacity", 0);
        });
}