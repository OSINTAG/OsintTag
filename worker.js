import { handleOsintag } from './osintag';

const BLOCKLIST = ['favicon.ico', 'wp-admin', 'wordpress', 'xmlrpc.php', 'robots.txt', 'setup-config.php'];

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname.slice(1);

        if (!path.includes('.')) {
            return new Response("Invalid request: no valid domain found", { status: 400 });
        }

        for (const blocked of BLOCKLIST) {
            if (path.includes(blocked)) {
                return new Response("Blocked path", { status: 403 });
            }
        }

        const targetUrl = `https://${path}${url.search}`;

        try {
            const response = await fetch(targetUrl, request);
            const clonedResponse = response.clone();
            const content = await clonedResponse.text();

            await handleOsintag(targetUrl, content, env);

            return response;
        } catch (e) {
            return new Response("Error fetching upstream resource", { status: 500 });
        }
    }
};
