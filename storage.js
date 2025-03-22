export async function updateIndex(tagId, entities, data, queryUrl, env) {
    for (const entity of entities) {
        await env.OSINTAG_KV.put(`${entity.type}:${entity.value}`, tagId);
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

    await env.OSINTAG_KV.put(tagId, JSON.stringify(osintagEntry));
}
