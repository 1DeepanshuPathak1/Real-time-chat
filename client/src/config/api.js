export const API_BASE_URL = 'https://chat-app-server-uwpx.onrender.com';

export const API_ENDPOINTS = {
    FRIEND_REQUESTS: (userId) => `${API_BASE_URL}/api/friend-requests/${userId}`,
    SEND_FRIEND_REQUEST: `${API_BASE_URL}/api/send-friend-request`,
    RESPOND_FRIEND_REQUEST: `${API_BASE_URL}/api/respond-friend-request`,
    VERIFY_USER: `${API_BASE_URL}/api/verify-user`,
    CREATE_USER: `${API_BASE_URL}/api/create-user`,
};

export default API_ENDPOINTS;