// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import your API handlers
import chatHandler from './api/chat.js';
import trendingHandler from './api/trending.js';

dotenv.config(); // Load API keys from .env

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit for image uploads

// 1. Serve Static Files (HTML, CSS, JS)
app.use(express.static(__dirname));

// 2. API Routes
app.post('/api/chat', async (req, res) => {
    try {
        await chatHandler(req, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/trending', async (req, res) => {
    try {
        await trendingHandler(req, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 Drona is running locally at: http://localhost:${PORT}`);
    console.log(`   (Press Ctrl + C to stop)\n`);
});
