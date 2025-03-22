import { handleOsintag, extractEntities } from './osintag';

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
            const clonedResponse = response.clone();
            const content = await clonedResponse.text();

            const entities = extractEntities(targetUrl, content);
            await env.OSINT_QUEUE.send({ entities });

            return response;
        } catch {
            return new Response("Error fetching resource", { status: 500 });
        }
    },

    async queue(batch, env) {
        const { handleQueue } = await import('./osintag');
        for (const message of batch.messages) {
            await handleQueue(message.body.entities, message.body.existingTagId, env);
        }
    }
};
