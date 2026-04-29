import axios from 'axios';
import config from '../config';
import { acquireToken } from './authService';

const apiClient = axios.create({
    baseURL: config.api.baseUrl,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(async (requestConfig) => {
    if (config.auth.enabled) {
        const token = await acquireToken();
        if (token) {
            requestConfig.headers.Authorization = `Bearer ${token}`;
        }
    }
    return requestConfig;
});

export default apiClient;
