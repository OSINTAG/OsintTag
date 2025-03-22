import { handleOsintag } from './osintag';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const targetUrl = url.pathname.slice(1) + url.search;

        if (!targetUrl) {
            return new Response("Missing target URL", { status: 400 });
        }

        const response = await fetch(`https://${targetUrl}`, request);
        const data = await response.clone().json();

        await handleOsintag(targetUrl, data, env);

        return response;
    }
};
