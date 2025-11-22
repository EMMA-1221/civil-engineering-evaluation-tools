// API配置 - 自动检测环境
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';

// 开发环境用完整URL，生产环境用相对路径
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:8080'  // 本地开发
  : '/api';                   // 生产环境（通过Nginx代理）

console.log('🌍 Environment:', isDevelopment ? 'Development' : 'Production');
console.log('🔗 API URL:', API_BASE_URL);