// Set up dimensions and margins
const margin = { top: 60, right: 30, bottom: 50, left: 50 };
const width = 600; // Adjusted to match your squarish chart
const height = 500; // Adjusted to match your squarish chart
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

/* Make the colours accessible globally */
/*******************************************/
const barColor = "#F5E9DC";
const bodyBackgroundColor = "#BCCCDC";
const tooltipColor = "#9E8C77";

// Set up the scales
// Note: If your X-axis is Categories (A, B, C), use scaleBand. 
// If it's strictly following the tutorial's scaleLinear for mapping, keep scaleLinear.
const xScale = d3.scaleBand().padding(0.2); // RECOMMENDED for your bar chart
const yScale = d3.scaleLinear();