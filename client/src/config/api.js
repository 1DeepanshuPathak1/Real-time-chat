export const API_BASE_URL = 'https://chat-app-server-uwpx.onrender.com/api';
export const SOCKET_URL = 'https://chat-app-server-uwpx.onrender.com';

export const API_ENDPOINTS = {
    FRIEND_REQUESTS: (userId) => `${API_BASE_URL}/friend-requests/${userId}`,
    SEND_FRIEND_REQUEST: `${API_BASE_URL}/send-friend-request`,
    RESPOND_FRIEND_REQUEST: `${API_BASE_URL}/respond-friend-request`
};

export default API_ENDPOINTS;