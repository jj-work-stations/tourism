import { useAuth } from "./auth-store";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SERVER_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || API_URL;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(base: string, path: string, query?: Query) {
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function errorMessage(status: number, data: unknown): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const detail = obj.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const first = detail[0] as Record<string, unknown>;
      if (typeof first.msg === "string") return first.msg;
    }
    if (typeof obj.message === "string") return obj.message;
  }
  if (status === 401) return "برای ادامه ابتدا وارد حساب خود شوید.";
  if (status === 403) return "دسترسی لازم برای این عملیات را ندارید.";
  if (status === 404) return "موردی یافت نشد.";
  if (status === 422) return "اطلاعات واردشده کامل یا معتبر نیست.";
  if (status >= 500) return "خطایی در سرور رخ داد. کمی بعد دوباره تلاش کنید.";
  return "درخواست انجام نشد.";
}

async function request<T>(
  path: string,
  options: RequestInit & { query?: Query; auth?: boolean } = {},
): Promise<T> {
  const { query, auth = false, headers, ...init } = options;
  const finalHeaders = new Headers(headers);
  if (init.body && !(init.body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = useAuth.getState().tokens?.access_token;
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(buildUrl(API_URL, path, query), {
    ...init,
    headers: finalHeaders,
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    if (response.status === 401 && auth) useAuth.getState().clear();
    throw new ApiError(errorMessage(response.status, data), response.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, auth = false) =>
    request<T>(path, { method: "GET", query, auth }),
  post: <T>(path: string, body?: unknown, auth = false) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      auth,
    }),
  patch: <T>(path: string, body?: unknown, auth = false) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
      auth,
    }),
  put: <T>(path: string, body?: unknown, auth = false) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
      auth,
    }),
  delete: <T>(path: string, body?: unknown, auth = false) =>
    request<T>(path, {
      method: "DELETE",
      body: body === undefined ? undefined : JSON.stringify(body),
      auth,
    }),
};

/** Fetch used by Server Components. Falls back gracefully when the API is unavailable. */
export async function serverFetch<T>(path: string, query?: Query): Promise<T | null> {
  try {
    const response = await fetch(buildUrl(SERVER_API_URL, path, query), {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
