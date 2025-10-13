// Monaco Editor 變數
let monacoEditor = null;

// 後端API配置
const API_BASE_URL = 'http://localhost:5000';
const API_ENDPOINTS = {
  execute: `${API_BASE_URL}/api/execute`,
  validate: `${API_BASE_URL}/api/validate`,
  status: `${API_BASE_URL}/api/status`,
  restart: `${API_BASE_URL}/api/restart`,
  tabs: `${API_BASE_URL}/api/tabs`,
  auto_start: `${API_BASE_URL}/api/auto_start`
};

// 後端啟動配置
const BACKEND_CONFIG = {
  pythonExecutable: 'python',
  backendScript: '../backend/app_web.py',
  maxStartupTime: 30000, // 30秒超時
  retryInterval: 2000 // 2秒重試間隔
};

// 狀態資料結構
const stats = {
  // 基本統計
  runCount: 0, aiCheckCount: 0, keyPressCount: 0, mouseClickCount: 0,
  successfulRuns: 0, errorCount: 0,

  // 時間追蹤
  sessionStartTime: Date.now(), lastCodeChangeTime: Date.now(),
  totalCodingTime: 0,

  // 學習行為
  mouseMoveCount: 0, totalClicks: 0, meaningfulMouseMoves: 0,
  lastActivityTime: Date.now(), focusStartTime: Date.now(),
  totalFocusTime: 0, currentFocusStreak: 0, maxFocusStreak: 0,

  // 學習進度
  completedQuestions: 0, totalQuestions: 10, codeModifications: 0,
  totalScores: [], averageScore: 0, lastCodeContent: ""
};

const weaknessAnalysis = {
  syntaxErrors: 0, codingSpeed: 0, namingIssues: 0,
  analyzeWeaknesses() {
    // 依據統計推估弱點（簡化模型）
    const minutes = Math.max(1, (Date.now() - stats.sessionStartTime) / 60000);
    this.syntaxErrors = Math.min(100, Math.round((stats.errorCount / Math.max(1, stats.runCount)) * 100));
    this.codingSpeed = Math.min(100, Math.round((stats.codeModifications / minutes) * 10)); // 修改密度
    // 命名議題：偵測非慣用命名（簡單啟發式）
    const code = getCode();
    const badNames = (code.match(/\b([A-Z]{2,}|[a-zA-Z]\d{2,})\b/g) || []).length;
    this.namingIssues = Math.min(100, badNames * 10);

    this.updateWeaknessDisplay();
    this.generateSuggestions();
  },
  updateWeaknessDisplay() {
    const wSyntax = document.getElementById('weakSyntax');
    const wSpeed  = document.getElementById('weakSpeed');
    const wName   = document.getElementById('weakNaming');
    const bSyntax = document.getElementById('weakSyntaxBar');
    const bSpeed  = document.getElementById('weakSpeedBar');
    const bName   = document.getElementById('weakNamingBar');

    const s = isNaN(this.syntaxErrors) ? 0 : this.syntaxErrors;
    const c = isNaN(this.codingSpeed) ? 0 : this.codingSpeed;
    const n = isNaN(this.namingIssues) ? 0 : this.namingIssues;

    wSyntax.textContent = s + "% 頻率";
    wSpeed.textContent  = c + "% 頻率";
    wName.textContent   = n + "% 頻率";
    bSyntax.style.width = s + "%";
    bSpeed.style.width  = c + "%";
    bName.style.width   = n + "%";
  },
  generateSuggestions() {
    const list = document.getElementById('aiSuggestionList');
    list.innerHTML = "";
    const suggestions = [];
    if (this.syntaxErrors >= 30) {
      suggestions.push("降低語法錯誤：輸出前先檢查引號是否成對、括號是否完整。");
    }
    if (this.codingSpeed >= 40) {
      suggestions.push("提升效率：先列出步驟，再分段撰寫與測試，避免反覆小修改。");
    }
    if (this.namingIssues >= 30) {
      suggestions.push("命名優化：採用小寫加底線，例如 total_score、run_count。");
    }
    if (suggestions.length === 0) {
      suggestions.push("表現穩定！持續保持良好的輸入與檢查習慣。");
    }
    for (const s of suggestions) {
      const li = document.createElement('li');
      li.textContent = s;
      list.appendChild(li);
    }
  }
};

// DOM 獲取
const editorContainer = document.getElementById('codeEditor');
const outputBox = document.getElementById('outputBox');
const runBtn = document.getElementById('runBtn');
const aiCheckBtn = document.getElementById('aiCheckBtn');
const saveBtn = document.getElementById('saveBtn');
const reconnectBtn = document.getElementById('reconnectBtn');
const saveHint = document.getElementById('saveHint');
const runStatus = document.getElementById('runStatus');
const aiStatus = document.getElementById('aiStatus');
const modelSelect = document.getElementById('modelSelect');

// 期望輸出
const expectedOutput = [
  "Hello, Python!",
  "我正在學習基礎輸出",
  "這是第 1 題 ✅"
];

// 工具：格式化時間
function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n)=> String(n).padStart(2,'0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function getCode() { 
  return monacoEditor ? monacoEditor.getValue() : ""; 
}

// 更新顯示：統一入口
function updateStatsDisplay() {
  // 頂部進度與統計
  document.getElementById('runCount').textContent = stats.runCount;
  document.getElementById('codeModCount').textContent = stats.codeModifications;
  document.getElementById('codeModBottom').textContent = stats.codeModifications;
  document.getElementById('successfulRuns').textContent = stats.successfulRuns;
  document.getElementById('errorCount').textContent = stats.errorCount;

  // 平均分數
  const avg = stats.totalScores.length ? Math.round(stats.totalScores.reduce((a,b)=>a+b,0)/stats.totalScores.length) : 0;
  stats.averageScore = avg;
  document.getElementById('avgScore').textContent = avg;

  // 學習時間
  const now = Date.now();
  const sessionDuration = now - stats.sessionStartTime;
  document.getElementById('sessionDuration').textContent = formatTime(sessionDuration);
  document.getElementById('totalTimeText').textContent = formatTime(stats.totalCodingTime);
  document.getElementById('totalTimeTextCard').textContent = formatTime(stats.totalCodingTime);

  // 鍵盤 / 滑鼠 / 點擊
  document.getElementById('keyPressCount').textContent = stats.keyPressCount;
  document.getElementById('clickCount').textContent = stats.totalClicks;
  document.getElementById('mouseMoveCount').textContent = stats.mouseMoveCount;

  // 每分鐘
  const mins = Math.max(1, (now - stats.sessionStartTime)/60000);
  document.getElementById('clickPerMin').textContent = Math.round(stats.totalClicks / mins);
  document.getElementById('keyPerMin').textContent = Math.round(stats.keyPressCount / mins);

  // 進度條（行為）
  const clamp = (v)=> Math.max(0, Math.min(100, v));
  document.getElementById('mouseMoveBar').style.width = clamp(stats.mouseMoveCount/5) + "%";
  document.getElementById('clickBar').style.width = clamp(stats.totalClicks*5) + "%";
  document.getElementById('keyPressBar').style.width = clamp(stats.keyPressCount/3) + "%";
  document.getElementById('mouseMoveActive').textContent = clamp(stats.meaningfulMouseMoves) + "%";

  // 專注時間與條
  document.getElementById('focusTimeText').textContent = formatTime(stats.totalFocusTime);
  document.getElementById('focusStreakText').textContent = Math.round(stats.currentFocusStreak/1000) + "s";
  const focusPercent = clamp((stats.currentFocusStreak/1000) / 60 * 100); // 60s = 100%
  document.getElementById('focusBar').style.width = focusPercent + "%";

  // 成功率
  const successRate = stats.runCount ? Math.round((stats.successfulRuns / stats.runCount) * 100) : 0;
  document.getElementById('successRate').textContent = successRate + "%";

  // 平均編程時間（估：總編碼時間 / 修改次數）
  const avgCoding = stats.codeModifications ? stats.totalCodingTime / stats.codeModifications : 0;
  document.getElementById('avgCodingTime').textContent = formatTime(avgCoding);

  // 累計分數數量
  document.getElementById('totalScoreCount').textContent = stats.totalScores.length;

  // 更新評分儀表
  const main = Math.max(0, Math.min(100, Math.round(avg)));
  updateScoreRing(main);
  document.getElementById('mainScore').textContent = main;
  document.getElementById('subScoreQuality').textContent = Math.round(main * 0.94);
  document.getElementById('subScoreActivity').textContent = Math.min(100, Math.round((stats.keyPressCount + stats.totalClicks) / 5));
  document.getElementById('subScorePass').textContent = Math.round(successRate * 0.95);
  document.getElementById('subScoreStable').textContent = Math.max(0, 100 - stats.errorCount * 3);
}

function updateScoreRing(value) {
  const circle = document.getElementById('scoreRing');
  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ≈ 377
  const offset = circumference - (value / 100) * circumference;
  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${offset}`;
  // 顏色根據分數
  if (value >= 85) circle.style.stroke = "#16a34a";
  else if (value >= 70) circle.style.stroke = "#22c55e";
  else if (value >= 50) circle.style.stroke = "#eab308";
  else circle.style.stroke = "#ef4444";
}

function updateLearningProgress() {
  const completed = stats.completedQuestions;
  const total = stats.totalQuestions;
  const percent = Math.round((completed / total) * 100);
  document.getElementById('progressCount').textContent = completed;
  document.getElementById('totalQuestions').textContent = total;
  document.getElementById('progressBar').style.width = percent + "%";
}

function detectCodeModification() {
  const content = getCode();
  if (stats.lastCodeContent !== content) {
    stats.codeModifications++;
    stats.lastCodeContent = content;
    stats.lastCodeChangeTime = Date.now();
    saveHint.textContent = "有未儲存的變更";
    updateStatsDisplay();
  }
}

// 檢查後端狀態
async function checkBackendStatus() {
  try {
    const response = await fetch(API_ENDPOINTS.status, {
      credentials: 'include'
    });
    const status = await response.json();
    
    // 更新界面狀態顯示
    const statusElement = document.getElementById('backendStatus');
    if (statusElement) {
      if (status.browser_ready && status.user_tab_ready) {
        statusElement.textContent = '就緒';
        statusElement.className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border';
      } else if (status.browser_ready) {
        statusElement.textContent = '初始化中';
        statusElement.className = 'text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border';
      } else {
        statusElement.textContent = '離線';
        statusElement.className = 'text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border';
      }
    }
    
    return status;
  } catch (err) {
    console.error('後端狀態檢查失敗:', err);
    const statusElement = document.getElementById('backendStatus');
    if (statusElement) {
      statusElement.textContent = '連線錯誤';
      statusElement.className = 'text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border';
    }
    return null;
  }
}

// 自動啟動後端
async function startBackendAutomatically() {
  console.log('🚀 正在自動啟動後端服務...');
  
  // 更新狀態顯示
  const statusElement = document.getElementById('backendStatus');
  if (statusElement) {
    statusElement.textContent = '自動啟動中';
    statusElement.className = 'text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border';
  }
  
  try {
    // 嘗試通過後端的自動啟動端點來確認服務狀態
    const response = await fetch(API_ENDPOINTS.auto_start, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 後端服務響應正常:', result.message);
      return await waitForBackendReady();
    }
  } catch (err) {
    console.log('⚠️ 後端服務未運行，需要手動啟動');
  }
  
  // 如果自動啟動失敗，顯示手動啟動提示
  showManualStartupGuide();
  return false;
}

// 等待後端準備就緒
async function waitForBackendReady() {
  const startTime = Date.now();
  const statusElement = document.getElementById('backendStatus');
  
  while (Date.now() - startTime < BACKEND_CONFIG.maxStartupTime) {
    try {
      const status = await checkBackendStatus();
      if (status && status.browser_ready) {
        console.log('✅ 後端已準備就緒');
        return true;
      }
    } catch (err) {
      // 忽略連接錯誤，繼續等待
    }
    
    // 更新狀態顯示
    if (statusElement) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      statusElement.textContent = `啟動中 ${elapsed}s`;
    }
    
    // 等待後重試
    await new Promise(resolve => setTimeout(resolve, BACKEND_CONFIG.retryInterval));
  }
  
  console.log('⏰ 後端啟動超時');
  return false;
}

// 顯示手動啟動指南
function showManualStartupGuide() {
  const statusElement = document.getElementById('backendStatus');
  if (statusElement) {
    statusElement.textContent = '需要手動啟動';
    statusElement.className = 'text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 border cursor-pointer';
    statusElement.title = '點擊查看啟動指南';
    statusElement.onclick = () => showStartupModal();
  }
}

// 顯示啟動指南彈窗
function showStartupModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-lg mx-4 shadow-xl">
      <h3 class="text-lg font-bold mb-4 text-gray-800">🚀 後端啟動指南</h3>
      <div class="space-y-4 text-sm text-gray-600">
        <div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p class="font-semibold text-blue-800 mb-2">💡 推薦方法（最簡單）：</p>
          <p>雙擊專案目錄中的 <strong>start_backend.bat</strong> 或 <strong>start_backend.ps1</strong> 檔案</p>
        </div>
        
        <div class="bg-gray-50 p-3 rounded-lg border">
          <p class="font-semibold text-gray-800 mb-2">🔧 手動啟動方法：</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>打開 PowerShell 或命令提示字元</li>
            <li>導航到後端目錄：<br><code class="bg-gray-200 px-1 py-0.5 rounded text-xs">cd "${window.location.pathname.replace('/frontend/main.html', '/backend').replace('/', '')}"</code></li>
            <li>執行後端：<br><code class="bg-gray-200 px-1 py-0.5 rounded text-xs">python app_web.py</code></li>
            <li>等待看到 "📱 網頁應用程式將在 http://localhost:5000 運行" 訊息</li>
            <li>重新整理此頁面</li>
          </ol>
        </div>
        
        <div class="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <p class="text-yellow-800"><strong>⚠️ 注意：</strong></p>
          <ul class="list-disc list-inside space-y-1 text-yellow-700">
            <li>確保已安裝 Python 3.7+</li>
            <li>確保已安裝必要套件：flask, flask-cors, selenium, webdriver-manager</li>
            <li>如果遇到套件錯誤，請執行：<br><code class="bg-yellow-200 px-1 py-0.5 rounded text-xs">pip install flask flask-cors selenium webdriver-manager</code></li>
          </ul>
        </div>
        
        <div class="text-xs text-gray-500 mt-3">
          💡 提示：後端啟動後請保持終端視窗開啟，不要關閉它
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">關閉</button>
        <button onclick="window.location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">重新整理頁面</button>
        <button onclick="openBackendFolder()" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">打開後端目錄</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 打開後端目錄（嘗試）
function openBackendFolder() {
  const backendPath = window.location.pathname.replace('/frontend/main.html', '/backend').replace('/', '');
  // 嘗試使用 file:// 協議打開目錄
  try {
    window.open(`file:///${backendPath}`, '_blank');
  } catch (e) {
    // 如果失敗，顯示路徑
    alert(`請手動導航到此目錄：\n${backendPath}`);
  }
}

// 重新連接後端
async function reconnectBackend() {
  try {
    const response = await fetch(API_ENDPOINTS.restart, {
      method: 'POST',
      credentials: 'include'
    });
    const result = await response.json();
    
    if (result.success) {
      // 顯示重連中狀態
      const statusElement = document.getElementById('backendStatus');
      if (statusElement) {
        statusElement.textContent = '重新連接中';
        statusElement.className = 'text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border';
      }
      
      // 等待一段時間後重新檢查狀態
      setTimeout(() => {
        checkBackendStatus();
      }, 3000);
      
      return true;
    }
  } catch (err) {
    console.error('重新連接失敗:', err);
  }
  return false;
}

// 保留原本的模擬執行函數作為AI檢查使用
function simulatePythonRun(code) {
  // 簡易偵錯：引號不成對、未關閉括號
  const quoteCount = (code.match(/"/g) || []).length + (code.match(/'/g) || []).length;
  const parenOpen = (code.match(/\(/g) || []).length;
  const parenClose = (code.match(/\)/g) || []).length;
  const hasSyntaxIssue = quoteCount % 2 !== 0 || parenOpen !== parenClose;

  if (hasSyntaxIssue) {
    throw new Error("語法錯誤：請檢查引號或括號是否成對。");
  }

  // 擷取 print("...") 的內容
  const lines = code.split(/\r?\n/);
  const outputs = [];
  for (const line of lines) {
    const m = line.match(/^\s*print\s*\((["'`])(.*)\1\s*\)\s*$/);
    if (m) {
      outputs.push(m[2]);
    }
  }
  if (outputs.length === 0) {
    outputs.push("(沒有檢測到輸出)");
  }
  return outputs.join("\n");
}

// AI 檢查：比對預期輸出並給分
function aiCheck() {
  stats.aiCheckCount++;
  aiStatus.textContent = "分析中...";
  aiStatus.className = "text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200";

  setTimeout(() => {
    let runText = "";
    let ok = false;
    try {
      runText = simulatePythonRun(getCode());
      const expected = expectedOutput.join("\n");
      const similarity = compareStrings(expected, runText);
      const score = Math.round(similarity * 100);
      stats.totalScores.push(score);
      if (score >= 85 && stats.completedQuestions === 0) {
        stats.completedQuestions = 1; // 通關第一題
      }
      ok = score >= 85;

      // 顯示 AI 分析
      const list = document.getElementById('aiSuggestionList');
      list.innerHTML = "";
      const suggestions = [];
      if (ok) {
        suggestions.push("輸出與題目一致，做得很好！");
        suggestions.push("下一步：嘗試使用變數將字串組裝後再輸出。");
      } else {
        suggestions.push("輸出與預期不完全一致，請檢查標點、空格與符號。");
        suggestions.push("每一行需各自輸出一次，注意換行。");
        // 顯示相異行
        const exp = expectedOutput;
        const got = runText.split("\n");
        const maxLen = Math.max(exp.length, got.length);
        for (let i=0; i<maxLen; i++) {
          if ((exp[i]||"") !== (got[i]||"")) {
            suggestions.push(`第 ${i+1} 行不同：預期「${exp[i]||"(空)"}」 / 實際「${got[i]||"(空)"}」`);
          }
        }
      }
      suggestions.forEach(s=>{
        const li = document.createElement('li');
        li.textContent = s;
        document.getElementById('aiSuggestionList').appendChild(li);
      });

    } catch (err) {
      stats.errorCount++;
      runText = "錯誤：" + err.message;
      const li = document.createElement('li');
      li.textContent = "偵測到語法錯誤：請檢查引號與括號。";
      document.getElementById('aiSuggestionList').innerHTML = "";
      document.getElementById('aiSuggestionList').appendChild(li);
    }

    // 更新
    updateLearningProgress();
    updateStatsDisplay();
    weaknessAnalysis.analyzeWeaknesses();

    aiStatus.textContent = "完成";
    aiStatus.className = "text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200";
  }, 400);
}

// 簡易字串相似度（以行為主，逐行比對）
function compareStrings(a, b) {
  const A = a.split("\n");
  const B = b.split("\n");
  const max = Math.max(A.length, B.length);
  if (max === 0) return 1;
  let same = 0;
  for (let i=0;i<max;i++) if ((A[i]||"") === (B[i]||"")) same++;
  return same / max;
}

// 執行程式 - 呼叫API
async function runProgram() {
  stats.runCount++;
  runStatus.textContent = "執行中...";
  runStatus.className = "text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border";
  
  // 變更按鈕狀態
  runBtn.disabled = true;
  runBtn.textContent = "執行中...";
  
  try {
    const code = getCode();
    if (!code.trim()) {
      throw new Error('程式碼不能為空');
    }
    
    const response = await fetch(API_ENDPOINTS.execute, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: code }),
      credentials: 'include' // 包含session cookie
    });
    
    const result = await response.json();
    
    if (result.success) {
      outputBox.textContent = result.output || '執行成功，但沒有輸出';
      outputBox.classList.remove('text-red-300');
      outputBox.classList.add('text-green-200');
      stats.successfulRuns++;
      runStatus.textContent = "完成";
      runStatus.className = "text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border";
    } else {
      throw new Error(result.error || '執行失敗');
    }
    
  } catch (err) {
    console.error('執行錯誤:', err);
    outputBox.textContent = `錯誤: ${err.message}`;
    outputBox.classList.remove('text-green-200');
    outputBox.classList.add('text-red-300');
    stats.errorCount++;
    runStatus.textContent = "錯誤";
    runStatus.className = "text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border";
  } finally {
    // 恢復按鈕狀態
    runBtn.disabled = false;
    runBtn.textContent = "▶️ 執行程式";
    updateStatsDisplay();
  }
}

// 儲存程式碼（localStorage）
function saveCode() {
  try {
    localStorage.setItem("python_diagnose_code", getCode());
    saveHint.textContent = "已儲存 ✅";
    setTimeout(()=>{ saveHint.textContent = "已儲存"; }, 1500);
  } catch (e) {
    saveHint.textContent = "儲存失敗";
  }
}

// 事件監聽系統
document.addEventListener('keydown', (e) => {
  stats.keyPressCount++;
  stats.lastActivityTime = Date.now();
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    runProgram();
  }
  updateStatsDisplay();
});

document.addEventListener('mousemove', (e) => {
  stats.mouseMoveCount++;
  // 意義性移動估計
  if (stats.mouseMoveCount % 20 === 0) {
    stats.meaningfulMouseMoves = Math.min(100, stats.meaningfulMouseMoves + 1);
  }
  stats.lastActivityTime = Date.now();
  updateStatsDisplay();
});

document.addEventListener('click', (e) => {
  stats.mouseClickCount++;
  stats.totalClicks++;
  stats.lastActivityTime = Date.now();
  updateStatsDisplay();
});

// Monaco Editor 初始化後會設置事件監聽器

window.addEventListener('focus', () => {
  stats.focusStartTime = Date.now();
});

window.addEventListener('blur', () => {
  const now = Date.now();
  stats.totalFocusTime += now - stats.focusStartTime;
  stats.currentFocusStreak = 0;
  updateStatsDisplay();
});

// 專注 streak 計時（每秒）
setInterval(() => {
  stats.currentFocusStreak += 1000;
  if (stats.currentFocusStreak > stats.maxFocusStreak) stats.maxFocusStreak = stats.currentFocusStreak;
  // 自動累積編碼時間：若最近 5 秒內有活動或焦點在
  if (document.hasFocus() && (Date.now() - stats.lastActivityTime) < 5000) {
    stats.totalCodingTime += 1000;
  }
  updateStatsDisplay();
}, 1000);

// 每分鐘更新下一次評估時間顯示
function updateNextAssessmentText() {
  const now = new Date();
  const next = new Date(now.getTime() + 60*1000);
  const hh = String(next.getHours()).padStart(2,'0');
  const mm = String(next.getMinutes()).padStart(2,'0');
  document.getElementById('nextAssessment').textContent = `${hh}:${mm}`;
}
updateNextAssessmentText();
setInterval(updateNextAssessmentText, 60*1000);

// 每 5 分鐘自動弱點分析（示範可縮短，但遵照規格使用 5 分鐘）
setInterval(() => {
  weaknessAnalysis.analyzeWeaknesses();
}, 5 * 60 * 1000);

// 按鈕
runBtn.addEventListener('click', (e) => { e.preventDefault(); runProgram(); });
aiCheckBtn.addEventListener('click', (e) => { e.preventDefault(); aiCheck(); });
saveBtn.addEventListener('click', (e) => { e.preventDefault(); saveCode(); });
reconnectBtn.addEventListener('click', (e) => { e.preventDefault(); reconnectBackend(); });
document.getElementById('manualAnalyzeBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  aiStatus.textContent = "手動分析中...";
  aiStatus.className = "text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200";
  setTimeout(()=>{
    weaknessAnalysis.analyzeWeaknesses();
    aiStatus.textContent = "完成";
    aiStatus.className = "text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200";
  }, 300);
});

// 模型選擇提示（僅顯示狀態，無外部呼叫）
modelSelect.addEventListener('change', ()=>{
  const badge = document.getElementById('modelBadge');
  badge.textContent = modelSelect.value + "（Demo）";
});

// 學習進度初始化
async function initFromStorage() {
  // Monaco Editor 已經在初始化時載入了保存的代碼
  // 這裡只需要初始化後端
  await initializeBackend();
  
  updateLearningProgress();
  updateStatsDisplay();
  weaknessAnalysis.analyzeWeaknesses();
}

// 初始化後端連接
async function initializeBackend() {
  console.log('🔄 正在初始化後端連接...');
  
  // 首先檢查後端是否已經運行
  let status = await checkBackendStatus();
  
  if (!status) {
    console.log('🚀 後端未運行，嘗試自動啟動...');
    const started = await startBackendAutomatically();
    
    if (started) {
      status = await checkBackendStatus();
    } else {
      console.log('⚠️ 自動啟動失敗，請手動啟動後端');
      return;
    }
  }
  
  if (status && status.browser_ready) {
    console.log('✅ 後端已就緒');
  } else if (status) {
    console.log('⏳ 後端正在初始化中...');
    // 等待後端完全就緒
    await waitForBackendReady();
  }
}

// 不要在這裡直接調用 initFromStorage()，等 Monaco Editor 初始化完成後再調用

// 定期檢查後端狀態
setInterval(checkBackendStatus, 10000); // 每10秒檢查一次

// 測試工具
window.testLearningProgress = {
  completeQuestion() {
    stats.completedQuestions = Math.min(stats.totalQuestions, stats.completedQuestions + 1);
    updateLearningProgress(); updateStatsDisplay();
  },
  addScore(score) {
    stats.totalScores.push(Math.max(0, Math.min(100, score)));
    updateStatsDisplay();
  },
  simulateProgress() {
    stats.keyPressCount += 50;
    stats.totalClicks += 20;
    stats.mouseMoveCount += 200;
    stats.totalCodingTime += 5 * 60 * 1000;
    stats.codeModifications += 5;
    updateLearningProgress(); updateStatsDisplay();
  },
  resetProgress() {
    Object.assign(stats, {
      runCount: 0, aiCheckCount: 0, keyPressCount: 0, mouseClickCount: 0,
      successfulRuns: 0, errorCount: 0,
      sessionStartTime: Date.now(), lastCodeChangeTime: Date.now(),
      totalCodingTime: 0,
      mouseMoveCount: 0, totalClicks: 0, meaningfulMouseMoves: 0,
      lastActivityTime: Date.now(), focusStartTime: Date.now(),
      totalFocusTime: 0, currentFocusStreak: 0, maxFocusStreak: 0,
      completedQuestions: 0, totalQuestions: 10, codeModifications: 0,
      totalScores: [], averageScore: 0, lastCodeContent: ""
    });
    updateLearningProgress(); updateStatsDisplay(); weaknessAnalysis.analyzeWeaknesses();
  },
  simulateError() {
    stats.errorCount++; updateStatsDisplay(); weaknessAnalysis.analyzeWeaknesses();
  },
  analyzeWeaknesses() {
    weaknessAnalysis.analyzeWeaknesses();
  }
};

// Monaco Editor 初始化
function initializeMonacoEditor() {
  require.config({
    paths: {
      'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
    }
  });

  require(['vs/editor/editor.main'], function() {
    monacoEditor = monaco.editor.create(editorContainer, {
      value: `# 請完成題目要求，輸出三行指定文字
print("Hello, Python!")
print("我正在學習基礎輸出")
print("這是第 1 題 ✅")`,
      language: 'python',
      theme: 'vs-light',
      fontSize: 14,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: 'on',
      lineHeight: 20,
      padding: { top: 10, bottom: 10 },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      }
    });

    // 設置事件監聽器
    monacoEditor.onDidChangeModelContent(() => {
      detectCodeModification();
    });

    // 設置快捷鍵 (Ctrl+Enter 執行)
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runProgram();
    });

    // 嘗試載入保存的代碼
    try {
      const saved = localStorage.getItem("python_diagnose_code");
      if (saved) {
        monacoEditor.setValue(saved);
        stats.lastCodeContent = saved;
        if (saveHint) saveHint.textContent = "已載入本機儲存";
      }
    } catch (e) {}

    console.log('Monaco Editor 初始化完成');
    
    // Monaco Editor 初始化完成後，執行其他初始化
    initFromStorage();
  });
}

// 當 DOM 載入完成後初始化 Monaco Editor
document.addEventListener('DOMContentLoaded', () => {
  initializeMonacoEditor();
});