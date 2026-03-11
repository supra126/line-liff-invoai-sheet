import { NextRequest, NextResponse } from "next/server";
import { appendInvoiceRow } from "@/lib/sheets";
import { getLineProfile } from "@/lib/line";

function normalizeInvoiceNumber(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[-\s]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{8}$/.test(cleaned)) return null;
  return cleaned;
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      invoice_number,
      invoice_date,
      vendor_name,
      total_amount,
      items,
    } = body;

    // 驗證總金額
    const parsedTotal = Number(total_amount);
    if (isNaN(parsedTotal) || parsedTotal < 0) {
      return NextResponse.json({ error: "請填寫有效的總金額" }, { status: 400 });
    }

    // 驗證並統一發票號碼格式
    if (invoice_number) {
      const normalized = normalizeInvoiceNumber(invoice_number);
      if (!normalized) {
        return NextResponse.json(
          { error: "發票號碼格式不正確，應為兩個英文字母加八位數字" },
          { status: 400 }
        );
      }
    }

    // 驗證日期格式
    if (invoice_date) {
      const normalized = normalizeDate(invoice_date);
      if (!normalized) {
        return NextResponse.json({ error: "發票日期格式不正確" }, { status: 400 });
      }
    }

    const accessToken = request.headers.get("authorization")?.replace("Bearer ", "") || "";
    const profile = await getLineProfile(accessToken);

    if (!profile) {
      return NextResponse.json({ error: "未授權，請透過 LINE 登入後使用" }, { status: 401 });
    }

    const lineItems = Array.isArray(items)
      ? items.filter((item: { name?: string }) => item.name?.trim())
      : [];

    const invoiceData = {
      invoice_date: normalizeDate(invoice_date || ""),
      vendor_name: vendor_name || null,
      invoice_number: normalizeInvoiceNumber(invoice_number || ""),
      subtotal: null,
      tax_amount: null,
      total_amount: parsedTotal,
      currency: "TWD",
      payment_method: null,
      line_items: lineItems,
      confidence_note: null,
      raw_text: null,
      source: "manual" as const,
    };

    let saved = false;
    let save_error: string | null = null;
    try {
      await appendInvoiceRow(invoiceData, profile);
      saved = true;
    } catch (sheetErr) {
      save_error = sheetErr instanceof Error ? sheetErr.message : String(sheetErr);
      console.error("Google Sheets write failed:", save_error);
    }

    return NextResponse.json({
      ...invoiceData,
      saved,
      save_error: saved ? null : "發票辨識成功，但資料尚未儲存，請稍後再試或聯絡客服",
    });
  } catch (err) {
    console.error("Manual invoice error:", err);
    return NextResponse.json({ error: "儲存失敗，請重試" }, { status: 500 });
  }
}
