import type { LineProfile } from "@/lib/line";

interface InvoiceData {
  invoice_date?: string | null;
  vendor_name?: string | null;
  invoice_number?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  payment_method?: string | null;
  line_items?: { name: string; qty: number; price: number }[];
  raw_text?: string | null;
  confidence_note?: string | null;
}

export async function appendInvoiceRow(
  invoiceData: InvoiceData,
  lineUser: LineProfile
) {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url || !url.startsWith("https://script.google.com/")) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not set or invalid");
  }

  const payload = {
    secret: process.env.GOOGLE_APPS_SCRIPT_SECRET || "",
    submitted_at: new Date().toISOString(),
    line_user_id: lineUser.userId,
    line_display_name: lineUser.displayName,
    line_picture_url: lineUser.pictureUrl,
    invoice_date: invoiceData.invoice_date || "",
    vendor_name: invoiceData.vendor_name || "",
    invoice_number: invoiceData.invoice_number || "",
    subtotal: invoiceData.subtotal ?? "",
    tax_amount: invoiceData.tax_amount ?? "",
    total_amount: invoiceData.total_amount ?? "",
    currency: invoiceData.currency || "",
    payment_method: invoiceData.payment_method || "",
    line_items_json: JSON.stringify(invoiceData.line_items || []),
    raw_text: invoiceData.raw_text || "",
    confidence_note: invoiceData.confidence_note || "",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Apps Script error: ${res.status} ${text}`);
  }
}
