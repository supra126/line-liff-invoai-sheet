import sharp from "sharp";
import jsQR from "jsqr";

interface TwInvoice {
  invoice_number: string;
  invoice_date: string;
  random_code: string;
  subtotal: number;
  total_amount: number;
  buyer_ban: string | null;
  seller_ban: string;
  line_items: { name: string; qty: number; price: number }[];
}

/**
 * 從圖片 buffer 掃描 QR Code，回傳解碼文字陣列
 * 會嘗試全圖 + 左半 + 右半，找出最多兩個不同的 QR Code
 */
export async function scanQRCodes(
  imageBuffer: Buffer
): Promise<string[]> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return [];
  const width = metadata.width;
  const height = metadata.height;

  const results = new Set<string>();

  // 掃描全圖
  const fullResult = await decodeRegion(imageBuffer, 0, 0, width, height);
  if (fullResult) results.add(fullResult);

  // 掃描左半（左 QR Code）
  const leftResult = await decodeRegion(
    imageBuffer,
    0,
    0,
    Math.floor(width / 2),
    height
  );
  if (leftResult) results.add(leftResult);

  // 掃描右半（右 QR Code）
  const rightResult = await decodeRegion(
    imageBuffer,
    Math.floor(width / 2),
    0,
    Math.floor(width / 2),
    height
  );
  if (rightResult) results.add(rightResult);

  // 掃描下半部（有些發票 QR Code 在底部）
  const bottomResult = await decodeRegion(
    imageBuffer,
    0,
    Math.floor(height / 2),
    width,
    Math.floor(height / 2)
  );
  if (bottomResult) results.add(bottomResult);

  // 左下角
  const bottomLeftResult = await decodeRegion(
    imageBuffer,
    0,
    Math.floor(height / 2),
    Math.floor(width / 2),
    Math.floor(height / 2)
  );
  if (bottomLeftResult) results.add(bottomLeftResult);

  // 右下角
  const bottomRightResult = await decodeRegion(
    imageBuffer,
    Math.floor(width / 2),
    Math.floor(height / 2),
    Math.floor(width / 2),
    Math.floor(height / 2)
  );
  if (bottomRightResult) results.add(bottomRightResult);

  return Array.from(results);
}

async function decodeRegion(
  imageBuffer: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<string | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const result = jsQR(
      new Uint8ClampedArray(data.buffer),
      info.width,
      info.height
    );

    return result?.data || null;
  } catch {
    return null;
  }
}

/**
 * 解析台灣電子發票左 QR Code 字串
 * 格式: 發票號碼(10) + 民國日期(7) + 隨機碼(4) + 未稅金額hex(8) + 總金額hex(8) + 買方統編(8) + 賣方統編(8) + ...
 */
export function parseLeftQR(qrText: string): TwInvoice | null {
  // 台灣電子發票左 QR Code 至少 53 字元
  if (qrText.length < 53) return null;

  // 發票號碼格式: 兩個大寫英文 + 8位數字
  const invoiceNumber = qrText.substring(0, 10);
  if (!/^[A-Z]{2}\d{8}$/.test(invoiceNumber)) return null;

  const rocDate = qrText.substring(10, 17); // e.g., "1140301"
  const randomCode = qrText.substring(17, 21);
  const subtotalHex = qrText.substring(21, 29);
  const totalHex = qrText.substring(29, 37);
  const buyerBan = qrText.substring(37, 45);
  const sellerBan = qrText.substring(45, 53);

  // 轉換民國年到西元年
  const rocYear = parseInt(rocDate.substring(0, 3), 10);
  const month = rocDate.substring(3, 5);
  const day = rocDate.substring(5, 7);
  const adYear = rocYear + 1911;
  const invoiceDate = `${adYear}-${month}-${day}`;

  const subtotal = parseInt(subtotalHex, 16);
  const totalAmount = parseInt(totalHex, 16);

  return {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    random_code: randomCode,
    subtotal,
    total_amount: totalAmount,
    buyer_ban: buyerBan === "00000000" ? null : buyerBan,
    seller_ban: sellerBan,
    line_items: [],
  };
}

/**
 * 解析台灣電子發票右 QR Code 字串
 * 格式: **品名:數量:單價:品名:數量:單價:...
 */
export function parseRightQR(
  qrText: string
): { name: string; qty: number; price: number }[] {
  if (!qrText.startsWith("**")) return [];

  const itemsPart = qrText.substring(2);
  const parts = itemsPart.split(":");
  const items: { name: string; qty: number; price: number }[] = [];

  for (let i = 0; i + 2 < parts.length; i += 3) {
    items.push({
      name: parts[i],
      qty: parseFloat(parts[i + 1]) || 1,
      price: parseFloat(parts[i + 2]) || 0,
    });
  }

  return items;
}

/**
 * 從掃描到的 QR Code 文字中，辨識並解析台灣電子發票
 */
export function parseTwInvoiceFromQRCodes(qrTexts: string[]): TwInvoice | null {
  let invoice: TwInvoice | null = null;
  let items: { name: string; qty: number; price: number }[] = [];

  for (const text of qrTexts) {
    // 嘗試解析左 QR Code
    const left = parseLeftQR(text);
    if (left) {
      invoice = left;
      continue;
    }

    // 嘗試解析右 QR Code
    const right = parseRightQR(text);
    if (right.length > 0) {
      items = right;
    }
  }

  if (invoice && items.length > 0) {
    invoice.line_items = items;
  }

  return invoice;
}
