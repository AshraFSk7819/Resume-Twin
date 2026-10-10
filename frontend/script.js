
const API = "https://resume-twin.onrender.com";
const $ = id => document.getElementById(id);

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
let activeSessionId = localStorage.getItem(ACTIVE_KEY) || null;
let resumeUploaded = false;
let busy = false;

function loadSessions() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function saveSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

    if (activeSessionId) {
        localStorage.setItem(ACTIVE_KEY, activeSessionId);
    } else {
        localStorage.removeItem(ACTIVE_KEY);
    }
}

function activeSession() {
    return sessions.find(s => s.id === activeSessionId) || null;
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
    element.className = `status ${type}`.trim();
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
    questionInput.focus();
}

function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}

/* Original welcome screen, displayed after the PDF is processed. */
function renderWelcome() {
    messages.replaceChildren();

    const welcome = document.createElement("div");
    welcome.className = "welcome";
    welcome.id = "welcome";

    welcome.innerHTML = `
        <div class="welcome-kicker">PERSONAL AI WORKSPACE</div>

        <h2 class="welcome-heading">
            A clearer view of<br>
            <span>your experience.</span>
        </h2>

        <p class="welcome-description">
            Ask questions about your skills, projects, education, and
            professional background.
        </p>

        <div class="suggestions">
            <button class="suggestion" data-question="Tell me about yourself">
                <span class="suggestion-symbol">01</span>
                <span>
                    <strong>About me</strong>
                    <small>Summarize my profile</small>
                </span>
                <span class="suggestion-arrow">↗</span>
            </button>

            <button class="suggestion"
                data-question="What are my strongest skills?">
                <span class="suggestion-symbol">02</span>
                <span>
                    <strong>My skills</strong>
                    <small>Identify my strengths</small>
                </span>
                <span class="suggestion-arrow">↗</span>
            </button>

            <button class="suggestion" data-question="Explain my projects">
                <span class="suggestion-symbol">03</span>
                <span>
                    <strong>My projects</strong>
                    <small>Explore my work</small>
                </span>
                <span class="suggestion-arrow">↗</span>
            </button>

            <button class="suggestion"
                data-question="Help me prepare for an interview using my resume">
                <span class="suggestion-symbol">04</span>
                <span>
                    <strong>Interview prep</strong>
                    <small>Practice from my resume</small>
                </span>
                <span class="suggestion-arrow">↗</span>
            </button>
        </div>
    `;

    messages.appendChild(welcome);

    welcome.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", () => {
            questionInput.value = button.dataset.question || "";
            questionInput.focus();
            questionInput.dispatchEvent(new Event("input"));
        });
    });
}

/* Lightweight Markdown renderer with table support. */
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
                        <thead><tr>${headers.map(cell =>
                            `<th>${inline(cell)}</th>`
                        ).join("")}</tr></thead>
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

function addMessage(text, role, save = true) {
    $("welcome")?.remove();

    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "Y" : "R";
    avatar.setAttribute("aria-hidden", "true");

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
    row.append(avatar, content);
    messages.appendChild(row);

    scrollToBottom();

    if (save) {
        const session = activeSession();

        if (session) {
            session.messages.push({ role, content: text });
            session.updatedAt = Date.now();

            if (role === "user" && session.title === "New chat") {
                session.title = text.length > 32
                    ? text.slice(0, 32).trim() + "…"
                    : text;

                currentChatTitle.textContent = session.title;
            }

            saveSessions();
            renderSessionList();
        }
    }

    return bubble;
}

function addTypingIndicator() {
    const bubble = addMessage("", "assistant", false);

    bubble.innerHTML = `
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
    `;

    return bubble;
}

async function readResponse(response) {
    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(`Server returned HTTP ${response.status}.`);
    }

    if (!response.ok) {
        throw new Error(data.detail || "The request failed.");
    }

    return data;
}

function renderSessionList() {
    sessionList.replaceChildren();

    if (!sessions.length) {
        const empty = document.createElement("p");
        empty.className = "empty-sessions";
        empty.textContent = "Your conversations will appear here.";
        sessionList.appendChild(empty);
        return;
    }

    [...sessions]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .forEach(session => {
            const item = document.createElement("div");
            item.className =
                `session-item ${session.id === activeSessionId ? "active" : ""}`;

            const select = document.createElement("button");
            select.type = "button";
            select.className = "session-select";
            select.innerHTML = `
                <span class="session-icon">▤</span>
                <span class="session-title"></span>
            `;

            select.querySelector(".session-title").textContent =
                session.title || "New chat";

            select.addEventListener("click", () => switchSession(session.id));

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "session-delete";
            remove.textContent = "×";
            remove.title = "Delete chat";
            remove.setAttribute("aria-label", "Delete chat");

            remove.addEventListener("click", event => {
                event.stopPropagation();
                deleteSession(session.id);
            });

            item.append(select, remove);
            sessionList.appendChild(item);
        });
}

function displaySession(session) {
    messages.replaceChildren();
    currentChatTitle.textContent = session?.title || "New chat";

    if (!session || !session.messages.length) {
        renderWelcome();
        return;
    }

    for (const message of session.messages) {
        const row = document.createElement("div");
        row.className = `message-row ${message.role}`;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = message.role === "user" ? "Y" : "R";

        const content = document.createElement("div");
        content.className = "message-content";

        const meta = document.createElement("div");
        meta.className = "message-meta";
        meta.textContent = message.role === "user" ? "You" : "Resume Twin";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        if (message.role === "assistant") {
            bubble.innerHTML = renderMarkdown(message.content);
        } else {
            bubble.textContent = message.content;
        }

        content.append(meta, bubble);
        row.append(avatar, content);
        messages.appendChild(row);
    }

    scrollToBottom();
}

async function createSession() {
    if (busy || !resumeUploaded) return;

    newChatBtn.disabled = true;

    try {
        const response = await fetch(`${API}/new-chat`, { method: "POST" });
        const data = await readResponse(response);

        if (!data.session_id) {
            throw new Error("Backend did not return a session ID.");
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
        onboardingStatus.textContent = error.message;
        onboardingStatus.className = "onboarding-status error";
    } finally {
        newChatBtn.disabled = false;
    }
}

function switchSession(id) {
    if (busy || !resumeUploaded) return;

    const session = sessions.find(s => s.id === id);
    if (!session) return;

    activeSessionId = id;
    saveSessions();
    renderSessionList();
    displaySession(session);
    showChat();
}

async function deleteSession(id) {
    if (busy) return;

    sessions = sessions.filter(session => session.id !== id);

    if (activeSessionId === id) {
        activeSessionId = sessions[0]?.id || null;
    }

    saveSessions();
    renderSessionList();

    if (activeSession()) {
        displaySession(activeSession());
        showChat();
    } else if (resumeUploaded) {
        await createSession();
    }
}

async function resetCurrentSession() {
    const session = activeSession();
    if (!session) return;

    const response = await fetch(`${API}/reset-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id })
    });

    await readResponse(response);

    session.messages = [];
    session.title = "New chat";
    session.updatedAt = Date.now();

    saveSessions();
    renderSessionList();
    displaySession(session);
    showChat();
}

function setProfile(info = {}) {
    resumeName.textContent = info.name || "Your profile";
    profileSubtitle.textContent = info.email || "Email unavailable";
    profileBadge.textContent = "READY";
    profileBadge.classList.add("ready");
}

async function uploadResume(file) {
    if (busy) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        onboardingStatus.textContent = "Please select a PDF file.";
        onboardingStatus.className = "onboarding-status error";
        return;
    }

    if (!file.size) {
        onboardingStatus.textContent = "The file is empty.";
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

        // The uploaded resume starts a fresh set of conversations.
        sessions = [];
        activeSessionId = null;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVE_KEY);
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
    const file = resumeFile.files[0];
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
    chatStatus.textContent = "Generating response";

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
                message = error.detail || message;
            } catch {}

            throw new Error(message);
        }

        if (!response.body) {
            throw new Error("The server did not return a readable stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let answer = "";
        let firstChunk = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            answer += decoder.decode(value, { stream: true });

            if (firstChunk) {
                bubble.innerHTML = "";
                firstChunk = false;
            }

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

        scrollToBottom();
    } catch (error) {
        bubble.textContent = `Something went wrong: ${error.message}`;
    } finally {
        busy = false;
        sendBtn.disabled = false;
        newChatBtn.disabled = false;
        chooseResumeBtn.disabled = false;
        chatStatus.textContent = "Connected";
        questionInput.focus();
        renderSessionList();
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

async function initialize() {
    renderSessionList();
    showOnboarding();

    try {
        const response = await fetch(`${API}/`);
        chatStatus.textContent = response.ok ? "Connected" : "Offline";
    } catch {
        chatStatus.textContent = "Offline";
    }
}

initialize();
