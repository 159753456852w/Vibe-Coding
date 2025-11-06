// API 配置文件
// 如果您使用 ngrok，請在這裡更新您的 ngrok URL

const CONFIG = {
  // 本地開發環境
  LOCAL_API_URL: 'http://localhost:5000',
  
  // Ngrok URL（需要手動更新）
  // 每次啟動 ngrok 時，URL 可能會改變，請更新此處
  // 執行: ngrok http 5000
  // 然後複製顯示的 Forwarding URL（https://xxxx.ngrok-free.app）
  NGROK_API_URL: 'https://karissa-unsiding-graphemically.ngrok-free.dev',
  
  // 是否自動偵測可用的 API
  AUTO_DETECT: true,
  
  // 預設模式（'local' 或 'ngrok'）
  DEFAULT_MODE: 'local'
};

// 如果從 HTML 引入，將配置暴露到全局
if (typeof window !== 'undefined') {
  window.API_CONFIG_EXTERNAL = CONFIG;
}
