// worker.js
import { handleOsintag, handleQueue } from './osintag';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname.slice(1);

        if (!path.includes('.')) {
            return new Response("Invalid request", { status: 400 });
        }

        const targetUrl = `https://${path}${url.search}`;

        try {
            const response = await fetch(targetUrl, request);
            const content = await response.clone().text();
            const entities = extractEntities(targetUrl, content);

            await env.OSINT_QUEUE.send({ entities });

            return response;
        } catch (e) {
            return new Response("Error fetching upstream resource", { status: 500 });
        }
    },

    // consumer queue
    async queue(batch, env) {
        for (const message of batch.messages) {
            await handleQueue(message.body.entities, env);
        }
    }
};
