
require('dotenv').config({ path: '.env.local' });

async function checkGeminiStatus() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY not found in .env.local");
        return;
    }

    console.log("Checking Gemini API Status...");
    console.log("Key starts with:", apiKey.substring(0, 5) + "...");

    const prompt = "Reply with 'OK' if you can hear me.";
    const GEMINI_MODEL = 'gemini-flash-latest';

    try {
        const start = Date.now();
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const duration = Date.now() - start;

        if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`✅ API is Responsive (${duration}ms)`);
            console.log(`Response: ${text?.trim()}`);
        } else {
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            if (response.status === 429) {
                console.error("⚠️ RATE LIMIT EXCEEDED. The API is currently busy.");
            }
        }

    } catch (error) {
        console.error("❌ Network/Script Error:", error.message);
    }
}

checkGeminiStatus();
