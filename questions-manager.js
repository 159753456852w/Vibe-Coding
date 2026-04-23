/**
 * 題目管理器
 * 負責從後端載入和管理題目
 */

class QuestionsManager {
  constructor() {
    this.questions = [];
    this.currentQuestionIndex = 0;
    // 從外部配置取得 Ngrok URL
    this.apiBaseUrl = window.API_CONFIG_EXTERNAL?.API_URL || 'https://karissa-unsiding-graphemically.ngrok-free.dev';
  }

  /**
   * 轉換 Google Drive 分享連結為直接圖片 URL
   */
  convertGoogleDriveUrl(url) {
    if (!url) return url;
    
    // 檢查是否為 Google Drive 連結
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      // 使用 thumbnail 格式（格式 2）
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    
    return url;
  }

  /**
   * 設定 API URL（僅供外部更新使用）
   */
  setApiUrl(url) {
    this.apiBaseUrl = url;
    console.log(`✅ API URL 已設定為: ${url}`);
  }

  /**
   * 獲取當前使用的 API URL
   */
  getCurrentApiUrl() {
    return this.apiBaseUrl;
  }

  /**
   * 從後端載入所有題目
   */
  async loadQuestions() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api1/api/questions`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'PythonDiagnosticPlatform'
        }
      });

      const result = await response.json();

      if (result.success && result.questions) {
        this.questions = result.questions;
        console.log(`✅ 成功載入 ${this.questions.length} 道題目`);
        
        if (result.cached) {
          console.log(`📦 使用快取資料 (${result.cache_age_minutes} 分鐘前)`);
        }
        
        return true;
      } else {
        console.error('❌ 載入題目失敗:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 載入題目時發生錯誤:', error);
      return false;
    }
  }

  /**
   * 強制重新載入題目（從 Google Sheets）
   */
  async refreshQuestions() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api1/api/questions/refresh`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'PythonDiagnosticPlatform'
        }
      });

      const result = await response.json();

      if (result.success) {
        this.questions = result.questions;
        console.log(`✅ 成功重新載入 ${this.questions.length} 道題目`);
        return true;
      } else {
        console.error('❌ 重新載入失敗:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 重新載入時發生錯誤:', error);
      return false;
    }
  }

  /**
   * 獲取當前題目
   */
  getCurrentQuestion() {
    if (this.questions.length === 0) return null;
    return this.questions[this.currentQuestionIndex];
  }

  /**
   * 獲取指定索引的題目
   */
  getQuestionByIndex(index) {
    if (index < 0 || index >= this.questions.length) return null;
    return this.questions[index];
  }

  /**
   * 獲取指定 ID 的題目
   */
  getQuestionById(id) {
    return this.questions.find(q => q.id === String(id));
  }

  /**
   * 切換到下一題
   */
  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      return this.getCurrentQuestion();
    }
    return null;
  }

  /**
   * 切換到上一題
   */
  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      return this.getCurrentQuestion();
    }
    return null;
  }

  /**
   * 設定當前題目索引
   */
  setCurrentQuestionIndex(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      return true;
    }
    return false;
  }

  /**
   * 獲取題目總數
   */
  getTotalQuestions() {
    return this.questions.length;
  }

  /**
   * 渲染題目到頁面
   */
  renderQuestion(containerId = 'questionContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('找不到題目容器');
      return;
    }

    const question = this.getCurrentQuestion();
    if (!question) {
      container.innerHTML = '<div class="text-red-600">❌ 沒有題目資料</div>';
      return;
    }

    // 構建 HTML
    const html = `
      <section class="relative bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden mb-6">
        <!-- 頂部裝飾漸層 -->
        <div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <!-- 主要內容區 -->
        <div class="p-5 sm:p-6">
          <!-- 標題列 -->
          <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  ${question.id}
                </div>
                <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <div class="text-xs text-gray-500 font-medium mb-1">📚 當前題目</div>
                <h3 class="text-xl sm:text-2xl font-bold text-gray-900">${question.title}</h3>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs px-3 py-1.5 rounded-lg ${this.getDifficultyClass(question.difficulty)} border font-semibold shadow-sm">
                ${this.getDifficultyIcon(question.difficulty)} ${question.difficulty}
              </span>
              <button id="prevQuestionBtn" class="text-xs bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${this.currentQuestionIndex === 0 ? 'disabled' : ''}>
                ← 上一題
              </button>
              <button id="nextQuestionBtn" class="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${this.currentQuestionIndex === this.questions.length - 1 ? 'disabled' : ''}>
                下一題 →
              </button>
            </div>
          </div>
          
          <!-- 題目描述 -->
          <div class="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">📝</span>
              <span class="font-semibold text-gray-800">題目描述</span>
            </div>
            <p class="text-gray-700 leading-relaxed">
              ${question.description}
            </p>
          </div>

          ${this.renderTestCases(question)}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            ${this.renderLearningGoals(question)}
            ${this.renderExampleImage(question)}
          </div>
        </div>
      </section>
    `;

    container.innerHTML = html;

    // 綁定按鈕事件
    this.bindNavigationButtons();
  }

  /**
   * 渲染測試案例
   */
  renderTestCases(question) {
    if (!question.test_cases || question.test_cases.length === 0) {
      return '';
    }

    const cases = question.test_cases.map((tc, index) => 
      `<div class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
          ${index + 1}
        </div>
        <div class="flex-1 flex items-center gap-2 text-sm flex-wrap">
          <span class="text-gray-600">輸入:</span>
          <code class="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 font-mono text-xs">${tc.input}</code>
          <span class="text-gray-400">→</span>
          <span class="text-gray-600">輸出:</span>
          <code class="bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200 font-mono text-xs">${tc.output}</code>
        </div>
      </div>`
    ).join('');

    return `
      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 shadow-sm">
        <div class="flex items-center gap-2 font-semibold text-gray-800 mb-3">
          <span class="text-lg">🧪</span>
          <span>測試案例</span>
        </div>
        <div class="space-y-2">
          ${cases}
        </div>
      </div>
    `;
  }

  /**
   * 渲染學習目標
   */
  renderLearningGoals(question) {
    if (!question.learning_goals || question.learning_goals.length === 0) {
      return '';
    }

    const goals = question.learning_goals.map(goal => 
      `<li class="flex items-start gap-2">
        <span class="text-green-500 mt-0.5">✓</span>
        <span>${goal}</span>
      </li>`
    ).join('');

    return `
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4 shadow-sm">
        <div class="flex items-center gap-2 font-semibold text-gray-800 mb-3">
          <span class="text-lg">🎯</span>
          <span>學習目標</span>
        </div>
        <ul class="text-sm text-gray-700 space-y-2">
          ${goals}
        </ul>
      </div>
    `;
  }

  /**
   * 渲染示例圖片
   */
  renderExampleImage(question) {
    // 檢查是否有圖片 URL
    if (!question.example_image || !question.example_image.trim()) {
      return '';
    }

    // 轉換 Google Drive URL
    const imageUrl = this.convertGoogleDriveUrl(question.example_image);

    return `
      <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-4 shadow-sm">
        <div class="flex items-center gap-2 font-semibold text-gray-800 mb-3">
          <span class="text-lg">🖼️</span>
          <span>示例圖片</span>
        </div>
        <div class="bg-white rounded-lg p-3 border border-purple-200">
          <img src="${imageUrl}" 
               alt="示例圖片" 
               class="w-full h-auto rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer"
               onclick="window.open('${question.example_image}', '_blank')"
               loading="lazy" />
        </div>
        <div class="text-xs text-gray-500 mt-2 text-center">點擊圖片可在新分頁中開啟</div>
      </div>
    `;
  }

  /**
   * 獲取難度對應的樣式類別
   */
  getDifficultyClass(difficulty) {
    const difficultyMap = {
      '入門': 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-green-300',
      '初級': 'bg-gradient-to-r from-blue-100 to-sky-100 text-blue-700 border-blue-300',
      '中級': 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border-yellow-300',
      '進階': 'bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 border-orange-300',
      '高級': 'bg-gradient-to-r from-red-100 to-pink-100 text-red-700 border-red-300'
    };
    return difficultyMap[difficulty] || 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border-gray-300';
  }

  /**
   * 獲取難度對應的圖示
   */
  getDifficultyIcon(difficulty) {
    const iconMap = {
      '入門': '🌱',
      '初級': '🌿',
      '中級': '🌳',
      '進階': '🔥',
      '高級': '⚡'
    };
    return iconMap[difficulty] || '📌';
  }

  /**
   * 綁定導航按鈕事件
   */
  bindNavigationButtons() {
    const prevBtn = document.getElementById('prevQuestionBtn');
    const nextBtn = document.getElementById('nextQuestionBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.previousQuestion()) {
          this.renderQuestion();
          this.onQuestionChange();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.nextQuestion()) {
          this.renderQuestion();
          this.onQuestionChange();
        }
      });
    }
  }

  /**
   * 題目切換時的回調函數（可由外部覆寫）
   */
  onQuestionChange() {
    // 可以在這裡更新統計資料
    console.log(`切換到題目 ${this.currentQuestionIndex + 1}/${this.questions.length}`);
    
    // 觸發自定義事件
    const event = new CustomEvent('questionChanged', {
      detail: {
        question: this.getCurrentQuestion(),
        index: this.currentQuestionIndex
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * 渲染題目選擇器（下拉選單）
   */
  renderQuestionSelector(selectId = 'questionSelector') {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = this.questions.map((q, index) => 
      `<option value="${index}" ${index === this.currentQuestionIndex ? 'selected' : ''}>
        題目 ${q.id}: ${q.title}
      </option>`
    ).join('');

    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.value);
      if (this.setCurrentQuestionIndex(index)) {
        this.renderQuestion();
        this.onQuestionChange();
      }
    });
  }
}

// 全域實例
window.questionsManager = new QuestionsManager();
