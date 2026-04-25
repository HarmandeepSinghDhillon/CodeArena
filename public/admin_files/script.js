const API_URL = '/api';
let currentProblem = null;
let testCases = [];
let totalProblems = 0;
let totalUsers = 0;
let refreshInterval = null;
// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/check-auth`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.authenticated || data.role !== 'admin') {
            window.location.href = '/index.html';
            return false;
        }
        
        document.getElementById('userName').textContent = `👋 ${data.username}`;
        document.getElementById('adminName').textContent = data.username;
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/index.html';
        return false;
    }
}
// Load dashboard stats
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            credentials: 'include'
        });
        const stats = await response.json();
        
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('totalProblems').textContent = stats.totalProblems;
        document.getElementById('totalSubmissions').textContent = stats.totalSubmissions;
        document.getElementById('activeUsers').textContent = stats.activeUsers;
        
        totalUsers = stats.totalUsers;
        totalProblems = stats.totalProblems;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}
// Load users with solved problems
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            credentials: 'include'
        });
        const data = await response.json();
        const tbody = document.getElementById('usersTableBody');
        
        if (!data.users || data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.users.map(user => {
            const solvedCount = user.solved_count || 0;
            const percentage = totalProblems > 0 ? (solvedCount / totalProblems * 100) : 0;
            
            return `
                <tr>
                    <td>
                        ${user.is_active ? 
                            '<span class="active-badge">● ACTIVE NOW</span>' : 
                            '<span class="inactive-badge">○ OFFLINE</span>'}
                    </td>
                    <td>
                        <strong>${escapeHtml(user.username)}</strong>
                        ${solvedCount > 0 ? `<span class="solved-badge">${solvedCount} solved</span>` : ''}
                    </td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="user-progress-details">
                            <strong>${solvedCount} / ${totalProblems}</strong>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                            ${solvedCount > 0 ? `
                                <div class="solved-problems-list">
                                    ${user.solved_problems.map(sp => `
                                        <span class="solved-problem-tag">Problem ${sp.problem_id}</span>
                                    `).join('')}
                                </div>
                            ` : '<div style="color: var(--text-secondary); font-size: 11px; margin-top: 5px;">No problems solved yet</div>'}
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-primary" onclick="viewUserDetails('${user.id}')" style="padding: 5px 12px; font-size: 11px;">
                            View Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">Error loading users</td></tr>';
    }
}
// View user details
window.viewUserDetails = async function(userId) {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            credentials: 'include'
        });
        const data = await response.json();
        const user = data.users.find(u => u.id === userId);
        
        if (user) {
            let solvedDetails = '';
            if (user.solved_problems && user.solved_problems.length > 0) {
                solvedDetails = user.solved_problems.map(sp => 
                    `   • Problem ${sp.problem_id} - Solved at: ${new Date(sp.solved_at).toLocaleString()}`
                ).join('\n');
            } else {
                solvedDetails = '   • No problems solved yet';
            }
            
            alert(`📊 User Details\n\n` +
                  `Username: ${user.username}\n` +
                  `Email: ${user.email}\n` +
                  `Joined: ${new Date(user.created_at).toLocaleString()}\n` +
                  `Last Active: ${user.last_active ? new Date(user.last_active).toLocaleString() : 'Never'}\n` +
                  `Status: ${user.is_active ? '🟢 Active Now' : '⚫ Offline'}\n` +
                  `Problems Solved: ${user.solved_count}/${totalProblems}\n\n` +
                  `Solved Problems:\n${solvedDetails}`);
        }
    } catch (error) {
        console.error('Error viewing user details:', error);
        alert('Error loading user details');
    }
};
// Add DELETE problem functionality
async function deleteProblem(problemId, problemTitle) {
    // Show confirmation dialog
    const confirmed = confirm(`⚠️ Are you sure you want to delete "${problemTitle}"?\n\nThis action cannot be undone!\n\nAll user submissions for this problem will also be deleted.`);
    if (!confirmed) return;
    try {
        const response = await fetch(`${API_URL}/admin/problems/${problemId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            alert(`✅ Problem "${problemTitle}" has been deleted successfully!`);
            // Reload the problems list
            loadProblems();
            // Also refresh stats
            loadStats();
        } else {
            const error = await response.json();
            alert(`❌ Error: ${error.error || 'Failed to delete problem'}`);
        }
    } catch (error) {
        console.error('Error deleting problem:', error);
        alert('❌ Error deleting problem. Please try again.');
    }
}
// Add delete button to problem cards - Update the loadProblems function
// Replace the existing loadProblems function with this updated version:
async function loadProblems() {
    try {
        const response = await fetch(`${API_URL}/admin/problems`, {
            credentials: 'include'
        });
        const data = await response.json();
        const problemsList = document.getElementById('problemsList');
        if (!data.problems || data.problems.length === 0) {
            problemsList.innerHTML = '<div style="text-align: center; padding: 20px;">No problems found</div>';
            return;
        }
        problemsList.innerHTML = data.problems.map(problem => {
            const solvedCount = problem.solved_by_count || 0;
            const percentage = totalUsers > 0 ? (solvedCount / totalUsers * 100) : 0;
            return `
                <div class="problem-card" style="position: relative;">
                    <div class="problem-title-admin">
                        <span onclick="selectProblem(${problem.id})" style="cursor: pointer; flex: 1;">
                            ${problem.id}. ${escapeHtml(problem.title)}
                        </span>
                        <div style="display: flex; gap: 8px;">
                            ${solvedCount > 0 ? `<span class="solved-badge">✓ Solved by ${solvedCount} users</span>` : ''}
                            <button class="btn btn-danger" onclick="deleteProblem(${problem.id}, '${escapeHtml(problem.title)}')" 
                                    style="padding: 4px 12px; font-size: 11px; background: var(--error);">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                    <div class="difficulty ${problem.difficulty.toLowerCase()}" style="display: inline-block; padding: 2px 8px; border-radius: 5px; font-size: 11px; margin-top: 5px;">
                        ${problem.difficulty}
                    </div>
                    <div class="problem-solved-stats">
                        📊 Solved by: ${solvedCount} / ${totalUsers} users
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading problems:', error);
        const problemsList = document.getElementById('problemsList');
        problemsList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--error);">Error loading problems</div>';
    }
}
// Modal delete confirmation (alternative to confirm dialog)
let pendingDelete = { id: null, title: null };
window.showDeleteModal = function(problemId, problemTitle) {
    pendingDelete = { id: problemId, title: problemTitle };
    const modal = document.getElementById('deleteConfirmModal');
    const message = document.getElementById('deleteConfirmMessage');
    message.textContent = `Are you sure you want to delete "${problemTitle}"?`;
    modal.style.display = 'flex';
};
window.hideDeleteModal = function() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'none';
    pendingDelete = { id: null, title: null };
};
// Add event listeners for modal buttons
document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    if (pendingDelete.id) {
        await deleteProblemConfirmed(pendingDelete.id, pendingDelete.title);
    }
    hideDeleteModal();
});
document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    hideDeleteModal();
});
async function deleteProblemConfirmed(problemId, problemTitle) {
    try {
        const response = await fetch(`${API_URL}/admin/problems/${problemId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            alert(`✅ Problem "${problemTitle}" has been deleted successfully!`);
            loadProblems();
            loadStats();
        } else {
            const error = await response.json();
            alert(`❌ Error: ${error.error || 'Failed to delete problem'}`);
        }
    } catch (error) {
        console.error('Error deleting problem:', error);
        alert('❌ Error deleting problem. Please try again.');
    }
}
// Select problem for editing
window.selectProblem = async function(problemId) {
    try {
        const response = await fetch(`${API_URL}/admin/problems`, {
            credentials: 'include'
        });
        const data = await response.json();
        currentProblem = data.problems.find(p => p.id === problemId);
        
        if (currentProblem) {
            document.getElementById('problemTitle').value = currentProblem.title;
            document.getElementById('problemDifficulty').value = currentProblem.difficulty;
            document.getElementById('problemDescription').value = currentProblem.description;
            document.getElementById('starterCode').value = currentProblem.starterCode;
            document.getElementById('constraints').value = currentProblem.constraints.join('\n');
            document.getElementById('examples').value = JSON.stringify(currentProblem.examples, null, 2);
            
            testCases = [...currentProblem.testCases];
            renderTestCases();
            
            document.getElementById('formTitle').textContent = '✏️ Edit Problem';
            document.getElementById('problemForm').classList.add('active');
            document.getElementById('dashboardView').style.display = 'none';
            document.getElementById('usersView').style.display = 'none';
            document.getElementById('problemsListContainer').style.display = 'none';
            document.getElementById('panelTitle').textContent = `Editing: ${currentProblem.title}`;
        }
    } catch (error) {
        console.error('Error selecting problem:', error);
        alert('Error loading problem details');
    }
};
// Render test cases
function renderTestCases() {
    const container = document.getElementById('testCasesContainer');
    if (!container) return;
    
    if (testCases.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">No test cases added yet</div>';
        return;
    }
    
    container.innerHTML = testCases.map((tc, index) => `
        <div class="testcase-item">
            <strong>Test Case ${index + 1}</strong>
            <div class="form-group" style="margin-top: 10px;">
                <label>Input</label>
                <input type="text" value="${escapeHtml(tc.input)}" onchange="updateTestCase(${index}, 'input', this.value)">
            </div>
            <div class="form-group">
                <label>Expected Output</label>
                <input type="text" value="${escapeHtml(tc.expected)}" onchange="updateTestCase(${index}, 'expected', this.value)">
            </div>
            <button class="btn btn-danger" onclick="removeTestCase(${index})" style="margin-top: 5px; padding: 5px 10px; font-size: 11px;">Remove</button>
        </div>
    `).join('');
}
window.updateTestCase = function(index, field, value) {
    if (testCases[index]) {
        testCases[index][field] = value;
    }
};
window.removeTestCase = function(index) {
    testCases.splice(index, 1);
    renderTestCases();
};
// Add test case
document.getElementById('addTestCaseBtn')?.addEventListener('click', () => {
    testCases.push({ input: '', expected: '' });
    renderTestCases();
});
// Save problem
document.getElementById('saveProblemBtn')?.addEventListener('click', async () => {
    const problemData = {
        title: document.getElementById('problemTitle').value,
        difficulty: document.getElementById('problemDifficulty').value,
        description: document.getElementById('problemDescription').value,
        starterCode: document.getElementById('starterCode').value,
        constraints: document.getElementById('constraints').value.split('\n').filter(c => c.trim()),
        examples: JSON.parse(document.getElementById('examples').value),
        testCases: testCases
    };
    
    if (!problemData.title || !problemData.description) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        let response;
        if (currentProblem) {
            // Update existing problem
            problemData.id = currentProblem.id;
            response = await fetch(`${API_URL}/admin/problems/${currentProblem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(problemData)
            });
        } else {
            // Add new problem
            response = await fetch(`${API_URL}/admin/problems`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(problemData)
            });
        }
        
        if (response.ok) {
            alert(currentProblem ? 'Problem updated successfully!' : 'Problem added successfully!');
            location.reload();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Failed to save problem'));
        }
    } catch (error) {
        console.error('Error saving problem:', error);
        alert('Error saving problem');
    }
});
// Navigation
document.getElementById('dashboardBtn')?.addEventListener('click', () => {
    document.getElementById('dashboardView').style.display = 'block';
    document.getElementById('problemForm').classList.remove('active');
    document.getElementById('usersView').style.display = 'none';
    document.getElementById('problemsListContainer').style.display = 'none';
    document.getElementById('panelTitle').textContent = 'Welcome, Admin!';
    loadStats();
});
document.getElementById('newProblemBtn')?.addEventListener('click', () => {
    currentProblem = null;
    document.getElementById('problemTitle').value = '';
    document.getElementById('problemDifficulty').value = 'Easy';
    document.getElementById('problemDescription').value = '';
    document.getElementById('starterCode').value = 'def solution():\n    # Write your code here\n    pass';
    document.getElementById('constraints').value = '';
    document.getElementById('examples').value = '[]';
    testCases = [];
    renderTestCases();
    document.getElementById('formTitle').textContent = '➕ Add New Problem';
    document.getElementById('problemForm').classList.add('active');
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('usersView').style.display = 'none';
    document.getElementById('problemsListContainer').style.display = 'none';
    document.getElementById('panelTitle').textContent = 'Create New Problem';
});
document.getElementById('manageProblemsBtn')?.addEventListener('click', () => {
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('problemForm').classList.remove('active');
    document.getElementById('usersView').style.display = 'none';
    document.getElementById('problemsListContainer').style.display = 'block';
    document.getElementById('panelTitle').textContent = '📋 Manage Problems';
    loadProblems();
});
document.getElementById('manageUsersBtn')?.addEventListener('click', () => {
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('problemForm').classList.remove('active');
    document.getElementById('usersView').style.display = 'block';
    document.getElementById('problemsListContainer').style.display = 'none';
    document.getElementById('panelTitle').textContent = '👥 User Management';
    loadUsers();
});
// Cancel form
document.getElementById('cancelFormBtn')?.addEventListener('click', () => {
    document.getElementById('problemForm').classList.remove('active');
    document.getElementById('dashboardView').style.display = 'block';
    document.getElementById('panelTitle').textContent = 'Welcome, Admin!';
    currentProblem = null;
});
// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await fetch(`${API_URL}/logout`, { 
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
});
// Auto-refresh for active users (every 30 seconds)
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    
    refreshInterval = setInterval(() => {
        const usersView = document.getElementById('usersView');
        const dashboardView = document.getElementById('dashboardView');
        const problemsContainer = document.getElementById('problemsListContainer');
        
        if (usersView && usersView.style.display !== 'none') {
            loadUsers();
        }
        if (dashboardView && dashboardView.style.display !== 'none') {
            loadStats();
        }
        if (problemsContainer && problemsContainer.style.display !== 'none') {
            loadProblems();
        }
    }, 30000); // Refresh every 30 seconds
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// Initialize
async function init() {
    const authenticated = await checkAuth();
    if (authenticated) {
        await loadStats();
        startAutoRefresh();
    }
}

init();