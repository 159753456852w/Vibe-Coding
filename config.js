// API 配置文件 - 僅使用 Ngrok 模式

const CONFIG = {
  // API URL 設定
  // 留空表示使用同源（相對路徑），前端與後端從同一個 Flask 伺服器提供
  // 如果使用 ngrok，前端也會透過 ngrok 存取，所以同樣使用相對路徑即可
  API_URL: ''
};

// 如果從 HTML 引入，將配置暴露到全局
if (typeof window !== 'undefined') {
  window.API_CONFIG_EXTERNAL = CONFIG;
}
