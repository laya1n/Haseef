// src/lib/api.ts
/// <reference types="vite/client" />

/* ============================== أنواع مساعدة ============================== */
type Params = Record<string, string | number | boolean | null | undefined>;

/* ============================== Base URL ============================== */
// ضعي في .env: VITE_API_BASE_URL=http://127.0.0.1:8000
const ENV_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE =
  (ENV_BASE && ENV_BASE.replace(/\/+$/, "")) || "http://127.0.0.1:8000";

function join(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/* ============================== HTTP helpers (Cookie-based) ============================== */
// 💡 مهم: نرسل credentials:"include" لكي تمر الكوكيز
async function httpGet<T>(path: string, params?: Params): Promise<T> {
  const url = new URL(join(path));
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const s = String(v);
      if (s === "" || s === "الكل") continue;
      url.searchParams.set(k, s);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function httpPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(join(path), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

/* ============================== Auth APIs (كوكيز) ============================== */
// عند النجاح، السيرفر هو الذي يضع كوكي access_token
export type LoginPayload = {
  national_id: string;
  password: string;
  remember?: boolean; // اختياري: لتحديد مدة الكوكي
};

export function apiLogin(payload: LoginPayload) {
  return httpPost<{ ok: true }>("/auth/login", payload);
}

export function apiLogout() {
  return httpPost<{ ok: true }>("/auth/logout");
}

// يعيد بيانات المستخدم إذا كانت الكوكيز صالحة
export function apiMe() {
  return httpGet<{ national_id: string; name?: string }>("/auth/me");
}

/* ============================== Data APIs ============================== */
export const ENDPOINTS = {
  medicalRecords: "/medical/records",
  insuranceRecords: "/insurance/records",
  drugRecords: "/drugs/records",
};

export function apiGetMedical(params?: Params) {
  return httpGet<unknown>(ENDPOINTS.medicalRecords, params);
}

export function apiGetInsurance(params?: Params) {
  return httpGet<unknown>(ENDPOINTS.insuranceRecords, params);
}

export function apiGetDrugs(params?: Params) {
  return httpGet<unknown>(ENDPOINTS.drugRecords, params);
}
export const apiGet = httpGet;
export const apiPost = httpPost;