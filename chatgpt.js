import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function queryChatGPT(entitiesA, entitiesB, env) {
    const content = JSON.stringify({ entitiesA, entitiesB });

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "אתה מומחה OSINT. בדוק האם מדובר באותה ישות או בשתי ישויות שונות. ענה בפורמט JSON בלבד."
            },
            {
                role: "user",
                content: content
            }
        ],
        response_format: {
            type: "json_object",
            schema: {
                type: "object",
                properties: {
                    decision: { type: "string", enum: ["same", "different"] },
                    confidence: { type: "number", description: "ביטחון בהחלטה בין 0 ל-1" },
                    reason: { type: "string", description: "הסבר להחלטה" }
                },
                required: ["decision", "confidence", "reason"]
            }
        }
    });

    return JSON.parse(completion.choices[0].message.content);
}
