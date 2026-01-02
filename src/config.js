// API配置 - 自动检测环境
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';

// 统一使用 /api 路径，开发环境通过 Vite proxy，生产环境通过 Nginx proxy
export const API_BASE_URL = '/api';

console.log('🌍 Environment:', isDevelopment ? 'Development' : 'Production');
console.log('🔗 API URL:', API_BASE_URL);