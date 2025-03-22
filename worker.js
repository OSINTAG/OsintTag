import { handleOsintag } from './osintag';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname.slice(1);

        // בודק שהנתיב כולל דומיין חוקי (לפחות נקודה אחת)
        if (!path.includes('.')) {
            return new Response("Invalid request: no valid domain found", { status: 400 });
        }

        const targetUrl = `https://${path}${url.search}`;

        try {
            const response = await fetch(targetUrl, request);

            // קורא את התשובה כטקסט (בלי להגביל ל-JSON)
            const responseClone = response.clone();
            const content = await responseClone.text();

            // שולח לאוסינטאג בלי קשר לסוג התשובה (text/json/csv וכו')
            await handleOsintag(targetUrl, content, env);

            // מחזיר את התשובה המקורית למשתמש כמו שהיא
            return response;
        } catch (e) {
            return new Response("Error fetching upstream resource", { status: 500 });
        }
    }
};
