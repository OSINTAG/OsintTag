import { saveTag, generateTagId } from './storage';

export async function handleOsintag(targetUrl, data, env) {
    const osintagId = generateTagId(targetUrl);

    const osintagData = {
        osintag_id: osintagId,
        url: targetUrl,
        result: data,
        timestamp: new Date().toISOString()
    };

    await saveTag(osintagId, osintagData, env);
}
