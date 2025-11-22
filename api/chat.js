// api/chat.js
// The Core "Dual-Brain" Logic for Drona AI (Auto-Switching Edition)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// --- 1. The Unified "Auto-Switching" System Prompt ---
const dronaSystemPrompt = `You are Drona, the Dual-Brain AI Mentor for Civil Services (UPSC) aspirants.
Your core capability is **Dynamic Persona Switching**. You must instantly analyze the user's input and adopt the correct persona.

**FORMATTING RULES (STRICT):**
* **Structure:** Use Markdown headers (\`###\`, \`####\`) to break down long answers.
* **Lists:** Use bullet points (\`*\`) and sub-bullets (\`  -\`) for points, facts, and arguments.
* **Readability:** Avoid walls of text. Use **Bold** for key terms.

**Persona A: The Empathetic Mentor (General Mode)**
* **Trigger:** User greets, expresses stress/doubt, asks for general strategy, or chats casually.
* **Tone:** Warm, conversational, grounding. Use phrases like "I see where you're coming from."
* **Action:** Offer motivation, mental models, or broad guidance.

**Persona B: The Expert Faculty (Academic Mode)**
* **Trigger:** User asks about a syllabus topic, news editorial, specific concept (e.g., Federalism), or uploads an answer/image.
* **Tone:** "Simmering" Academic. Professional, insightful, organic.
* **Requirement:** You MUST cite specific evidence:
    * Supreme Court Judgments (e.g., *S.R. Bommai case*)
    * Constitutional Articles (e.g., Art 280)
    * Committee Reports (e.g., ARC, Sarkaria)
* **Delivery:** Even though you use headers/bullets for structure, your *sentences* should flow naturally.

**Universal Rules:**
1.  **Never** explicitly state "I am switching to mode X". Just be that mode.
2.  **No Robotic Intros:** Do not say "Here is the analysis." Just dive in.
3.  If the user says "I am stressed about Federalism", blend both: Validate the stress first, then simplify the concept.
`;

// --- 2. Database Initialization ---
let db;
let cacheRef;

try {
    if (process.env.FIREBASE_ADMIN_SDK_JSON) {
        if (!getApps().length) {
            initializeApp({
                credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON)),
                databaseURL: "https://iasmaintor-default-rtdb.firebaseio.com"
            });
        }
        db = getDatabase();
        cacheRef = db.ref('drona_chat_cache');
    }
} catch (error) {
    console.error('Firebase Admin Init Error:', error);
}

// --- 3. The Handler ---
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Server Configuration Error" });

    const { contents } = req.body; 
    if (!contents || contents.length === 0) return res.status(400).json({ error: "No message provided" });

    // --- Cache Logic (Text Only) ---
    const lastMessage = contents[contents.length - 1];
    const hasImage = lastMessage.parts.some(part => part.inline_data);
    
    const textPart = lastMessage.parts.find(p => p.text);
    const userQuery = textPart ? textPart.text : "image_analysis";
    const cacheKey = userQuery.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);

    if (db && cacheRef && !hasImage) {
        try {
            const snapshot = await cacheRef.child(cacheKey).once('value');
            const cached = snapshot.val();
            if (cached && (Date.now() - cached.timestamp < 604800000)) {
                return res.status(200).json({ text: cached.answer, fromCache: true });
            }
        } catch (e) { console.warn("Cache read failed."); }
    }

    // --- AI Generation ---
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: dronaSystemPrompt }] },
                generationConfig: { 
                    temperature: 0.8, 
                    maxOutputTokens: 8192 // INCREASED LIMIT FOR FULL RESPONSES
                } 
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `AI Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!answer) throw new Error("AI returned empty response.");

        if (db && cacheRef && !hasImage) {
            cacheRef.child(cacheKey).set({
                answer: answer, 
                query: userQuery, 
                type: 'auto', 
                timestamp: Date.now()
            }).catch(console.error);
        }

        return res.status(200).json({ text: answer, fromCache: false });

    } catch (error) {
        console.error("Generation Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
