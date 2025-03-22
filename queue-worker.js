// queue-worker.js
export default {
    async queue(batch, env) {
        for (const message of batch.messages) {
            const { entities } = message.body;

            for (const entity of entities) {
                await new Promise(r => setTimeout(r, 5000)); // השהייה 5 שניות בין בקשות

                const leakUrl = `https://leakcheck.io/api/v2/query/${encodeURIComponent(entity.value)}`;

                try {
                    const leakResponse = await fetch(leakUrl, {
                        headers: { 'X-API-Key': env.LEAKCHECK_API_KEY, 'Accept': 'application/json' }
                    });

                    if (leakResponse.ok) {
                        const leakData = await leakResponse.json();
                        const newEntities = extractEntities(leakUrl, leakData);
                        await updateIndex("OSINTAG_"+Date.now(), newEntities, leakData, leakUrl, env);
                    }
                } catch (err) {
                    console.error("Error checking entity", entity.value, err);
                }
            }
        }
    }
};
