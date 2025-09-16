// server/controllers/qrcode.controller.ts
import QRCode from "qrcode";

export async function genCentralQR(absBaseUrl: string): Promise<Uint8Array> {
  // สร้างลิงก์แบบ relative /survey ให้เป็น absolute จาก base ที่ส่งมา
  const href = absBaseUrl.replace(/\/$/, "") + "/survey";

  const buf = await QRCode.toBuffer(href, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 600,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFFFF" },
  });
  return new Uint8Array(buf);
}
