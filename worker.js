export default {
    async fetch(request) {
        const url = new URL(request.url);
        const targetUrl = url.pathname.slice(1); // מוציא את הנתיב

        if (!targetUrl) {
            return new Response("Missing target URL", { status: 400 });
        }

        const query = url.search;
        const fullUrl = `https://${targetUrl}${query}`;

        const response = await fetch(fullUrl, request);

        // מוחק את ה-API Key לפני אחסון (לא נשמר אצלך)
        const safeUrl = fullUrl.replace(/key=[^&]+/gi, 'key=REDACTED');

        // דוגמה פשוטה לשמירת מידע ברקע (לא חובה)
        // saveToDB(safeUrl, await response.clone().json());

        return response;
    }
};
