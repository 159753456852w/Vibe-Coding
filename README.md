# Python 智能程式診斷平台

一個基於 AI 的互動式 Python 學習平台，整合 Gemini AI 進行程式碼分析、評分與引導式教學。

---

## 目錄

- [功能特色](#功能特色)
- [系統架構](#系統架構)
- [環境需求](#環境需求)
- [安裝步驟](#安裝步驟)
- [設定說明](#設定說明)
- [執行方式](#執行方式)
- [API 端點](#api-端點)
- [前端功能](#前端功能)
- [檔案結構](#檔案結構)
- [常見問題](#常見問題)

---

## 功能特色

### 核心功能

1. **安全的程式碼執行環境**
   - 沙箱化執行 Python 程式碼
   - 白名單機制限制危險操作
   - 5 秒執行超時保護
   - 支援 `input()` 互動式輸入

2. **AI 智能分析**
   - **程式碼評分**：從時間複雜度、空間複雜度、可讀性、穩定性四個維度評分
   - **引導式教學**：不直接給答案，用問題引導學生思考
   - **流式對話**：即時串流 AI 回應，體驗更流暢

3. **題目管理系統**
   - 從 Google Sheets 動態載入題目
   - 支援題目快取與手動重新整理
   - 學習進度追蹤

4. **成績記錄系統**
   - 自動記錄學生成績到 Google Sheets
   - 保留歷史最高分
   - 支援詳細評分項目

5. **可調整 UI 布局**
   - 使用 Split.js 實現可拖曳調整的面板
   - 程式碼編輯器 / 執行結果 / AI 助手三區域獨立可調

---

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │   Code Editor   │ │  Output Panel   │ │  AI Assistant │  │
│  │  (Monaco Editor)│ │                 │ │               │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / SSE
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Flask Backend (server.py)                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│  │ Code Exec  │ │ AI Analyze │ │ Questions  │ │  Scores  │  │
│  │  Sandbox   │ │  (Gemini)  │ │  Manager   │ │ Manager  │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Gemini API  │    │Google Sheets │    │  Local JSON  │
   │   (AI 分析)  │    │   (題目/成績) │    │   (備份)     │
   └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 環境需求

- **Python**: 3.8 或更高版本
- **Node.js**: 不需要（純前端）
- **瀏覽器**: Chrome / Edge / Firefox（推薦 Chrome）

### Python 套件

```
flask
flask-cors
google-generativeai
gspread
oauth2client
requests
```

---

## 安裝步驟

### 1. 安裝 Python 套件

```bash
pip install flask flask-cors google-generativeai gspread oauth2client requests
```

### 2. 設定 API Keys

建立 `api_keys.json` 檔案：

```json
{
  "gemini_api_keys": [
    "你的-GEMINI-API-KEY-1",
    "你的-GEMINI-API-KEY-2"
  ]
}
```

> **取得 API Key**: 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 申請免費的 Gemini API Key。

### 3. 設定 Google Sheets（可選）

如果需要從 Google Sheets 載入題目或記錄成績，請：

1. 建立 Google Cloud 專案並啟用 Google Sheets API
2. 建立服務帳號並下載金鑰 JSON
3. 將金鑰檔案路徑填入 `server.py` 中的 `SERVICE_ACCOUNT_FILE`
4. 將服務帳號 email 加入試算表的分享名單

### 4. 設定 Ngrok（遠端存取）

如果需要從外部網路存取：

```bash
# 安裝 ngrok
# Windows: 下載 https://ngrok.com/download
# macOS: brew install ngrok

# 執行
ngrok http 5000

# 將產生的 URL 貼到 frontend/config.js
```

---

## 設定說明

### config.json

主要設定檔，控制 AI 模型參數：

```json
{
  "model_name": "gemini-2.5-flash",
  "api_settings": {
    "temperature": 0.7,
    "max_tokens": 2000,
    "timeout": 30
  }
}
```

| 參數 | 說明 |
|------|------|
| `model_name` | Gemini 模型名稱 |
| `temperature` | AI 創造性（0-1，越高越有創意） |
| `max_tokens` | 最大回應長度 |
| `timeout` | API 請求超時秒數 |

### prompts.json

AI 提示詞設定檔，包含：

| 類型 | 說明 |
|------|------|
| `analyze_prompt` | 程式碼全面分析與評分 |
| `check_prompt` | 快速輸出檢查 |
| `suggest_prompt` | 引導式學習建議 |
| `chat_system_prompt` | AI 對話系統提示詞 |

### frontend/config.js

前端 API 設定：

```javascript
const CONFIG = {
  API_URL: 'https://your-ngrok-url.ngrok-free.app'
};
```

---

## 執行方式

### 啟動後端伺服器

```bash
cd path/to/project
python server.py
```

伺服器將在 `http://localhost:5000` 啟動。

### 開啟前端

直接用瀏覽器開啟 `frontend/index.html`，或透過 Live Server。

### 使用 Ngrok（遠端存取）

```bash
# 終端機 1：啟動伺服器
python server.py

# 終端機 2：啟動 ngrok
ngrok http 5000
```

將 ngrok 產生的 URL 填入 `frontend/config.js`。

---

## API 端點

### 程式執行

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/execute` | POST | 執行 Python 程式碼 |
| `/api/validate` | POST | 檢查程式碼安全性 |

### AI 分析

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/ai/analyze` | POST | 全面分析程式碼（評分） |
| `/api/ai/check` | POST | 快速檢查輸出 |
| `/api/ai/suggest` | POST | 取得改進建議 |
| `/api/ai/chat` | POST | AI 對話（流式輸出） |

### 題目管理

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/questions` | GET | 取得所有題目 |
| `/api/questions/<id>` | GET | 取得單一題目 |
| `/api/questions/refresh` | POST | 重新載入題目 |

### 成績管理

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/scores/submit` | POST | 提交成績 |
| `/api/scores/<name>` | GET | 取得學生成績 |

### 系統狀態

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/health` | GET | 健康檢查 |
| `/api/status` | GET | 系統狀態 |

---

## 前端功能

### 程式碼編輯器

- 基於 **Monaco Editor**（VS Code 同款）
- 語法高亮、自動完成
- 快捷鍵 `Ctrl+Enter` 執行程式

### 輸出面板

- 顯示程式執行結果
- 錯誤訊息以紅色標示
- 支援 `input()` 互動輸入

### AI 助手

- **AI 評分**：分析程式碼並給出四維度評分
- **對話機器人**：即時問答、引導式教學
- **流式輸出**：打字機效果的回應

### 可調整布局

- 拖曳分隔線調整面板大小
- 水平分割：程式碼區 / AI 區
- 垂直分割：編輯器 / 輸出

---

## 檔案結構

```
project/
├── server.py              # Flask 後端主程式
├── config.json            # AI 模型設定
├── prompts.json           # AI 提示詞設定
├── api_keys.json          # API 金鑰（不要上傳 Git）
├── questions.json         # 題目快取
├── scores_backup.json     # 成績本地備份
├── fetch_questions.py     # 題目抓取腳本
├── verify_input_fix.py    # 輸入功能測試
├── 指令.txt               # 執行指令備忘
│
└── frontend/
    ├── index.html         # 主頁面
    ├── script.js          # 主要 JavaScript 邏輯
    ├── styles.css         # 自訂樣式
    ├── config.js          # API URL 設定
    ├── questions-manager.js # 題目管理器
    └── lib/               # 第三方函式庫
        ├── marked.min.js      # Markdown 渲染
        ├── highlight.min.js   # 程式碼高亮
        ├── python.min.js      # Python 語法
        └── github.min.css     # 高亮主題
```

---

## 常見問題

### Q: 執行程式碼時出現「連線被拒絕」

**A**: 確認後端伺服器已啟動，且 `frontend/config.js` 中的 API URL 正確。

### Q: AI 分析沒有回應

**A**: 
1. 檢查 `api_keys.json` 中的 API Key 是否有效
2. 確認網路可以連到 Google API
3. 查看終端機的錯誤訊息

### Q: 無法載入題目

**A**: 
1. 確認 Google Sheets 權限設定正確
2. 嘗試點擊「重新整理題目」按鈕
3. 查看 `questions.json` 是否有內容

### Q: 拖曳分隔線沒有反應

**A**: 
1. 嘗試硬刷新（`Ctrl+Shift+R`）
2. 確認 Split.js 有正確載入（檢查開發者工具 Console）

### Q: 如何自訂 AI 提示詞

**A**: 編輯 `prompts.json` 檔案，修改對應的 `template` 欄位。

---

## 授權

本專案僅供教育用途。

---

## 聯絡方式

如有問題，請透過 GitHub Issues 回報。
