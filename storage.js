export async function updateIndex(tagId, entities, data, queryUrl, env) {
    // יצירת osintag אם לא קיים
    await env.DB.prepare(`
        INSERT OR IGNORE INTO osintags (id) VALUES (?)
    `).bind(tagId).run();

    // עדכון entities
    for (const entity of entities) {
        await env.DB.prepare(`
            INSERT OR IGNORE INTO entities (osintag_id, type, value) VALUES (?, ?, ?)
        `).bind(tagId, entity.type, entity.value).run();
    }

    // הוספת תוצאות לתוך טבלת results
    await env.DB.prepare(`
        INSERT INTO results (osintag_id, query, data) VALUES (?, ?, ?)
    `).bind(tagId, queryUrl, JSON.stringify(data)).run();
}

export async function getTagByEntity(entity, env) {
    const { results } = await env.DB.prepare(`
        SELECT osintag_id FROM entities WHERE type = ? AND value = ?
    `).bind(entity.type, entity.value).all();

    return results.length > 0 ? results[0].osintag_id : null;
}

export async function getEntitiesByTagId(tagId, env) {
    const { results } = await env.DB.prepare(`
        SELECT type, value FROM entities WHERE osintag_id = ?
    `).bind(tagId).all();

    return results;
}
