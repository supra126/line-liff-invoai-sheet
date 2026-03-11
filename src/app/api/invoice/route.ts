import { NextRequest, NextResponse } from "next/server";
import { extractInvoice } from "@/lib/gemini";
import { appendInvoiceRow } from "@/lib/sheets";
import { scanQRCodes, parseTwInvoiceFromQRCodes } from "@/lib/qrcode";
import { getLineProfile } from "@/lib/line";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("invoice");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "請上傳發票圖片" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `不支援的檔案類型: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "檔案大小不可超過 10MB" },
        { status: 400 }
      );
    }

    const accessToken = request.headers.get("authorization")?.replace("Bearer ", "") || "";
    const profile = await getLineProfile(accessToken);

    if (!profile) {
      return NextResponse.json({ error: "未授權，請透過 LINE 登入後使用" }, { status: 401 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. 先嘗試 QR Code 解碼（快速且精確）
    let invoiceData = null;
    try {
      const qrTexts = await scanQRCodes(buffer);
      if (qrTexts.length > 0) {
        const twInvoice = parseTwInvoiceFromQRCodes(qrTexts);
        if (twInvoice) {
          invoiceData = {
            invoice_date: twInvoice.invoice_date,
            vendor_name: twInvoice.seller_ban, // 統編，後續可查公司名
            invoice_number: twInvoice.invoice_number,
            subtotal: twInvoice.subtotal,
            tax_amount: twInvoice.total_amount - twInvoice.subtotal,
            total_amount: twInvoice.total_amount,
            currency: "TWD",
            payment_method: null,
            line_items: twInvoice.line_items,
            confidence_note: null,
            source: "qrcode",
          };
        }
      }
    } catch (qrErr) {
      console.warn("QR Code scan failed, falling back to Gemini:", qrErr);
    }

    // 2. QR Code 讀不到，fallback 到 Gemini AI 辨識
    if (!invoiceData) {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: "無法辨識發票 QR Code，且未設定 GEMINI_API_KEY 無法進行 AI 辨識" },
          { status: 422 }
        );
      }
      invoiceData = {
        ...(await extractInvoice(buffer, file.type)),
        source: "gemini",
      };
    }

    // 3. 檢查辨識結果是否有效
    const hasValidData =
      invoiceData.invoice_number ||
      invoiceData.vendor_name ||
      invoiceData.total_amount != null;

    if (!hasValidData) {
      return NextResponse.json(
        { error: "無法從圖片中辨識出發票資訊，請確認圖片清晰且為發票/收據", ...invoiceData },
        { status: 422 }
      );
    }

    // 4. 寫入 Google Sheets
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
    console.error("Invoice processing error:", err);
    return NextResponse.json({ error: "發票辨識失敗，請重試" }, { status: 500 });
  }
}
