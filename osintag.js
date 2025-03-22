import { findExistingTag, createNewTag, updateIndex } from './storage';

function extractEntities(queryUrl, data) {
    let entities = [];

    const url = new URL(`https://${queryUrl}`);
    for (const [key, value] of url.searchParams) {
        entities.push({ type: key, value });
    }

    if (data.emails) data.emails.forEach(email => entities.push({ type: 'email', value: email }));
    if (data.ips) data.ips.forEach(ip => entities.push({ type: 'ip', value: ip }));
    if (data.passwords) data.passwords.forEach(pwd => entities.push({ type: 'password', value: pwd }));
    if (data.usernames) data.usernames.forEach(user => entities.push({ type: 'username', value: user }));

    return entities;
}

export async function handleOsintag(queryUrl, data, env) {
    const entities = extractEntities(queryUrl, data);

    let existingTagId = null;
    for (const entity of entities) {
        existingTagId = await findExistingTag(entity, env);
        if (existingTagId) break;
    }

    if (!existingTagId) {
        existingTagId = createNewTag();
    }

    await updateIndex(existingTagId, entities, data, queryUrl, env);
}
