(function () {
    'use strict';

    const script = document.currentScript;
    const websiteId = script.getAttribute('data-website-id');
    const hostUrl = script.getAttribute('data-host-url') || script.src.replace(/\/script\.js$/, '');

    if (!websiteId) {
        console.error('Umami: Website ID is required');
        return;
    }

    const screen = `${window.screen.width}x${window.screen.height}`;
    const language = window.navigator.language;
    let cache = false;

    function getPayload() {
        return {
            website: websiteId,
            hostname: window.location.hostname,
            url: window.location.pathname + window.location.search,
            referrer: document.referrer,
            screen: screen,
            language: language,
            cache: cache,
        };
    }

    async function collect(type: string, payload: any) {
        const data = {
            ...payload,
            name: type === 'event' ? payload.name : undefined,
        };

        try {
            const response = await fetch(`${hostUrl}/api/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                cache = true;
            }
        } catch (error) {
            console.error('Umami:', error);
        }
    }

    function pageview() {
        collect('pageview', getPayload());
    }

    function event(name: string, data?: Record<string, any>) {
        collect('event', {
            ...getPayload(),
            name,
            data,
        });
    }

    const handlePush = (state: string, title: string, url: string) => {
        if (!url) return;

        history[state] = function (...args: any[]) {
            const result = History.prototype[state].apply(history, args);
            pageview();
            return result;
        };
    };

    handlePush('pushState', '', '');
    handlePush('replaceState', '', '');

    window.addEventListener('popstate', pageview);

    const umami = {
        pageview,
        event,
    };

    (window as any).umami = umami;

    if (!cache) {
        pageview();
    }
})();
