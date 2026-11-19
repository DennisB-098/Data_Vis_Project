document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    let currentSlideIndex = 0;
    let isTransitioning = false;

    function goToNextSlide() {
        if (isTransitioning || currentSlideIndex + 1 >= slides.length) {
            return;
        }

        const currentSlide = slides[currentSlideIndex];
        const nextSlide = slides[currentSlideIndex + 1];
        currentSlideIndex += 1;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            currentSlide.classList.remove('active');
            nextSlide.classList.add('active');
            return;
        }

        isTransitioning = true;
        nextSlide.classList.add('active', 'slide-enter-from-right');
        currentSlide.classList.add('slide-exit-to-left');

        function finishTransition() {
            if (!isTransitioning) {
                return;
            }

            currentSlide.classList.remove('active', 'slide-exit-to-left');
            nextSlide.classList.remove('slide-enter-from-right');
            isTransitioning = false;
        }

        nextSlide.addEventListener('animationend', event => {
            if (event.target === nextSlide) {
                finishTransition();
            }
        }, { once: true });

        window.setTimeout(finishTransition, 550);
    }

    const startBtn = document.getElementById('btn-start');

    if (startBtn) {
        startBtn.addEventListener('click', goToNextSlide);
    }
});