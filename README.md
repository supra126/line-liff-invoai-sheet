# LINE LIFF InvoAI Sheet

工作上的一個 tactical project，如果你也有類似的需求，歡迎直接拿去用。

用戶透過 LINE 開啟 LIFF 頁面，拍照或選擇發票圖片上傳，系統會先嘗試 QR Code 解碼（電子發票），如果失敗會自動透過 Gemini AI 辨識，最後將結果寫入 Google Sheets。

對於沒有實體發票的用戶可選手動輸入，但本專案未串接財政部電子發票 API，因此就真的只能純手動輸入。

## 快速開始

**不需要寫程式！** 跟著互動式引導，幾分鐘就能部署完成：

> **[https://supra126.github.io/line-liff-invoai-sheet/](https://supra126.github.io/line-liff-invoai-sheet/)** — 互動式設定引導，一步步帶你取得 API Key、設定 Google Sheets、部署到 Vercel。


## 辨識流程

1. **QR Code 掃描** — 用 sharp + jsQR，直接從 QR Code 取資料（萬一商品太多可能會被截斷）
2. **Gemini AI fallback** — QR Code 讀不到時，透過 Gemini Vision 辨識發票內容
3. **寫入 Google Sheets** — 辨識結果自動寫入指定試算表

## 設定教學

部署前需要準備以下設定值。如果你不熟悉這些步驟，可以參考 **[互動式設定引導](https://supra126.github.io/line-liff-invoai-sheet/)**，有完整的圖文教學。

### Step 1：取得 Gemini API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)，登入 Google 帳號
2. 點「Create API Key」建立金鑰
3. 複製金鑰 → 這就是 `GEMINI_API_KEY`

### Step 2：設定 Google Sheets + Apps Script

1. 前往 [Google Sheets](https://sheets.google.com) 建立新的試算表
2. 上方選單 → **擴充功能** → **Apps Script**
3. 刪除預設程式碼，將 [`google-apps-script.js`](./google-apps-script.js) 的內容貼上
4. **修改第 1 行**的 `SECRET`，改成你自己的隨機字串（例如：`my-secret-abc123`）
5. 點擊 **部署** → **新增部署**
6. 類型選 **網頁應用程式**，執行身分選「我」，存取權限選「所有人」
7. 部署後複製 Web App URL → 這就是 `GOOGLE_APPS_SCRIPT_URL`
8. 你在第 4 步設定的隨機字串 → 這就是 `GOOGLE_APPS_SCRIPT_SECRET`

> 首次寫入時會自動建立 `Invoices` 工作表及標頭，不需手動設定。

### Step 3：設定 LINE LIFF（選填）

> 不設定 LIFF 也可以使用，但不會有 LINE 使用者辨識功能。

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 建立 Provider → 建立 **LINE Login** channel
3. 在 LIFF 頁籤新增 LIFF App：
   - **Size**：`Full`
   - **Endpoint URL**：你的 Vercel 部署網址（如 `https://your-app.vercel.app`）
   - **Scope**：勾選 `profile`
4. 複製 LIFF ID → 到 Vercel 的 Settings → Environment Variables 加入 `NEXT_PUBLIC_LIFF_ID`

## 手動安裝

### 前置需求

- Node.js 18+
- LINE Developers 帳號（建立 LIFF App）
- Google AI Studio API Key（Gemini）
- Google 帳號（透過 Apps Script 寫入 Google Sheets，不需要 GCP）

### 1. Clone 並安裝依賴

```bash
git clone https://github.com/supra126/line-liff-invoai-sheet.git
cd line-liff-invoai-sheet
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env.local
```

編輯 `.env.local`，參考上方[設定教學](#設定教學)填入各項設定值。

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟 http://localhost:3000 即可使用。未設定 `NEXT_PUBLIC_LIFF_ID` 時會自動進入開發模式，不需登入 LINE。

### 4. 部署

```bash
npm run build
npm start
```

支援部署至 Vercel、Docker 或任何支援 Node.js 的平台。部署後記得更新 LINE LIFF 的 Endpoint URL。

## 選填設定

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `SITE_TITLE` | 網站標題 | 發票登錄 |
| `GEMINI_MODEL` | Gemini 模型 | gemini-2.5-flash |

## 技術棧

Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Gemini AI / Google Apps Script / sharp / jsQR / LIFF SDK v2

## 授權

MIT
