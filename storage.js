export async function updateIndex(tagId, entities, data, queryUrl, env) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    async function safePut(key, value) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await env.OSINTAG_KV.put(key, value);
                return;
            } catch (error) {
                if (error.message.includes('429')) {
                    console.warn(`KV rate limit reached for key: ${key}, retrying (${attempt}/${MAX_RETRIES})`);
                    await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
                } else {
                    console.error(`Unexpected KV error for key ${key}:`, error);
                    return;
                }
            }
        }
        console.error(`Failed to write key ${key} after ${MAX_RETRIES} retries.`);
    }

    for (const entity of entities) {
        await safePut(`${entity.type}:${entity.value}`, tagId);
    }

    const existingData = await env.OSINTAG_KV.get(tagId);
    let osintagEntry = existingData ? JSON.parse(existingData) : { osintag_id: tagId, entities: {}, results: [] };

    entities.forEach(({ type, value }) => {
        osintagEntry.entities[type] = osintagEntry.entities[type] || [];
        if (!osintagEntry.entities[type].includes(value)) {
            osintagEntry.entities[type].push(value);
        }
    });

    osintagEntry.results.push({
        query: queryUrl,
        date: new Date().toISOString(),
        data
    });

    await safePut(tagId, JSON.stringify(osintagEntry));
}
