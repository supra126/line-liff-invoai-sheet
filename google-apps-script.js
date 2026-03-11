/**
 * Google Apps Script — 貼到 Google Sheets 的 Apps Script 編輯器中
 *
 * 部署方式：
 * 1. 開啟 Google Sheets → 擴充功能 → Apps Script
 * 2. 將此檔案內容貼入編輯器，取代預設的 Code.gs
 * 3. 點擊「部署」→「新增部署」
 * 4. 類型選「網頁應用程式」
 * 5. 執行身分：「我」
 * 6. 存取權限：「所有人」
 * 7. 部署後複製 Web App URL，填入 .env.local 的 GOOGLE_APPS_SCRIPT_URL
 * 8. 將下方 SECRET 改為自訂的隨機字串，同時填入 .env.local 的 GOOGLE_APPS_SCRIPT_SECRET
 */

var SECRET = "請替換為你自己的隨機字串";
var SHEET_NAME = "Invoices";
var KEYS = [
  "submitted_at",
  "line_user_id",
  "line_display_name",
  "line_picture",
  "invoice_date",
  "vendor_name",
  "invoice_number",
  "subtotal",
  "tax_amount",
  "total_amount",
  "currency",
  "payment_method",
  "line_items_json",
  "raw_text",
  "confidence_note",
];
var HEADERS = [
  "提交時間",
  "LINE 用戶 ID",
  "用戶名稱",
  "大頭照",
  "發票日期",
  "商家名稱",
  "發票號碼",
  "小計",
  "稅額",
  "總金額",
  "幣別",
  "付款方式",
  "品項明細",
  "原始文字",
  "備註",
];

function sanitizeCell(value) {
  if (typeof value === "string" && /^[=+\-@|]/.test(value)) {
    return "'" + value;
  }
  return value;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== SECRET) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Unauthorized" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
    }

    var row = KEYS.map(function (key) {
      if (key === "line_picture") {
        var picUrl = data["line_picture_url"] || "";
        return picUrl ? '=IMAGE("' + picUrl + '")' : "";
      }
      var val = data[key] !== undefined ? data[key] : "";
      return sanitizeCell(val);
    });

    sheet.appendRow(row);

    return ContentService.createTextOutput(
      JSON.stringify({ success: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
