const API_URL = '/api';

let currentProblem = null;
let problemsData = null;
let currentFilter = 'all';
let currentFontSize = 16;
const MIN_FONT = 12;
const MAX_FONT = 28;

// DOM Elements
const problemsList = document.getElementById('problemsList');
const problemTitle = document.getElementById('problemTitle');
const problemDifficulty = document.getElementById('problemDifficulty');
const problemDescription = document.getElementById('problemDescription');
const problemExamples = document.getElementById('problemExamples');
const problemConstraints = document.getElementById('problemConstraints');
const codeEditor = document.getElementById('codeEditor');
const lineNumbers = document.getElementById('lineNumbers');
const runBtn = document.getElementById('runCodeBtn');
const submitBtn = document.getElementById('submitCodeBtn');
const resetBtn = document.getElementById('resetCodeBtn');
const themeToggle = document.getElementById('themeToggle');
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const increaseFontBtn = document.getElementById('increaseFont');
const decreaseFontBtn = document.getElementById('decreaseFont');
const fontSizeDisplay = document.getElementById('fontSizeDisplay');

// Python keywords for syntax highlighting
const pythonKeywords = [
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
    'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global',
    'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass',
    'raise', 'return', 'True', 'try', 'while', 'with', 'yield'
];

// Check authentication on page load
async function checkUserAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/index.html';
            return false;
        }
        
        if (data.role === 'admin') {
            window.location.href = '/admin';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/index.html';
        return false;
    }
}

// Run auth check before loading the main app
checkUserAuth();

// Add logout functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch(`${API_URL}/logout`, { method: 'POST' });
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/index.html';
        }
    });
}

// Load user progress and display
async function loadUserProgress() {
    try {
        const response = await fetch(`${API_URL}/user/progress`);
        const data = await response.json();
        
        // You can use this data to show solved problems
        console.log('User progress:', data);
        
        // Mark solved problems in the sidebar
        if (data.solvedIds) {
            document.querySelectorAll('.problem-item').forEach(item => {
                const problemTitle = item.querySelector('.problem-title').textContent;
                const problemId = parseInt(problemTitle.split('.')[0]);
                if (data.solvedIds.includes(problemId)) {
                    item.style.borderLeft = '3px solid var(--success)';
                    const solvedBadge = document.createElement('span');
                    solvedBadge.textContent = '✓';
                    solvedBadge.style.cssText = 'color: var(--success); margin-left: 10px; font-weight: bold;';
                    item.querySelector('.problem-title').appendChild(solvedBadge);
                }
            });
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Call this after loading problems
// Add this line in your loadProblems function after rendering problems list
// loadUserProgress();

// Heartbeat to keep user session active
let heartbeatInterval;

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    
    heartbeatInterval = setInterval(async () => {
        try {
            await fetch(`${API_URL}/user/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('Heartbeat error:', error);
        }
    }, 60000); // Send heartbeat every minute
}

// Load user progress and mark solved problems
async function loadUserProgress() {
    try {
        const response = await fetch(`${API_URL}/user/progress`);
        const data = await response.json();
        
        console.log('User progress:', data);
        
        // Mark solved problems in the sidebar
        if (data.solvedIds && data.solvedIds.length > 0) {
            document.querySelectorAll('.problem-item').forEach(item => {
                const problemTitle = item.querySelector('.problem-title').textContent;
                const problemId = parseInt(problemTitle.split('.')[0]);
                
                if (data.solvedIds.includes(problemId)) {
                    // Add green checkmark
                    item.style.borderLeft = '3px solid var(--success)';
                    const existingBadge = item.querySelector('.solved-badge');
                    if (!existingBadge) {
                        const solvedBadge = document.createElement('span');
                        solvedBadge.className = 'solved-badge';
                        solvedBadge.textContent = ' ✓';
                        solvedBadge.style.cssText = 'color: var(--success); margin-left: 10px; font-weight: bold;';
                        item.querySelector('.problem-title').appendChild(solvedBadge);
                    }
                }
            });
        }
        
        // Update progress stats in UI if you have a stats section
        if (data.stats) {
            const statsHtml = `
                <div class="progress-stats">
                    <div class="stat">Solved: ${data.stats.solved}/${data.stats.total}</div>
                    <div class="stat">Progress: ${Math.round(data.stats.percentage)}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${data.stats.percentage}%"></div>
                    </div>
                </div>
            `;
            
            // Add stats to sidebar or header
            const sidebar = document.querySelector('.sidebar-header');
            if (sidebar && !document.querySelector('.progress-stats')) {
                const statsDiv = document.createElement('div');
                statsDiv.className = 'progress-stats';
                statsDiv.innerHTML = statsHtml;
                sidebar.after(statsDiv);
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error loading progress:', error);
        return null;
    }
}

// Call this after loading problems
// Modify your loadProblems function to call loadUserProgress
const originalLoadProblems = loadProblems;
window.loadProblems = async function() {
    await originalLoadProblems();
    await loadUserProgress();
    startHeartbeat();
};

// Add CSS for progress bar
const style = document.createElement('style');
style.textContent = `
    .progress-stats {
        padding: 15px;
        background: var(--bg-tertiary);
        margin: 10px;
        border-radius: 10px;
    }
    .progress-stats .stat {
        font-size: 12px;
        margin-bottom: 5px;
        color: var(--text-secondary);
    }
    .progress-bar {
        height: 6px;
        background: var(--bg-primary);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 10px;
    }
    .progress-fill {
        height: 100%;
        background: var(--success);
        transition: width 0.3s ease;
    }
    .solved-badge {
        animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.5); }
        to { opacity: 1; transform: scale(1); }
    }
`;
document.head.appendChild(style);

// Clear all localStorage on page load
function clearAllStorage() {
    localStorage.clear();
    sessionStorage.clear();
    console.log('All stored data cleared on page refresh');
}

// Reset all UI to default state
function resetUIToDefault() {
    // Reset sidebar to closed state
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    
    // Reset font size to default
    currentFontSize = 16;
    codeEditor.style.fontSize = currentFontSize + 'px';
    lineNumbers.style.fontSize = currentFontSize + 'px';
    if (document.querySelector('.problem-content')) {
        document.querySelector('.problem-content').style.fontSize = currentFontSize + 'px';
    }
    fontSizeDisplay.textContent = currentFontSize;
    
    // Reset panel widths (remove any inline styles)
    const problemPanel = document.getElementById('problemPanel');
    const editorPanel = document.getElementById('editorPanel');
    if (problemPanel && editorPanel) {
        problemPanel.style.flex = '';
        problemPanel.style.width = '';
        editorPanel.style.flex = '';
    }
    
    // Reset theme to dark
    document.body.removeAttribute('data-theme');
    if (themeToggle) themeToggle.textContent = '🌙';
    
    // Reset filter to 'All'
    currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') {
            btn.classList.add('active');
        }
    });
    
    // Reset active tab to Code tab
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === 'code') {
            tab.classList.add('active');
        }
    });
    document.querySelectorAll('.editor-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const codeTab = document.getElementById('codeTab');
    if (codeTab) codeTab.classList.add('active');
    
    // Clear any results display
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsList = document.getElementById('resultsList');
    if (resultsSummary) resultsSummary.innerHTML = '';
    if (resultsList) resultsList.innerHTML = '';
    
    console.log('UI reset to default');
}

// Toggle Sidebar
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});

// Font size control
function updateFontSize() {
    codeEditor.style.fontSize = currentFontSize + 'px';
    lineNumbers.style.fontSize = currentFontSize + 'px';
    if (document.querySelector('.problem-content')) {
        document.querySelector('.problem-content').style.fontSize = currentFontSize + 'px';
    }
    fontSizeDisplay.textContent = currentFontSize;
    updateLineNumbers();
}

increaseFontBtn.addEventListener('click', () => {
    if (currentFontSize < MAX_FONT) {
        currentFontSize += 2;
        updateFontSize();
    }
});

decreaseFontBtn.addEventListener('click', () => {
    if (currentFontSize > MIN_FONT) {
        currentFontSize -= 2;
        updateFontSize();
    }
});

// Load problems
async function loadProblems() {
    try {
        const response = await fetch(`${API_URL}/problems`);
        problemsData = await response.json();
        renderProblemsList();
        if (problemsData.problems.length > 0) {
            loadProblem(problemsData.problems[0]);
        }
    } catch (error) {
        console.error('Error loading problems:', error);
    }
}

function renderProblemsList() {
    if (!problemsData) return;
    
    const filteredProblems = currentFilter === 'all' 
        ? problemsData.problems 
        : problemsData.problems.filter(p => p.difficulty === currentFilter);
    
    problemsList.innerHTML = filteredProblems.map(problem => `
        <div class="problem-item" onclick="loadProblem(${JSON.stringify(problem).replace(/"/g, '&quot;')})">
            <div class="problem-title">${problem.id}. ${problem.title}</div>
            <div class="problem-difficulty difficulty ${problem.difficulty.toLowerCase()}">${problem.difficulty}</div>
        </div>
    `).join('');
}

function loadProblem(problem) {
    currentProblem = problem;
    
    document.querySelectorAll('.problem-item').forEach(item => {
        item.classList.remove('active');
        if (item.querySelector('.problem-title').textContent.includes(problem.title)) {
            item.classList.add('active');
        }
    });
    
    problemTitle.textContent = `${problem.id}. ${problem.title}`;
    problemDifficulty.textContent = problem.difficulty;
    problemDifficulty.className = `difficulty ${problem.difficulty.toLowerCase()}`;
    problemDescription.textContent = problem.description;
    
    problemExamples.innerHTML = problem.examples.map(ex => `
        <div class="example-box">
            <strong>Input:</strong> ${ex.input}<br>
            <strong>Output:</strong> ${ex.output}<br>
            ${ex.explanation ? `<strong>Explanation:</strong> ${ex.explanation}` : ''}
        </div>
    `).join('');
    
    problemConstraints.innerHTML = problem.constraints.map(c => `<li>${c}</li>`).join('');
    
    codeEditor.value = problem.starterCode;
    updateLineNumbers();
    renderTestCases();
}

function renderTestCases() {
    const testCasesList = document.getElementById('testCasesList');
    if (!currentProblem) return;
    
    testCasesList.innerHTML = currentProblem.testCases.map((tc, idx) => `
        <div class="test-case">
            <strong>Test Case ${idx + 1}:</strong><br>
            <strong>Input:</strong> <code>${tc.input}</code><br>
            <strong>Expected Output:</strong> <code>${tc.expected}</code>
        </div>
    `).join('');
}

function updateLineNumbers() {
    const lines = codeEditor.value.split('\n');
    lineNumbers.innerHTML = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
    lineNumbers.scrollTop = codeEditor.scrollTop;
}

// Advanced editor features
function handleTab(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;
        const value = codeEditor.value;
        
        if (e.shiftKey) {
            const lines = value.substring(0, end).split('\n');
            const lastLineIndex = lines.length - 1;
            const lastLine = lines[lastLineIndex];
            if (lastLine.startsWith('    ')) {
                const newValue = value.substring(0, start - 4) + value.substring(start);
                codeEditor.value = newValue;
                codeEditor.selectionStart = codeEditor.selectionEnd = start - 4;
            }
        } else {
            codeEditor.value = value.substring(0, start) + '    ' + value.substring(end);
            codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
        }
        updateLineNumbers();
    }
    
    if (e.key === '(' || e.key === '{' || e.key === '[') {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const value = codeEditor.value;
        const closing = e.key === '(' ? ')' : (e.key === '{' ? '}' : ']');
        codeEditor.value = value.substring(0, start) + e.key + closing + value.substring(start);
        codeEditor.selectionStart = start + 1;
        codeEditor.selectionEnd = start + 1;
        updateLineNumbers();
    }
    
    if (e.key === '"' || e.key === "'") {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const value = codeEditor.value;
        codeEditor.value = value.substring(0, start) + e.key + e.key + value.substring(start);
        codeEditor.selectionStart = start + 1;
        codeEditor.selectionEnd = start + 1;
        updateLineNumbers();
    }
}

codeEditor.addEventListener('keydown', handleTab);

// Auto-indent on newline
codeEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const value = codeEditor.value;
        const lines = value.substring(0, start).split('\n');
        const currentLine = lines[lines.length - 1];
        const indent = currentLine.match(/^\s*/)[0];
        
        let extraIndent = '';
        if (currentLine.trim().endsWith(':')) {
            extraIndent = '    ';
        }
        
        const newValue = value.substring(0, start) + '\n' + indent + extraIndent + value.substring(start);
        codeEditor.value = newValue;
        codeEditor.selectionStart = codeEditor.selectionEnd = start + 1 + indent.length + extraIndent.length;
        updateLineNumbers();
    }
});

// Resizable panels
let isResizing = false;
let startX = 0;
let startLeftWidth = 0;

function initResizable() {
    const resizer = document.getElementById('resizer');
    const problemPanel = document.getElementById('problemPanel');
    const editorPanel = document.getElementById('editorPanel');
    const contentArea = document.getElementById('contentArea');
    
    if (!resizer) return;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = problemPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const newLeftWidth = startLeftWidth + deltaX;
        const containerWidth = contentArea.offsetWidth;
        const minWidth = 300;
        const maxWidth = containerWidth - 400;
        
        if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
            problemPanel.style.flex = 'none';
            problemPanel.style.width = newLeftWidth + 'px';
            editorPanel.style.flex = '1';
        }
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Don't save panel width - reset on refresh
    });
}

// Run code
async function runCode() {
    const code = codeEditor.value;
    
    document.querySelector('[data-tab="results"]').click();
    
    const resultsList = document.getElementById('resultsList');
    const resultsSummary = document.getElementById('resultsSummary');
    
    resultsSummary.innerHTML = '<h3>Running your code...</h3>';
    resultsList.innerHTML = '<div class="result-item">Executing... Please wait.</div>';
    
    try {
        const response = await fetch(`${API_URL}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, input: '' })
        });
        
        const result = await response.json();
        
        resultsSummary.innerHTML = `
            <h3>Execution Results</h3>
            <div style="font-size: 14px; margin-top: 10px;">
                ${result.error ? '❌ Error occurred' : '✅ Code executed successfully'}
            </div>
        `;
        
        resultsList.innerHTML = `
            <div class="result-item ${result.error ? 'failed' : 'passed'}">
                <strong>Output:</strong>
                <pre style="margin-top: 10px; padding: 10px; background: var(--bg-primary); border-radius: 5px;">${result.output || 'No output'}</pre>
            </div>
        `;
    } catch (error) {
        resultsSummary.innerHTML = '<h3>❌ Error</h3>';
        resultsList.innerHTML = `<div class="result-item failed">Failed to connect to server: ${error.message}</div>`;
    }
}

// Submit code
async function submitCode() {
    if (!currentProblem) return;
    
    const code = codeEditor.value;
    
    // Switch to results tab
    document.querySelector('[data-tab="results"]').click();
    
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsList = document.getElementById('resultsList');
    
    resultsSummary.innerHTML = '<h3>Running test cases...</h3>';
    resultsList.innerHTML = '<div class="result-item">Testing your solution against all test cases...</div>';
    
    try {
        const response = await fetch(`${API_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                problemId: currentProblem.id,
                testCases: currentProblem.testCases
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            resultsSummary.innerHTML = `<h3>❌ Error</h3><pre>${result.error}</pre>`;
            return;
        }
        
        resultsSummary.innerHTML = `
            <h3>Results: ${result.passedTests}/${result.totalTests} Test Cases Passed</h3>
            <div style="font-size: 20px; margin-top: 10px;">
                ${result.success ? '✅ All Tests Passed!' : '❌ Some Tests Failed'}
            </div>
            <div style="font-size: 12px; margin-top: 10px;">
                Pass Rate: ${Math.round((result.passedTests/result.totalTests)*100)}%
            </div>
        `;
        
        resultsList.innerHTML = result.results.map(r => `
            <div class="result-item ${r.passed ? 'passed' : 'failed'}">
                <strong>Test Case ${r.testCase}:</strong><br>
                <strong>Input:</strong> <code>${escapeHtml(r.input)}</code><br>
                <strong>Expected:</strong> <code>${escapeHtml(r.expected)}</code><br>
                <strong>Output:</strong> <code>${escapeHtml(r.output)}</code><br>
                <strong>Status:</strong> ${r.passed ? '✅ Passed' : '❌ Failed'}
            </div>
        `).join('');
        
    } catch (error) {
        resultsSummary.innerHTML = '<h3>❌ Error</h3>';
        resultsList.innerHTML = `<div class="result-item failed">Failed to submit: ${error.message}</div>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function resetCode() {
    if (currentProblem) {
        codeEditor.value = currentProblem.starterCode;
        updateLineNumbers();
        
        const resetBtn = document.getElementById('resetCodeBtn');
        const originalText = resetBtn.innerHTML;
        resetBtn.innerHTML = '✓ Reset!';
        setTimeout(() => {
            resetBtn.innerHTML = originalText;
        }, 1500);
    }
}

// Tab switching
document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    });
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderProblemsList();
    });
});

// Theme toggle
let isDark = true;
themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    if (isDark) {
        document.body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
    } else {
        document.body.setAttribute('data-theme', 'light');
        themeToggle.textContent = '☀️';
    }
});

// Event listeners
runBtn.addEventListener('click', runCode);
submitBtn.addEventListener('click', submitCode);
resetBtn.addEventListener('click', resetCode);
codeEditor.addEventListener('input', updateLineNumbers);
codeEditor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = codeEditor.scrollTop;
});

// Keyboard shortcuts
codeEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
    }
});

// Initialize - Clear all storage and reset UI on page load
clearAllStorage();
resetUIToDefault();
loadProblems();
initResizable();

console.log('🔥 CodeArena Ready - All settings reset on refresh!');