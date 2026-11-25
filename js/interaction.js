/**
 * Positions a D3 tooltip near a pointer or synthetic focus event.
 * Contract: tooltip must be a D3 selection with a rendered .tooltip
 * node. pageX/pageY are preferred; clientX/clientY plus scroll offsets
 * are used as a fallback.
 */
window.positionChartTooltip = (event, tooltip) => {
    const node = tooltip.node();
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    let left = Number.isFinite(event.pageX)
        ? event.pageX + 14
        : (Number.isFinite(event.clientX) ? event.clientX + window.scrollX + 14 : 14);
    let top = Number.isFinite(event.pageY)
        ? event.pageY - 64
        : (Number.isFinite(event.clientY) ? event.clientY + window.scrollY - 64 : 64);

    const pageLeft = left - window.scrollX;
    const pageTop = top - window.scrollY;
    if (pageLeft + rect.width > viewportWidth - 8) {
        left = left - rect.width - 28;
    }
    if (pageTop < 8) {
        const pointerY = Number.isFinite(event.pageY)
            ? event.pageY
            : (Number.isFinite(event.clientY) ? event.clientY + window.scrollY : window.scrollY + 8);
        top = pointerY + 14;
    }

    tooltip.style("left", `${left}px`).style("top", `${top}px`);
};