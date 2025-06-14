// Global variables
let isRunning = false;
let usernameType = null;
let checkedCount = 0;
let availableCount = 0;
let availableUsernames = [];
let fileUsernames = [];
let uploadedFiles = [];
let selectedFileIndex = -1;
let checkingInterval = null;
let startTime = null;
let testedUsernames = new Set();

// Discord-specific variables
let discordIsRunning = false;
let discordUsernameType = null;
let discordCheckedCount = 0;
let discordAvailableCount = 0;
let discordAvailableUsernames = [];
let discordFileUsernames = [];
let discordUploadedFiles = []; // Store multiple Discord files
let discordSelectedFileIndex = -1; // Currently selected Discord file
let discordManualUsernames = [];
let discordStartTime = null;
let discordTestedUsernames = new Set();

// Add after existing global variables
let usernameMetadata = []; // Store metadata for each username
let currentFilter = 'date';


// Discord username generation functions
function generateDiscordShortUsername(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure it doesn't start or end with underscore
    result = result.replace(/^_+|_+$/g, '');
    if (result.length < length) {
        result += 'a'.repeat(length - result.length);
    }
    return result;
}

function setDiscordUsernameType(type) {
    discordUsernameType = type;
    appendToDiscordConsole(`Username type set to: ${type}`, 'info');
    
    // Update button styles
    const buttons = document.querySelectorAll('#discord-tab .button-group .discord-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    showNotification(`Discord username type set to ${type}`, 'success');
}

function handleDiscordFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
        // Check if file with same name already exists
        const existingFile = discordUploadedFiles.find(f => f.name === file.name);
        if (existingFile) {
            appendToDiscordConsole(`File "${file.name}" is already uploaded`, 'warning');
            showNotification(`Discord file "${file.name}" is already uploaded`, 'warning');
            event.target.value = ''; // Clear the input
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result.trim();
            if (!content) {
                appendToDiscordConsole('File is empty', 'error');
                showNotification('File is empty', 'error');
                return;
            }
            
            const usernames = content.split('\n')
                .map(name => name.trim())
                .filter(name => name !== '' && name.length >= 1 && name.length <= 32);
            
            if (usernames.length === 0) {
                appendToDiscordConsole('No valid usernames found in file', 'error');
                showNotification('No valid Discord usernames found in file', 'error');
                return;
            }
            
            // Add to Discord uploaded files array
            const fileData = {
                name: file.name,
                usernames: usernames,
                originalCount: usernames.length,
                remainingCount: usernames.length
            };
            
            discordUploadedFiles.push(fileData);
            updateDiscordFileSelector();
            
            appendToDiscordConsole(`Added file: ${file.name} with ${usernames.length} valid usernames`, 'success');
            showNotification(`Added ${usernames.length} Discord usernames from ${file.name}`, 'success');
        };
        reader.readAsText(file);
    } else {
        appendToDiscordConsole('Please select a valid text file', 'error');
        showNotification('Invalid file type', 'error');
    }
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
}



function appendToDiscordConsole(message, type = 'info') {
    const console = document.getElementById('discord-console');
    const messageDiv = document.createElement('div');
    messageDiv.className = `console-message ${type}`;
    
    const icon = getIconForType(type);
    messageDiv.innerHTML = `<i class="${icon}"></i>[${new Date().toLocaleTimeString()}] ${message}`;
    
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
    
    // Limit console messages
    if (console.children.length > 1000) {
        console.removeChild(console.firstChild);
    }
}

function clearDiscordConsole() {
    document.getElementById('discord-console').innerHTML = '';
    appendToDiscordConsole('Console cleared', 'info');
}

async function checkDiscordUsername(username, authToken) {
    if (discordTestedUsernames.has(username)) {
        appendToDiscordConsole(`Skipping already tested username: ${username}`, 'warning');
        return false;
    }
    
    discordTestedUsernames.add(username);
    
    try {
        const response = await fetch('https://discord.com/api/v9/users/@me/pomelo-attempt', {
            method: 'POST',
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({ username: username })
        });
        
        if (response.ok) {
            const data = await response.json();
            const isAvailable = !data.taken;
            
            if (isAvailable) {
                appendToDiscordConsole(`✓ ${username} is available!`, 'success');
                addDiscordAvailableUsername(username);
                return true;
            } else {
                appendToDiscordConsole(`✗ ${username} is taken`, 'error');
                return false;
            }
        } else {
            appendToDiscordConsole(`API Error for ${username}: ${response.status}`, 'error');
            return false;
        }
    } catch (error) {
        appendToDiscordConsole(`Error checking ${username}: ${error.message}`, 'error');
        return false;
    }
}

function addDiscordAvailableUsername(username, showNotifications = true) {
    if (discordAvailableUsernames.includes(username)) return;
    
    discordAvailableUsernames.push(username);
    const listDiv = document.getElementById('discord-available-usernames');
    
    // Remove empty state
    const emptyState = listDiv.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username-item';
    usernameDiv.innerHTML = `
        <span class="username-text">${username}</span>
        <button class="copy-btn" onclick="copyUsername('${username}')" title="Copy username">
            <i class="fas fa-copy"></i>
        </button>
    `;
    listDiv.appendChild(usernameDiv);
    
    discordAvailableCount++;
    updateDiscordStats();
    
    // Play notification sound if enabled
        // Only show notifications for new finds, not when loading from storage
    if (showNotifications) {
        // Play notification sound if enabled
        if (document.getElementById('sound-notifications') && document.getElementById('sound-notifications').checked) {
            playNotificationSound();
        }
        
        showNotification(`Found available Discord username: ${username}`, 'success');
    }

}

function updateDiscordStats() {
    document.getElementById('discord-checked-count').textContent = discordCheckedCount;
    document.getElementById('discord-available-count').textContent = discordAvailableCount;
    document.getElementById('discord-status').textContent = discordIsRunning ? 'Running...' : 'Ready';
    
    // Calculate rate
    if (discordStartTime && discordCheckedCount > 0) {
        const elapsed = (Date.now() - discordStartTime) / 1000 / 60; // minutes
        const rate = Math.round(discordCheckedCount / elapsed);
        document.getElementById('discord-rate').textContent = `${rate}/min`;
    } else {
        document.getElementById('discord-rate').textContent = '0/min';
    }
}

async function performDiscordCheck() {
    if (!discordIsRunning) return;
    
    const authToken = document.getElementById('discord-auth-token').value.trim();
    if (!authToken) {
        appendToDiscordConsole('Authorization token is required', 'error');
        stopDiscordChecking();
        return;
    }
    
    let username;
    const length = parseInt(document.getElementById('discord-length').value) || 3;
    
    // Generate username based on type
    if (discordUsernameType === 'short') {
        username = generateDiscordShortUsername(length);
    } else if (discordUsernameType === 'file') {
    if (discordSelectedFileIndex === -1) {
        appendToDiscordConsole('Please select a Discord file first', 'error');
        stopDiscordChecking();
        return;
    }
    
    if (discordFileUsernames.length === 0) {
        appendToDiscordConsole('No more usernames in selected Discord file to check', 'warning');
        stopDiscordChecking();
        return;
    }
    
    username = discordFileUsernames.shift();
    
    // Update the remaining count in the uploaded Discord file
    if (discordUploadedFiles[discordSelectedFileIndex]) {
        discordUploadedFiles[discordSelectedFileIndex].remainingCount = discordFileUsernames.length;
        updateDiscordFileSelector();
    }

    } else if (discordUsernameType === 'manual') {
        if (discordManualUsernames.length === 0) {
            // Get manual usernames from textarea
            const manualText = document.getElementById('discord-manual').value.trim();
            if (!manualText) {
                appendToDiscordConsole('No manual usernames provided', 'warning');
                stopDiscordChecking();
                return;
            }
            discordManualUsernames = manualText.split('\n')
                .map(name => name.trim())
                .filter(name => name !== '');
        }
        
        if (discordManualUsernames.length === 0) {
            appendToDiscordConsole('No more manual usernames to check', 'warning');
            stopDiscordChecking();
            return;
        }
        username = discordManualUsernames.shift();
    } else {
        appendToDiscordConsole('Please select a username type first', 'error');
        stopDiscordChecking();
        return;
    }
    
    if (discordTestedUsernames.has(username)) {
        setTimeout(performDiscordCheck, 50);
        return;
    }
    
    appendToDiscordConsole(`Checking: ${username}`, 'info');
    await checkDiscordUsername(username, authToken);
    
    discordCheckedCount++;
    updateDiscordStats();
    
    // Continue checking after delay
    if (discordIsRunning) {
        const delay = parseInt(document.getElementById('discord-delay').value) || 1000;
        setTimeout(performDiscordCheck, delay);
    }
}

function startDiscordChecking() {
    const authToken = document.getElementById('discord-auth-token').value.trim();
    if (!authToken) {
        appendToDiscordConsole('Please enter your Discord authorization token', 'error');
        showNotification('Discord auth token required', 'error');
        return;
    }
    
    if (!discordUsernameType) {
        appendToDiscordConsole('Please select a username type first', 'error');
                showNotification('Please select a username type', 'error');
        return;
    }
    
    if (discordUsernameType === 'file' && discordFileUsernames.length === 0) {
        appendToDiscordConsole('Please upload a file with usernames first', 'error');
        showNotification('Please upload a file first', 'error');
        return;
    }
    
    if (discordUsernameType === 'manual') {
        const manualText = document.getElementById('discord-manual').value.trim();
        if (!manualText) {
            appendToDiscordConsole('Please enter usernames in the manual list', 'error');
            showNotification('Please enter manual usernames', 'error');
            return;
        }
    }
    
    const length = parseInt(document.getElementById('discord-length').value);
    if (discordUsernameType === 'short' && (length < 1 || length > 5)) {
        appendToDiscordConsole('Please enter a valid length between 1 and 5', 'error');
        showNotification('Invalid username length', 'error');
        return;
    }
    
    discordIsRunning = true;
    discordStartTime = Date.now();
    document.getElementById('discord-start-button').disabled = true;
    document.getElementById('discord-stop-button').disabled = false;
    
    appendToDiscordConsole('Starting Discord username checker...', 'success');
    showNotification('Discord username checker started', 'success');
    updateDiscordStats();
    
    // Initialize empty state for available usernames if needed
    const availableList = document.getElementById('discord-available-usernames');
    if (availableList.children.length === 0) {
        availableList.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No available usernames found yet...</p></div>';
    }
    
    performDiscordCheck();
}

function stopDiscordChecking() {
    discordIsRunning = false;
    document.getElementById('discord-start-button').disabled = false;
    document.getElementById('discord-stop-button').disabled = true;
    
    appendToDiscordConsole('Discord username checker stopped', 'warning');
    showNotification('Discord username checker stopped', 'warning');
    updateDiscordStats();
}

function downloadDiscordResults() {
    if (discordAvailableUsernames.length === 0) {
        appendToDiscordConsole('No available Discord usernames to download', 'warning');
        showNotification('No Discord usernames to download', 'warning');
        return;
    }
    
    const content = discordAvailableUsernames.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `available_discord_usernames_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    appendToDiscordConsole(`Downloaded ${discordAvailableUsernames.length} available Discord usernames`, 'success');
    showNotification(`Downloaded ${discordAvailableUsernames.length} Discord usernames`, 'success');
}

function clearDiscordData() {
    try {
        // Reset all Discord variables
        discordAvailableUsernames = [];
        discordTestedUsernames = new Set();
        discordCheckedCount = 0;
        discordAvailableCount = 0;
        discordFileUsernames = [];
        discordManualUsernames = [];
        
        // Clear the UI
        document.getElementById('discord-available-usernames').innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No available usernames found yet...</p></div>';
        document.getElementById('discord-manual').value = '';
        document.getElementById('discord-file-info').style.display = 'none';
        
        // Reset file input
        document.getElementById('discord-file').value = '';
        
        updateDiscordStats();
        appendToDiscordConsole('All Discord data cleared', 'info');
        showNotification('Discord data cleared', 'info');
    } catch (error) {
        console.log('Could not clear Discord data:', error);
        appendToDiscordConsole('Error clearing Discord data', 'error');
    }
}

// Local storage functions for Discord
function saveDiscordToLocalStorage() {
    try {
        localStorage.setItem('discordAvailableUsernames', JSON.stringify(discordAvailableUsernames));
        localStorage.setItem('discordTestedUsernames', JSON.stringify([...discordTestedUsernames]));
        localStorage.setItem('discordCheckedCount', discordCheckedCount.toString());
        localStorage.setItem('discordAvailableCount', discordAvailableCount.toString());
    } catch (error) {
        console.log('Could not save Discord data to localStorage:', error);
    }
}

function loadDiscordFromLocalStorage() {
    try {
        const saved = localStorage.getItem('discordAvailableUsernames');
        if (saved) {
            const usernames = JSON.parse(saved);
            usernames.forEach(username => addDiscordAvailableUsername(username, false)); // Don't show notifications when loading
        }

        
        const savedTested = localStorage.getItem('discordTestedUsernames');
        if (savedTested) {
            const tested = JSON.parse(savedTested);
            discordTestedUsernames = new Set(tested);
        }
        
        const savedChecked = localStorage.getItem('discordCheckedCount');
        if (savedChecked) {
            discordCheckedCount = parseInt(savedChecked);
        }
        
        const savedAvailable = localStorage.getItem('discordAvailableCount');
        if (savedAvailable) {
            discordAvailableCount = parseInt(savedAvailable);
        }
        
        updateDiscordStats();
    } catch (error) {
        console.log('Could not load Discord data from localStorage:', error);
    }
}

// Update the main DOMContentLoaded event listener to include Discord initialization
document.addEventListener('DOMContentLoaded', async function() {
    updateStats();
    loadFromLocalStorage();
    
    // Load uploaded files from localStorage
    loadFilesFromLocalStorage();
    loadDiscordFilesFromLocalStorage();
    
    // Load Discord data
    loadDiscordFromLocalStorage();
    updateDiscordStats();
    
    appendToConsole('Roblox Username Checker initialized', 'success');
    appendToDiscordConsole('Discord Username Checker initialized', 'success');
    
    // Existing Electron/Python setup code...
    if (typeof require !== 'undefined') {
        try {
            const { ipcRenderer } = require('electron');
            const moduleExists = await ipcRenderer.invoke('check-python-module');
            
            if (!moduleExists) {
                appendToConsole('Creating Python module...', 'info');
                await ipcRenderer.invoke('create-python-module');
                appendToConsole('Python module created successfully!', 'success');
            } else {
                appendToConsole('Python module found!', 'success');
            }
            
            appendToConsole('Ready to make real API requests!', 'success');
        } catch (error) {
            appendToConsole('Error setting up Python module: ' + error.message, 'error');
            appendToConsole('Falling back to simulation mode', 'warning');
        }
    } else {
        appendToConsole('Note: This demo simulates API responses due to CORS restrictions', 'warning');
        appendToConsole('Use Electron version for real API requests', 'info');
    }
});


// Update the beforeunload event to save Discord data
window.addEventListener('beforeunload', function(e) {
    if (isRunning || discordIsRunning) {
        e.preventDefault();
        e.returnValue = 'Username checking is still running. Are you sure you want to leave?';
        return e.returnValue;
    }
    
    // Save both Roblox and Discord state
    saveToLocalStorage();
    saveDiscordToLocalStorage();
    
    // Save uploaded files
    saveFilesToLocalStorage();
    saveDiscordFilesToLocalStorage();
});


// Update keyboard shortcuts to include Discord
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        // Check which tab is active
        const activeTab = document.querySelector('.tab-content.active');
        const isDiscordTab = activeTab && activeTab.id === 'discord-tab';
        
        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                if (isDiscordTab) {
                    if (!discordIsRunning) {
                        startDiscordChecking();
                    } else {
                        stopDiscordChecking();
                    }
                } else {
                    if (!isRunning) {
                        startChecking();
                    } else {
                        stopChecking();
                    }
                }
                break;
            case 's':
                e.preventDefault();
                if (isDiscordTab) {
                    if (discordAvailableUsernames.length > 0) {
                        downloadDiscordResults();
                    }
                } else {
                    if (availableUsernames.length > 0) {
                        downloadResults();
                    }
                }
                break;
            case 'l':
                e.preventDefault();
                if (isDiscordTab) {
                    clearDiscordConsole();
                } else {
                    clearConsole();
                }
                break;
        }
    }
});

// URL template for username validation
const urlTemplate = "https://auth.roblox.com/v1/usernames/validate?Username={}&Birthday=1999-12-31T23:00:00.000Z";

// Add this to your existing global variables section
let normalUsernamesPool = [];
let originalUsernames = [];

// Add this new function for generating normal username variations
function generateNormalUsername() {
    if (originalUsernames.length === 0) {
        appendToConsole('No usernames loaded for normal generation', 'error');
        return null;
    }
    
    // Pick a random username from the original list
    const baseUsername = originalUsernames[Math.floor(Math.random() * originalUsernames.length)];
    
    // Array of modification strategies
    const modifications = [
        // Add numbers at the end
        () => baseUsername + Math.floor(Math.random() * 999),
        () => baseUsername + Math.floor(Math.random() * 99),
        () => baseUsername + Math.floor(Math.random() * 9999),
        
        // Add common suffixes
        () => baseUsername + ['_', 'x', 'z', 'pro', 'gamer', '123', '456', '789'][Math.floor(Math.random() * 8)],
        
        // Replace similar looking characters
        () => baseUsername.replace(/o/gi, '0').replace(/i/gi, '1').replace(/s/gi, '5'),
        () => baseUsername.replace(/a/gi, '@').replace(/e/gi, '3').replace(/o/gi, '0'),
        
        // Add underscores or dots
        () => baseUsername.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
        () => baseUsername + '_' + Math.floor(Math.random() * 99),
        
        // Capitalize variations
        () => baseUsername.charAt(0).toUpperCase() + baseUsername.slice(1).toLowerCase(),
        () => baseUsername.toLowerCase(),
        () => baseUsername.toUpperCase(),
        
        // Add prefixes
        () => ['the', 'real', 'im', 'its', 'mr', 'ms'][Math.floor(Math.random() * 6)] + baseUsername,
        () => ['x', 'z', 'i'][Math.floor(Math.random() * 3)] + baseUsername,
        
        // Duplicate letters
        () => baseUsername.replace(/([aeiou])/gi, '$1$1'),
        () => baseUsername + baseUsername.charAt(baseUsername.length - 1),
        
        // Remove vowels occasionally
        () => Math.random() > 0.7 ? baseUsername.replace(/[aeiou]/gi, '') : baseUsername,
        
        // Add year variations
        () => baseUsername + ['2024', '2023', '2022', '2021', '2020'][Math.floor(Math.random() * 5)],
        
        // Reverse parts of the username
        () => baseUsername.length > 6 ? baseUsername.slice(0, 3) + baseUsername.slice(3).split('').reverse().join('') : baseUsername,
        
        // Add gaming terms
        () => baseUsername + ['yt', 'ttv', 'tv', 'live', 'stream'][Math.floor(Math.random() * 5)],
        
        // Character substitutions that look natural
        () => baseUsername.replace(/ck/gi, 'k').replace(/ph/gi, 'f').replace(/th/gi, 't'),
        
        // Add random letters
        () => baseUsername + String.fromCharCode(97 + Math.floor(Math.random() * 26)),
        
        // Combine with common words
        () => baseUsername + ['cool', 'epic', 'best', 'top', 'king', 'queen'][Math.floor(Math.random() * 6)]
    ];
    
    // Apply a random modification
    const modifyFunction = modifications[Math.floor(Math.random() * modifications.length)];
    let modifiedUsername = modifyFunction();
    
    // Ensure username meets Roblox requirements (3-20 characters, alphanumeric + underscore)
    modifiedUsername = modifiedUsername.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Truncate if too long
    if (modifiedUsername.length > 20) {
        modifiedUsername = modifiedUsername.substring(0, 20);
    }
    
    // Ensure minimum length
    if (modifiedUsername.length < 3) {
        modifiedUsername = modifiedUsername + Math.floor(Math.random() * 999);
    }
    
    // Make sure it doesn't start or end with underscore
    modifiedUsername = modifiedUsername.replace(/^_+|_+$/g, '');
    
    // If still too short, pad with numbers
    while (modifiedUsername.length < 3) {
        modifiedUsername += Math.floor(Math.random() * 10);
    }
    
    return modifiedUsername;
}

// Tab functionality
function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    const navItems = document.getElementsByClassName("nav-item");
    
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }
    
    for (let i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove("active");
    }
    
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Username generation functions
function generateBarcodeUsername(length) {
    const barcodeChars = 'Il';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += barcodeChars.charAt(Math.floor(Math.random() * barcodeChars.length));
    }
    return result;
}

function generateShortUsername(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Console functions
function appendToConsole(message, type = 'info') {
    const console = document.getElementById('console');
    const messageDiv = document.createElement('div');
    messageDiv.className = `console-message ${type}`;
    
    const icon = getIconForType(type);
    messageDiv.innerHTML = `<i class="${icon}"></i>[${new Date().toLocaleTimeString()}] ${message}`;
    
    console.appendChild(messageDiv);
    console.scrollTop = console.scrollHeight;
    
    // Limit console messages to prevent memory issues
    if (console.children.length > 1000) {
        console.removeChild(console.firstChild);
    }
}

function getIconForType(type) {
    switch(type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-times-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        case 'info': return 'fas fa-info-circle';
        default: return 'fas fa-circle';
    }
}

function clearConsole() {
    document.getElementById('console').innerHTML = '';
    appendToConsole('Console cleared', 'info');
}

// Update the setUsernameType function to include normal usernames
function setUsernameType(type) {
    usernameType = type;
    appendToConsole(`Username type set to: ${type}`, 'info');
    
    // If normal usernames selected, prepare the pool
    if (type === 'normal') {
        if (fileUsernames.length === 0) {
            appendToConsole('Please upload usernames.txt file first for normal username generation', 'warning');
            showNotification('Upload usernames.txt file first', 'warning');
            return;
        }
        
        // Copy file usernames to original usernames for normal generation
        originalUsernames = [...fileUsernames];
        appendToConsole(`Loaded ${originalUsernames.length} base usernames for normal generation`, 'success');
        showNotification(`Ready to generate variations from ${originalUsernames.length} usernames`, 'success');
    }
    
    // Update button styles
    const buttons = document.querySelectorAll('.button-group .discord-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    showNotification(`Username type set to ${type}`, 'success');
}


function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
        // Check if file with same name already exists
        const existingFile = uploadedFiles.find(f => f.name === file.name);
        if (existingFile) {
            appendToConsole(`File "${file.name}" is already uploaded`, 'warning');
            showNotification(`File "${file.name}" is already uploaded`, 'warning');
            event.target.value = ''; // Clear the input
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result.trim();
            if (!content) {
                appendToConsole('File is empty', 'error');
                showNotification('File is empty', 'error');
                return;
            }
            
            const usernames = content.split('\n')
                .map(name => name.trim())
                .filter(name => name !== '' && name.length >= 3 && name.length <= 20);
            
            if (usernames.length === 0) {
                appendToConsole('No valid usernames found in file', 'error');
                showNotification('No valid usernames found in file', 'error');
                return;
            }
            
            // Add to uploaded files array
            const fileData = {
                name: file.name,
                usernames: usernames,
                originalCount: usernames.length,
                remainingCount: usernames.length
            };
            
            uploadedFiles.push(fileData);
            updateFileSelector();
            
            appendToConsole(`Added file: ${file.name} with ${usernames.length} valid usernames`, 'success');
            showNotification(`Added ${usernames.length} usernames from ${file.name}`, 'success');
        };
        reader.readAsText(file);
    } else {
        appendToConsole('Please select a valid text file', 'error');
        showNotification('Invalid file type', 'error');
    }
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
}





function addAvailableUsername(username, showNotifications = true) {
    if (availableUsernames.includes(username)) return;

    availableUsernames.push(username);
    
    // Store metadata for filtering
    const metadata = {
        username: username,
        length: username.length,
        type: usernameType || 'unknown',
        timestamp: Date.now(),
        isBarcode: /^[Il]+$/.test(username),
        isFromFile: usernameType === 'file',
        isNormal: usernameType === 'normal'
    };
    usernameMetadata.push(metadata);

    availableCount++;
    updateStats();
    
    // Re-render the filtered list
    renderFilteredUsernames();

    // Only show notifications for new finds, not when loading from storage
    if (showNotifications) {
        // Play notification sound if enabled
        if (document.getElementById('sound-notifications').checked) {
            playNotificationSound();
        }
        
        showNotification(`Found available username: ${username}`, 'success');
    }

    // Auto-save if enabled
    if (document.getElementById('auto-save') && document.getElementById('auto-save').checked) {
        saveToLocalStorage();
    }
}

function filterAvailableUsernames() {
    const filterValue = document.getElementById('username-filter').value;
    currentFilter = filterValue;
    renderFilteredUsernames();
}

function renderFilteredUsernames() {
    const listDiv = document.getElementById('available-usernames');
    
    if (availableUsernames.length === 0) {
        listDiv.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No available usernames found yet...</p></div>';
        return;
    }

    // Create a copy of metadata for sorting
    let sortedMetadata = [...usernameMetadata];

    // Apply filter
    switch(currentFilter) {
        case 'shortest':
            sortedMetadata.sort((a, b) => a.length - b.length);
            break;
        case 'longest':
            sortedMetadata.sort((a, b) => b.length - a.length);
            break;
        case 'letters':
            sortedMetadata.sort((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()));
            break;
        case 'normal':
            sortedMetadata = sortedMetadata.filter(item => item.isNormal);
            break;
        case 'files':
            sortedMetadata = sortedMetadata.filter(item => item.isFromFile);
            break;
        case 'barcodes':
            sortedMetadata = sortedMetadata.filter(item => item.isBarcode);
            break;
        case 'date':
        default:
            sortedMetadata.sort((a, b) => b.timestamp - a.timestamp);
            break;
    }

    // Clear and rebuild the list
    listDiv.innerHTML = '';
    
    if (sortedMetadata.length === 0) {
        listDiv.innerHTML = '<div class="empty-state"><i class="fas fa-filter"></i><p>No usernames match the current filter...</p></div>';
        return;
    }

    sortedMetadata.forEach(metadata => {
        const usernameDiv = document.createElement('div');
        usernameDiv.className = 'username-item';
        
        // Add type indicator
        let typeIcon = '';
        switch(metadata.type) {
            case 'barcode': typeIcon = '<i class="fas fa-barcode" title="Barcode"></i>'; break;
            case 'short': typeIcon = '<i class="fas fa-font" title="Short"></i>'; break;
            case 'file': typeIcon = '<i class="fas fa-file-alt" title="From File"></i>'; break;
            case 'normal': typeIcon = '<i class="fas fa-user-friends" title="Normal"></i>'; break;
            default: typeIcon = '<i class="fas fa-question" title="Unknown"></i>'; break;
        }
        
        usernameDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                ${typeIcon}
                <span class="username-text">${metadata.username}</span>
                <small style="color: var(--text-secondary); margin-left: auto;">${metadata.length} chars</small>
            </div>
            <button class="copy-btn" onclick="copyUsername('${metadata.username}')" title="Copy username">
                <i class="fas fa-copy"></i>
            </button>
        `;
        listDiv.appendChild(usernameDiv);
    });
}



function copyUsername(username) {
    navigator.clipboard.writeText(username).then(() => {
        showNotification(`Copied "${username}" to clipboard`, 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = username;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification(`Copied "${username}" to clipboard`, 'success');
    });
}

// Update statistics
function updateStats() {
    document.getElementById('checked-count').textContent = checkedCount;
    document.getElementById('available-count').textContent = availableCount;
    document.getElementById('status').textContent = isRunning ? 'Running...' : 'Ready';
    
    // Calculate rate
    if (startTime && checkedCount > 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
        const rate = Math.round(checkedCount / elapsed);
        document.getElementById('rate').textContent = `${rate}/min`;
    } else {
        document.getElementById('rate').textContent = '0/min';
    }
}

// Check single username with Python module
async function checkUsername(username) {
    if (testedUsernames.has(username)) {
        appendToConsole(`Skipping already tested username: ${username}`, 'warning');
        return false;
    }
    
    testedUsernames.add(username);
    
    try {
        // Check if running in Electron
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('check-username-python', username);
            
            if (result.available) {
                appendToConsole(`✓ ${username} is available!`, 'success');
                addAvailableUsername(username);
                return true;
            } else {
                appendToConsole(`✗ ${username} is taken`, 'error');
                return false;
            }
        } else {
            // Fallback to simulation if not in Electron
            appendToConsole('Python module not available, using simulation', 'warning');
            const response = await simulateUsernameCheck(username);
            
            if (response.available) {
                appendToConsole(`✓ ${username} is available! (simulated)`, 'success');
                addAvailableUsername(username);
                return true;
            } else {
                appendToConsole(`✗ ${username} is taken (simulated)`, 'error');
                return false;
            }
        }
    } catch (error) {
        appendToConsole(`Error checking ${username}: ${error.message}`, 'error');
        return false;
    }
}

// Simulate username checking with realistic patterns
async function simulateUsernameCheck(username) {
    // Add realistic delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // More realistic availability simulation based on username patterns
    let availabilityChance = 0.05; // Base 5% chance
    
    // Adjust chances based on username characteristics
    if (username.length <= 4) {
        availabilityChance = 0.01; // Very rare for short names
    } else if (username.length >= 15) {
        availabilityChance = 0.15; // Higher chance for very long names
    } else if (username.length >= 10) {
        availabilityChance = 0.08; // Slightly higher for long names
    }
    
    // Barcode usernames (all I and l) are usually taken
    if (/^[Il]+$/.test(username)) {
        availabilityChance = 0.02;
    }
    
    // Names with numbers at the end are more likely to be available
    if (/\d+$/.test(username)) {
        availabilityChance *= 1.5;
    }
    
    // Common patterns are less likely to be available
    if (/^(test|user|player|gamer|pro|noob|cool|awesome)/i.test(username)) {
        availabilityChance *= 0.3;
    }
    
    const isAvailable = Math.random() < availabilityChance;
    
    if (isAvailable) {
        return { available: true };
    } else {
        const reasons = [
            'Username is already in use',
            'Username contains inappropriate content',
            'Username is too similar to existing username',
            'Username violates community standards'
        ];
        return { 
            available: false, 
            reason: reasons[Math.floor(Math.random() * reasons.length)]
        };
    }
}

// Update the performCheck function to handle normal usernames
async function performCheck() {
    if (!isRunning) return;

    let username;
    const length = parseInt(document.getElementById('length-input').value) || 5;

    // Generate or get username based on type
    if (usernameType === 'barcode') {
        username = generateBarcodeUsername(length);
    } else if (usernameType === 'short') {
        username = generateShortUsername(length);
    } else if (usernameType === 'file') {
    if (selectedFileIndex === -1) {
        appendToConsole('Please select a file first', 'error');
        stopChecking();
        return;
    }
    
    if (fileUsernames.length === 0) {
        appendToConsole('No more usernames in selected file to check', 'warning');
        stopChecking();
        return;
    }
    
    username = fileUsernames.shift();
    
    // Update the remaining count in the uploaded file
    if (uploadedFiles[selectedFileIndex]) {
        uploadedFiles[selectedFileIndex].remainingCount = fileUsernames.length;
        updateFileSelector();
    }

    } else if (usernameType === 'normal') {
        username = generateNormalUsername();
        if (!username) {
            appendToConsole('Could not generate normal username', 'error');
            stopChecking();
            return;
        }
    } else {
        appendToConsole('Please select a username type first', 'error');
        stopChecking();
        return;
    }

    // Skip if username was already tested
    if (testedUsernames.has(username)) {
        setTimeout(performCheck, 50); // Quick retry with new username
        return;
    }

    appendToConsole(`Checking: ${username}`, 'info');
    await checkUsername(username);

    checkedCount++;
    updateStats();

    // Continue checking after delay
    if (isRunning) {
        const delay = parseInt(document.getElementById('delay-input').value) || 1000;
        setTimeout(performCheck, delay);
    }
}


// Update the startChecking function to handle normal usernames
function startChecking() {
    if (!usernameType) {
        appendToConsole('Please select a username type first', 'error');
        showNotification('Please select a username type', 'error');
        return;
    }

    if (usernameType === 'file' && fileUsernames.length === 0) {
        appendToConsole('Please upload a file with usernames first', 'error');
        showNotification('Please upload a file first', 'error');
        return;
    }
    
    if (usernameType === 'normal' && originalUsernames.length === 0) {
        appendToConsole('Please upload usernames.txt file first for normal username generation', 'error');
        showNotification('Please upload usernames.txt file first', 'error');
        return;
    }

    const length = parseInt(document.getElementById('length-input').value);
    if ((usernameType === 'barcode' || usernameType === 'short') && (length < 3 || length > 20)) {
        appendToConsole('Please enter a valid length between 3 and 20', 'error');
        showNotification('Invalid username length', 'error');
        return;
    }

    isRunning = true;
    startTime = Date.now();
    document.getElementById('start-button').disabled = true;
    document.getElementById('stop-button').disabled = false;

    appendToConsole('Starting username checker...', 'success');
    showNotification('Username checker started', 'success');
    updateStats();

    // Initialize empty state for available usernames if needed
    const availableList = document.getElementById('available-usernames');
    if (availableList.children.length === 0) {
        availableList.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No available usernames found yet...</p></div>';
    }

    performCheck();
}

// Stop checking
function stopChecking() {
    isRunning = false;
    document.getElementById('start-button').disabled = false;
    document.getElementById('stop-button').disabled = true;
    
    appendToConsole('Username checker stopped', 'warning');
    showNotification('Username checker stopped', 'warning');
    updateStats();
}

// Download results
function downloadResults() {
    if (availableUsernames.length === 0) {
        appendToConsole('No available usernames to download', 'warning');
        showNotification('No usernames to download', 'warning');
        return;
    }
    
    const content = availableUsernames.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `available_usernames_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    appendToConsole(`Downloaded ${availableUsernames.length} available usernames`, 'success');
    showNotification(`Downloaded ${availableUsernames.length} usernames`, 'success');
}

function updateFileSelector() {
    const fileInfo = document.getElementById('file-info');
    
    if (uploadedFiles.length === 0) {
        fileInfo.style.display = 'none';
        return;
    }
    
    fileInfo.style.display = 'block';
    fileInfo.innerHTML = `
        <div class="uploaded-files-container">
            <h4><i class="fas fa-files"></i> Uploaded Files</h4>
            <div class="files-grid">
                ${uploadedFiles.map((file, index) => `
                    <div class="file-selector-item ${index === selectedFileIndex ? 'selected' : ''}" onclick="selectFile(${index})">
                        <div class="file-content">
                            <i class="fas fa-file-text"></i>
                            <div class="file-details">
                                <div class="file-name">${file.name}</div>
                                <div class="file-count">${file.remainingCount}/${file.originalCount}</div>
                            </div>
                        </div>
                        <button class="file-delete-btn" onclick="removeFile(event, ${index})" title="Remove file">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Save to localStorage after updating
    saveFilesToLocalStorage();
}



function updateDiscordFileSelector() {
    const fileInfo = document.getElementById('discord-file-info');
    
    if (discordUploadedFiles.length === 0) {
        fileInfo.style.display = 'none';
        return;
    }
    
    fileInfo.style.display = 'block';
    fileInfo.innerHTML = `
        <div class="uploaded-files-container">
            <h4><i class="fas fa-files"></i> Discord Files</h4>
            <div class="files-grid">
                ${discordUploadedFiles.map((file, index) => `
                    <div class="file-selector-item ${index === discordSelectedFileIndex ? 'selected' : ''}" onclick="selectDiscordFile(${index})">
                        <div class="file-content">
                            <i class="fas fa-file-text"></i>
                            <div class="file-details">
                                <div class="file-name">${file.name}</div>
                                <div class="file-count">${file.remainingCount}/${file.originalCount}</div>
                            </div>
                        </div>
                        <button class="file-delete-btn" onclick="removeDiscordFile(event, ${index})" title="Remove file">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Save to localStorage after updating
    saveDiscordFilesToLocalStorage();
}



function selectFile(index) {
    selectedFileIndex = index;
    const selectedFile = uploadedFiles[index];
    
    // Update fileUsernames with selected file's remaining usernames
    fileUsernames = [...selectedFile.usernames];
    
    // Update originalUsernames if normal type is selected
    if (usernameType === 'normal') {
        originalUsernames = [...selectedFile.usernames];
    }
    
    updateFileSelector();
    appendToConsole(`Selected file: ${selectedFile.name} (${selectedFile.remainingCount} usernames remaining)`, 'info');
}

function selectDiscordFile(index) {
    discordSelectedFileIndex = index;
    const selectedFile = discordUploadedFiles[index];
    
    // Update discordFileUsernames with selected file's remaining usernames
    discordFileUsernames = [...selectedFile.usernames];
    
    updateDiscordFileSelector();
    appendToDiscordConsole(`Selected file: ${selectedFile.name} (${selectedFile.remainingCount} usernames remaining)`, 'info');
}

function removeFile(event, index) {
    event.stopPropagation();
    const fileName = uploadedFiles[index].name;
    uploadedFiles.splice(index, 1);
    
    // Adjust selected index
    if (selectedFileIndex === index) {
        selectedFileIndex = -1;
        fileUsernames = [];
        originalUsernames = [];
    } else if (selectedFileIndex > index) {
        selectedFileIndex--;
    }
    
    updateFileSelector();
    appendToConsole(`Removed file: ${fileName}`, 'warning');
}

function removeDiscordFile(event, index) {
    event.stopPropagation();
    const fileName = discordUploadedFiles[index].name;
    discordUploadedFiles.splice(index, 1);
    
    // Adjust selected index
    if (discordSelectedFileIndex === index) {
        discordSelectedFileIndex = -1;
        discordFileUsernames = [];
    } else if (discordSelectedFileIndex > index) {
        discordSelectedFileIndex--;
    }
    
    updateDiscordFileSelector();
    appendToDiscordConsole(`Removed file: ${fileName}`, 'warning');
}

function clearAllFiles() {
    uploadedFiles = [];
    selectedFileIndex = -1;
    fileUsernames = [];
    originalUsernames = [];
    updateFileSelector();
    appendToConsole('Cleared all uploaded files', 'warning');
}

function clearAllDiscordFiles() {
    discordUploadedFiles = [];
    discordSelectedFileIndex = -1;
    discordFileUsernames = [];
    updateDiscordFileSelector();
    appendToDiscordConsole('Cleared all Discord files', 'warning');
}

// Notification system with stacking
let notificationContainer = null;
let notificationQueue = [];

function createNotificationContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }
}

function showNotification(message, type = 'info') {
    createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: all 0.3s ease;
        pointer-events: auto;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set colors based on type
    switch(type) {
        case 'success':
            notification.style.borderLeftColor = '#4CAF50';
            notification.style.borderLeftWidth = '4px';
            break;
        case 'error':
            notification.style.borderLeftColor = '#f44336';
            notification.style.borderLeftWidth = '4px';
            break;
        case 'warning':
            notification.style.borderLeftColor = '#ff9800';
            notification.style.borderLeftWidth = '4px';
            break;
        case 'info':
            notification.style.borderLeftColor = '#2196F3';
            notification.style.borderLeftWidth = '4px';
            break;
    }
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; color: var(--text-primary);">
            <i class="${getIconForType(type)}" style="margin-right: 8px; flex-shrink: 0;"></i>
            <span style="font-size: 14px;">${message}</span>
        </div>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 4000);
    
    // Click to dismiss
    notification.addEventListener('click', () => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    });
}

// Sound notification
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Could not play notification sound:', error);
    }
}

// Local storage functions
function saveToLocalStorage() {
    try {
        localStorage.setItem('availableUsernames', JSON.stringify(availableUsernames));
        localStorage.setItem('testedUsernames', JSON.stringify([...testedUsernames])); // Save tested usernames
        localStorage.setItem('checkedCount', checkedCount.toString());
        localStorage.setItem('availableCount', availableCount.toString());
                localStorage.setItem('usernameMetadata', JSON.stringify(usernameMetadata));
    } catch (error) {
        console.log('Could not save to localStorage:', error);
    }
}

function clearStoredData() {
    try {
        localStorage.removeItem('availableUsernames');
        localStorage.removeItem('testedUsernames');
        localStorage.removeItem('checkedCount');
        localStorage.removeItem('availableCount');
        
        // Reset variables
        availableUsernames = [];
        testedUsernames = new Set();
        checkedCount = 0;
        availableCount = 0;
        
        // Clear the UI
        document.getElementById('available-usernames').innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No available usernames found yet...</p></div>';
        
        updateStats();
        appendToConsole('All stored data cleared', 'info');
        showNotification('All data cleared', 'info');
    } catch (error) {
        console.log('Could not clear stored data:', error);
    }
}


function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('availableUsernames');
        const savedMetadata = localStorage.getItem('usernameMetadata');
        
        if (saved) {
            availableUsernames = JSON.parse(saved);
            
            // Load metadata if available, otherwise create basic metadata
            if (savedMetadata) {
                usernameMetadata = JSON.parse(savedMetadata);
            } else {
                // Create basic metadata for existing usernames
                usernameMetadata = availableUsernames.map(username => ({
                    username: username,
                    length: username.length,
                    type: 'unknown',
                    timestamp: Date.now(),
                    isBarcode: /^[Il]+$/.test(username),
                    isFromFile: false,
                    isNormal: false
                }));
            }
            
            renderFilteredUsernames();
        }
        
        // Load tested usernames to avoid retrying them
        const savedTested = localStorage.getItem('testedUsernames');
        if (savedTested) {
            const tested = JSON.parse(savedTested);
            testedUsernames = new Set(tested);
        }
        
        const savedChecked = localStorage.getItem('checkedCount');
        if (savedChecked) {
            checkedCount = parseInt(savedChecked);
        }
        
        const savedAvailable = localStorage.getItem('availableCount');
        if (savedAvailable) {
            availableCount = parseInt(savedAvailable);
        }
        
        updateStats();
    } catch (error) {
        console.log('Could not load from localStorage:', error);
    }
}



// Theme switching
function switchTheme(theme) {
    if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-primary', '#ffffff');
        document.documentElement.style.setProperty('--bg-secondary', '#f6f6f6');
        document.documentElement.style.setProperty('--bg-tertiary', '#e3e5e8');
        document.documentElement.style.setProperty('--text-primary', '#2e3338');
        document.documentElement.style.setProperty('--text-secondary', '#4f5660');
    } else {
        // Reset to dark theme (default)
        document.documentElement.style.removeProperty('--bg-primary');
        document.documentElement.style.removeProperty('--bg-secondary');
        document.documentElement.style.removeProperty('--bg-tertiary');
        document.documentElement.style.removeProperty('--text-primary');
        document.documentElement.style.removeProperty('--text-secondary');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    updateStats();
    loadFromLocalStorage();
    appendToConsole('Roblox Username Checker initialized', 'success');
    
    // Check if running in Electron and setup Python module
    if (typeof require !== 'undefined') {
        try {
            const { ipcRenderer } = require('electron');
            const moduleExists = await ipcRenderer.invoke('check-python-module');
            
            if (!moduleExists) {
                appendToConsole('Creating Python module...', 'info');
                await ipcRenderer.invoke('create-python-module');
                appendToConsole('Python module created successfully!', 'success');
            } else {
                appendToConsole('Python module found!', 'success');
            }
            
            appendToConsole('Ready to make real API requests!', 'success');
        } catch (error) {
            appendToConsole('Error setting up Python module: ' + error.message, 'error');
            appendToConsole('Falling back to simulation mode', 'warning');
        }
    } else {
        appendToConsole('Note: This demo simulates API responses due to CORS restrictions', 'warning');
        appendToConsole('Use Electron version for real API requests', 'info');
    }

});

// Save uploaded files to localStorage
function saveFilesToLocalStorage() {
    try {
        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
        localStorage.setItem('selectedFileIndex', selectedFileIndex.toString());
    } catch (error) {
        console.error('Error saving files to localStorage:', error);
    }
}

// Save Discord files to localStorage
function saveDiscordFilesToLocalStorage() {
    try {
        localStorage.setItem('discordUploadedFiles', JSON.stringify(discordUploadedFiles));
        localStorage.setItem('discordSelectedFileIndex', discordSelectedFileIndex.toString());
    } catch (error) {
        console.error('Error saving Discord files to localStorage:', error);
    }
}

// Load uploaded files from localStorage
function loadFilesFromLocalStorage() {
    try {
        const savedFiles = localStorage.getItem('uploadedFiles');
        const savedIndex = localStorage.getItem('selectedFileIndex');
        
        if (savedFiles) {
            uploadedFiles = JSON.parse(savedFiles);
            updateFileSelector();
        }
        
        if (savedIndex) {
            selectedFileIndex = parseInt(savedIndex);
            if (selectedFileIndex >= uploadedFiles.length) {
                selectedFileIndex = uploadedFiles.length - 1;
            }
            if (selectedFileIndex < 0) selectedFileIndex = 0;
        }
    } catch (error) {
        console.error('Error loading files from localStorage:', error);
        uploadedFiles = [];
        selectedFileIndex = 0;
    }
}

// Load Discord files from localStorage
function loadDiscordFilesFromLocalStorage() {
    try {
        const savedFiles = localStorage.getItem('discordUploadedFiles');
        const savedIndex = localStorage.getItem('discordSelectedFileIndex');
        
        if (savedFiles) {
            discordUploadedFiles = JSON.parse(savedFiles);
            updateDiscordFileSelector();
        }
        
        if (savedIndex) {
            discordSelectedFileIndex = parseInt(savedIndex);
            if (discordSelectedFileIndex >= discordUploadedFiles.length) {
                discordSelectedFileIndex = discordUploadedFiles.length - 1;
            }
            if (discordSelectedFileIndex < 0) discordSelectedFileIndex = 0;
        }
    } catch (error) {
        console.error('Error loading Discord files from localStorage:', error);
        discordUploadedFiles = [];
        discordSelectedFileIndex = 0;
    }
}

// Handle window beforeunload
// Handle window beforeunload
window.addEventListener('beforeunload', function(e) {
    if (isRunning) {
        e.preventDefault();
        e.returnValue = 'Username checking is still running. Are you sure you want to leave?';
        return e.returnValue;
    }
    
    // Always save state before leaving (including tested usernames)
    saveToLocalStorage();
});


// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                if (!isRunning) {
                    startChecking();
                } else {
                    stopChecking();
                }
                break;
            case 's':
                e.preventDefault();
                if (availableUsernames.length > 0) {
                    downloadResults();
                }
                break;
            case 'l':
                e.preventDefault();
                clearConsole();
                break;
        }
    }
});
