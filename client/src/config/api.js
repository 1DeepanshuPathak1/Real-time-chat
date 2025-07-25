export const API_BASE_URL = 'https://chat-app-server-uwpx.onrender.com/api';

export const API_ENDPOINTS = {
    FRIEND_REQUESTS: (userId) => `${API_BASE_URL}/friend-requests/${userId}`,
    SEND_FRIEND_REQUEST: `${API_BASE_URL}/send-friend-request`,
    RESPOND_FRIEND_REQUEST: `${API_BASE_URL}/respond-friend-request`,
    VERIFY_USER: `${API_BASE_URL}/verify-user`,
    CREATE_USER: `${API_BASE_URL}/create-user`,
};

export default API_ENDPOINTS;