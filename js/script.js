// Wait for the HTML document to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Get all elements with the class "slide"
    const slides = document.querySelectorAll('.slide');
    let currentSlideIndex = 0;

    // Function to hide the current slide and show the next one
    function goToNextSlide() {
        // 1. Hide current slide
        slides[currentSlideIndex].classList.remove('active');

        // 2. Increase index
        currentSlideIndex++;

        // 3. If we reach the end, go back to the first slide
        if (currentSlideIndex >= slides.length) {
            currentSlideIndex = 0;
        }

        // 4. Show the new slide
        slides[currentSlideIndex].classList.add('active');
    }

    // Connect the buttons to the function
    const startBtn = document.getElementById('btn-start');
    const exploreBtn = document.getElementById('btn-explore');

    // Add click events to the buttons
    if (startBtn) {
        startBtn.addEventListener('click', goToNextSlide);
    }

    if (exploreBtn) {
        // Since there is no 3rd slide yet, this will loop back to the first slide
        exploreBtn.addEventListener('click', goToNextSlide);
    }
});