import { updateIndex, getTagByEntity, getEntitiesByTagId } from './storage';
import { queryChatGPT } from './chatgpt';

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

async function shouldMerge(entitiesA, entitiesB, env) {
    const commonEmails = entitiesA.some(a => a.type === 'email' && entitiesB.some(b => b.type === 'email' && b.value === a.value));
    if (commonEmails) return true;

    const aiDecision = await queryChatGPT(entitiesA, entitiesB, env);
    return aiDecision.decision === 'same' && aiDecision.confidence > 0.7;
}

export async function handleOsintag(queryUrl, data, env) {
    const entities = extractEntities(queryUrl, data);
    let existingTagId = null;

    for (const entity of entities) {
        existingTagId = await getTagByEntity(entity, env);
        if (existingTagId) break;
    }

    if (!existingTagId) existingTagId = "OSINTAG_" + Date.now();

    await updateIndex(existingTagId, entities, data, queryUrl, env);
    await env.OSINT_QUEUE.send({ entities, existingTagId });
}

export async function handleQueue(entities, existingTagId, env) {
    for (const entity of entities) {
        await new Promise(res => setTimeout(res, 5000));

        const leakUrl = `https://leakcheck.io/api/v2/query/${encodeURIComponent(entity.value)}`;
        const response = await fetch(leakUrl, {
            headers: { 'X-API-Key': env.LEAKCHECK_API_KEY, 'Accept': 'application/json' }
        });

        if (response.ok) {
            const leakData = await response.json();
            const newEntities = extractEntities(leakUrl, leakData);

            let mergeToTag = existingTagId;

            for (const newEntity of newEntities) {
                const secondaryTag = await getTagByEntity(newEntity, env);
                if (secondaryTag && secondaryTag !== existingTagId) {
                    const secondaryEntities = await getEntitiesByTagId(secondaryTag, env);

                    if (await shouldMerge(entities, secondaryEntities, env)) {
                        mergeToTag = secondaryTag;
                        break;
                    }
                }
            }

            await updateIndex(mergeToTag, newEntities, leakData, leakUrl, env);
        }
    }
}
