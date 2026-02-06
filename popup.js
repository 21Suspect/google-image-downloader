// Popup Init
document.addEventListener('DOMContentLoaded', () => {
    // Check if running
    chrome.runtime.sendMessage({ action: "get_status" }, (state) => {
        if (state && state.isRunning) {
            showRunningState(state);
            startPolling();
        } else if (state && state.logs.length > 0 && state.logs[state.logs.length - 1] === "All done!") {
            document.getElementById('log').textContent = state.logs.join('\n');
            document.getElementById('log').scrollTop = document.getElementById('log').scrollHeight;
        }
    });
});

document.getElementById('startBtn').addEventListener('click', async () => {
    const list = document.getElementById('buildingList').value.split(';').map(s => s.trim()).filter(Boolean);

    // Collect settings
    const config = {
        folderName: document.getElementById('folderName').value.trim() || "images",
        imageCount: parseInt(document.getElementById('imageCount').value, 10) || 1,
        pageLoadDelay: parseInt(document.getElementById('pageLoadDelay').value, 10) || 2000,
        maxWaitMs: parseInt(document.getElementById('maxWaitMs').value, 10) || 1000
    };

    if (!list.length) {
        alert("Please enter at least one building.");
        return;
    }

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        document.getElementById('log').textContent = "Error: No active tab found.";
        return;
    }

    // Send the task to the background script
    chrome.runtime.sendMessage({
        action: "start_download",
        list: list,
        config: config,
        tabId: tab.id // Pass the current tab ID
    }, (response) => {
        if (chrome.runtime.lastError) {
            document.getElementById('log').textContent = "Error: " + chrome.runtime.lastError.message;
        } else {
            startPolling();
        }
    });
});

function showRunningState(state) {
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = true;
    startBtn.textContent = "Running in Background...";

    if (state.logs) {
        const logDiv = document.getElementById('log');
        logDiv.textContent = state.logs.join('\n');
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    const progressFill = document.getElementById('progressFill');
    if (state.total > 0) {
        progressFill.style.width = `${(state.progress / state.total) * 100}%`;
    }
}

function startPolling() {
    const interval = setInterval(() => {
        chrome.runtime.sendMessage({ action: "get_status" }, (state) => {
            if (!state || !state.isRunning) {
                clearInterval(interval);
                document.getElementById('startBtn').disabled = false;
                document.getElementById('startBtn').textContent = "Start Visual Download";
                if (state) showRunningState(state);
                return;
            }
            showRunningState(state);
        });
    }, 1000);
}
