// api/trending.js
// Fetches live UPSC editorials to suggest conversation starters

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let db;
let cacheRef;

// Initialize simple cache to avoid hitting Google Search API limits
try {
    if (process.env.FIREBASE_ADMIN_SDK_JSON) {
        if (!getApps().length) {
            initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON)) });
        }
        db = getDatabase();
        cacheRef = db.ref('drona_trending_cache');
    }
} catch (e) { console.error(e); }

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 1. Check Cache (6-hour validity)
    if (db && cacheRef) {
        const snapshot = await cacheRef.once('value');
        const data = snapshot.val();
        if (data && (Date.now() - data.timestamp < 21600000)) {
            return res.status(200).json({ topics: data.topics });
        }
    }

    const { GOOGLE_SEARCH_API_KEY, GOOGLE_CX_ID, GEMINI_API_KEY } = process.env;
    
    // Fallback topics if keys are missing
    const fallbackTopics = [
        "Impact of recent Supreme Court judgments on Federalism",
        "Analyze the current Monetary Policy stance of RBI",
        "India's strategic role in the Global South"
    ];

    if (!GOOGLE_SEARCH_API_KEY || !GEMINI_API_KEY) {
        return res.status(200).json({ topics: fallbackTopics });
    }

    try {
        // 2. Fetch Live News (Hindu/Express/PIB)
        const q = `(UPSC OR editorial) (site:thehindu.com OR site:indianexpress.com OR site:pib.gov.in)`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(q)}&num=5&sort=date`;
        
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const titles = searchData.items?.map(i => i.title).join("\n") || "";

        // 3. Extract Core Concepts using AI
        const extractUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const aiRes = await fetch(extractUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Extract 3 complex UPSC Mains topics from these headlines. Return strictly a JSON array of strings. Headlines:\n${titles}` }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });
        
        const aiData = await aiRes.json();
        const topics = JSON.parse(aiData.candidates[0].content.parts[0].text);

        // 4. Update Cache
        if (db && cacheRef) {
            cacheRef.set({ topics: topics, timestamp: Date.now() }).catch(console.error);
        }

        return res.status(200).json({ topics });

    } catch (error) {
        console.error("Trending Fetch Error:", error);
        return res.status(200).json({ topics: fallbackTopics });
    }
}