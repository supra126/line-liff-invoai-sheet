import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `你是一個發票/收據辨識助手。分析提供的發票圖片，提取所有相關資訊。

你必須回傳嚴格的 JSON 格式，不要包含其他文字。JSON 結構如下：

{
  "invoice_date": "YYYY-MM-DD 或 null",
  "vendor_name": "商家名稱 或 null",
  "invoice_number": "發票號碼 或 null",
  "subtotal": 數字或null,
  "tax_amount": 數字或null,
  "total_amount": 數字或null,
  "currency": "TWD/USD/... 或 null",
  "payment_method": "現金/信用卡/轉帳/其他 或 null",
  "line_items": [{"name": "品項名稱", "qty": 數量, "price": 單價}],
  "confidence_note": "如果圖片模糊或資訊不完整，在此說明；否則為 null"
}

規則：
- 找不到的欄位用 null，不要捏造
- 金額用數字（浮點數），不要帶貨幣符號
- 日期統一用 YYYY-MM-DD
- 只回傳 JSON，不要有其他文字`;

export async function extractInvoice(imageBuffer: Buffer, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });

  const base64 = imageBuffer.toString("base64");

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
      "請辨識這張發票/收據的內容。",
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
  });

  const text = response.text ?? "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      invoice_date: null,
      vendor_name: null,
      invoice_number: null,
      subtotal: null,
      tax_amount: null,
      total_amount: null,
      currency: null,
      payment_method: null,
      line_items: [],
      confidence_note: "AI 回傳格式異常",
      raw_text: text,
    };
  }
}
