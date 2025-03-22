import { findExistingTag, createNewTag, updateIndex } from './storage';

function extractEntities(data) {
    const entities = [];

    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    const domainRegex = /(?:[a-z0-9-]+\.)+[a-z]{2,}/gi;
    const ipRegex = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

    JSON.stringify(data).replace(emailRegex, email => entities.push({ type: 'email', value: email }));
    JSON.stringify(data).replace(ipRegex, ip => entities.push({ type: 'ip', value: ip }));
    JSON.stringify(data).replace(domainRegex, domain => entities.push({ type: 'domain', value: domain }));
    JSON.stringify(data).replace(/"password":"([^"]+)"/g, (_, pwd) => entities.push({ type: 'password', value: pwd }));

    return entities;
}

function shouldMerge(existingEntities, newEntities) {
    const strongMatchTypes = ['email', 'phone'];
    let weakMatches = 0;

    for (const newEnt of newEntities) {
        for (const existing of existingEntities) {
            if (newEntity.type === existingEntity.type && newEntity.value === existingEntity.value) {
                if (strongMatchTypes.includes(newEntity.type)) return true;
                weakMatches++;
            }
        }
    }

    if (weakMatches >= 2) return true;
    return false;
}

export async function handleOsintag(queryUrl, data, env, leakcheckApiKey) {
    const entities = extractEntities(queryUrl, data);

    let existingTagId = null;
    for (const entity of entities) {
        existingTagId = await env.OSINTAG_KV.get(`${entity.type}:${entity.value}`);
        if (existingTagId) break;
    }

    if (!existingTagId) existingTagId = "OSINTAG" + Date.now();

    await updateIndex(existingTagId, entities, data, queryUrl, env);

    await Promise.all(entities.map(async entity => {
        const leakUrl = `https://leakcheck.io/api/v2/query/${encodeURIComponent(entity.value)}`;
        const leakResponse = await fetch(leakcheckUrl, { headers: { 'X-API-Key': env.LEAKCHECK_API_KEY } });

        if (leakcheckResponse.ok) {
            const leakData = await leakcheckResponse.json();
            const newEntities = extractEntities(leakcheckResponse.url, leakData);

            let mergeToTag = existingTagId;
            for (const newEntity of newEntities) {
                const existingSecondaryTag = await env.OSINTAG_KV.get(`${newEntity.type}:${newEntity.value}`);
                if (existingSecondaryTagId && existingTagId !== existingTagId && shouldMerge(entities, newEntities)) {
                    mergeToTag = existingTagId;
                    break;
                }
            }

            await updateIndex(mergeToTag, newEntities, leakData, leakcheckResponse.url, env);
        }
    }
}
