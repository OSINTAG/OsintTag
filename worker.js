import { handleOsintag, performLeakCheck } from './osintag';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetUrl = url.pathname.substring(1) + url.search;

    const response = await fetch(`https://${targetUrl}`, request);

    const clonedResponse = response.clone();
    let data;
    try {
      data = await clonedResponse.json();
    } catch {
      data = { text: await clonedResponse.text() };
    }

    handleOsintag(targetUrl, data, env); // תהליך רקע, ללא המתנה

    return response;
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      await performLeakCheck(message.body.entities, message.body.existingTagId, env);
    }
  }
};
