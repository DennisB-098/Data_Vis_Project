(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const savedDirection = sessionStorage.getItem('page-transition-direction');

    if (savedDirection) {
        sessionStorage.removeItem('page-transition-direction');
        if (!reducedMotion) {
            const enterClass = savedDirection === 'previous'
                ? 'page-enter-from-left'
                : 'page-enter-from-right';
            const clearEnterState = () => root.classList.remove(enterClass);

            root.classList.add(enterClass);
            document.body.addEventListener('animationend', event => {
                if (event.target === document.body) {
                    clearEnterState();
                }
            }, { once: true });
            window.setTimeout(clearEnterState, 500);
        }
    }

    let isNavigating = false;

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : event.target.parentElement;
        const link = target && target.closest('a[href]');

        if (
            !link ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            link.hasAttribute('download') ||
            (link.target && link.target !== '_self')
        ) {
            return;
        }

        const destination = new URL(link.href, window.location.href);
        if (
            destination.origin !== window.location.origin ||
            !/\.html?$/i.test(destination.pathname) ||
            destination.href === window.location.href
        ) {
            return;
        }

        event.preventDefault();
        if (isNavigating) {
            return;
        }
        isNavigating = true;

        const isPrevious = link.classList.contains('previous') ||
            /(?:^|\/)index\.html$/i.test(destination.pathname);

        if (reducedMotion) {
            window.location.assign(destination.href);
            return;
        }

        sessionStorage.setItem('page-transition-direction', isPrevious ? 'previous' : 'next');
        root.classList.add(isPrevious ? 'page-exit-to-right' : 'page-exit-to-left');
        window.setTimeout(() => window.location.assign(destination.href), 380);
    });
})();
