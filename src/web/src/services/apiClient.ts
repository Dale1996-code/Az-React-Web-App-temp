import axios from 'axios';
import config from '../config';

/**
 * Shared axios instance for all Dales Operations API calls.
 * Base URL is set from VITE_API_BASE_URL (injected at build time by azd).
 * Falls back to http://localhost:3100 for local development.
 */
const apiClient = axios.create({
    baseURL: config.api.baseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default apiClient;
