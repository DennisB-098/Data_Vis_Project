d3.csv("data/question4data.csv", d => {
    return {
        ageGroup: d["Age group"],
        year: +d["Calendar year"],
    }
})