import axios from "axios";

const defaultBaseUrl = "/api/v1";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultBaseUrl,
  withCredentials: true, // ⬅️ WAJIB (HttpOnly cookie)
});

const isAuthEndpoint = (url?: string) => {
  const path = (url || "").toLowerCase();
  return path.includes("/login") || path.includes("/logout") || path.includes("/refresh") || path.includes("/register");
};

// 🔁 AUTO REFRESH TOKEN
api.interceptors.response.use(
  res => res,
  async err => {
    const originalRequest = err?.config as (typeof err.config & { _retry?: boolean }) | undefined;
    if (err.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      originalRequest._retry = true;
      try {
        await api.post("/refresh");
        return api(originalRequest); // retry request
      } catch {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
