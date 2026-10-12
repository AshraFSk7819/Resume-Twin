const API = "https://resume-twin.onrender.com";
const $ = (id) => document.getElementById(id);

const onboarding = $("onboarding");
const onboardingStatus = $("onboardingStatus");
const dropZone = $("dropZone");
const messages = $("messages");
const composerArea = $("composerArea");
const resumeFile = $("resumeFile");
const chooseResumeBtn = $("chooseResumeBtn");
const uploadStatus = $("uploadStatus");
const resumeName = $("resumeName");
const profileSubtitle = $("profileSubtitle");
const profileBadge = $("profileBadge");
const chatForm = $("chatForm");
const questionInput = $("question");
const sendBtn = $("sendBtn");
const chatStatus = $("chatStatus");
const newChatBtn = $("newChatBtn");
const sessionList = $("sessionList");
const currentChatTitle = $("currentChatTitle");

const STORAGE_KEY = "resumeTwinSessionsV1";
const ACTIVE_KEY = "resumeTwinActiveSessionV1";

let sessions = loadSessions();
let activeSessionId = safeStorageGet(ACTIVE_KEY);
let resumeUploaded = false;
let busy = false;
let healthCheckInProgress = false;
let healthRetryTimer = null;

function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function loadSessions() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveSessions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

        if (activeSessionId) {
            localStorage.setItem(ACTIVE_KEY, activeSessionId);
        } else {
            localStorage.removeItem(ACTIVE_KEY);
        }
    } catch (error) {
        console.warn("Could not save chat history:", error);
    }
}

function activeSession() {
    return sessions.find(session => session.id === activeSessionId) || null;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function setStatus(element, text, type = "") {
    if (!element) return;

    element.textContent = text;
    element.dataset.state = type || "pending";

    if (element.id === "chatStatus") {
        const container = element.closest(".connection-status");

        if (container) {
            container.dataset.state = type || "pending";
            container.setAttribute("aria-label", `Backend status: ${text}`);
        }
    }
}

function showOnboarding() {
    onboarding.classList.remove("is-hidden");
    messages.classList.add("is-hidden");
    composerArea.classList.add("is-hidden");
}

function showChat() {
    onboarding.classList.add("is-hidden");
    messages.classList.remove("is-hidden");
    composerArea.classList.remove("is-hidden");
}

function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}

/* Welcome screen */
function renderWelcome() {
    messages.replaceChildren();

    const welcome = document.createElement("div");
    welcome.className = "welcome";
    welcome.id = "welcome";

    welcome.innerHTML = `
        <h2 class="welcome-heading">What would you like to explore?</h2>

        <p class="welcome-description">
            Ask about your skills, projects, education, or experience.
        </p>

        <div class="suggestions">
            <button class="suggestion" data-question="Tell me about yourself">
                <strong>About me</strong>
                <small>Summarize my profile</small>
            </button>

            <button class="suggestion" data-question="What are my strongest skills?">
                <strong>My skills</strong>
                <small>Identify my strengths</small>
            </button>

            <button class="suggestion" data-question="Explain my projects">
                <strong>My projects</strong>
                <small>Walk through my work</small>
            </button>

            <button class="suggestion"
                data-question="Help me prepare for an interview using my resume">
                <strong>Interview prep</strong>
                <small>Practice with my resume</small>
            </button>
        </div>
    `;

    messages.appendChild(welcome);

    welcome.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", () => {
            questionInput.value = button.dataset.question || "";
            questionInput.dispatchEvent(new Event("input"));
            chatForm.requestSubmit();
        });
    });
}

/* Markdown rendering */
function renderMarkdown(input) {
    const source = String(input ?? "").replace(/\r\n/g, "\n");
    const codeBlocks = [];
    let text = escapeHTML(source);

    text = text.replace(
        /```([a-zA-Z0-9_+#.-]*)[ \t]*\n?([\s\S]*?)```/g,
        (_, language, code) => {
            const index = codeBlocks.length;

            codeBlocks.push(
                `<pre><div class="code-header">${escapeHTML(language || "Code")}</div><code>${code.trimEnd()}</code></pre>`
            );

            return `\n%%CODE${index}%%\n`;
        }
    );

    function inline(value) {
        return value
            .replace(/`([^`\n]+)`/g, "<code>$1</code>")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    }

    function parseTableRow(row) {
        return row.trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(cell => cell.trim());
    }

    const lines = text.split("\n");
    const output = [];
    let paragraph = [];
    let listType = "";
    let listItems = [];

    function flushParagraph() {
        if (!paragraph.length) return;

        output.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
        paragraph = [];
    }

    function flushList() {
        if (!listItems.length) return;

        output.push(
            `<${listType}>${listItems.map(item =>
                `<li>${inline(item)}</li>`
            ).join("")}</${listType}>`
        );

        listItems = [];
        listType = "";
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^%%CODE\d+%%$/.test(trimmed)) {
            flushParagraph();
            flushList();
            output.push(trimmed);
            continue;
        }

        if (
            trimmed.startsWith("|") &&
            i + 1 < lines.length &&
            /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
            lines[i + 1].includes("-")
        ) {
            flushParagraph();
            flushList();

            const headers = parseTableRow(line);
            i++;

            const rows = [];

            while (
                i + 1 < lines.length &&
                lines[i + 1].trim().startsWith("|")
            ) {
                rows.push(parseTableRow(lines[++i]));
            }

            output.push(`
                <div class="table-wrapper">
                    <table class="markdown-table">
                        <thead>
                            <tr>${headers.map(cell =>
                                `<th>${inline(cell)}</th>`
                            ).join("")}</tr>
                        </thead>
                        <tbody>${rows.map(row => `
                            <tr>${row.map(cell =>
                                `<td>${inline(cell)}</td>`
                            ).join("")}</tr>
                        `).join("")}</tbody>
                    </table>
                </div>
            `);

            continue;
        }

        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

        if (heading) {
            flushParagraph();
            flushList();

            const level = heading[1].length;
            output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            continue;
        }

        const unordered = trimmed.match(/^[-*]\s+(.+)$/);
        const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);

        if (unordered || ordered) {
            flushParagraph();

            const type = unordered ? "ul" : "ol";

            if (listType && listType !== type) flushList();
            if (!listType) listType = type;

            listItems.push((unordered || ordered)[1]);
            continue;
        }

        flushList();
        paragraph.push(line);
    }

    flushParagraph();
    flushList();

    return output.join("\n").replace(
        /%%CODE(\d+)%%/g,
        (_, index) => codeBlocks[Number(index)] || ""
    );
}

/* Message rendering */
function addMessage(text, role, save = true) {
    $("welcome")?.remove();

    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const content = document.createElement("div");
    content.className = "message-content";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = role === "user" ? "You" : "Resume Twin";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (role === "assistant") {
        bubble.innerHTML = renderMarkdown(text);
    } else {
        bubble.textContent = text;
    }

    content.append(meta, bubble);
    row.appendChild(content);
    messages.appendChild(row);

    scrollToBottom();

    if (save) {
        const session = activeSession();

        if (session) {
            session.messages.push({ role, content: text });
            session.updatedAt = Date.now();

            if (role === "user" && session.title === "New chat") {
                session.title = text.slice(0, 32) || "New chat";
            }

            saveSessions();
            renderSessionList();
        }
    }

    return bubble;
}

function addTypingIndicator() {
    const row = document.createElement("div");
    row.className = "message-row assistant";

    const content = document.createElement("div");
    content.className = "message-content";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = "Resume Twin";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble typing";
    bubble.textContent = "Thinking…";

    content.append(meta, bubble);
    row.appendChild(content);
    messages.appendChild(row);

    scrollToBottom();
    return bubble;
}

async function readResponse(response) {
    if (!response.ok) {
        let message = `Request failed (${response.status}).`;

        try {
            const data = await response.json();
            message = data.detail || data.message || message;
        } catch {
            // The server may return a non-JSON error.
        }

        throw new Error(message);
    }

    return response.json();
}

/* Chat session management */
function renderSessionList() {
    sessionList.replaceChildren();

    if (!sessions.length) {
        const empty = document.createElement("p");
        empty.className = "empty-sessions";
        empty.textContent = "Your conversations will appear here.";
        sessionList.appendChild(empty);
        return;
    }

    sessions
        .slice()
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .forEach(session => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "session-item";
            button.classList.toggle("active", session.id === activeSessionId);
            button.textContent = session.title || "New chat";
            button.title = session.title || "New chat";

            button.addEventListener("click", () => switchSession(session.id));
            sessionList.appendChild(button);
        });
}

function displaySession(session) {
    messages.replaceChildren();

    if (!session.messages.length) {
        renderWelcome();
    } else {
        session.messages.forEach(message => {
            addMessage(message.content, message.role, false);
        });
    }

    if (currentChatTitle) {
        currentChatTitle.textContent = session.title || "New chat";
    }

    scrollToBottom();
}

async function createSession() {
    if (busy) return;

    if (!resumeUploaded) {
        showOnboarding();
        onboardingStatus.textContent = "Upload your resume before starting a chat.";
        onboardingStatus.className = "onboarding-status";
        return;
    }

    newChatBtn.disabled = true;

    try {
        const response = await fetch(`${API}/new-chat`, {
            method: "POST"
        });

        const data = await readResponse(response);

        if (!data.session_id) {
            throw new Error("The backend did not return a session ID.");
        }

        const session = {
            id: data.session_id,
            title: "New chat",
            messages: [],
            updatedAt: Date.now()
        };

        sessions.push(session);
        activeSessionId = session.id;

        saveSessions();
        renderSessionList();
        displaySession(session);
        showChat();
    } catch (error) {
        onboardingStatus.textContent =
            `Couldn't create a chat: ${error.message}`;
        onboardingStatus.className = "onboarding-status error";
    } finally {
        newChatBtn.disabled = false;
    }
}

function switchSession(id) {
    if (busy || !resumeUploaded) return;

    const session = sessions.find(item => item.id === id);
    if (!session) return;

    activeSessionId = id;
    saveSessions();
    renderSessionList();
    displaySession(session);
    showChat();
}

function setProfile(info = {}) {
    resumeName.textContent = info.name || "Your profile";
    profileSubtitle.textContent = info.email || "Email unavailable";
    profileBadge.textContent = "Ready";
    profileBadge.classList.add("ready");
}

/* Resume upload */
async function uploadResume(file) {
    if (busy) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        onboardingStatus.textContent = "Please select a PDF file.";
        onboardingStatus.className = "onboarding-status error";
        return;
    }

    if (!file.size) {
        onboardingStatus.textContent = "The selected file is empty.";
        onboardingStatus.className = "onboarding-status error";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        onboardingStatus.textContent = "The PDF must be 10 MB or smaller.";
        onboardingStatus.className = "onboarding-status error";
        return;
    }

    busy = true;
    chooseResumeBtn.disabled = true;
    newChatBtn.disabled = true;

    onboardingStatus.className = "onboarding-status";
    onboardingStatus.textContent = "Uploading and reading your resume…";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(`${API}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await readResponse(response);

        resumeUploaded = true;
        setProfile(data.resume_info || {});

        sessions = [];
        activeSessionId = null;

        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(ACTIVE_KEY);
        } catch (error) {
            console.warn("Could not clear saved sessions:", error);
        }

        renderSessionList();

        onboardingStatus.textContent = "Resume processed successfully.";
        onboardingStatus.className = "onboarding-status success";

        busy = false;
        await createSession();
    } catch (error) {
        resumeUploaded = false;

        onboardingStatus.textContent =
            error.message || "Upload failed. Please try again.";
        onboardingStatus.className = "onboarding-status error";

        setStatus(uploadStatus, onboardingStatus.textContent, "error");
    } finally {
        busy = false;
        chooseResumeBtn.disabled = false;
        newChatBtn.disabled = false;
        resumeFile.value = "";
    }
}

chooseResumeBtn.addEventListener("click", () => {
    if (!busy) resumeFile.click();
});

resumeFile.addEventListener("change", () => {
    const file = resumeFile.files?.[0];
    if (file) uploadResume(file);
});

["dragenter", "dragover"].forEach(type => {
    dropZone.addEventListener(type, event => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });
});

["dragleave", "drop"].forEach(type => {
    dropZone.addEventListener(type, event => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");
    });
});

dropZone.addEventListener("drop", event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) uploadResume(file);
});

newChatBtn.addEventListener("click", createSession);

/* Chat request and streamed response */
chatForm.addEventListener("submit", async event => {
    event.preventDefault();

    const question = questionInput.value.trim();
    if (!question || busy) return;

    if (!resumeUploaded || !activeSession()) {
        showOnboarding();
        onboardingStatus.textContent = "Upload your resume to start chatting.";
        onboardingStatus.className = "onboarding-status";
        return;
    }

    const session = activeSession();

    busy = true;
    sendBtn.disabled = true;
    newChatBtn.disabled = true;
    chooseResumeBtn.disabled = true;

    setStatus(chatStatus, "Generating response");

    showChat();
    addMessage(question, "user");

    questionInput.value = "";
    questionInput.style.height = "auto";

    const bubble = addTypingIndicator();

    try {
        const response = await fetch(`${API}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                session_id: session.id
            })
        });

        if (!response.ok) {
            let message = `Request failed (${response.status}).`;

            try {
                const error = await response.json();
                message = error.detail || error.message || message;
            } catch {
                // The response might not be JSON.
            }

            throw new Error(message);
        }

        if (!response.body) {
            throw new Error("The server returned no readable response stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let answer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            answer += decoder.decode(value, { stream: true });
            bubble.innerHTML = renderMarkdown(answer);
            scrollToBottom();
        }

        answer += decoder.decode();

        if (!answer.trim()) {
            bubble.textContent = "No response received. Please try again.";
        } else {
            bubble.innerHTML = renderMarkdown(answer);
            session.messages.push({ role: "assistant", content: answer });
            session.updatedAt = Date.now();
            saveSessions();
        }
    } catch (error) {
        bubble.textContent = `Something went wrong: ${error.message}`;
        bubble.classList.add("error-message");
    } finally {
        busy = false;
        sendBtn.disabled = false;
        newChatBtn.disabled = false;
        chooseResumeBtn.disabled = false;
        renderSessionList();
        checkBackend();
    }
});

questionInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});

questionInput.addEventListener("input", () => {
    questionInput.style.height = "auto";
    questionInput.style.height =
        `${Math.min(questionInput.scrollHeight, 150)}px`;
});

/* Wake Render on page load and retry failed health checks. */
async function checkBackend() {
    if (healthCheckInProgress) return;

    healthCheckInProgress = true;

    setStatus(
        chatStatus,
        "Waking up server… this may take up to a minute."
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
        const response = await fetch(`${API}/`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        setStatus(chatStatus, "Connected", "success");

        if (healthRetryTimer) {
            clearTimeout(healthRetryTimer);
            healthRetryTimer = null;
        }
    } catch (error) {
        setStatus(
            chatStatus,
            "Server unavailable or waking up — retrying in 5 seconds…",
            "error"
        );

        if (healthRetryTimer) clearTimeout(healthRetryTimer);

        healthRetryTimer = setTimeout(() => {
            healthRetryTimer = null;
            checkBackend();
        }, 5000);
    } finally {
        clearTimeout(timeout);
        healthCheckInProgress = false;
    }
}

function initialize() {
    renderSessionList();
    showOnboarding();
    checkBackend();
}

initialize();