import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Search, Edit2, Trash2, LogOut, X, Users, Code2, Activity, Moon, Sun, ChevronDown, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

function parseCSV(text) {
  const lines = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r' || char === '\n') {
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        field += char;
      }
    }
  }
  
  if (field || row.length > 0) {
    row.push(field);
    lines.push(row);
  }
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length === 1 && values[0] === '') continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] !== undefined ? values[index] : '';
    });
    data.push(obj);
  }
  
  return data;
}

function validateProblem(prob) {
  const errors = [];
  
  if (!prob.title || !prob.title.trim()) {
    errors.push("Title is required");
  }
  
  if (!prob.description || !prob.description.trim()) {
    errors.push("Description is required");
  }
  
  const pyBoilerplate = prob.boilerplatepython || prob.boilerplate;
  if (!pyBoilerplate || !pyBoilerplate.trim()) {
    errors.push("Python boilerplate code is required");
  }

  if (!prob.boilerplatecpp || !prob.boilerplatecpp.trim()) {
    errors.push("C++ boilerplate code is required");
  }

  if (!prob.boilerplatejava || !prob.boilerplatejava.trim()) {
    errors.push("Java boilerplate code is required");
  }
  
  let testCases = [];
  if (!prob.testcases || !prob.testcases.trim()) {
    errors.push("testCases column is required and cannot be empty");
  } else {
    try {
      const rawTestCases = JSON.parse(prob.testcases.trim());
      if (!Array.isArray(rawTestCases)) {
        errors.push("testCases must be a JSON array");
      } else if (rawTestCases.length === 0) {
        errors.push("At least one testcase is required");
      } else {
        rawTestCases.forEach((tc, idx) => {
          if (tc.input === undefined || tc.input === null) {
            errors.push(`Test case ${idx + 1} is missing "input"`);
          }
          if (tc.expected === undefined || tc.expected === null) {
            errors.push(`Test case ${idx + 1} is missing "expected"`);
          }
        });
        testCases = rawTestCases;
      }
    } catch (e) {
      errors.push("Invalid JSON format in testCases column");
    }
  }
  
  let difficulty = 'Easy';
  if (prob.difficulty) {
    const diffTrimmed = prob.difficulty.trim().toLowerCase();
    if (diffTrimmed === 'medium') difficulty = 'Medium';
    else if (diffTrimmed === 'hard') difficulty = 'Hard';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title: prob.title ? prob.title.trim() : '',
      difficulty,
      description: prob.description ? prob.description.trim() : '',
      inputFormat: prob.inputformat ? prob.inputformat.trim() : '',
      outputFormat: prob.outputformat ? prob.outputformat.trim() : '',
      constraints: prob.constraints ? prob.constraints.trim() : '',
      boilerplate: pyBoilerplate ? pyBoilerplate.trim() : '',
      boilerplateCpp: prob.boilerplatecpp ? prob.boilerplatecpp.trim() : '',
      boilerplateJava: prob.boilerplatejava ? prob.boilerplatejava.trim() : '',
      testCases
    }
  };
}

const downloadTemplate = () => {
  const headers = ['title', 'difficulty', 'description', 'inputFormat', 'outputFormat', 'constraints', 'boilerplatePython', 'boilerplateCpp', 'boilerplateJava', 'testCases'];
  const row1 = [
    'Two Sum',
    'Easy',
    'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    'First line contains nums, second line contains target.',
    'Indices of the two numbers as an array.',
    '2 <= nums.length <= 10^4',
    'def solution(nums, target):\n    # Write code here\n    pass',
    '#include <iostream>\n#include <vector>\n\nclass Solution {\npublic:\n    std::vector<int> solution(std::vector<int>& nums, int target) {\n        // Write code here\n    }\n};',
    'import java.util.*;\n\npublic class Solution {\n    public List<Integer> solution(List<Integer> nums, int target) {\n        // Write code here\n    }\n}',
    JSON.stringify([{ input: '[2,7,11,15], 9', expected: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9' }])
  ];
  const row2 = [
    'Reverse String',
    'Easy',
    'Write a function that reverses a string in-place.',
    'A single string.',
    'Reversed string.',
    'Length <= 10^5',
    'def solution(s):\n    return s[::-1]',
    '#include <iostream>\n#include <string>\n\nclass Solution {\npublic:\n    std::string solution(std::string s) {\n        // Write code here\n    }\n};',
    'import java.util.*;\n\npublic class Solution {\n    public String solution(String s) {\n        // Write code here\n    }\n}',
    JSON.stringify([{ input: '"hello"', expected: '"olleh"' }])
  ];
  
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    row1.map(val => `"${val.replace(/"/g, '""')}"`).join(','),
    row2.map(val => `"${val.replace(/"/g, '""')}"`).join(',')
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'codearena_questions_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


export default function Admin() {
  const [activeTab, setActiveTab] = useState('problems'); // 'problems' or 'users'
  const [problems, setProblems] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ totalProblems: 0, totalSubmissions: 0, activeUsers: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [formData, setFormData] = useState({ title: '', difficulty: 'Easy', description: '', inputFormat: '', outputFormat: '', constraints: '', testCases: [{ input: '', expected: '', explanation: '' }], boilerplate: '', boilerplateCpp: '', boilerplateJava: '' });
  const [activeCodeTab, setActiveCodeTab] = useState('python');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('dark');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('idle'); // 'idle' | 'parsing' | 'validated' | 'uploading' | 'success'
  const [importError, setImportError] = useState(null);
  const [parsedProblems, setParsedProblems] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/check-auth')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated || data.role !== 'admin') {
          navigate('/');
        } else if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
        }
      })
      .catch(() => navigate('/'));

    fetchData();
  }, [navigate, activeTab]);

  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const probsRes = await fetch('/api/admin/problems');
      if (probsRes.ok) {
        const probsData = await probsRes.json();
        setProblems(probsData.problems || []);
      }

      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.clear();
    navigate('/');
  };

  const handleOpenModal = (problem = null) => {
    setActiveCodeTab('python');
    if (problem) {
      setEditingProblem(problem);
      setFormData({
        title: problem.title,
        difficulty: problem.difficulty,
        description: problem.description || '',
        inputFormat: problem.inputFormat || '',
        outputFormat: problem.outputFormat || '',
        constraints: problem.constraints || '',
        testCases: Array.isArray(problem.testCases) && problem.testCases.length > 0 
          ? problem.testCases 
          : [{ input: '', expected: '', explanation: '' }],
        boilerplate: problem.boilerplate || 'def solution(nums, target):\n    pass',
        boilerplateCpp: problem.boilerplateCpp || '',
        boilerplateJava: problem.boilerplateJava || ''
      });
    } else {
      setEditingProblem(null);
      setFormData({ 
        title: '', 
        difficulty: 'Easy', 
        description: 'Given an array of integers nums, return...', 
        inputFormat: 'The first line contains...',
        outputFormat: 'Return a list of...',
        constraints: '1 <= nums.length <= 10^4',
        testCases: [{ input: '1,2,3', expected: '6', explanation: 'The sum of all numbers is 6.' }],
        boilerplate: 'def solution(nums):\n    return []',
        boilerplateCpp: `#include <iostream>\n#include <vector>\n#include <string>\n\nclass Solution {\npublic:\n    // Adjust return type and parameters as needed\n    int solution(std::vector<int>& nums) {\n        return 0;\n    }\n};`,
        boilerplateJava: `import java.util.*;\n\npublic class Solution {\n    // Adjust return type and parameters as needed\n    public int solution(List<Integer> nums) {\n        return 0;\n    }\n}`
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData
      };

      const url = editingProblem ? `/api/admin/problems/${editingProblem.id}` : '/api/admin/problems';
      const method = editingProblem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert("Error saving problem");
      }
    } catch (err) {
      alert("Network error occurred while saving the problem");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this problem?")) {
      await fetch(`/api/admin/problems/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change this user's status to ${newStatus}?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        fetchData();
      } else {
        alert("Failed to update status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to permanently delete this user? This cannot be undone.")) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchData();
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportStatus('parsing');
    setImportError(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const csvRows = parseCSV(text);
        
        if (csvRows.length === 0) {
          throw new Error("The CSV file is empty or missing content.");
        }
        
        const validated = csvRows.map((row, idx) => {
          const res = validateProblem(row);
          return {
            rowNumber: idx + 2, // Header is 1
            ...res
          };
        });
        
        setParsedProblems(validated);
        setImportStatus('validated');
      } catch (err) {
        setImportStatus('idle');
        setImportError(err.message || "Failed to parse the CSV file.");
      }
    };
    reader.onerror = () => {
      setImportStatus('idle');
      setImportError("Error reading the CSV file.");
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    const validProblems = parsedProblems.filter(p => p.isValid).map(p => p.data);
    if (validProblems.length === 0) {
      alert("No valid problems to import.");
      return;
    }
    
    setImportStatus('uploading');
    try {
      const response = await fetch('/api/admin/problems/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProblems)
      });
      
      if (response.ok) {
        setImportStatus('success');
        const fileInput = document.getElementById('csvFileInput');
        if (fileInput) fileInput.value = '';
        
        fetchData();
        
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportStatus('idle');
          setParsedProblems([]);
        }, 1500);
      } else {
        const errData = await response.json();
        setImportStatus('validated');
        setImportError(errData.error || "Failed to import problems to server.");
      }
    } catch (err) {
      setImportStatus('validated');
      setImportError("Network error occurred while importing problems.");
    }
  };

  const filteredProblems = problems.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={`w-full min-h-screen flex flex-col ${theme === 'dark' ? 'bg-[#0a0a0f] text-gray-200' : 'bg-slate-50 text-slate-800 font-sans'}`}>
      {/* Header */}
      <header className={`h-16 flex items-center justify-between px-8 border-b sticky top-0 z-30 ${theme === 'dark' ? 'border-white/5 bg-[#14141a]/80' : 'border-slate-200 bg-white/80 shadow-sm'} backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/30">
            <ShieldCheck size={20} className="text-purple-500" />
          </div>
          <span className={`font-bold text-xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Admin Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100 text-slate-600'}`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {avatarUrl ? (
            <img src={avatarUrl} alt="Admin Avatar" className="w-9 h-9 rounded-full object-cover border border-purple-500/30 shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20 font-bold text-sm select-none">
              {localStorage.getItem('username') ? localStorage.getItem('username').charAt(0).toUpperCase() : 'A'}
            </div>
          )}

          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Admin Dashboard</h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Manage coding challenges and monitor user progress.</p>
          </div>
          {activeTab === 'problems' && (
            <div className="flex gap-3">
              <button 
                onClick={() => setIsImportModalOpen(true)} 
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium transition-all ${
                  theme === 'dark' 
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-200' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm'
                }`}
              >
                <Upload size={18} /> Import CSV
              </button>
              <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all shadow-lg shadow-purple-500/25">
                <Plus size={18} /> New Problem
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Problems', value: stats.totalProblems, color: 'from-blue-500/20 to-cyan-500/5', icon: Code2 },
            { label: 'Total Submissions', value: stats.totalSubmissions, color: 'from-purple-500/20 to-pink-500/5', icon: Activity },
            { label: 'Total Users', value: stats.totalUsers || 0, color: 'from-emerald-500/20 to-teal-500/5', icon: Users },
          ].map((stat, idx) => (
            <div key={idx} className={`p-6 rounded-2xl bg-gradient-to-br ${stat.color} border relative overflow-hidden group ${theme === 'dark' ? 'border-white/5' : 'border-slate-200 shadow-sm'}`}>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>{stat.label}</p>
                  <h3 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stat.value}</h3>
                </div>
                <stat.icon size={24} className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'} />
              </div>
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-10 -mt-10 transition-colors duration-500 ${theme === 'dark' ? 'bg-white/5 group-hover:bg-white/10' : 'bg-black/5 group-hover:bg-black/10'}`} />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 mb-6 border-b pb-px ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
          <button 
            onClick={() => { setActiveTab('problems'); setSearchQuery(''); }}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'problems' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Manage Problems
          </button>
          <button 
            onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            User Details & Progress
          </button>
        </div>

        {/* Main Table Container */}
        <div className={`border rounded-2xl overflow-hidden shadow-2xl ${theme === 'dark' ? 'bg-[#14141a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
            <div className="relative">
              <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className={`pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-64 ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-sm hover:border-slate-300'}`}
              />
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Showing {activeTab === 'problems' ? filteredProblems.length : filteredUsers.length} {activeTab}
            </div>
          </div>
          
          <div className="overflow-x-auto min-h-[400px]">
            {activeTab === 'problems' ? (
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-white/5 bg-white/[0.01]' : 'border-slate-200 bg-slate-50'}`}>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Difficulty</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Solved By</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProblems.map((p, idx) => {
                    const isLast = idx >= filteredProblems.length - 3 && filteredProblems.length > 3;
                    return (
                    <tr key={p.id} className={`border-b transition-colors group ${theme === 'dark' ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <td className={`p-4 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>#{p.id}</td>
                      <td className={`p-4 text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-slate-800'}`}>{p.title}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          p.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                          p.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {p.difficulty}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {p.solved_by && p.solved_by.length > 0 ? (
                          <div className="relative">
                            <button 
                              onClick={() => setOpenDropdown(openDropdown === `p-${p.id}` ? null : `p-${p.id}`)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                            >
                              {p.solved_by_count} users <ChevronDown size={14} className={`transition-transform ${openDropdown === `p-${p.id}` ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdown === `p-${p.id}` && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                <div className={`absolute left-0 ${isLast ? 'bottom-full mb-2' : 'top-full mt-2'} w-48 py-1 z-50 rounded-xl border shadow-xl max-h-48 overflow-y-auto ${theme === 'dark' ? 'bg-[#1c1c24] border-white/10' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
                                  {p.solved_by.map((u, i) => (
                                    <div key={i} className={`px-4 py-2 text-xs transition-colors ${theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}>{u}</div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>0 users</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(p)} className="p-1.5 rounded-md hover:bg-blue-500/20 text-blue-400 transition-colors" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400 transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filteredProblems.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">No problems found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-white/5 bg-white/[0.01]' : 'border-slate-200 bg-slate-50'}`}>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Username</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Progress</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Active</th>
                    <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, idx) => {
                    const percentage = u.total_problems > 0 ? Math.round((u.solved_count / u.total_problems) * 100) : 0;
                    const isLast = idx >= filteredUsers.length - 3 && filteredUsers.length > 3;
                    return (
                      <tr key={u.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <td className={`p-4 text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-slate-900'}`}>{u.username}</td>
                        <td className={`p-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>{u.email || '-'}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-purple-500 w-8">{percentage}%</span>
                            <div className={`w-32 h-2 rounded-full overflow-hidden border ${theme === 'dark' ? 'bg-black/50 border-white/5' : 'bg-slate-200 border-slate-300'}`}>
                              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>{u.solved_count}/{u.total_problems}</span>
                            {u.solved_problems && u.solved_problems.length > 0 && (
                              <div className="relative ml-2">
                                <button 
                                  onClick={() => setOpenDropdown(openDropdown === `u-${u.id}` ? null : `u-${u.id}`)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                                >
                                  Solved <ChevronDown size={14} className={`transition-transform ${openDropdown === `u-${u.id}` ? 'rotate-180' : ''}`} />
                                </button>
                                {openDropdown === `u-${u.id}` && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                    <div className={`absolute right-0 ${isLast ? 'bottom-full mb-2' : 'top-full mt-2'} w-56 py-1 z-50 rounded-xl border shadow-xl max-h-48 overflow-y-auto ${theme === 'dark' ? 'bg-[#1c1c24] border-white/10' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
                                      {u.solved_problems.map((sp, i) => (
                                        <div key={i} className={`px-4 py-2 text-xs truncate transition-colors ${theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-50 text-slate-700'}`}>{sp.title}</div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5">
                            {u.status === 'TEMPORARILY_DEACTIVATED' && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30 w-fit">
                                Temp Deactivated
                              </span>
                            )}
                            {u.status === 'PERMANENTLY_DEACTIVATED' && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600/20 text-red-500 border border-red-600/30 w-fit">
                                Perm Deactivated
                              </span>
                            )}
                            {(u.status === 'ACTIVE' || !u.status) && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-fit">
                                Active
                              </span>
                            )}

                            {u.is_active ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div> Offline
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {u.last_active ? new Date(u.last_active).toLocaleString() : 'Never'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === `act-${u.id}` ? null : `act-${u.id}`)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-black/10 dark:hover:bg-white/5 transition-colors ${
                                theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              Actions
                            </button>
                            {openDropdown === `act-${u.id}` && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                <div className={`absolute right-0 ${isLast ? 'bottom-full mb-2' : 'top-full mt-2'} w-48 py-1 z-50 rounded-xl border shadow-xl ${
                                  theme === 'dark' ? 'bg-[#1c1c24] border-white/10' : 'bg-white border-slate-100 shadow-slate-200/50'
                                }`}>
                                  {u.status !== 'ACTIVE' && (
                                    <button
                                      onClick={() => { setOpenDropdown(null); handleUpdateUserStatus(u.id, 'ACTIVE'); }}
                                      className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/5 text-emerald-400' : 'hover:bg-slate-50 text-emerald-600'}`}
                                    >
                                      Activate Account
                                    </button>
                                  )}
                                  {u.status !== 'TEMPORARILY_DEACTIVATED' && (
                                    <button
                                      onClick={() => { setOpenDropdown(null); handleUpdateUserStatus(u.id, 'TEMPORARILY_DEACTIVATED'); }}
                                      className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/5 text-amber-500' : 'hover:bg-slate-50 text-amber-600'}`}
                                    >
                                      Temporarily Deactivate
                                    </button>
                                  )}
                                  {u.status !== 'PERMANENTLY_DEACTIVATED' && (
                                    <button
                                      onClick={() => { setOpenDropdown(null); handleUpdateUserStatus(u.id, 'PERMANENTLY_DEACTIVATED'); }}
                                      className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/5 text-red-500' : 'hover:bg-slate-50 text-red-600'}`}
                                    >
                                      Permanently Deactivate
                                    </button>
                                  )}
                                  <div className={`border-t my-1 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`} />
                                  <button
                                    onClick={() => { setOpenDropdown(null); handleDeleteUser(u.id); }}
                                    className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/5 text-red-600' : 'hover:bg-slate-50 text-red-700'}`}
                                  >
                                    Delete User
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Problem Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col ${theme === 'dark' ? 'bg-[#14141a] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingProblem ? 'Edit Problem' : 'New Problem'}</h2>
              <button onClick={() => setIsModalOpen(false)} className={`${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors`}>
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="problemForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Title</label>
                    <input 
                      required
                      type="text" 
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Difficulty</label>
                    <select 
                      value={formData.difficulty}
                      onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${theme === 'dark' ? 'bg-[#1c1c24] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-white/10">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Default/Boilerplate Solution Codes</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Python Boilerplate Code</label>
                    <p className="text-[10px] text-gray-500 mb-1">Ensure the function is named <code>solution</code>.</p>
                    <textarea 
                      required
                      rows="3"
                      value={formData.boilerplate}
                      onChange={(e) => setFormData({...formData, boilerplate: e.target.value})}
                      className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                      placeholder="def solution(...):"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">C++ Boilerplate Code</label>
                    <p className="text-[10px] text-gray-500 mb-1">Ensure the class is named <code>Solution</code> with a public method <code>solution</code>.</p>
                    <textarea 
                      required
                      rows="3"
                      value={formData.boilerplateCpp}
                      onChange={(e) => setFormData({...formData, boilerplateCpp: e.target.value})}
                      className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                      placeholder="class Solution { ... };"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Java Boilerplate Code</label>
                    <p className="text-[10px] text-gray-500 mb-1">Ensure the class is named <code>Solution</code> with a public method <code>solution</code>.</p>
                    <textarea 
                      required
                      rows="3"
                      value={formData.boilerplateJava}
                      onChange={(e) => setFormData({...formData, boilerplateJava: e.target.value})}
                      className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                      placeholder="public class Solution { ... }"
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Description</label>
                    <textarea 
                      required
                      rows="4"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Input Format</label>
                      <textarea 
                        rows="3"
                        value={formData.inputFormat}
                        onChange={(e) => setFormData({...formData, inputFormat: e.target.value})}
                        className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase">Output Format</label>
                      <textarea 
                        rows="3"
                        value={formData.outputFormat}
                        onChange={(e) => setFormData({...formData, outputFormat: e.target.value})}
                        className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Constraints</label>
                    <textarea 
                      rows="3"
                      value={formData.constraints}
                      onChange={(e) => setFormData({...formData, constraints: e.target.value})}
                      className={`w-full font-mono text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-2 border-t mt-4 border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-400 uppercase">Test Cases / Examples</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, testCases: [...formData.testCases, { input: '', expected: '', explanation: '' }] })}
                      className="text-xs flex items-center gap-1 text-purple-500 hover:text-purple-400 font-semibold"
                    >
                      <Plus size={14} /> Add Test Case
                    </button>
                  </div>
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {formData.testCases.map((tc, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border relative ${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="absolute top-2 right-2">
                          <button 
                            type="button" 
                            onClick={() => {
                              const newTestCases = [...formData.testCases];
                              newTestCases.splice(idx, 1);
                              setFormData({ ...formData, testCases: newTestCases });
                            }}
                            className="p-1 rounded-md text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="font-semibold text-sm mb-3">Test Case {idx + 1}</div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Input</label>
                            <input
                              required
                              type="text"
                              value={tc.input}
                              onChange={(e) => {
                                const newTestCases = [...formData.testCases];
                                newTestCases[idx].input = e.target.value;
                                setFormData({ ...formData, testCases: newTestCases });
                              }}
                              className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Expected Output</label>
                            <input
                              required
                              type="text"
                              value={tc.expected}
                              onChange={(e) => {
                                const newTestCases = [...formData.testCases];
                                newTestCases[idx].expected = e.target.value;
                                setFormData({ ...formData, testCases: newTestCases });
                              }}
                              className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Explanation (Optional)</label>
                            <textarea
                              rows="2"
                              value={tc.explanation || ''}
                              onChange={(e) => {
                                const newTestCases = [...formData.testCases];
                                newTestCases[idx].explanation = e.target.value;
                                setFormData({ ...formData, testCases: newTestCases });
                              }}
                              className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className={`p-6 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'}`}>
              <button onClick={() => setIsModalOpen(false)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-200'}`}>Cancel</button>
              <button form="problemForm" type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium shadow-lg shadow-purple-500/25 transition-colors">
                {editingProblem ? 'Save Changes' : 'Create Problem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col ${theme === 'dark' ? 'bg-[#14141a] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Upload className="text-purple-500" size={20} />
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Import Problems via CSV</h2>
              </div>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStatus('idle');
                  setImportError(null);
                  setParsedProblems([]);
                }} 
                className={`${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} transition-colors`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Template Download / Instructions */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${theme === 'dark' ? 'bg-purple-950/15 border-purple-500/25' : 'bg-purple-50 border-purple-100'}`}>
                <div>
                  <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-purple-300' : 'text-purple-900'}`}>Need the CSV format template?</h3>
                  <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-purple-400/80' : 'text-purple-700/80'}`}>Download our ready-to-use template to correctly format your question data.</p>
                </div>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-purple-500/25 transition-all whitespace-nowrap"
                >
                  <Download size={14} /> Download Template
                </button>
              </div>

              {/* Error Banner */}
              {importError && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${theme === 'dark' ? 'bg-red-50/10 border-red-500/25 text-red-400' : 'bg-red-50 border-red-100 text-red-700'}`}>
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-xs uppercase tracking-wider mb-1">Import Error</h4>
                    <p className="text-sm">{importError}</p>
                  </div>
                </div>
              )}

              {/* Drag/Drop and File Input */}
              {importStatus === 'idle' && (
                <div className="relative">
                  <input 
                    type="file" 
                    id="csvFileInput"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                    theme === 'dark' 
                      ? 'border-white/10 hover:border-purple-500/50 bg-white/[0.01]' 
                      : 'border-slate-300 hover:border-purple-500/50 bg-slate-50/50'
                  }`}>
                    <div className="p-4 bg-purple-500/10 rounded-full border border-purple-500/20 mb-4 text-purple-500">
                      <Upload size={32} />
                    </div>
                    <h3 className={`font-semibold text-base mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Select CSV File</h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Drag and drop your file here, or click to browse</p>
                    <p className={`text-[10px] mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>Only .csv files up to 5MB are supported</p>
                  </div>
                </div>
              )}

              {/* Status Indicator */}
              {(importStatus === 'parsing' || importStatus === 'uploading') && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <h3 className={`font-semibold text-base mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {importStatus === 'parsing' ? 'Reading and Validating CSV...' : 'Saving problems to Database...'}
                  </h3>
                  <p className="text-xs text-gray-500">Please wait, this will take just a moment.</p>
                </div>
              )}

              {/* Success Notification */}
              {importStatus === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 mb-4 text-emerald-500">
                    <CheckCircle2 size={40} className="animate-bounce" />
                  </div>
                  <h3 className={`font-semibold text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Problems Imported Successfully!</h3>
                  <p className="text-xs text-gray-500">The page will refresh and modal will close automatically.</p>
                </div>
              )}

              {/* Preview Table */}
              {importStatus === 'validated' && parsedProblems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>File Preview</h3>
                    <div className="text-xs flex gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {parsedProblems.filter(p => p.isValid).length} Valid
                      </span>
                      {parsedProblems.filter(p => !p.isValid).length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                          {parsedProblems.filter(p => !p.isValid).length} Invalid
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={`border rounded-xl overflow-hidden max-h-80 overflow-y-auto ${theme === 'dark' ? 'bg-black/10 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className={`border-b ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-100'}`}>
                          <th className="p-3 font-semibold text-gray-400">Row</th>
                          <th className="p-3 font-semibold text-gray-400">Status</th>
                          <th className="p-3 font-semibold text-gray-400">Title</th>
                          <th className="p-3 font-semibold text-gray-400">Difficulty</th>
                          <th className="p-3 font-semibold text-gray-400">Test Cases</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedProblems.map((prob, idx) => (
                          <tr key={idx} className={`border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
                            <td className="p-3 text-gray-500 font-mono">#{prob.rowNumber}</td>
                            <td className="p-3">
                              {prob.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/15">
                                  Invalid
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-left">
                              <div className="font-semibold max-w-[200px] truncate" title={prob.data.title || "(No Title)"}>
                                {prob.data.title || <span className="text-gray-500 italic">(No Title)</span>}
                              </div>
                              {!prob.isValid && prob.errors.map((err, eIdx) => (
                                <div key={eIdx} className="text-[10px] text-red-400 mt-0.5 font-medium">{err}</div>
                              ))}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                prob.data.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500' : 
                                prob.data.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                              }`}>
                                {prob.data.difficulty}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400 font-mono">
                              {prob.data.testCases ? prob.data.testCases.length : 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-6 border-t flex justify-between items-center ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'}`}>
              <div>
                {importStatus === 'validated' && (
                  <button 
                    onClick={() => {
                      setParsedProblems([]);
                      setImportStatus('idle');
                      setImportError(null);
                      const fileInput = document.getElementById('csvFileInput');
                      if (fileInput) fileInput.value = '';
                    }} 
                    className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'} underline transition-colors`}
                  >
                    Upload a different file
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  disabled={importStatus === 'uploading'}
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportStatus('idle');
                    setImportError(null);
                    setParsedProblems([]);
                  }} 
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                {importStatus === 'validated' && (
                  <button 
                    onClick={handleImportConfirm}
                    disabled={parsedProblems.filter(p => p.isValid).length === 0}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg shadow-purple-500/25 transition-colors"
                  >
                    Import {parsedProblems.filter(p => p.isValid).length} Problems
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
