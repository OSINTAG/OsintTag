// worker.js
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname.slice(1);

        if (!path.includes('.')) {
            return new Response("Invalid request: no valid domain found", { status: 400 });
        }

        const targetUrl = `https://${path}${url.search}`;

        try {
            const response = await fetch(targetUrl, request);
            const clonedResponse = response.clone();
            const content = await clonedResponse.text();

            const entities = extractEntities(targetUrl, content);

            // שולח משימות לתור
            await env.OSINT_QUEUE.send({ entities });

            return response;
        } catch (e) {
            return new Response("Error fetching upstream resource", { status: 500 });
        }
    }
};
