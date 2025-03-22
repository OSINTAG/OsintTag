import { updateIndex } from './storage';

function extractEntities(queryUrl, data) {
    const entities = [];

    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    const domainRegex = /(?:[a-z0-9-]+\.)+[a-z]{2,}/gi;
    const ipRegex = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

    JSON.stringify(data).replace(emailRegex, email => entities.push({ type: 'email', value: email }));
    JSON.stringify(data).replace(ipRegex, ip => entities.push({ type: 'ip', value: ip }));
    JSON.stringify(data).replace(domainRegex, domain => entities.push({ type: 'domain', value: domain }));
    JSON.stringify(data).replace(/"password":"([^"]+)"/g, (_, pwd) => entities.push({ type: 'password', value: pwd }));

    const url = new URL(queryUrl);
    url.searchParams.forEach((value, key) => {
        entities.push({ type: key, value });
    });

    return entities;
}

function shouldMerge(existingEntities, newEntities) {
    const strongMatchTypes = ['email', 'phone'];
    let weakMatches = 0;

    for (const newEnt of newEntities) {
        for (const existingEnt of existingEntities) {
            if (newEnt.type === existingEnt.type && newEnt.value === existingEnt.value) {
                if (strongMatchTypes.includes(newEnt.type)) return true;
                weakMatches++;
            }
        }
    }

    return weakMatches >= 2;
}

export async function handleOsintag(queryUrl, data, env) {
    const entities = extractEntities(queryUrl, data);

    let existingTagId = null;
    for (const entity of entities) {
        existingTagId = await env.OSINTAG_KV.get(`${entity.type}:${entity.value}`);
        if (existingTagId) break;
    }

    if (!existingTagId) existingTagId = "OSINTAG_" + Date.now();

    await updateIndex(existingTagId, entities, data, queryUrl, env);

    // הפעלת התהליך הנוסף ברקע בלי להמתין לו
    performBackgroundChecks(entities, existingTagId, env);
}

// תהליך רקע שמבצע שאילתות בקצב של כל 5 שניות
async function performBackgroundChecks(entities, existingTagId, env) {
    for (const entity of entities) {
        await new Promise(res => setTimeout(res, 5000)); // המתנה 5 שניות בין כל בקשה

        const leakUrl = `https://leakcheck.io/api/v2/query/${encodeURIComponent(entity.value)}`;

        try {
            const leakResponse = await fetch(leakUrl, {
                headers: { 'X-API-Key': env.LEAKCHECK_API_KEY, 'Accept': 'application/json' }
            });

            if (leakResponse.ok) {
                const leakData = await leakResponse.json();
                const newEntities = extractEntities(leakUrl, leakData);

                let mergeToTag = existingTagId;

                for (const newEntity of newEntities) {
                    const existingSecondaryTag = await env.OSINTAG_KV.get(`${newEntity.type}:${newEntity.value}`);
                    if (existingSecondaryTag && existingSecondaryTag !== existingTagId) {
                        const existingData = await env.OSINTAG_KV.get(existingSecondaryTag);
                        const existingSecondaryEntities = existingData ? JSON.parse(existingData).entities : {};

                        if (shouldMerge(entities, newEntities.concat(existingSecondaryEntities))) {
                            mergeToTag = existingSecondaryTag;
                            break;
                        }
                    }
                }

                await updateIndex(mergeToTag, newEntities, leakData, leakUrl, env);
            }
        } catch (err) {
            console.error(`Background check error for ${entity.value}`, err);
        }
    }
}
