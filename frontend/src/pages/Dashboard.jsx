import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Moon, Sun, Play, Send, CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';

const languageLabels = {
  python: 'Python',
  cpp: 'C++',
  java: 'Java'
};

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState({});
  const [activeProblem, setActiveProblem] = useState(null);
  const [code, setCode] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [languageCodes, setLanguageCodes] = useState({
    python: '',
    cpp: '',
    java: ''
  });
  const [activeTab, setActiveTab] = useState('code');
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');
  const fileInputRef = useRef(null);
  
  // Resizer state
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/check-auth')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) { navigate('/', { replace: true }); }
        else if (data.role !== 'user') { navigate('/admin', { replace: true }); }
        else {
          setIsLoading(false);
          if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        }
      })
      .catch(() => navigate('/', { replace: true }));

    const fetchData = async () => {
      try {
        const probRes = await fetch('/api/problems');
        const probData = await probRes.json();
        if (probData.problems) setProblems(probData.problems);

        const progRes = await fetch('/api/user/progress');
        if (progRes.ok) {
          const progData = await progRes.json();
          setProgress(progData.progress || {});
        }
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };

    fetchData();

    const heartbeat = setInterval(() => {
      fetch('/api/user/heartbeat', { method: 'POST' });
    }, 60000);

    return () => clearInterval(heartbeat);
  }, [navigate]);

  useEffect(() => {
    if (activeProblem) {
      const pythonBP = activeProblem.boilerplate || 'def solution(nums):\n    pass';
      const cppBP = activeProblem.boilerplateCpp || `#include <iostream>\n#include <vector>\n#include <string>\n\nclass Solution {\npublic:\n    // Adjust return type and parameters as needed\n    int solution(std::vector<int>& nums) {\n        return 0;\n    }\n};`;
      const javaBP = activeProblem.boilerplateJava || `import java.util.*;\n\npublic class Solution {\n    // Adjust return type and parameters as needed\n    public int solution(List<Integer> nums) {\n        return 0;\n    }\n}`;

      setLanguageCodes({
        python: pythonBP,
        cpp: cppBP,
        java: javaBP
      });

      setCode(selectedLanguage === 'python' ? pythonBP : (selectedLanguage === 'cpp' ? cppBP : javaBP));
      setResults(null);
      setActiveTab('code');
    }
  }, [activeProblem]);

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    setCode(languageCodes[lang]);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.clear();
    navigate('/');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
        }
      } else {
        alert('Failed to upload profile picture.');
      }
    } catch (err) {
      alert('Error uploading file.');
    }
  };

  const handleRun = async () => {
    if (!activeProblem) return;
    setIsRunning(true);
    setActiveTab('results');
    setResults({ status: 'Running...', details: [] });

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          language: selectedLanguage,
          input: activeProblem.testCases && activeProblem.testCases.length > 0 
                 ? activeProblem.testCases[0].input : ""
        })
      });
      
      const data = await response.json();
      setResults({
        status: data.error ? 'Error' : 'Finished',
        output: data.output || data.error,
        time: data.executionTime + 'ms',
        details: []
      });
    } catch (err) {
      setResults({ status: 'Error', output: 'Connection error' });
    }
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    if (!activeProblem) return;
    setIsRunning(true);
    setActiveTab('results');
    setResults({ status: 'Evaluating...', details: [] });

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          language: selectedLanguage,
          problemId: activeProblem.id,
          testCases: activeProblem.testCases || []
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResults({
          status: data.success ? 'Accepted' : 'Wrong Answer',
          details: data.results || []
        });
        
        if (data.success) {
          setProgress(prev => ({
            ...prev,
            [activeProblem.id]: { solved: true }
          }));
        }
      } else {
        setResults({ status: 'Error', output: data.error });
      }
    } catch (err) {
      setResults({ status: 'Error', output: 'Connection error' });
    }
    setIsRunning(false);
  };

  // Drag resizer handlers
  const startDragging = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  const onDrag = (e) => {
    if (!isDragging || !containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const offsetLeft = containerRef.current.getBoundingClientRect().left;
    const newWidthPercentage = ((e.clientX - offsetLeft) / containerWidth) * 100;
    
    if (newWidthPercentage > 20 && newWidthPercentage < 80) {
      setLeftWidth(newWidthPercentage);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDragging);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDragging);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [isDragging]);

  if (isLoading) {
    return <div className="w-full h-screen bg-[#0f0f13] flex items-center justify-center"></div>;
  }

  return (
    <div className={`w-full h-screen flex flex-col ${theme === 'dark' ? 'dark bg-[#0f0f13] text-slate-200' : 'light bg-slate-50 text-slate-800 font-sans'}`}>
      <header className={`h-16 shrink-0 flex items-center justify-between px-6 border-b ${theme === 'dark' ? 'bg-[#14141a] border-white/5' : 'bg-white border-slate-200 shadow-sm'} z-30`}>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="font-bold text-white text-sm">C</span>
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">CodeArena</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100 text-slate-600'}`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative group cursor-pointer mr-1" onClick={handleAvatarClick} title="Click to upload profile picture">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-purple-500/30 hover:border-purple-500 transition-all duration-300" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20 hover:bg-purple-600/30 hover:text-purple-300 transition-all duration-300 font-bold text-sm">
                {localStorage.getItem('username') ? localStorage.getItem('username').charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            </div>
          </div>

          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={`transition-all duration-300 border-r ${theme === 'dark' ? 'bg-[#14141a] border-white/5' : 'bg-white border-slate-200'} flex flex-col shrink-0`} style={{ width: isSidebarOpen ? '320px' : '0', opacity: isSidebarOpen ? 1 : 0, overflow: 'hidden' }}>
          <div className="p-4 border-b border-inherit">
            <h3 className={`font-semibold text-sm uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>Problems List</h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Search problems..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full text-sm px-3 py-2.5 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
              />
              <div className="relative">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`w-full text-sm px-3 py-2.5 rounded-xl border flex items-center justify-between transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                >
                  <span className={difficultyFilter === 'All' && theme === 'light' ? 'text-slate-500' : ''}>
                    {difficultyFilter === 'All' ? 'All Difficulties' : difficultyFilter}
                  </span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                </button>
                
                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                    <div className={`absolute left-0 right-0 mt-2 p-1 z-50 rounded-xl border shadow-xl ${theme === 'dark' ? 'bg-[#1c1c24] border-white/10' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
                      {['All', 'Easy', 'Medium', 'Hard'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => { setDifficultyFilter(opt); setIsFilterOpen(false); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${difficultyFilter === opt ? (theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600 font-medium') : (theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-50 text-slate-600')}`}
                        >
                          {opt === 'All' ? 'All Difficulties' : opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
            {problems
              .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()) && (difficultyFilter === 'All' || p.difficulty === difficultyFilter))
              .map(p => {
              const isSolved = progress[p.id]?.solved;
              return (
                <button 
                  key={p.id} 
                  onClick={() => setActiveProblem(p)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between ${activeProblem?.id === p.id ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  <div className="flex items-center gap-2">
                    {isSolved && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                    <span className={`text-sm font-medium truncate ${activeProblem?.id === p.id ? 'text-purple-500' : (theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}`}>{p.title}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md shrink-0 ${
                    p.difficulty === 'Easy' ? (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : 
                    p.difficulty === 'Medium' ? (theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-700') : (theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700')
                  }`}>{p.difficulty}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`flex-1 flex ${theme === 'dark' ? 'bg-[#0f0f13]' : 'bg-slate-50'} overflow-hidden`} ref={containerRef}>
          {activeProblem ? (
            <>
              {/* Left Pane: Problem Description */}
              <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-[#14141a]' : 'bg-white shadow-sm'} overflow-y-auto custom-scrollbar`} style={{ width: `${leftWidth}%` }}>
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <h2 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{activeProblem.title}</h2>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md shadow-sm ${
                      activeProblem.difficulty === 'Easy' ? (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') : 
                      activeProblem.difficulty === 'Medium' ? (theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200') : (theme === 'dark' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200')
                    }`}>{activeProblem.difficulty}</span>
                    <span className={`text-sm ml-auto font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>Solved by: {activeProblem.solved_by_count || 0}</span>
                  </div>
                  <div className={`prose max-w-none ${theme === 'dark' ? 'prose-invert text-gray-300' : 'text-slate-600'} space-y-8`}>
                    <div>
                      <div dangerouslySetInnerHTML={{ __html: activeProblem.description }} className="leading-relaxed whitespace-pre-wrap" />
                    </div>
                    {activeProblem.testCases && activeProblem.testCases.length > 0 && (
                      <div className="space-y-4">
                        {activeProblem.testCases.map((tc, idx) => (
                          <div key={idx} className="space-y-1">
                            <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Example {idx + 1}:</h3>
                            <div className={`p-4 rounded-xl border font-mono text-sm space-y-2 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                              <div><span className="font-bold">Input:</span> {tc.input}</div>
                              <div><span className="font-bold">Output:</span> {tc.expected}</div>
                              {tc.explanation && (
                                <div><span className="font-bold">Explanation:</span> {tc.explanation}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeProblem.inputFormat && (
                      <div>
                        <h3 className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Input Format</h3>
                        <div dangerouslySetInnerHTML={{ __html: activeProblem.inputFormat }} className="leading-relaxed whitespace-pre-wrap" />
                      </div>
                    )}
                    {activeProblem.outputFormat && (
                      <div>
                        <h3 className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Output Format</h3>
                        <div dangerouslySetInnerHTML={{ __html: activeProblem.outputFormat }} className="leading-relaxed whitespace-pre-wrap" />
                      </div>
                    )}
                    {activeProblem.constraints && (
                      <div>
                        <h3 className={`text-lg font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Constraints</h3>
                        <div dangerouslySetInnerHTML={{ __html: activeProblem.constraints }} className="leading-relaxed whitespace-pre-wrap font-mono text-sm bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Draggable Divider */}
              <div 
                onMouseDown={startDragging}
                className={`w-1.5 hover:w-2 shrink-0 cursor-col-resize z-10 transition-colors flex items-center justify-center
                  ${isDragging ? 'bg-purple-500' : theme === 'dark' ? 'bg-white/5 hover:bg-purple-500/50' : 'bg-slate-200 hover:bg-purple-500/50'}`}
              >
                <div className={`h-8 w-0.5 rounded ${theme === 'dark' ? 'bg-white/20' : 'bg-slate-400'}`} />
              </div>

              {/* Right Pane: Editor */}
              <div className={`flex flex-col ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-slate-50'}`} style={{ width: `calc(${100 - leftWidth}% - 6px)` }}>
                <div className={`h-14 shrink-0 border-b flex items-center justify-between px-3 ${theme === 'dark' ? 'bg-[#14141a] border-white/5' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg">
                      {['code', 'testcases', 'results'].map(tab => (
                        <button 
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-5 py-1.5 rounded-md text-sm font-semibold transition-all capitalize shadow-sm ${activeTab === tab ? (theme === 'dark' ? 'bg-[#282c34] text-white' : 'bg-white text-slate-800') : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5 shadow-none' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 shadow-none')}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        className={`text-sm px-3.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer ${theme === 'dark' ? 'bg-[#282c34] border-white/10 text-white hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                      >
                        <span>{languageLabels[selectedLanguage]}</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                      </button>
                      
                      {isLangOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)} />
                          <div className={`absolute right-0 mt-2 w-32 p-1 z-50 rounded-xl border shadow-xl ${theme === 'dark' ? 'bg-[#1c1c24] border-white/10' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
                            {Object.entries(languageLabels).map(([val, label]) => (
                              <button
                                key={val}
                                onClick={() => { handleLanguageChange(val); setIsLangOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedLanguage === val ? (theme === 'dark' ? 'bg-purple-500/20 text-purple-400 font-medium' : 'bg-purple-50 text-purple-600 font-medium') : (theme === 'dark' ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-slate-50 text-slate-600')}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pr-1">
                    <button onClick={handleRun} disabled={isRunning} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors border shadow-sm disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <Play size={14} className={theme === 'light' ? 'text-slate-500' : ''} /> Run
                    </button>
                    <button onClick={handleSubmit} disabled={isRunning} className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 border border-emerald-400">
                      <Send size={14} /> Submit
                    </button>
                  </div>
                </div>
 
                <div className="flex-1 relative overflow-hidden flex flex-col">
                  {activeTab === 'code' && (
                    <div className={`flex-1 overflow-auto custom-scrollbar ${theme === 'dark' ? 'bg-[#282c34]' : 'bg-white'}`}>
                      <CodeMirror
                        value={code}
                        height="100%"
                        theme={theme === 'dark' ? 'dark' : 'light'}
                        extensions={[selectedLanguage === 'cpp' ? cpp() : selectedLanguage === 'java' ? java() : python()]}
                        basicSetup={{ autocompletion: false }}
                        onChange={(value) => {
                          setCode(value);
                          setLanguageCodes(prev => ({
                            ...prev,
                            [selectedLanguage]: value
                          }));
                        }}
                        className="text-[15px]"
                      />
                    </div>
                  )}
                  {activeTab === 'testcases' && (
                    <div className="p-8 overflow-y-auto custom-scrollbar h-full text-sm">
                      {activeProblem.testCases?.map((tc, idx) => (
                        <div key={idx} className={`mb-6 p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#14141a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <div className={`font-bold text-lg mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Test Case {idx + 1}</div>
                          <div className="mb-4">
                            <span className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>Input</span>
                            <code className={`block px-4 py-3 rounded-xl font-mono ${theme === 'dark' ? 'bg-black/40 text-gray-300' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>{tc.input}</code>
                          </div>
                          <div>
                            <span className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>Expected Output</span>
                            <code className={`block px-4 py-3 rounded-xl font-mono ${theme === 'dark' ? 'bg-black/40 text-gray-300' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>{tc.expected}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'results' && results && (
                    <div className="p-8 overflow-y-auto custom-scrollbar h-full">
                      <h3 className={`text-2xl font-bold mb-6 ${results.status === 'Accepted' ? 'text-emerald-500' : results.status.includes('Error') || results.status === 'Wrong Answer' ? 'text-red-500' : (theme === 'dark' ? 'text-gray-300' : 'text-slate-800')}`}>
                        {results.status}
                      </h3>
                      {results.output && (
                        <div className={`mb-8 p-6 rounded-2xl font-mono text-sm whitespace-pre-wrap border ${theme === 'dark' ? 'bg-black/40 text-gray-300 border-white/5' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          {results.output}
                        </div>
                      )}
                      {results.time && <div className={`text-sm font-medium mb-6 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>Execution Time: <span className="font-mono">{results.time}</span></div>}
                      
                      {results.details && results.details.length > 0 && (
                        <div className="space-y-4">
                          {results.details.map((tc, idx) => (
                            <div key={idx} className={`flex flex-col p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#14141a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                              <div className="flex items-center gap-3 mb-4">
                                {tc.passed ? <CheckCircle2 className="text-emerald-500 shrink-0" size={20} /> : <Circle className="text-red-500 shrink-0" size={20} />}
                                <span className={`text-lg ${theme === 'dark' ? 'font-bold text-white' : 'font-bold text-slate-800'}`}>Test Case {tc.testCase}</span>
                                {tc.executionTime && <span className={`text-xs font-mono ml-auto px-2 py-1 rounded-md ${theme === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>{tc.executionTime}ms</span>}
                              </div>
                              {!tc.passed && (
                                <div className="text-sm mt-2 grid grid-cols-2 gap-6">
                                  <div className={`border p-4 rounded-xl ${theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'} min-w-0`}>
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>Expected</div>
                                    <code className={`block font-mono whitespace-pre-wrap break-all ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>{tc.expected}</code>
                                  </div>
                                  <div className={`border p-4 rounded-xl ${theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'} min-w-0`}>
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>Actual</div>
                                    <code className={`block font-mono whitespace-pre-wrap break-all ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>{tc.output || tc.actual}</code>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
              <p>Select a problem to start coding</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
