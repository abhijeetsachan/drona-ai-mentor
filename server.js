import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import your API handlers
import chatHandler from './api/chat.js';
import trendingHandler from './api/trending.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Serve static files (HTML, CSS, JS) from the root directory
app.use(express.static(__dirname));

// Mount the API routes
app.post('/api/chat', chatHandler);
app.get('/api/trending', trendingHandler);

// Fallback: Serve index.html for any other request
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Drona Server is running at http://localhost:${PORT}`);
    console.log(`   - API Chat:   http://localhost:${PORT}/api/chat`);
    console.log(`   - Static UI:  http://localhost:${PORT}/\n`);
});
