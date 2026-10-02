import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import { AppError } from "@/lib/errors";

export interface StorageObjectMeta {
  storageKey: string;
  storageProvider: string;
  storageBucket?: string;
  fileSize: number;
}

export interface SignedDownloadPayload {
  documentId: string;
  businessId: string;
  userId: string;
  expiresAt: number;
}

const STORAGE_ROOT = process.env.STORAGE_PATH
  ? path.join(process.env.STORAGE_PATH, "vault")
  : process.env.VERCEL
  ? path.join("/tmp", "storage", "vault")
  : path.join(process.cwd(), "storage", "vault");
const TOKEN_SECRET = process.env.AUTH_SECRET || "sai-vault-secure-hmac-token-secret-998811";

export class StorageService {
  private static ensureInitialized = false;

  private static async init(): Promise<void> {
    if (!this.ensureInitialized) {
      if (!fsSync.existsSync(STORAGE_ROOT)) {
        await fs.mkdir(STORAGE_ROOT, { recursive: true });
      }
      this.ensureInitialized = true;
    }
  }

  /**
   * Generates a secure, unguessable, business-isolated conceptual storage key.
   * Format: business/<businessId>/documents/<year>/<uuid>.<ext>
   */
  public static generateStorageKey(businessId: string, extension: string): string {
    const year = new Date().getFullYear();
    const cleanExt = extension.replace(/^\./, "").toLowerCase() || "bin";
    const uuid = crypto.randomUUID();
    return `business/${businessId}/documents/${year}/${uuid}.${cleanExt}`;
  }

  /**
   * Resolves storage key to absolute safe local file path.
   * Strictly prevents directory traversal outside STORAGE_ROOT.
   */
  public static getAbsolutePath(storageKey: string): string {
    if (!storageKey || storageKey.includes("..") || path.isAbsolute(storageKey)) {
      throw new AppError("Security violation: Attempted path traversal in storage key.", 403);
    }
    const cleanKey = storageKey.replace(/^[/\\]+/, "");
    const absolutePath = path.resolve(STORAGE_ROOT, cleanKey);

    if (!absolutePath.startsWith(path.resolve(STORAGE_ROOT))) {
      throw new AppError("Security violation: Attempted path traversal in storage key.", 403);
    }

    return absolutePath;
  }

  /**
   * Store object securely into private vault.
   */
  public static async saveObject(storageKey: string, buffer: Buffer): Promise<StorageObjectMeta> {
    await this.init();
    const absolutePath = this.getAbsolutePath(storageKey);
    const parentDir = path.dirname(absolutePath);

    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    return {
      storageKey,
      storageProvider: "LOCAL_VAULT",
      fileSize: buffer.length,
    };
  }

  /**
   * Read object bytes from private vault.
   */
  public static async getObject(storageKey: string): Promise<Buffer> {
    await this.init();
    const absolutePath = this.getAbsolutePath(storageKey);

    if (!fsSync.existsSync(absolutePath)) {
      throw new AppError("Storage object not found in private vault.", 404);
    }

    return fs.readFile(absolutePath);
  }

  /**
   * Check if object exists in storage.
   */
  public static async exists(storageKey: string): Promise<boolean> {
    try {
      const absolutePath = this.getAbsolutePath(storageKey);
      return fsSync.existsSync(absolutePath);
    } catch {
      return false;
    }
  }

  /**
   * Delete object from private vault.
   */
  public static async deleteObject(storageKey: string): Promise<void> {
    try {
      const absolutePath = this.getAbsolutePath(storageKey);
      if (fsSync.existsSync(absolutePath)) {
        await fs.unlink(absolutePath);
      }
    } catch (error) {
      console.warn(`[StorageService] Warning: Failed to delete storage object ${storageKey}:`, error);
    }
  }

  /**
   * Generates a short-lived HMAC-signed token for authorized private file download.
   * Default validity: 15 minutes.
   */
  public static generateSignedDownloadToken(
    documentId: string,
    businessId: string,
    userId: string,
    expiresInMinutes = 15
  ): string {
    const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
    const payload: SignedDownloadPayload = {
      documentId,
      businessId,
      userId,
      expiresAt,
    };

    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson).toString("base64url");
    const signature = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(payloadB64)
      .digest("base64url");

    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifies signed download token and ensures it has not expired.
   */
  public static verifySignedDownloadToken(token: string): SignedDownloadPayload {
    if (!token || typeof token !== "string" || !token.includes(".")) {
      throw new AppError("Invalid download signature.", 401);
    }

    const [payloadB64, signature] = token.split(".");
    const expectedSig = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(payloadB64)
      .digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new AppError("Tampered or invalid download token signature.", 403);
    }

    try {
      const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
      const payload: SignedDownloadPayload = JSON.parse(payloadJson);

      if (Date.now() > payload.expiresAt) {
        throw new AppError("Download token has expired. Please generate a new download link.", 410);
      }

      return payload;
    } catch (e: unknown) {
      if (e instanceof AppError) throw e;
      throw new AppError("Malformed download token payload.", 400);
    }
  }
}
