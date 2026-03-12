"use client";

import { useState, useEffect, useRef } from "react";
import liff from "@line/liff";

interface InvoiceResult {
  invoice_date: string | null;
  vendor_name: string | null;
  invoice_number: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  line_items: { name: string; qty: number; price: number }[];
  confidence_note: string | null;
  source?: "qrcode" | "gemini" | "manual";
  saved?: boolean;
  save_error?: string | null;
}

type AppState = "loading" | "ready" | "processing" | "result" | "error";
type InputMode = "photo" | "manual";

const FIELD_LABELS: Record<string, string> = {
  invoice_date: "發票日期",
  vendor_name: "商家名稱",
  invoice_number: "發票號碼",
  subtotal: "小計",
  total_amount: "總金額",
  currency: "幣別",
};

const SOURCE_LABELS: Record<string, string> = {
  qrcode: "QR Code",
  gemini: "AI 辨識",
  manual: "手動輸入",
};

interface ManualForm {
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  total_amount: string;
  items: { name: string; qty: string; price: string }[];
}

const EMPTY_FORM: ManualForm = {
  invoice_number: "",
  invoice_date: "",
  vendor_name: "",
  total_amount: "",
  items: [{ name: "", qty: "1", price: "" }],
};

const inputClass =
  "w-full h-12 border border-input-border bg-input-bg text-foreground rounded-xl px-3.5 text-base focus:outline-none focus:border-input-focus placeholder:text-muted-light transition-all appearance-none";

function CameraIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto">
      <rect x="4" y="12" width="40" height="28" rx="6" className="stroke-muted" strokeWidth="2.5" fill="none" />
      <path d="M17 12L19.5 7H28.5L31 12" className="stroke-muted" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="26" r="7" className="stroke-accent" strokeWidth="2.5" fill="none" />
      <circle cx="24" cy="26" r="3" className="fill-accent" opacity="0.3" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 5V2.5A1.5 1.5 0 012.5 1H5M11 1h2.5A1.5 1.5 0 0115 2.5V5M15 11v2.5a1.5 1.5 0 01-1.5 1.5H11M5 15H2.5A1.5 1.5 0 011 13.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="4" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" className="stroke-accent" strokeWidth="2" />
      <path d="M6 10l3 3 5-5" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>("loading");
  const [mode, setMode] = useState<InputMode>("photo");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<InvoiceResult | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM);
  const [sendMsgStatus, setSendMsgStatus] = useState<"idle" | "sent" | "failed">("idle");
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function sendLiffMessage(data: InvoiceResult) {
    const template = process.env.NEXT_PUBLIC_LIFF_SUCCESS_MESSAGE;
    if (!template) return;
    if (!process.env.NEXT_PUBLIC_LIFF_ID) return;
    try {
      if (!liff.isInClient()) return;
      const text = template.replace(/\{(\w+)\}/g, (_, key) => {
        if (key === "user_name") return userName;
        if (key === "user_id") return userId;
        if (key === "source") return SOURCE_LABELS[data.source || "gemini"] || "";
        const val = data[key as keyof InvoiceResult];
        if (val == null) return "";
        return String(val);
      });
      await liff.sendMessages([{ type: "text", text }]);
      setSendMsgStatus("sent");
    } catch (e) {
      console.warn("liff.sendMessages failed:", e);
      setSendMsgStatus("failed");
    }
  }

  useEffect(() => {
    initLiff();
  }, []);

  async function initLiff() {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setUserName("開發模式");
      setAccessToken("dev-token");
      setState("ready");
      return;
    }

    try {
      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      setUserName(profile.displayName);
      setUserId(profile.userId);
      setAccessToken(liff.getAccessToken() || "");
      setState("ready");
    } catch (e) {
      console.warn("LIFF init failed:", e);
      if (process.env.NODE_ENV === "development") {
        setUserName("開發模式");
        setAccessToken("dev-token");
        setState("ready");
      } else {
        setError("LINE 登入失敗，請重新開啟");
        setState("error");
      }
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    fileRef.current = file;
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handlePhotoSubmit() {
    if (!fileRef.current) return;
    setState("processing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("invoice", fileRef.current);

      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "辨識失敗" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: InvoiceResult = await res.json();
      setResult(data);
      setState("result");
      if (data.saved) sendLiffMessage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
      setState("error");
    }
  }

  async function handleManualSubmit() {
    // 發票號碼：寬鬆檢查，允許有無連字號，只要大致符合兩英文+八數字
    if (form.invoice_number) {
      const cleaned = form.invoice_number.replace(/[-\s]/g, "");
      if (!/^[A-Z]{2}\d{8}$/.test(cleaned)) {
        setError("發票號碼格式不正確，應為兩個英文字母加八位數字（如 AB12345678）");
        return;
      }
    }

    if (!form.total_amount || isNaN(parseFloat(form.total_amount)) || parseFloat(form.total_amount) < 0) {
      setError("請填寫有效的總金額");
      return;
    }

    if (form.invoice_date) {
      const d = new Date(form.invoice_date);
      if (isNaN(d.getTime())) {
        setError("發票日期格式不正確");
        return;
      }
    }

    setState("processing");
    setError("");

    try {
      const res = await fetch("/api/invoice-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...form,
          total_amount: parseFloat(form.total_amount),
          tax_amount: null,
          items: form.items
            .filter((item) => item.name.trim())
            .map((item) => ({
              name: item.name,
              qty: parseFloat(item.qty) || 1,
              price: parseFloat(item.price) || 0,
            })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "儲存失敗" }));
        setError(err.error || `HTTP ${res.status}`);
        setState("ready");
        return;
      }

      const data: InvoiceResult = await res.json();
      setResult(data);
      setState("result");
      if (data.saved) sendLiffMessage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
      setState("ready");
    }
  }

  function updateFormField(field: keyof ManualForm, value: string) {
    if (error) setError("");
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateItem(
    index: number,
    field: "name" | "qty" | "price",
    value: string
  ) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { name: "", qty: "1", price: "" }],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    fileRef.current = null;
    setPreviewUrl(null);
    setResult(null);
    setError("");
    setForm(EMPTY_FORM);
    setSendMsgStatus("idle");
    setState("ready");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (state === "loading") {
    return (
      <main className="max-w-md mx-auto px-5 pt-24 text-center">
        <div className="inline-block w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-5 pb-12 pt-6 min-h-screen">
      {/* Header */}
      <div className="text-center mb-7 animate-float-up">
        <div className="inline-flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            發票登錄
          </h1>
        </div>
        <p className="text-xs text-muted tracking-wide">{userName}</p>
      </div>

      {/* Mode Toggle */}
      {state === "ready" && (
        <div className="flex bg-toggle-bg rounded-2xl p-1 mb-6 animate-float-up stagger-1"
          style={{ boxShadow: "var(--shadow-sm)" }}>
          <button
            onClick={() => setMode("photo")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
              mode === "photo"
                ? "bg-toggle-active text-accent"
                : "text-muted hover:text-foreground"
            }`}
            style={mode === "photo" ? { boxShadow: "var(--shadow-md)" } : {}}
          >
            <ScanIcon />
            拍照上傳
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
              mode === "manual"
                ? "bg-toggle-active text-accent"
                : "text-muted hover:text-foreground"
            }`}
            style={mode === "manual" ? { boxShadow: "var(--shadow-md)" } : {}}
          >
            <EditIcon />
            手動輸入
          </button>
        </div>
      )}

      {/* Photo Upload */}
      {state === "ready" && mode === "photo" && (
        <div>
          <label
            className={`block rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
              previewUrl
                ? "border-2 border-accent bg-accent-soft"
                : "border-2 border-dashed border-border hover:border-accent hover:bg-card"
            }`}
            style={{ boxShadow: previewUrl ? "var(--shadow-md)" : "none" }}
          >
            {!previewUrl && (
              <>
                <CameraIcon />
                <p className="text-muted text-sm mt-3 font-medium">
                  點擊拍照或選擇發票照片
                </p>
                <p className="text-muted-light text-xs mt-1">
                  支援 JPG, PNG, WebP, HEIC
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {previewUrl && (
            <div className="mt-4 text-center">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="preview"
                  className="max-h-64 mx-auto rounded-xl object-contain"
                  style={{ boxShadow: "var(--shadow-md)" }}
                />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    fileRef.current = null;
                    setPreviewUrl(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-muted hover:text-danger text-sm transition-colors"
                  style={{ boxShadow: "var(--shadow-sm)" }}
                >
                  x
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handlePhotoSubmit}
            disabled={!previewUrl}
            className="w-full mt-5 py-3.5 rounded-xl font-semibold text-white bg-accent disabled:opacity-100 disabled:bg-toggle-bg disabled:text-muted disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-150"
            style={{ boxShadow: previewUrl ? "0 4px 14px rgba(6, 199, 85, 0.3)" : "none" }}
          >
            上傳辨識
          </button>
        </div>
      )}

      {/* Manual Input */}
      {state === "ready" && mode === "manual" && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                發票號碼
              </label>
              <input
                type="text"
                placeholder="例：AB12345678"
                value={form.invoice_number}
                onChange={(e) =>
                  updateFormField("invoice_number", e.target.value.toUpperCase())
                }
                className={`${inputClass} font-mono tracking-wider`}
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                發票日期
              </label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) =>
                  updateFormField("invoice_date", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                商家名稱
              </label>
              <input
                type="text"
                placeholder="例：康是美 中博門市"
                value={form.vendor_name}
                onChange={(e) =>
                  updateFormField("vendor_name", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                總金額（含稅） <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.total_amount}
                  onChange={(e) =>
                    updateFormField("total_amount", e.target.value)
                  }
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-muted">品項明細（選填）</label>
              <button
                onClick={addItem}
                className="text-xs text-accent font-semibold hover:underline"
              >
                + 新增
              </button>
            </div>
            <div className="space-y-2">
              {/* Column headers */}
              <div className="flex gap-1.5 text-[10px] text-muted-light px-1">
                <span className="flex-1">品名</span>
                <span className="w-11 text-center">數量</span>
                <span className="w-16 text-right">單價</span>
                {form.items.length > 1 && <span className="w-6" />}
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    placeholder="--"
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                    className="flex-1 min-w-0 border border-input-border bg-input-bg text-foreground rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-input-focus placeholder:text-muted-light transition-all"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="1"
                    value={item.qty}
                    onChange={(e) => updateItem(i, "qty", e.target.value)}
                    className="w-11 shrink-0 border border-input-border bg-input-bg text-foreground rounded-xl px-1 py-2.5 text-base text-center focus:outline-none focus:border-input-focus placeholder:text-muted-light transition-all"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={item.price}
                    onChange={(e) => updateItem(i, "price", e.target.value)}
                    className="w-16 shrink-0 border border-input-border bg-input-bg text-foreground rounded-xl px-2 py-2.5 text-base text-right focus:outline-none focus:border-input-focus placeholder:text-muted-light transition-all"
                  />
                  {form.items.length > 1 && (
                    <button
                      onClick={() => removeItem(i)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger-soft text-xs transition-all"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-danger-soft text-danger rounded-xl text-center text-xs font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleManualSubmit}
            disabled={!form.total_amount}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-accent disabled:opacity-100 disabled:bg-toggle-bg disabled:text-muted disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-150"
            style={{ boxShadow: form.total_amount ? "0 4px 14px rgba(6, 199, 85, 0.3)" : "none" }}
          >
            送出
          </button>
        </div>
      )}

      {/* Processing */}
      {state === "processing" && (
        <div className="text-center py-16 animate-float-up">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute w-16 h-16 rounded-full bg-accent/10" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
            <div className="absolute w-16 h-16 rounded-full bg-accent/5" style={{ animation: "pulse-ring 1.5s ease-out infinite 0.5s" }} />
            <div className="relative w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted mt-6 text-sm font-medium">
            {mode === "photo" ? "AI 辨識中..." : "登錄中..."}
          </p>
          <p className="text-muted-light mt-1 text-xs">
            {mode === "photo" ? "正在分析發票內容" : "正在儲存資料"}
          </p>
        </div>
      )}

      {/* Result */}
      {state === "result" && result && (
        <div className="animate-float-up">
          {/* Success badge */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <CheckCircleIcon />
            <span className="text-sm font-semibold text-accent">
              {result.source === "manual" ? "已成功儲存" : "辨識完成"}
            </span>
          </div>

          {/* Total amount highlight */}
          {result.total_amount != null && (
            <div className="bg-card rounded-2xl p-5 text-center mb-3" style={{ boxShadow: "var(--shadow-md)" }}>
              <p className="text-xs text-muted font-medium mb-1">總金額</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                <span className="text-lg text-muted font-normal mr-0.5">$</span>
                {Number(result.total_amount).toLocaleString()}
              </p>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-accent-soft text-accent font-semibold tracking-wide uppercase">
                {SOURCE_LABELS[result.source || "gemini"]}
              </span>
            </div>
          )}

          {/* Details card */}
          <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            {Object.entries(FIELD_LABELS).map(([key, label]) => {
              if (key === "total_amount") return null;
              const val = result[key as keyof InvoiceResult];
              return (
                <div
                  key={key}
                  className="flex justify-between py-2.5 border-b border-border last:border-0 text-sm"
                >
                  <span className="text-muted">{label}</span>
                  <span className="font-medium text-right max-w-[60%] break-all">
                    {val != null ? String(val) : "-"}
                  </span>
                </div>
              );
            })}

            {result.line_items.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
                  明細
                </h3>
                {result.line_items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-sm py-1.5"
                  >
                    <span className="text-foreground">
                      {item.name}
                      <span className="text-muted ml-1">x{item.qty}</span>
                    </span>
                    <span className="font-medium tabular-nums">${item.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {result.saved === false && (
            <div className="mt-3 p-3.5 bg-danger-soft text-danger rounded-xl text-center text-xs font-medium">
              發票辨識成功，但資料尚未儲存，請稍後再試或聯絡客服
            </div>
          )}

          {result.confidence_note && (
            <div className="mt-3 p-3.5 bg-danger-soft text-danger rounded-xl text-center text-xs font-medium">
              {result.confidence_note}
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full mt-5 py-3.5 rounded-xl font-semibold bg-card text-foreground border border-border active:scale-[0.98] transition-all duration-150"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            繼續掃描
          </button>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="animate-float-up">
          <div className="p-5 bg-danger-soft rounded-2xl text-center">
            <div className="text-2xl mb-2">!</div>
            <p className="text-danger font-medium text-sm">{error}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full mt-4 py-3.5 rounded-xl font-semibold bg-card text-foreground border border-border active:scale-[0.98] transition-all duration-150"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            重試
          </button>
        </div>
      )}
    </main>
  );
}
