import { v4 as uuidv4 } from 'uuid';

async function generateSignedOsintag(secretKey) {
  const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
  const uuid = uuidv4();
  const tag = `OTAG-${date}-${uuid}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(tag));
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  return { tag, signature: signatureHex };
}

export async function handleOsintag(queryUrl, data, env) {
  const entities = extractEntities(queryUrl, data);
  let existingTagId = await findExistingTag(entities, env);
  let signature;

  if (!existingTagId) {
    const result = await generateSignedOsintag(env.OSINTAG_SECRET);
    existingTagId = result.tag;
    signature = result.signature;

    await env.DB.prepare(`
      INSERT INTO osintags (id, signature, created_at)
      VALUES (?, ?, ?)
    `).bind(existingTagId, signature, new Date().toISOString()).run();
  }

  await saveResults(existingTagId, entities, data, queryUrl, env);
  await env.OSINT_QUEUE.send({ entities, existingTagId });
}

async function findExistingTag(entities, env) {
  for (const entity of entities) {
    const result = await env.DB.prepare(`
      SELECT osintag_id FROM entities WHERE value = ? LIMIT 1
    `).bind(entity.value).first();
    if (result) return result.osintag_id;
  }
  return null;
}

async function saveResults(tagId, entities, data, queryUrl, env) {
  for (const entity of entities) {
    await env.DB.prepare(`
      INSERT INTO entities (osintag_id, type, value) VALUES (?, ?, ?)
    `).bind(tagId, entity.type, entity.value).run();
  }

  await env.DB.prepare(`
    INSERT INTO results (osintag_id, query, data, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(tagId, queryUrl, JSON.stringify(data), new Date().toISOString()).run();
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
