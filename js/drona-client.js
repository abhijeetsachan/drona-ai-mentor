/**
 * js/drona-client.js
 * Simmering Edition: Added Typewriter Effect & Smooth Streaming Visuals
 */

const API_CHAT = '/api/chat';
const API_TRENDING = '/api/trending';

let conversationHistory = [];
let isChatOpen = false;
let DOMElements = {};
let pendingImages = [];

const GREETINGS = [
    "Ready to conquer UPSC? Let's begin.",
    "Prelims facts or Mains strategy? Ask away.",
    "Stuck on a topic? I'm here to help.",
    "Let's turn your doubts into strengths."
];

// --- 1. MOBILE NAVIGATION LOGIC ---
export function initMobileNav() {
    const openBtn = document.getElementById('mobile-menu-open');
    const closeBtn = document.getElementById('mobile-menu-close');
    const overlay = document.getElementById('mobile-menu-overlay');
    const links = document.querySelectorAll('.mobile-link');

    if (!openBtn || !overlay) return;

    function toggleMenu(show) {
        if (show) {
            overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; 
        } else {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    openBtn.addEventListener('click', () => toggleMenu(true));
    closeBtn.addEventListener('click', () => toggleMenu(false));

    links.forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
    });
}

// --- 2. MAIN CHAT INITIALIZATION ---
export function initDrona() {
    DOMElements = {
        toggle: document.getElementById('drona-toggle'),
        window: document.getElementById('drona-window'),
        close: document.getElementById('drona-close'),
        clear: document.getElementById('drona-clear'),
        messages: document.getElementById('drona-messages'),
        form: document.getElementById('drona-form'),
        input: document.getElementById('drona-input'),
        fileInput: document.getElementById('drona-file'),
        attachBtn: document.getElementById('drona-attach-btn'),
        imagePreview: document.getElementById('drona-image-preview'),
        bubble: document.getElementById('drona-bubble'),
        sendBtn: document.querySelector('.send-btn-floating')
    };

    if (!DOMElements.toggle || !DOMElements.window) return;

    DOMElements.toggle.addEventListener('click', () => toggleChat(true));
    DOMElements.close.addEventListener('click', () => toggleChat(false));
    if (DOMElements.clear) DOMElements.clear.addEventListener('click', clearChat);
    
    DOMElements.form.addEventListener('submit', handleSubmit);
    DOMElements.attachBtn.addEventListener('click', () => DOMElements.fileInput.click());
    DOMElements.fileInput.addEventListener('change', handleFileSelect);

    window.addEventListener('popstate', (event) => {
        if (window.innerWidth < 768) {
            if (!event.state?.dronaChat && isChatOpen) {
                toggleChat(false, false);
            }
        }
    });

    showGreetingBubble();
}

// --- 3. UI STATE MANAGEMENT ---
function toggleChat(forceState, updateHistory = true) {
    const newState = (typeof forceState === 'boolean') ? forceState : !isChatOpen;
    if (newState === isChatOpen) return;
    isChatOpen = newState;
    
    if (isChatOpen) {
        DOMElements.window.classList.remove('hidden');
        DOMElements.window.classList.add('flex');
        DOMElements.toggle.classList.add('drona-toggle-hidden');
        DOMElements.bubble.classList.add('hidden');
        
        setTimeout(() => DOMElements.input.focus(), 100);

        if (DOMElements.messages.children.length === 0) {
            addMessage('ai', { text: GREETINGS[0] });
            loadTrendingTopics();
        }

        if (updateHistory && window.innerWidth < 768) {
            history.pushState({ dronaChat: true }, '', '#chat');
        }
    } else {
        DOMElements.window.classList.add('hidden');
        DOMElements.window.classList.remove('flex');
        DOMElements.toggle.classList.remove('drona-toggle-hidden');
        
        if (updateHistory && window.innerWidth < 768) {
            if (history.state && history.state.dronaChat) history.back();
        }
    }
}

function showGreetingBubble() {
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    const textEl = DOMElements.bubble.querySelector('.bubble-text');
    if (textEl) textEl.textContent = greeting;
    DOMElements.bubble.classList.remove('hidden');
    setTimeout(() => DOMElements.bubble.classList.add('hidden'), 8000);
}

function clearChat() {
    DOMElements.messages.innerHTML = '';
    conversationHistory = [];
    addMessage('ai', { text: GREETINGS[0] });
    pendingImages = [];
    renderImagePreview();
}

// --- 4. FILE HANDLING ---
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (pendingImages.length + files.length > 10) {
        alert("You can only upload a maximum of 10 images at a time.");
        return;
    }

    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
            alert(`Image ${file.name} is too large (Max 5MB). Skipping.`);
            continue;
        }
        try {
            const base64 = await fileToBase64(file);
            pendingImages.push({ 
                mime_type: file.type, 
                data: base64, 
                id: Date.now() + Math.random() 
            });
        } catch (err) { console.error("File read error:", err); }
    }
    renderImagePreview();
    DOMElements.fileInput.value = ''; 
}

function renderImagePreview() {
    const container = DOMElements.imagePreview;
    if (pendingImages.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = pendingImages.map((img, index) => `
        <div class="preview-item">
            <img src="data:${img.mime_type};base64,${img.data}" alt="Preview">
            <button type="button" class="remove-img-btn" data-index="${index}">&times;</button>
        </div>
    `).join('');
    
    container.querySelectorAll('.remove-img-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            pendingImages.splice(idx, 1);
            renderImagePreview();
        });
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
    });
}

// --- 5. CORE SUBMISSION LOGIC ---
async function handleSubmit(e) {
    e.preventDefault();
    const text = DOMElements.input.value.trim();
    if (!text && pendingImages.length === 0) return;

    if (DOMElements.sendBtn) {
        DOMElements.sendBtn.classList.remove('sending');
        void DOMElements.sendBtn.offsetWidth; 
        DOMElements.sendBtn.classList.add('sending');
        setTimeout(() => {
            if(DOMElements.sendBtn) DOMElements.sendBtn.classList.remove('sending');
        }, 600);
    }

    const userDisplayData = { text: text };
    if (pendingImages.length > 0) {
        userDisplayData.images = pendingImages.map(img => `data:${img.mime_type};base64,${img.data}`);
    }
    addMessage('user', userDisplayData);

    const userParts = [];
    if (text) userParts.push({ text: text });
    pendingImages.forEach(img => {
        userParts.push({ inline_data: { mime_type: img.mime_type, data: img.data } });
    });

    conversationHistory.push({ role: "user", parts: userParts });
    
    DOMElements.input.value = '';
    pendingImages = [];
    renderImagePreview();

    const loaderId = showLoader();

    try {
        const response = await fetch(API_CHAT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: conversationHistory,
                queryType: 'academic'
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Network error");

        removeLoader(loaderId);
        // Enable "Simmering" Typewriter Effect
        addMessage('ai', { text: data.text }, data.fromCache, true);
        conversationHistory.push({ role: "model", parts: [{ text: data.text }] });

    } catch (error) {
        console.error("Chat Error:", error);
        removeLoader(loaderId);
        addMessage('ai', { text: "I apologize, but I am unable to connect to the server right now. Please check your connection." });
    }
}

// --- 6. MESSAGE RENDERING (With Typewriter) ---
function addMessage(role, content, fromCache = false, animate = false) {
    const div = document.createElement('div');
    div.className = `drona-message ${role}`;
    
    let innerHTML = '';
    
    if (content.images && content.images.length > 0) {
        innerHTML += `<div class="msg-images-grid">`;
        content.images.forEach(src => {
            innerHTML += `<div class="msg-image"><img src="${src}" alt="User upload"></div>`;
        });
        innerHTML += `</div>`;
    }
    
    // Helper to construct text content
    const buildTextContainer = (text) => {
        const textHtml = (role === 'ai') ? renderMarkdown(text) : text.replace(/\n/g, '<br>');
        return `<div class="msg-content">${textHtml}</div>`;
    };

    // If it's user, or cache, or we explicitly don't want animation -> Render instantly
    if (!animate || !content.text) {
        if (content.text) innerHTML += buildTextContainer(content.text);
    } 
    // AI response with animation
    else {
        innerHTML += `<div class="msg-content"></div>`; 
    }
    
    if (role === 'ai') {
        innerHTML += `<div class="msg-actions"><button type="button" class="copy-btn" title="Copy"><i class="fas fa-copy"></i></button></div>`;
    }
    
    div.innerHTML = innerHTML;
    DOMElements.messages.appendChild(div);
    
    // Handle Typewriter Animation
    if (animate && content.text) {
        const contentDiv = div.querySelector('.msg-content');
        typewriterEffect(contentDiv, content.text);
    } else {
        scrollToBottom();
    }
    
    // Copy Button Logic
    if (role === 'ai' && content.text) {
        const copyBtn = div.querySelector('.copy-btn');
        if(copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(content.text);
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => copyBtn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
            });
        }
    }
}

// --- 6b. TYPEWRITER EFFECT ---
function typewriterEffect(element, fullText) {
    // We'll stream the raw text first, then render markdown at the end for stability,
    // OR we can render partial markdown. For stability, we type plain text chars.
    // Note: "Simmering" implies fluid reading.
    
    // Faster approach: Split by words to prevent choppy char-by-char feel
    const words = fullText.split(/(\s+)/); 
    let i = 0;
    element.innerHTML = ''; // Clear
    
    const interval = setInterval(() => {
        if (i < words.length) {
            element.textContent += words[i]; // Append raw text safely
            i++;
            // Auto-scroll while typing
            DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
        } else {
            clearInterval(interval);
            // Final Pass: Render Markdown
            element.innerHTML = renderMarkdown(fullText);
            scrollToBottom();
        }
    }, 15); // Speed: 15ms per word/space chunk
}

function showLoader() {
    const id = 'loader-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'drona-message ai typing-indicator';
    div.innerHTML = `<span></span><span></span><span></span>`;
    DOMElements.messages.appendChild(div);
    scrollToBottom();
    return id;
}

function removeLoader(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    setTimeout(() => {
        DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
    }, 10);
}

// --- 7. TRENDING TOPICS ---
async function loadTrendingTopics() {
    try {
        const res = await fetch(API_TRENDING);
        const data = await res.json();
        
        if (data.topics && data.topics.length > 0) {
            const container = document.createElement('div');
            // ... inside loadTrendingTopics ...
if (data.topics && data.topics.length > 0) {
    const container = document.createElement('div');
    container.className = 'suggestion-group'; // Use new CSS class
    
    // Use the new label class
    container.innerHTML = `<span class="suggestion-label">Suggested Topics</span>`;
    
    data.topics.forEach(topic => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-btn'; // Use new CSS class
        btn.textContent = topic;
        btn.onclick = () => { 
            DOMElements.input.value = topic; 
            handleSubmit(new Event('submit')); 
        };
        container.appendChild(btn);
    });
    
    const msgDiv = document.createElement('div');
    // Removed 'ai' class so it doesn't look like a chat bubble, but a system message
    msgDiv.className = 'drona-message max-w-[90%]'; 
    msgDiv.appendChild(container);
    
    DOMElements.messages.appendChild(msgDiv);
    scrollToBottom();
}
                btn.textContent = topic;
                btn.onclick = () => { 
                    DOMElements.input.value = topic; 
                    handleSubmit(new Event('submit')); 
                };
                container.appendChild(btn);
            });
            
            const msgDiv = document.createElement('div');
            msgDiv.className = 'drona-message ai max-w-[85%]';
            msgDiv.appendChild(container);
            
            DOMElements.messages.appendChild(msgDiv);
            scrollToBottom();
        }
    } catch (e) { 
        console.warn("Trending topics failed to load", e); 
    }
}

// --- 8. REFINED MARKDOWN PARSER ---
function renderMarkdown(text) {
    if (!text) return '';

    let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
    // Emphasize italics for citations/cases
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); 

    const lines = html.split('\n');
    let inList = false;
    let result = '';

    lines.forEach(line => {
        if (line.trim().startsWith('<li>')) {
            if (!inList) {
                result += '<ul>'; 
                inList = true;
            }
            result += line;
        } else {
            if (inList) {
                result += '</ul>'; 
                inList = false;
            }
            if (line.trim().length > 0 && !line.includes('<h3')) {
                result += line + '<br>';
            } else {
                result += line;
            }
        }
    });
    
    if (inList) result += '</ul>';

    return result;
}
