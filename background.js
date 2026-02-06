// State tracking
let appState = {
    isRunning: false,
    logs: [],
    progress: 0,
    total: 0
};

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_download") {
        if (!appState.isRunning) {
            appState.isRunning = true;
            appState.logs = ["Job started..."];
            appState.progress = 0;
            appState.total = request.list.length;
            processQueue(request.list, request.config, request.tabId);
        }
        sendResponse({ status: "started" });
    } else if (request.action === "get_status") {
        sendResponse(appState);
    }
    return true; // Keep channel open
});

function log(msg) {
    appState.logs.push(msg);
    // Keep log size manageable
    if (appState.logs.length > 50) appState.logs.shift();
}

async function processQueue(list, config, tabId) {
    let activeTabId = tabId;

    if (!activeTabId) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            activeTabId = tab ? tab.id : (await chrome.tabs.create({ url: 'about:blank' })).id;
        } catch (e) {
            log("Error finding tab: " + e.message);
            appState.isRunning = false;
            return;
        }
    }

    const folder = (config.folderName || "images").replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeConfig = JSON.parse(JSON.stringify(config));

    for (let i = 0; i < list.length; i++) {
        appState.progress = i;
        const building = list[i];
        log(`[${i + 1}/${list.length}] Searching: ${building}`);

        // URL with Large + Wide filters
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(building)}&udm=2&tbs=isz:l,iar:w`;

        try {
            await chrome.tabs.update(activeTabId, { url: searchUrl });

            // SMART LOAD: Wait for 'complete', then barely wait.
            // We delegate "waiting for results" to the script for max speed.
            await new Promise(resolve => {
                const listener = (tid, info) => {
                    if (tid === activeTabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });

            // Execute Scraper
            const results = await chrome.scripting.executeScript({
                target: { tabId: activeTabId },
                func: interactAndScrape,
                args: [safeConfig]
            });

            if (results && results[0] && results[0].result) {
                const resultData = results[0].result;
                if (resultData.logs) resultData.logs.forEach(l => log(`   [PG] ${l}`));

                const foundImages = resultData.urls || [];
                if (foundImages.length > 0) {
                    log(`   -> Downloading ${foundImages.length} images.`);
                    let count = 1;
                    for (const url of foundImages) {
                        const cleanName = building.replace(/[^a-zA-Z0-9]/g, '');
                        chrome.downloads.download({
                            url: url,
                            filename: `${folder}/${cleanName}_${count}.jpg`,
                            conflictAction: 'overwrite'
                        });
                        count++;
                    }
                } else {
                    log(`   -> No suitable images found (Strict Mode).`);
                }
            }
        } catch (e) {
            log(`   -> Error: ${e.message}`);
        }
    }

    log("All done!");
    appState.isRunning = false;
}

// Logic injected into the page
async function interactAndScrape(config) {
    const outputLogs = [];
    const collectedUrls = [];
    const internalLog = (msg) => { console.log(msg); outputLogs.push(msg); };
    const delay = ms => new Promise(res => setTimeout(res, ms));

    // Settings
    const targetCount = config.imageCount || 1;
    const maxWait = config.maxWaitMs || 5000;
    const STRICT_MIN_WIDTH = 1200; // Only accept > 1200px width
    const ABSOLUTE_MIN_WIDTH = 800; // Fallback only if > 800px

    // 1. Wait for Content (replace PageLoadDelay)
    internalLog("Waiting for results...");
    let candidates = [];
    const loadStart = Date.now();

    while ((Date.now() - loadStart) < 5000) {
        // Look for images that look like search results
        const allImgs = Array.from(document.querySelectorAll('img'));
        candidates = allImgs.filter(img => {
            const rect = img.getBoundingClientRect();
            // Visible and standard thumbnail size
            return rect.top > 140 && rect.width > 100 && rect.height > 80;
        });

        if (candidates.length >= 3) break; // Found enough content
        await delay(100);
    }

    internalLog(`Content loaded. Candidates: ${candidates.length}`);

    // De-duplicate
    const distinctCandidates = [];
    for (const img of candidates) {
        if (distinctCandidates.length >= targetCount) break;
        const rect = img.getBoundingClientRect();
        const isDuplicate = distinctCandidates.some(c => {
            const cr = c.getBoundingClientRect();
            return Math.abs(cr.top - rect.top) < 50 && Math.abs(cr.left - rect.left) < 50;
        });
        if (!isDuplicate) distinctCandidates.push(img);
    }

    for (const thumb of distinctCandidates) {
        thumb.style.outline = "5px solid magenta";
        thumb.scrollIntoView({ block: "center", behavior: "smooth" });

        // Click
        ['mousedown', 'click', 'mouseup'].forEach(evt =>
            thumb.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }))
        );
        const parent = thumb.closest('a');
        if (parent) parent.click();

        // POLL FOR HIGH RES
        const startTime = Date.now();
        let foundUrl = null;
        let bestCandidate = null;

        while ((Date.now() - startTime) < maxWait) {
            const currentImages = Array.from(document.querySelectorAll('img'));

            // Find valid images (not thumbnails)
            const valid = currentImages.filter(i => {
                const r = i.getBoundingClientRect();
                return i.src && i.src.startsWith('http') && i !== thumb && i.src !== thumb.src &&
                    r.width > 300 && r.height > 200 && i.naturalWidth > 0;
            });

            // Identify best quality available right now
            if (valid.length > 0) {
                // Sort by resolution
                valid.sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
                const currentBest = valid[0];

                if (!bestCandidate || (currentBest.naturalWidth > bestCandidate.naturalWidth)) {
                    bestCandidate = currentBest;
                }

                // SPEED CHECK: If we found a great one, grab it immediately
                if (currentBest.naturalWidth >= STRICT_MIN_WIDTH) {
                    currentBest.style.outline = "5px solid #00ff00";
                    foundUrl = currentBest.src;
                    internalLog(`HD Found! [${currentBest.naturalWidth}px]`);
                    break;
                }
            }
            await delay(50); // Fast polling
        }

        if (foundUrl) {
            collectedUrls.push(foundUrl);
        } else if (bestCandidate && bestCandidate.naturalWidth >= ABSOLUTE_MIN_WIDTH) {
            // Fallback: Timeout reached, but we have a decent image
            bestCandidate.style.outline = "5px solid yellow";
            internalLog(`Timeout. Taking best available: [${bestCandidate.naturalWidth}px]`);
            collectedUrls.push(bestCandidate.src);
        } else {
            thumb.style.outline = "5px solid red";
            internalLog(`Skipped: Best image was too small (<${ABSOLUTE_MIN_WIDTH}px).`);
        }
    }

    return { logs: outputLogs, urls: [...new Set(collectedUrls)] };
}
