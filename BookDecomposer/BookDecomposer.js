let bookChunks = [];
let novelData = {};
let isBookProcessed = false;

function chunkText(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

function safeParse(response, field, defaultValue) {
    try {
        return JSON.parse(response)[field] || defaultValue;
    } catch (e) {
        console.warn(`Failed to parse ${field}: ${e.message}. Raw: ${response}`);
        return defaultValue;
    }
}

async function callGrokAPI(messages, maxTokens, isJSON) {
    const apiKey = document.getElementById("apiKey").value.trim();
    try {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "grok-2-latest",
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.7,
                response_format: isJSON ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid API response: missing choices or message.");
        }
        return data.choices[0].message.content;
    } catch (error) {
        console.error("API call error:", error);
        throw error;
    }
}

window.processBook = async function() {
    const bookTitle = document.getElementById("title").value.trim();
    const fileInput = document.getElementById("bookFile");
    const apiKey = document.getElementById("apiKey").value.trim();

    if (!bookTitle) {
        alert("Please enter a book title.");
        return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please upload a text file.");
        return;
    }
    if (!apiKey) {
        alert("Please enter an API key.");
        return;
    }
    if (isBookProcessed) {
        alert("Book already processed. Refresh to start anew.");
        return;
    }

    const loading = document.getElementById("tab1").querySelector("#loading");
    loading.style.display = "block";

    const file = fileInput.files[0];
    const bookText = await file.text();

    // Pre-parse chapters
    novelData.chapters = [];
    const chapterMatches = Array.from(bookText.matchAll(/(\d+)\.\s*"(.+?)"(?=\s*\n|$)/g));
    for (let i = 0; i < chapterMatches.length; i++) {
        const match = chapterMatches[i];
        const start = match.index + match[0].length + 1; // Skip chapter title
        const end = (i + 1 < chapterMatches.length) ? chapterMatches[i + 1].index : bookText.length;
        novelData.chapters.push(bookText.substring(start, end).trim());
    }
    novelData.numChapters = novelData.chapters.length;
    novelData.chapterLength = Math.round(novelData.chapters.reduce((sum, c) => sum + c.split(/\s+/).length, 0) / novelData.numChapters);
    novelData.title = bookTitle;

    // Use chapters as chunks, split if > 15,000 chars
    bookChunks = [];
    for (let i = 0; i < novelData.chapters.length; i++) {
        const chapter = `${i + 1}. "${chapterMatches[i][2]}"\n${novelData.chapters[i]}`;
        if (chapter.length <= 15000) {
            bookChunks.push(chapter);
        } else {
            const subChunks = chunkText(chapter, 15000);
            bookChunks.push(...subChunks);
        }
    }
    console.log(`Book '${bookTitle}' parsed into ${novelData.numChapters} chapters, ${bookChunks.length} chunks.`);
    const avgChunkSize = bookChunks.reduce((sum, c) => sum + c.length, 0) / bookChunks.length;
    console.log(`Average chunk size: ${avgChunkSize} chars (~${Math.round(avgChunkSize / 4)} tokens)`);
    if (avgChunkSize > 15000) {
        console.warn(`Average chunk size (${avgChunkSize} chars) exceeds 15,000-char limit. Some content may be truncated.`);
    }

    try {
        let messages = [{
            role: "system",
            content: `I’m loading a book titled '${bookTitle}' with ${bookChunks.length} chunks (chapters or parts). I’ll provide all chunks next. Use ONLY this book’s content—no improvisation or external references—and build a complete understanding of the narrative. Confirm with: '${bookTitle}'`
        }];
        let response = await callGrokAPI(messages, 200, false);
        if (!response.includes(bookTitle)) throw new Error("Title not confirmed by API.");
        messages.push({ role: "assistant", content: response });

        for (let i = 0; i < bookChunks.length; i++) {
            messages.push({
                role: "user",
                content: `Chunk ${i + 1}/${bookChunks.length} (chapter/part): "${bookChunks[i]}"\nAbsorb this chunk. Confirm with: "Chunk ${i + 1} processed."`
            });
            response = await callGrokAPI(messages, 200, false);
            messages.push({ role: "assistant", content: response });
            if (!response.includes(`Chunk ${i + 1} processed`)) throw new Error(`Chunk ${i + 1} not acknowledged by API.`);
            console.log(`Chunk ${i + 1} sent, response: ${response}`);
        }

        const masterPrompt = `
            Using the full context of '${bookTitle}' (all ${bookChunks.length} chunks), provide the following in a single JSON structure:
            1. Genre: Determine the genre based on the narrative themes and setting.
            2. Story Arc: Extract the main story arc (200-300 words), summarizing the protagonist’s journey and all major turning points.
            3. General Plot: Extract the general plot (300-400 words), detailing all major events and conflicts.
            4. Setting: Extract the setting (200-300 words), describing primary locations and world context.
            5. Characters: Extract ALL main characters, including names, backstories, and arcs.
            6. Subplots: Extract ALL significant subplots as a list, including protagonist’s journey, character arcs, and event-driven threads.
            7. Chapter Outlines: Extract outlines for all ${novelData.numChapters} chapters, summarizing key events.
            8. Chapter Arcs: Extract arcs for all ${novelData.numChapters} chapters, detailing character and plot development.
            9. Author Style: Suggest an author style matching the narrative’s tone and prose ("edgar").
            10. Style Guide: Generate an editable style guide (300-400 words) based on the suggested author.
            Return as JSON:
            {
                "novelData": {
                    "genre": "<genre>",
                    "title": "${bookTitle}",
                    "storyArc": "<arc>",
                    "generalPlot": "<plot>",
                    "setting": "<setting>",
                    "numChapters": ${novelData.numChapters},
                    "chapterLength": ${novelData.chapterLength},
                    "authorStyle": "edgar",
                    "styleGuide": "<guide>",
                    "author": "edgar",
                    "characters": [{"name": "<name>", "backstory": "<backstory>", "arc": "<arc>"}, ...],
                    "subplots": ["<subplot1>", "<subplot2>", ...],
                    "chapterOutlines": ["<chapter1>", "<chapter2>", ...],
                    "chapterArcs": ["<arc1>", "<arc2>", ...],
                    "chapters": [],
                    "requestLog": ""
                }
            }
        `;
        messages.push({ role: "user", content: masterPrompt });
        const fullResponse = await callGrokAPI(messages, 12000, true);

        const parsed = JSON.parse(fullResponse);
        Object.assign(novelData, parsed);

        isBookProcessed = true;
    } catch (error) {
        console.error("Processing error:", error);
        alert("Error: " + error.message);
    }

    populateChaptersTable();
    populateElementsTable();
    generateJSON();
    showTab(2);
    loading.style.display = "none";
};





function populateChaptersTable() {
    const table = document.getElementById("chaptersTable");
    table.innerHTML = "<tr><th>Chapter</th><th>Preview</th></tr>";
    novelData.chapters.forEach((chapter, index) => {
        const row = table.insertRow();
        row.insertCell().textContent = `Chapter ${index + 1}`;
        row.insertCell().textContent = chapter.slice(0, 100) + "...";
    });
}

function populateElementsTable() {
    const table = document.getElementById("elementsTable");
    table.innerHTML = "<tr><th>Field</th><th>Value</th></tr>";
    for (const [key, value] of Object.entries(novelData)) {
        const row = table.insertRow();
        row.insertCell().textContent = key;
        row.insertCell().textContent = typeof value === "object" ? JSON.stringify(value, null, 2) : value;
    }
}

function generateJSON() {
    document.getElementById("jsonOutput").textContent = JSON.stringify(novelData, null, 2);
}

function showTab(tabNumber) {
    document.querySelectorAll(".tabcontent").forEach(tab => tab.classList.remove("active"));
    document.getElementById(`tab${tabNumber}`).classList.add("active");
}