// Monaco Editor 變數
let monacoEditor = null;

// 後端API配置 - 支援本地和 ngrok 自動切換
const API_CONFIG = {
  local: 'http://localhost:5000',
  ngrok: 'https://karissa-unsiding-graphemically.ngrok-free.dev',
  current: localStorage.getItem('apiMode') || 'local', // 預設使用本地
  autoDetected: false // 標記是否已自動偵測
};

// 獲取當前 API URL
function getApiBaseUrl() {
  return API_CONFIG[API_CONFIG.current];
}

// 🔍 自動偵測可用的 API
async function autoDetectAPI() {
  console.log('🔍 開始自動偵測 API...');
  
  // 先嘗試 localStorage 中儲存的模式
  const savedMode = localStorage.getItem('apiMode');
  if (savedMode && (savedMode === 'local' || savedMode === 'ngrok')) {
    const isAvailable = await testAPIConnection(savedMode);
    if (isAvailable) {
      console.log(`✅ 使用已儲存的 ${savedMode} 模式`);
      API_CONFIG.current = savedMode;
      API_CONFIG.autoDetected = true;
      updateApiModeDisplay();
      return savedMode;
    }
  }
  
  // 測試順序：先 local，再 ngrok
  for (const mode of ['local', 'ngrok']) {
    console.log(`🔍 測試 ${mode} 模式...`);
    const isAvailable = await testAPIConnection(mode);
    
    if (isAvailable) {
      console.log(`✅ ${mode} 模式可用！自動切換`);
      API_CONFIG.current = mode;
      API_CONFIG.autoDetected = true;
      localStorage.setItem('apiMode', mode);
      updateApiModeDisplay();
      
      // 同步更新 questions manager
      if (window.questionsManager) {
        window.questionsManager.setApiUrl(getApiBaseUrl());
      }
      
      return mode;
    }
  }
  
  console.error('❌ 無法連接到任何 API 伺服器');
  API_CONFIG.autoDetected = true;
  updateApiModeDisplay();
  return null;
}

// 🧪 測試 API 連接
async function testAPIConnection(mode) {
  const url = API_CONFIG[mode];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒逾時
    
    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log(`⚠️ ${mode} 模式無法連接:`, error.message);
    return false;
  }
}

// 設定 API 模式（手動切換）
function setApiMode(mode) {
  if (mode === 'local' || mode === 'ngrok') {
    API_CONFIG.current = mode;
    localStorage.setItem('apiMode', mode);
    console.log(`✅ API 模式已切換為: ${mode} (${getApiBaseUrl()})`);
    
    // 更新 UI 顯示
    updateApiModeDisplay();
    
    // 同步更新 questions manager
    if (window.questionsManager) {
      window.questionsManager.setApiUrl(getApiBaseUrl());
    }
    
    return true;
  }
  return false;
}

// 更新 API 模式顯示
function updateApiModeDisplay() {
  const badge = document.getElementById('modelBadge');
  if (badge) {
    const mode = API_CONFIG.current;
    const url = getApiBaseUrl();
    const autoText = API_CONFIG.autoDetected ? ' (自動)' : '';
    badge.textContent = (mode === 'local' ? '本地模式' : 'ngrok 模式') + autoText;
    badge.title = url;
    badge.className = `text-xs px-2 py-1 rounded-full ${
      mode === 'local' 
        ? 'text-green-600 bg-green-50 border border-green-200' 
        : 'text-indigo-600 bg-indigo-50 border border-indigo-200'
    }`;
  }
}

// 後端API配置對象（使用動態 URL）
const API_ENDPOINTS = {
  get execute() { return `${getApiBaseUrl()}/api/execute`; },
  get validate() { return `${getApiBaseUrl()}/api/validate`; },
  get status() { return `${getApiBaseUrl()}/api/status`; },
  get restart() { return `${getApiBaseUrl()}/api/restart`; },
  get aiAnalyze() { return `${getApiBaseUrl()}/api/ai/analyze`; },
  get aiCheck() { return `${getApiBaseUrl()}/api/ai/check`; },
  get aiSuggest() { return `${getApiBaseUrl()}/api/ai/suggest`; }
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
  totalScores: [], averageScore: 0, lastCodeContent: "",
  
  // 學生資訊
  studentName: localStorage.getItem('studentName') || ''
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
  // 🆕 顯示學生姓名
  const studentNameDisplay = document.getElementById('studentNameText');
  if (studentNameDisplay) {
    studentNameDisplay.textContent = stats.studentName || '未設定';
  }
  
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

  // ⚠️ 注意：不要在這裡更新 AI 評分系統的分數
  // AI 評分系統的分數應該只由 AI 分析結果更新，而不是統計數據
  // 這樣可以避免覆蓋 AI 的詳細評分
  
  // 如果沒有任何分數記錄，則顯示統計平均分（僅供參考）
  // 但不會覆蓋 AI 分析的詳細評分
}

function updateScoreRing(value) {
  const circle = document.getElementById('scoreRing');
  const radius = 75; // 更新為新的半徑
  const circumference = 2 * Math.PI * radius; // ≈ 471
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
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      }
    });
    
    // 檢查回應是否為 JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('後端回傳非 JSON 內容:', text.substring(0, 200));
      throw new Error('後端回傳了 HTML 而非 JSON，可能是 ngrok 的攔截頁面。請檢查 ngrok 是否正確設定，或嘗試在瀏覽器中直接訪問: ' + API_ENDPOINTS.status);
    }
    
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
      statusElement.textContent = 'ngrok 攔截';
      statusElement.className = 'text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 border';
      statusElement.title = '點擊查看說明';
      statusElement.style.cursor = 'pointer';
      statusElement.onclick = () => showNgrokWarningModal();
    }
    return null;
  }
}

// 初始化後端連接
async function initializeBackend() {
  console.log('🔄 正在初始化後端連接...');
  
  // 檢查後端狀態
  await checkBackendStatus();
}

// 顯示 ngrok 攔截警告
function showNgrokWarningModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-2xl mx-4 shadow-xl">
      <h3 class="text-lg font-bold mb-4 text-gray-800">⚠️ ngrok 攔截問題</h3>
      <div class="space-y-4 text-sm text-gray-600">
        <div class="bg-orange-50 p-3 rounded-lg border border-orange-200">
          <p class="font-semibold text-orange-800 mb-2">🔍 問題診斷</p>
          <p>後端回傳了 HTML 而不是 JSON，這通常是因為：</p>
          <ul class="list-disc list-inside space-y-1 text-orange-700 mt-2">
            <li>ngrok 顯示了警告/歡迎頁面（免費版會有「Visit Site」按鈕）</li>
            <li>ngrok 沒有正確轉發請求到本地後端</li>
            <li>後端服務沒有正確啟動</li>
          </ul>
        </div>
        
        <div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p class="font-semibold text-blue-800 mb-2">✅ 解決方案 1：跳過 ngrok 警告頁</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>在瀏覽器新分頁開啟：<br>
              <code class="bg-blue-100 px-2 py-1 rounded text-xs select-all block mt-1">https://karissa-unsiding-graphemically.ngrok-free.dev/api/status</code>
            </li>
            <li>點擊 ngrok 頁面上的「<strong>Visit Site</strong>」按鈕</li>
            <li>確認看到 JSON 回應（例如：{"browser_ready": true, ...}）</li>
            <li>回到此頁面重新整理（Ctrl+F5）</li>
          </ol>
        </div>
        
        <div class="bg-green-50 p-3 rounded-lg border border-green-200">
          <p class="font-semibold text-green-800 mb-2">✅ 解決方案 2：使用本地模式</p>
          <p>如果您的後端在本機運行（localhost:5000），可以直接使用本地模式：</p>
          <button onclick="setApiMode('local'); this.closest('.fixed').remove(); location.reload();" 
                  class="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors w-full">
            🔄 切換到本地模式 (localhost:5000)
          </button>
        </div>
        
        <div class="bg-gray-50 p-3 rounded-lg border">
          <p class="font-semibold text-gray-800 mb-2">🔧 解決方案 3：確認後端運行</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>確認 Python 後端已啟動：<code class="bg-gray-200 px-1 rounded">python server.py</code></li>
            <li>確認本地可訪問：開啟 <code class="bg-gray-200 px-1 rounded">http://localhost:5000/api/status</code></li>
            <li>確認 ngrok 已啟動並指向正確 port：<code class="bg-gray-200 px-1 rounded">ngrok http 5000 --domain=...</code></li>
          </ol>
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">關閉</button>
        <button onclick="window.open('https://karissa-unsiding-graphemically.ngrok-free.dev/api/status', '_blank')" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">開啟後端 API</button>
        <button onclick="window.location.reload()" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">重新整理</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 顯示 API 模式選擇對話框
function showApiModeSelector() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
      <h3 class="text-lg font-bold mb-4 text-gray-800">🔄 選擇 API 模式</h3>
      <div class="space-y-3">
        <button onclick="setApiMode('local'); this.closest('.fixed').remove(); location.reload();" 
                class="w-full p-4 text-left rounded-lg border-2 ${API_CONFIG.current === 'local' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'} transition-all">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold text-gray-800">🏠 本地模式</div>
              <div class="text-sm text-gray-600">http://localhost:5000</div>
            </div>
            ${API_CONFIG.current === 'local' ? '<span class="text-green-600">✓</span>' : ''}
          </div>
          <div class="text-xs text-gray-500 mt-2">適用於本機開發，速度快，無需網路</div>
        </button>
        
        <button onclick="setApiMode('ngrok'); this.closest('.fixed').remove(); location.reload();" 
                class="w-full p-4 text-left rounded-lg border-2 ${API_CONFIG.current === 'ngrok' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'} transition-all">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold text-gray-800">🌐 ngrok 模式</div>
              <div class="text-sm text-gray-600">karissa-unsiding-graphemically.ngrok-free.dev</div>
            </div>
            ${API_CONFIG.current === 'ngrok' ? '<span class="text-indigo-600">✓</span>' : ''}
          </div>
          <div class="text-xs text-gray-500 mt-2">適用於遠端訪問，需要 ngrok 運行</div>
        </button>
      </div>
      <div class="mt-4 pt-4 border-t">
        <div class="text-xs text-gray-500 mb-3">
          💡 提示：您可以隨時點擊右上角的「切換」按鈕或標籤來更改模式
        </div>
        <button onclick="this.closest('.fixed').remove()" 
                class="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
          取消
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 重新連接後端
async function reconnectBackend() {
  try {
    const response = await fetch(API_ENDPOINTS.restart, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      }
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

// 保留原本的模擬執行函數作為後備方案
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

// AI 檢查：使用真實的 Gemini API
async function aiCheck() {
  stats.aiCheckCount++;
  aiStatus.textContent = "AI 分析中...";
  aiStatus.className = "text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200";

  try {
    const code = getCode();
    const currentQuestion = window.questionsManager.getCurrentQuestion();
    
    if (!currentQuestion) {
      throw new Error('找不到當前題目資料');
    }
    
    let runText = "";
    
    // 先嘗試執行程式碼獲取輸出
    try {
      const execResponse = await fetch(API_ENDPOINTS.execute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'PythonDiagnosticPlatform'
        },
        body: JSON.stringify({ code: code })
      });
      
      const execResult = await execResponse.json();
      if (execResult.success) {
        runText = execResult.output || '';
      } else {
        runText = '執行錯誤: ' + (execResult.error || '未知錯誤');
      }
    } catch (err) {
      console.error('執行失敗，使用模擬輸出:', err);
      runText = simulatePythonRun(code);
    }

    // 構建預期輸出（從測試案例）
    let expectedOutputText = '';
    if (currentQuestion.test_cases && currentQuestion.test_cases.length > 0) {
      expectedOutputText = currentQuestion.test_cases.map(tc => 
        `輸入 ${tc.input} 時，預期輸出: ${tc.output}`
      ).join('\n');
    }

    // 呼叫 AI 分析 API
    const response = await fetch(API_ENDPOINTS.aiAnalyze, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      },
      body: JSON.stringify({
        code: code,
        output: runText,
        expected_output: expectedOutputText,
        question: `${currentQuestion.title}\n${currentQuestion.description}`
      })
    });

    const result = await response.json();
    
    if (result.success && result.analysis) {
      const analysis = result.analysis;
      const overallScore = analysis.overall_score || 0;
      
      // 記錄分數
      stats.totalScores.push(overallScore);
      
      // 更新完成狀態
      if (overallScore >= 85 && stats.completedQuestions < window.questionsManager.getTotalQuestions()) {
        stats.completedQuestions++;
      }
      
      // 🆕 提交成績到後端（包含所有評分細項）
      const questionId = currentQuestion.id || currentQuestion.task_number;
      const submitted = await submitScoreToBackend(questionId, overallScore, code, {
        time_complexity: analysis.time_complexity_score,
        space_complexity: analysis.space_complexity_score,
        readability: analysis.readability_score,
        stability: analysis.stability_score
      });
      
      // 🎯 更新 AI 評分系統的各項分數
      if (analysis.time_complexity_score !== undefined) {
        document.getElementById('subScoreTimeComplexity').textContent = analysis.time_complexity_score;
      }
      if (analysis.space_complexity_score !== undefined) {
        document.getElementById('subScoreSpaceComplexity').textContent = analysis.space_complexity_score;
      }
      if (analysis.readability_score !== undefined) {
        document.getElementById('subScoreReadability').textContent = analysis.readability_score;
      }
      if (analysis.stability_score !== undefined) {
        document.getElementById('subScoreStability').textContent = analysis.stability_score;
      }
      
      // 更新總分圓環
      updateScoreRing(overallScore);
      document.getElementById('mainScore').textContent = overallScore;
      
      // 顯示 AI 分析結果
      const list = document.getElementById('aiSuggestionList');
      list.innerHTML = "";
      
      // 添加成績提交狀態提示
      if (submitted) {
        const submittedDiv = document.createElement('div');
        submittedDiv.className = 'bg-green-50 border border-green-200 rounded-lg p-3 mb-3 shadow-sm';
        
        // 建立評分詳情文字
        const timeScore = analysis.time_complexity_score !== undefined ? analysis.time_complexity_score : '-';
        const spaceScore = analysis.space_complexity_score !== undefined ? analysis.space_complexity_score : '-';
        const readScore = analysis.readability_score !== undefined ? analysis.readability_score : '-';
        const stabScore = analysis.stability_score !== undefined ? analysis.stability_score : '-';
        
        submittedDiv.innerHTML = `
          <div class="flex items-start gap-3">
            <span class="text-2xl">✅</span>
            <div class="flex-1">
              <div class="font-semibold text-green-800 mb-2">成績已記錄</div>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div class="bg-white rounded px-2 py-1 border border-green-200">
                  <div class="text-gray-500">總分</div>
                  <div class="text-lg font-bold text-gray-800">${overallScore}<span class="text-sm text-gray-500">/100</span></div>
                </div>
                <div class="bg-white rounded px-2 py-1 border border-indigo-200">
                  <div class="text-gray-500">⏱️ 時間</div>
                  <div class="text-lg font-bold text-indigo-700">${timeScore}<span class="text-sm text-indigo-500">/10</span></div>
                </div>
                <div class="bg-white rounded px-2 py-1 border border-purple-200">
                  <div class="text-gray-500">💾 空間</div>
                  <div class="text-lg font-bold text-purple-700">${spaceScore}<span class="text-sm text-purple-500">/10</span></div>
                </div>
                <div class="bg-white rounded px-2 py-1 border border-green-200">
                  <div class="text-gray-500">📖 易讀</div>
                  <div class="text-lg font-bold text-green-700">${readScore}<span class="text-sm text-green-500">/10</span></div>
                </div>
                <div class="bg-white rounded px-2 py-1 border border-blue-200">
                  <div class="text-gray-500">🛡️ 穩定</div>
                  <div class="text-lg font-bold text-blue-700">${stabScore}<span class="text-sm text-blue-500">/10</span></div>
                </div>
              </div>
            </div>
          </div>
        `;
        document.getElementById('aiAnalysisBox').insertBefore(submittedDiv, list);
      }
      
      // 添加總體評語
      if (analysis.feedback) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-3 shadow-sm';
        feedbackDiv.innerHTML = `<div class="flex items-start gap-2"><span class="text-2xl">💬</span><div><strong class="text-blue-800">AI 評語</strong><div class="mt-2 text-gray-700 leading-relaxed">${analysis.feedback.replace(/\n/g, '<br>')}</div></div></div>`;
        document.getElementById('aiAnalysisBox').insertBefore(feedbackDiv, list);
      }
      
      // 更新狀態
      if (overallScore >= 85) {
        stats.successfulRuns++;
      } else {
        stats.errorCount++;
      }
      
    } else {
      throw new Error(result.error || 'AI 分析失敗');
    }

    // 更新顯示
    updateLearningProgress();
    updateStatsDisplay();
    weaknessAnalysis.analyzeWeaknesses();

    aiStatus.textContent = "分析完成 ✓";
    aiStatus.className = "text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200";
    
  } catch (err) {
    console.error('AI 檢查錯誤:', err);
    stats.errorCount++;
    
    // 顯示錯誤訊息
    const list = document.getElementById('aiSuggestionList');
    list.innerHTML = "";
    const li = document.createElement('li');
    li.className = 'text-red-600';
    li.textContent = `AI 分析失敗: ${err.message}`;
    list.appendChild(li);
    
    // 嘗試使用本地模擬分析作為後備
    try {
      const runText = simulatePythonRun(getCode());
      const expected = expectedOutput.join("\n");
      const similarity = compareStrings(expected, runText);
      const score = Math.round(similarity * 100);
      stats.totalScores.push(score);
      
      const backupLi = document.createElement('li');
      backupLi.textContent = `使用本地分析：相似度 ${score}%`;
      list.appendChild(backupLi);
    } catch (e) {
      console.error('本地分析也失敗:', e);
    }
    
    updateStatsDisplay();
    
    aiStatus.textContent = "分析失敗";
    aiStatus.className = "text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200";
  }
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
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      },
      body: JSON.stringify({ code: code })
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

// 手動分析按鈕 - 使用真實 AI 建議
document.getElementById('manualAnalyzeBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  aiStatus.textContent = "AI 深度分析中...";
  aiStatus.className = "text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200";
  
  try {
    const code = getCode();
    const statsData = {
      run_count: stats.runCount,
      error_count: stats.errorCount,
      success_rate: stats.runCount ? Math.round((stats.successfulRuns / stats.runCount) * 100) : 0,
      modifications: stats.codeModifications
    };
    
    // 呼叫 AI 建議 API
    const response = await fetch(API_ENDPOINTS.aiSuggest, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      },
      body: JSON.stringify({
        code: code,
        stats: statsData
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.suggestions) {
      const suggestions = result.suggestions;
      
      // 更新立即行動建議
      const actionList = document.getElementById('actionList');
      actionList.innerHTML = '';
      if (suggestions.actions) {
        suggestions.actions.forEach(action => {
          const li = document.createElement('li');
          li.textContent = action;
          actionList.appendChild(li);
        });
      }
      
      // 也可以更新弱點分析
      weaknessAnalysis.analyzeWeaknesses();
      
      aiStatus.textContent = "深度分析完成 ✓";
      aiStatus.className = "text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200";
    } else {
      throw new Error(result.error || 'AI 建議失敗');
    }
    
  } catch (err) {
    console.error('AI 建議失敗:', err);
    
    // 使用本地分析作為後備
    weaknessAnalysis.analyzeWeaknesses();
    
    aiStatus.textContent = "使用本地分析";
    aiStatus.className = "text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200";
  }
});

// API 模式切換按鈕
const apiModeToggleBtn = document.getElementById('apiModeToggleBtn');
if (apiModeToggleBtn) {
  apiModeToggleBtn.addEventListener('click', () => {
    const currentMode = API_CONFIG.current;
    const newMode = currentMode === 'local' ? 'ngrok' : 'local';
    
    if (setApiMode(newMode)) {
      // 顯示切換成功提示
      const badge = document.getElementById('modelBadge');
      const originalText = badge.textContent;
      badge.textContent = '✓ 已切換';
      
      setTimeout(() => {
        updateApiModeDisplay();
      }, 1000);
      
      // 可選：重新連接後端
      setTimeout(() => {
        checkBackendStatus();
      }, 500);
    }
  });
}

// 點擊 badge 也可以切換
const modelBadge = document.getElementById('modelBadge');
if (modelBadge) {
  modelBadge.addEventListener('click', () => {
    apiModeToggleBtn.click();
  });
}

// 學習進度初始化
async function initFromStorage() {
  // 檢查是否已輸入學生姓名
  if (!stats.studentName) {
    showStudentNameModal();
    return; // 等待使用者輸入姓名後再繼續
  }
  
  // 顯示歡迎訊息
  console.log(`👋 歡迎, ${stats.studentName}!`);
  
  // 初始化 API 模式顯示
  updateApiModeDisplay();
  
  // 同步 questions manager 的 API URL
  if (window.questionsManager) {
    window.questionsManager.setApiUrl(getApiBaseUrl());
  }
  
  // 先載入題目
  const questionsLoaded = await window.questionsManager.loadQuestions();
  
  if (questionsLoaded) {
    // 渲染第一題
    window.questionsManager.renderQuestion();
    
    // 更新題目總數
    const totalQuestions = window.questionsManager.getTotalQuestions();
    stats.totalQuestions = totalQuestions;
    document.getElementById('totalQuestions').textContent = totalQuestions;
    
    // 載入學生的歷史成績
    await loadStudentScores();
    
    console.log('✅ 題目載入完成');
  } else {
    // 題目載入失敗，顯示錯誤訊息
    const container = document.getElementById('questionContainer');
    if (container) {
      container.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div class="text-4xl mb-3">⚠️</div>
          <h3 class="text-lg font-bold text-red-800 mb-2">題目載入失敗</h3>
          <p class="text-red-600 mb-4">無法從 Google Sheets 載入題目資料</p>
          <button onclick="window.questionsManager.refreshQuestions().then(() => location.reload())" 
                  class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
            🔄 重試
          </button>
        </div>
      `;
    }
  }
  
  // Monaco Editor 已經在初始化時載入了保存的代碼
  await initializeBackend();
  
  updateLearningProgress();
  updateStatsDisplay();
  weaknessAnalysis.analyzeWeaknesses();
}

// 顯示學生姓名輸入對話框
function showStudentNameModal() {
  const modal = document.createElement('div');
  modal.id = 'studentNameModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-8 max-w-md mx-4 shadow-xl">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">👋 歡迎使用 Python 學習平台</h2>
      <p class="text-gray-600 mb-6">請輸入您的姓名，系統會記錄您的學習進度和成績</p>
      
      <div class="mb-6">
        <label class="block text-sm font-semibold text-gray-700 mb-2">學生姓名 *</label>
        <input 
          type="text" 
          id="studentNameInput" 
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="請輸入您的姓名"
          maxlength="20"
        />
        <div id="nameError" class="text-red-600 text-sm mt-1 hidden">請輸入姓名</div>
      </div>
      
      <button 
        onclick="submitStudentName()" 
        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200">
        開始學習
      </button>
      
      <div class="mt-4 text-xs text-gray-500 text-center">
        💡 您的姓名將用於記錄學習進度，請確保輸入正確
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 聚焦到輸入框
  setTimeout(() => {
    const input = document.getElementById('studentNameInput');
    if (input) {
      input.focus();
      // Enter 鍵提交
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitStudentName();
        }
      });
    }
  }, 100);
}

// 提交學生姓名
function submitStudentName() {
  const input = document.getElementById('studentNameInput');
  const nameError = document.getElementById('nameError');
  const name = input.value.trim();
  
  if (!name) {
    nameError.classList.remove('hidden');
    input.classList.add('border-red-500');
    return;
  }
  
  // 儲存姓名
  stats.studentName = name;
  localStorage.setItem('studentName', name);
  
  // 關閉對話框
  const modal = document.getElementById('studentNameModal');
  if (modal) {
    modal.remove();
  }
  
  // 繼續初始化
  initFromStorage();
}

// 載入學生歷史成績
async function loadStudentScores() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/scores/${encodeURIComponent(stats.studentName)}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      }
    });
    
    const result = await response.json();
    
    if (result.success && result.scores) {
      console.log(`📊 載入了 ${result.scores.length} 筆歷史成績`);
      
      // 更新統計
      result.scores.forEach(scoreRecord => {
        stats.totalScores.push(scoreRecord.score);
      });
      
      updateStatsDisplay();
    }
  } catch (error) {
    console.error('載入歷史成績失敗:', error);
  }
}

// 提交成績到後端
async function submitScoreToBackend(questionId, score, code, detailedScores = {}) {
  try {
    if (!stats.studentName) {
      console.warn('未設定學生姓名，無法提交成績');
      return false;
    }
    
    const response = await fetch(`${getApiBaseUrl()}/api/scores/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'PythonDiagnosticPlatform'
      },
      body: JSON.stringify({
        student_name: stats.studentName,
        question_id: questionId,
        score: score,
        code: code,
        detailed_scores: detailedScores
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ 成績已記錄: 題目 ${questionId}, 總分 ${score}`);
      if (detailedScores.time_complexity) {
        console.log(`   📊 詳細評分 - 時間: ${detailedScores.time_complexity}, 空間: ${detailedScores.space_complexity}, 易讀: ${detailedScores.readability}, 穩定: ${detailedScores.stability}`);
      }
      return true;
    } else {
      console.error('成績記錄失敗:', result.error);
      return false;
    }
  } catch (error) {
    console.error('提交成績時發生錯誤:', error);
    return false;
  }
}

// 監聽題目切換事件
document.addEventListener('questionChanged', (e) => {
  const { question, index } = e.detail;
  console.log(`已切換到題目 ${index + 1}: ${question.title}`);
  
  // 可以在這裡更新預期輸出等資訊
  // 例如：expectedOutput = question.expected_output;
  
  // 清空輸出區域
  if (outputBox) {
    outputBox.textContent = '等待程式執行...';
    outputBox.classList.remove('text-red-300');
    outputBox.classList.add('text-green-200');
  }
  
  // 清空 AI 分析
  const aiAnalysisBox = document.getElementById('aiAnalysisBox');
  if (aiAnalysisBox) {
    aiAnalysisBox.querySelector('div').textContent = '請先執行或使用 AI 檢查，這裡將顯示分析、錯誤定位與改進建議。';
    const suggestionList = document.getElementById('aiSuggestionList');
    if (suggestionList) suggestionList.innerHTML = '';
  }
});

// 初始化後端連接
async function initializeBackend() {
  console.log('🔄 正在初始化後端連接...');
  
  // 檢查後端狀態
  await checkBackendStatus();
}

// 不要在這裡直接調用 initFromStorage()，等 Monaco Editor 初始化完成後再調用

// 定期檢查後端狀態
setInterval(checkBackendStatus, 10000); // 每10秒檢查一次

// 在頁面載入時顯示當前 API 模式
console.log('🔧 當前 API 模式:', API_CONFIG.current);
console.log('🌐 當前 API URL:', getApiBaseUrl());
console.log('💡 使用 setApiMode("local") 或 setApiMode("ngrok") 切換模式');
console.log('💡 或點擊右上角的「切換」按鈕');

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

// API 切換工具
window.apiTools = {
  useLocal() {
    setApiMode('local');
    console.log('✅ 已切換到本地模式:', getApiBaseUrl());
  },
  useNgrok() {
    setApiMode('ngrok');
    console.log('✅ 已切換到 ngrok 模式:', getApiBaseUrl());
  },
  getCurrentMode() {
    console.log('當前模式:', API_CONFIG.current);
    console.log('API URL:', getApiBaseUrl());
    return API_CONFIG.current;
  },
  showSelector() {
    showApiModeSelector();
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
document.addEventListener('DOMContentLoaded', async () => {
  // 🔍 首先自動偵測 API
  await autoDetectAPI();
  
  // 然後初始化編輯器
  initializeMonacoEditor();
  
  // 🎯 初始化 AI 評分系統顯示（清空預設值）
  document.getElementById('mainScore').textContent = '-';
  document.getElementById('subScoreTimeComplexity').textContent = '-';
  document.getElementById('subScoreSpaceComplexity').textContent = '-';
  document.getElementById('subScoreReadability').textContent = '-';
  document.getElementById('subScoreStability').textContent = '-';
  
  // 重置圓環進度
  const scoreRing = document.getElementById('scoreRing');
  if (scoreRing) {
    scoreRing.style.strokeDashoffset = '471'; // 完全隱藏
  }
});