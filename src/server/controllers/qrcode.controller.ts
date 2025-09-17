// server/controllers/qrcode.controller.ts
import QRCode from "qrcode";

/** สร้าง PNG ของ QR ที่ชี้ไปยัง /survey */
export async function genCentralQR(origin: string): Promise<Uint8Array> {
  const url = `${origin.replace(/\/+$/,'')}/survey`;
  // ใช้ toBuffer → ได้ PNG Buffer ตรง ๆ
  const buf = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
  });
  return new Uint8Array(buf);
}
