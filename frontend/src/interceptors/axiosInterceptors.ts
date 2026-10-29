import axios from "axios";
import { api } from "../shared/api";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const requestUrl = axios.isAxiosError(error) ? error.config?.url : "";
    if (axios.isAxiosError(error) && error.response?.status === 401 &&
      !["/auth/login", "/auth/register"].includes(requestUrl ?? "")) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("session-expired"));
    }

    return Promise.reject(error);
  },
);
