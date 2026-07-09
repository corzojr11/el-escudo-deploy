import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function syncData() {
  const response = await api.get('/api/v1/sync');
  return response.data;
}

export async function processCommand(command: string) {
  const response = await api.post('/api/v1/process-command', { command });
  return response.data;
}

export default api;