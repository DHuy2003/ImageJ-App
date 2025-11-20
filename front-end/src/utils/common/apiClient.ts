import axios from 'axios';
import { getSessionId } from './session';

export const API_BASE_URL = 'http://127.0.0.1:5000/api/images';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Mọi request đều tự gắn ?session_id=...
api.interceptors.request.use((config) => {
  const sid = getSessionId();

  // đảm bảo luôn có params
  config.params = {
    ...(config.params || {}),
    session_id: sid,
  };

  return config;
});

export default api;

