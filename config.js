// API 配置文件 - 僅使用 Ngrok 模式

const CONFIG = {
  // Ngrok URL（需要手動更新）
  // 讓前端可以在任何地方開啟，並連回這台電腦的後端
  API_URL: 'https://karissa-unsiding-graphemically.ngrok-free.dev'
};

// 如果從 HTML 引入，將配置暴露到全局
if (typeof window !== 'undefined') {
  window.API_CONFIG_EXTERNAL = CONFIG;
}
