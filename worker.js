import { handleOsintag } from './osintag';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetUrl = url.pathname.substring(1) + url.search;

    const response = await fetch(`https://${targetUrl}`, request);

    // כאן התיקון - שימוש נכון ב-clone
    const clonedResponse = response.clone();
    let data;
    try {
      data = await clonedResponse.json();
    } catch {
      data = { text: await clonedResponse.text() };
    }

    handleOsintag(targetUrl, data, env); // מתבצע ברקע, לא מעכב את התגובה

    return response; // התגובה המקורית חוזרת נקייה
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      await performLeakCheck(message.body.entities, message.body.existingTagId, env);
    }
  }
};

async function performLeakCheck(entities, tagId, env) {
  for (const entity of entities) {
    await new Promise(r => setTimeout(r, 5000)); // המתנה בין בקשות

    const leakUrl = `https://leakcheck.io/api/v2/query/${encodeURIComponent(entity.value)}`;
    const response = await fetch(leakUrl, { headers: { 'X-API-Key': env.LEAKCHECK_API_KEY } });

    if (response.ok) {
      const leakData = await response.json();
      await handleOsintag(leakUrl, leakData, env);
    }
  }
}
