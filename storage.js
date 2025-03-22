export function generateTagId(url) {
    // דוגמה פשוטה ליצירת תג לפי URL
    return 'osintag_' + btoa(url).replace(/=/g, '');
}

export async function saveTag(tagId, data, env) {
    await env.OSINTAG_KV.put(tagId, JSON.stringify(data));
}

export async function getTag(tagId, env) {
    const data = await env.OSINTAG_KV.get(tagId);
    return data ? JSON.parse(data) : null;
}
