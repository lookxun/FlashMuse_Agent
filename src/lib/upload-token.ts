import { createHmac, timingSafeEqual } from "crypto";

const authSecret = process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me";
const uploadTokenMaxAgeMs = 5 * 60 * 1000;

type UploadTokenPayload = {
  userId: string;
  purpose: "upload-image";
  exp: number;
};

function signUploadTokenPayload(payload: string) {
  return createHmac("sha256", `${authSecret}:upload-token`).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createUploadToken(userId: string) {
  const payload: UploadTokenPayload = {
    userId,
    purpose: "upload-image",
    exp: Date.now() + uploadTokenMaxAgeMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signUploadTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyUploadToken(token: string | undefined) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!safeEqual(signUploadTokenPayload(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<UploadTokenPayload>;
    if (payload.purpose !== "upload-image") return null;
    if (!payload.userId || typeof payload.userId !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function getBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}
