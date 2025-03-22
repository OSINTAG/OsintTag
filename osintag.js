import { v4 as uuidv4 } from 'uuid';

export async function handleOsintag(queryUrl, data, env) {
  const entities = extractEntities(queryUrl, data);
  let tagId = await findExistingTag(entities, env);

  if (!tagId) {
    tagId = await createOsintag(env);
  }

  await saveEntities(tagId, entities, env);
  await saveResults(tagId, queryUrl, data, env);
  await env.OSINT_QUEUE.send({ entities, existingTagId: tagId });
}

async function createOsintag(env) {
  const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
  const uuid = uuidv4();
  const tagId = `OTAG-${date}-${uuid}`;

  const signature = await generateSignature(tagId, env.OSINTAG_SECRET);

  await env.DB.prepare(`
    INSERT INTO osintags (id, signature) VALUES (?, ?)
  `).bind(tagId, signature).run();

  return tagId;
}

async function generateSignature(tag, secretKey) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(tag));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function findExistingTag(entities, env) {
  for (const entity of entities) {
    const result = await env.DB.prepare(`
      SELECT osintag_id FROM entities WHERE type = ? AND value = ? LIMIT 1
    `).bind(entity.type, entity.value).first();

    if (result) return result.osintag_id;
  }
  return null;
}

async function saveEntities(tagId, entities, env) {
  const stmt = env.DB.prepare(`
    INSERT OR IGNORE INTO entities (osintag_id, type, value) VALUES (?, ?, ?)
  `);

  for (const entity of entities) {
    await stmt.bind(tagId, entity.type, entity.value).run();
  }
}

async function saveResults(tagId, queryUrl, data, env) {
  await env.DB.prepare(`
    INSERT INTO results (osintag_id, query, data) VALUES (?, ?, ?)
  `).bind(tagId, queryUrl, JSON.stringify(data)).run();
}

export async function performLeakCheck(entities, tagId, env) {
  for (const entity of entities) {
    await new Promise(r => setTimeout(r, 5000));

    const leakUrl = `https://leakcheck.io/api/v2/query/${encodeURIComponent(entity.value)}`;
    const response = await fetch(leakUrl, {
      headers: { 'X-API-Key': env.LEAKCHECK_API_KEY }
    });

    if (response.ok) {
      const leakData = await response.json();
      await handleOsintag(leakUrl, leakData, env);
    }
  }
}

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

