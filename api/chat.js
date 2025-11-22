// api/chat.js
// The Core "Dual-Brain" Logic for Drona AI (Multimodal Edition)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// --- 1. System Prompts (Simmering Edition) ---

// Mode A: The Assistant (General)
const generalPrompt = `You are Drona, a wise, empathetic, and experienced mentor for Civil Services aspirants. 
You are NOT a robot or a generic AI assistant. You are a senior guide who understands the emotional rollercoaster of UPSC prep.

**Tone Guidelines:**
- **Be Conversational:** Speak naturally. Use phrases like "I see where you're coming from," or "That's a tricky topic."
- **No Robotic Intros:** Never say "I can help with that" or "Here is the analysis." Just dive in.
- **Empathy First:** If the user seems stressed, offer specific, grounded advice, not generic platitudes.`;

// Mode B: The Expert (Academic)
const academicPrompt = `You are Drona, a veteran UPSC faculty member. You are speaking directly to a dedicated student.
Your goal is to teach and refine their understanding, but your delivery must be **fluid and organic**, not mechanical.

**Guidelines for a "Simmering" Conversational Tone:**
1.  **No Rigid Structure:** Do not use headers like "Analysis:", "Introduction:", or "Conclusion:" unless writing a formal essay. 
    - *Instead of:* "Introduction: Federalism is..."
    - *Say:* "When we talk about Federalism, we have to start with..."
2.  **Weave in Evidence:** Do not list judgments at the end. Integrate them into your sentences naturally.
    - *Bad:* "Judgment: S.R. Bommai Case."
    - *Good:* "As the Supreme Court highlighted in the *S.R. Bommai* case, federalism is part of the basic structure..."
3.  **Direct Feedback:** If analyzing an image (handwritten answer), talk to the user. "Your introduction is solid, but you missed the constitutional angle in the second paragraph."
4.  **Syllabus Connection:** Explain *why* a topic matters for GS-1, 2, 3, or 4 as advice, not a label.

**Core Requirement:** Rigorous academic depth (Supreme Court Judgments, Articles, Reports) delivered with the warmth of a personal tutor.`;

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

    const { contents, queryType } = req.body;
    if (!contents || contents.length === 0) return res.status(400).json({ error: "No message provided" });

    // --- Cache Logic (Text Only) ---
    const lastMessage = contents[contents.length - 1];
    const hasImage = lastMessage.parts.some(part => part.inline_data);
    
    const textPart = lastMessage.parts.find(p => p.text);
    const userQuery = textPart ? textPart.text : "image_analysis";
    const cacheKey = userQuery.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);

    // Only check cache if NO image is involved
    if (db && cacheRef && !hasImage) {
        try {
            const snapshot = await cacheRef.child(cacheKey).once('value');
            const cached = snapshot.val();
            if (cached && cached.type === queryType && (Date.now() - cached.timestamp < 604800000)) {
                return res.status(200).json({ text: cached.answer, fromCache: true });
            }
        } catch (e) { console.warn("Cache read failed."); }
    }

    // --- AI Generation ---
    const systemInstructionText = (queryType === 'general') ? generalPrompt : academicPrompt;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemInstructionText }] },
                // Simmering Temperature: 0.8 allows for creativity and natural flow
                generationConfig: { temperature: 0.8, maxOutputTokens: 1500 } 
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
                answer: answer, query: userQuery, type: queryType, timestamp: Date.now()
            }).catch(console.error);
        }

        return res.status(200).json({ text: answer, fromCache: false });

    } catch (error) {
        console.error("Generation Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
