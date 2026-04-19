let bookChunks = [];
let novelData = {
    genre: "",
    title: "",
    storyArc: "",
    generalPlot: "",
    setting: "",
    numChapters: 0,
    chapterLength: 0,
    authorStyle: "",
    styleGuide: "",
    author: "",
    characters: [],
    subplots: [],
    chapterBlueprints: [],
    chapterOutlines: [],
    chapterArcs: [],
    chapters: [],
    editedChapters: [],
    bookText: "",
    outlineImprovements: "",
    bookImprovementsWithStatus: [],
    requestLog: {
        lastPrompt: "",
        status: "",
        returnedInfo: "",
        tokenUsage: "",
        cost: "",
        originTab: null
    }
};
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

function parseModelJSONResponse(rawText) {
    if (typeof rawText !== "string" || !rawText.trim()) {
        return null;
    }

    const attempts = [];
    attempts.push(rawText.trim());
    attempts.push(rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim());

    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        attempts.push(rawText.slice(firstBrace, lastBrace + 1).trim());
    }

    for (const candidate of attempts) {
        try {
            return JSON.parse(candidate);
        } catch (e) {
            // Try next candidate.
        }
    }

    return null;
}

async function callGrokAPI(messages, maxTokens, isJSON) {
    const apiKey = document.getElementById("apiKey").value.trim();
    const selectedModel = document.getElementById("model")?.value || "grok-4.20-0309-reasoning";
    const customModel = document.getElementById("customModel")?.value.trim() || "";
    const model = selectedModel === "custom" ? customModel : selectedModel;
    const useResponsesAPI = model.includes("multi-agent");

    if (!model) {
        throw new Error("Please select a model or enter a custom model name.");
    }

    try {
        const endpoint = useResponsesAPI
            ? "https://api.x.ai/v1/responses"
            : "https://api.x.ai/v1/chat/completions";

        const payload = useResponsesAPI
            ? {
                model: model,
                input: messages.map((m) => `${m.role}: ${m.content}`).join("\n\n"),
                max_output_tokens: maxTokens,
                temperature: 0.65,
                text: isJSON ? { format: { type: "json_object" } } : undefined
            }
            : {
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.65,
                response_format: isJSON ? { type: "json_object" } : undefined
            };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (useResponsesAPI) {
            if (typeof data.output_text === "string" && data.output_text.length > 0) {
                return data.output_text;
            }

            if (Array.isArray(data.output)) {
                const extractedText = data.output
                    .flatMap(item => Array.isArray(item.content) ? item.content : [])
                    .filter(contentItem => contentItem.type === "output_text" && typeof contentItem.text === "string")
                    .map(contentItem => contentItem.text)
                    .join("\n")
                    .trim();

                if (extractedText) {
                    return extractedText;
                }
            }

            throw new Error("Invalid responses API payload: missing output text.");
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid chat completions response: missing choices or message.");
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

    // Reset schema object for a fresh run and pre-parse chapters.
    novelData = {
        ...novelData,
        genre: "",
        title: "",
        storyArc: "",
        generalPlot: "",
        setting: "",
        numChapters: 0,
        chapterLength: 0,
        authorStyle: "",
        styleGuide: "",
        author: "",
        characters: [],
        subplots: [],
        chapterBlueprints: [],
        chapterOutlines: [],
        chapterArcs: [],
        chapters: [],
        editedChapters: [],
        bookText: bookText,
        outlineImprovements: "",
        bookImprovementsWithStatus: [],
        requestLog: {
            lastPrompt: "",
            status: "",
            returnedInfo: "",
            tokenUsage: "",
            cost: "",
            originTab: null
        }
    };

    const chapterMatches = Array.from(bookText.matchAll(/(\d+)\.\s*"(.+?)"(?=\s*\n|$)/g));
    for (let i = 0; i < chapterMatches.length; i++) {
        const match = chapterMatches[i];
        const start = match.index + match[0].length + 1; // Skip chapter title
        const end = (i + 1 < chapterMatches.length) ? chapterMatches[i + 1].index : bookText.length;
        novelData.chapters.push(bookText.substring(start, end).trim());
    }

    // Fallback: if chapter markers are not detected, treat whole text as one chapter.
    if (novelData.chapters.length === 0 && bookText.trim()) {
        novelData.chapters = [bookText.trim()];
    }

    novelData.numChapters = novelData.chapters.length;
    novelData.chapterLength = novelData.numChapters > 0
        ? Math.round(novelData.chapters.reduce((sum, c) => sum + c.split(/\s+/).length, 0) / novelData.numChapters)
        : 0;
    novelData.title = bookTitle;
    novelData.editedChapters = Array(novelData.numChapters).fill(null);

    // Use chapters as chunks, split if > 15,000 chars
    bookChunks = [];
    for (let i = 0; i < novelData.chapters.length; i++) {
        const chapterTitle = chapterMatches[i] ? chapterMatches[i][2] : `Chapter ${i + 1}`;
        const chapter = `${i + 1}. "${chapterTitle}"\n${novelData.chapters[i]}`;
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
            content: `I’m loading a book titled '${bookTitle}' with ${bookChunks.length} chunks (chapters or parts). I’ll provide all chunks next. Use ONLY this book’s content (no external references) and build a complete understanding of the narrative. In the final extraction, do not leave core narrative fields empty without an explicit reason. Confirm with: '${bookTitle}'`
        }];
        let response = await callGrokAPI(messages, 200, false);
        if (!response.includes(bookTitle)) {
            console.warn("Title was not explicitly echoed by model; continuing with chunk loading.");
        }
        messages.push({ role: "assistant", content: response });

        for (let i = 0; i < bookChunks.length; i++) {
            messages.push({
                role: "user",
                content: `Chunk ${i + 1}/${bookChunks.length} (chapter/part): "${bookChunks[i]}"\nAbsorb this chunk. Confirm with: "Chunk ${i + 1} processed."`
            });
            response = await callGrokAPI(messages, 200, false);
            messages.push({ role: "assistant", content: response });
            if (!response.includes(`Chunk ${i + 1} processed`)) {
                console.warn(`Chunk ${i + 1} was not explicitly acknowledged; continuing.`);
            }
            console.log(`Chunk ${i + 1} sent, response: ${response}`);
        }

                const masterPrompt = `
                        Using the full context of '${bookTitle}' (all ${bookChunks.length} chunks), return ONE JSON object only.

                        Extraction goals:
                        1. Genre: Determine genre from the source text.
                        2. Story Arc: 200-300 words on the central narrative movement and major turning points.
                        3. General Plot: 300-400 words on major events/conflicts.
                        4. Setting: 200-300 words describing world/location context.
                        5. Characters: Main cast with name, backstory, and arc.
                        6. Subplots: Significant secondary threads. If no clear subplot exists, include one explicit explanatory item instead of returning an empty list.
                        7. Chapter Outlines: EXACTLY ${novelData.numChapters} items, one per chapter.
                        8. Chapter Arcs: EXACTLY ${novelData.numChapters} items, one per chapter.
                        9. Author Style + Style Guide: best-fit prose profile and editable style guide.

                        Quality rules:
                        - For fiction-like narratives, treat characters, storyArc, generalPlot, setting, chapterOutlines, and chapterArcs as required analytical outputs.
                        - Do not leave critical fields blank. If evidence is weak, provide best-effort extraction plus a brief caveat sentence.
                        - Use only evidence from the provided book text.
                        - Keep JSON valid and machine-readable.

                        Return as JSON with this shape:
                        {
                            "novelData": {
                                "genre": "<genre>",
                                "title": "${bookTitle}",
                                "storyArc": "<non-empty story arc or explicit rationale>",
                                "generalPlot": "<non-empty plot or explicit rationale>",
                                "setting": "<non-empty setting description or explicit rationale>",
                                "numChapters": ${novelData.numChapters},
                                "chapterLength": ${novelData.chapterLength},
                                "authorStyle": "edgar",
                                "styleGuide": "<style guide>",
                                "author": "edgar",
                                "characters": [{"name": "<name>", "backstory": "<backstory>", "arc": "<arc>"}],
                                "subplots": ["<subplot or explicit 'no distinct subplot' rationale>"],
                                "chapterOutlines": ["<exactly ${novelData.numChapters} chapter-outline items>"],
                                "chapterArcs": ["<exactly ${novelData.numChapters} chapter-arc items>"],
                                "chapters": ["<chapter1 text>", "<chapter2 text>", ...],
                                "editedChapters": [],
                                "bookText": "<full book text>",
                                "outlineImprovements": "",
                                "bookImprovementsWithStatus": [],
                                "requestLog": {"lastPrompt": "", "status": "", "returnedInfo": "", "tokenUsage": "", "cost": "", "originTab": null}
                            }
                        }
                `;
        messages.push({ role: "user", content: masterPrompt });
        const fullResponse = await callGrokAPI(messages, 12000, true);

        const parsed = parseModelJSONResponse(fullResponse);
        if (!parsed) {
            throw new Error("Model returned invalid JSON for extraction output.");
        }
        const parsedNovelData = parsed.novelData && typeof parsed.novelData === "object" ? parsed.novelData : parsed;
        const preservedChapters = [...novelData.chapters];
        const preservedEditedChapters = [...novelData.editedChapters];
        const preservedBookText = novelData.bookText;

        novelData = {
            ...novelData,
            ...parsedNovelData,
            // Preserve source-of-truth chapter content from local parse.
            chapters: preservedChapters,
            editedChapters: Array.isArray(parsedNovelData.editedChapters)
                ? parsedNovelData.editedChapters
                : preservedEditedChapters,
            bookText: preservedBookText,
            numChapters: preservedChapters.length,
            chapterLength: preservedChapters.length > 0
                ? Math.round(preservedChapters.reduce((sum, c) => sum + c.split(/\s+/).length, 0) / preservedChapters.length)
                : 0,
            title: bookTitle,
            requestLog: {
                ...(novelData.requestLog || {}),
                ...(parsedNovelData.requestLog && typeof parsedNovelData.requestLog === "object" ? parsedNovelData.requestLog : {})
            }
        };

        isBookProcessed = true;
    } catch (error) {
        console.error("Processing error:", error);
        novelData.requestLog = {
            ...(novelData.requestLog || {}),
            status: "error",
            returnedInfo: error.message,
            originTab: "tab1"
        };
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
    const payload = {
        schemaVersion: "1.0",
        sourceTool: "BookDecomposer",
        sourceVersion: "0.2.0",
        novelData: novelData
    };
    document.getElementById("jsonOutput").textContent = JSON.stringify(payload, null, 2);
}

function buildSchemaPayload() {
    return {
        schemaVersion: "1.0",
        sourceTool: "BookDecomposer",
        sourceVersion: "0.2.0",
        novelData: novelData
    };
}

window.exportJSON = function() {
    const payload = buildSchemaPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bookdecomposer-output.json";
    link.click();
};

window.importJSON = function() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const raw = JSON.parse(e.target.result);
                const incoming = raw && raw.novelData && typeof raw.novelData === "object" ? raw.novelData : raw;
                if (!incoming || typeof incoming !== "object") {
                    throw new Error("Invalid JSON structure.");
                }

                novelData = {
                    ...novelData,
                    ...incoming,
                    characters: Array.isArray(incoming.characters) ? incoming.characters : (novelData.characters || []),
                    subplots: Array.isArray(incoming.subplots) ? incoming.subplots : (novelData.subplots || []),
                    chapterOutlines: Array.isArray(incoming.chapterOutlines) ? incoming.chapterOutlines : (novelData.chapterOutlines || []),
                    chapterArcs: Array.isArray(incoming.chapterArcs) ? incoming.chapterArcs : (novelData.chapterArcs || []),
                    chapters: Array.isArray(incoming.chapters) ? incoming.chapters : (novelData.chapters || []),
                    editedChapters: Array.isArray(incoming.editedChapters) ? incoming.editedChapters : (novelData.editedChapters || []),
                    bookImprovementsWithStatus: Array.isArray(incoming.bookImprovementsWithStatus)
                        ? incoming.bookImprovementsWithStatus
                        : (novelData.bookImprovementsWithStatus || []),
                    requestLog: {
                        ...(novelData.requestLog || {}),
                        ...(incoming.requestLog && typeof incoming.requestLog === "object" ? incoming.requestLog : {})
                    }
                };

                document.getElementById("title").value = novelData.title || "";
                populateChaptersTable();
                populateElementsTable();
                generateJSON();
                isBookProcessed = true;
                showTab(4);
            } catch (error) {
                alert("Error importing JSON: " + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

function showTab(tabNumber) {
    document.querySelectorAll(".tabcontent").forEach(tab => tab.classList.remove("active"));
    document.getElementById(`tab${tabNumber}`).classList.add("active");
}

window.toggleCustomModelInput = function() {
    const model = document.getElementById("model");
    const customLabel = document.getElementById("customModelLabel");
    const customInput = document.getElementById("customModel");
    const showCustom = model && model.value === "custom";

    if (customLabel) {
        customLabel.style.display = showCustom ? "block" : "none";
    }
    if (customInput) {
        customInput.style.display = showCustom ? "block" : "none";
        if (!showCustom) {
            customInput.value = "";
        }
    }
};
