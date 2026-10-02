import crypto from "crypto";
import path from "path";
import { AppError } from "@/lib/errors";

export interface FileValidationResult {
  isValid: boolean;
  safeFileName: string;
  extension: string;
  detectedMimeType: string;
  declaredMimeType: string;
  fileSize: number;
  checksum: string;
  isQuarantined: boolean;
  quarantineReason?: string;
  securityNotes?: string[];
}

export interface SecurityScannerCapability {
  scannerType: string;
  isActive: boolean;
  realtimeEngine: string;
  externalAntivirusConnected: boolean;
  supportedChecks: string[];
  notice: string;
}

// Configurable file size limits (bytes)
export const FILE_SIZE_LIMITS: Record<string, number> = {
  pdf: 20 * 1024 * 1024, // 20 MB
  image: 10 * 1024 * 1024, // 10 MB
  spreadsheet: 15 * 1024 * 1024, // 15 MB
  document: 15 * 1024 * 1024, // 15 MB
  text: 10 * 1024 * 1024, // 10 MB
  default: 20 * 1024 * 1024,
};

// Safe allowed extensions and standard MIME types
export const ALLOWED_EXTENSIONS_MAP: Record<string, { mime: string; category: string }> = {
  pdf: { mime: "application/pdf", category: "pdf" },
  png: { mime: "image/png", category: "image" },
  jpg: { mime: "image/jpeg", category: "image" },
  jpeg: { mime: "image/jpeg", category: "image" },
  webp: { mime: "image/webp", category: "image" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    category: "spreadsheet",
  },
  xls: { mime: "application/vnd.ms-excel", category: "spreadsheet" },
  csv: { mime: "text/csv", category: "spreadsheet" },
  txt: { mime: "text/plain", category: "text" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
  },
};

// Dangerous extensions that must be rejected unconditionally
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "dll", "bin", "msi", "com", "scr", "bat", "cmd", "sh", "bash",
  "ps1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "py", "pyw", "php",
  "phtml", "rb", "pl", "cgi", "jar", "app", "dmg", "pkg", "deb", "rpm",
  "html", "htm", "hta", "xhtml", "svg", "lnk", "url", "pif", "inf",
  "reg", "iso", "img", "vhd", "xlsm", "xltm", "xlam", "docm", "dotm",
  "pptm", "potm", "ppam"
]);

export class FileSecurityService {
  /**
   * Reports the actual capabilities of the file security system.
   * Accurately distinguishes between local heuristic validation and external scanners.
   */
  public static getScannerCapability(): SecurityScannerCapability {
    return {
      scannerType: "LOCAL_HEURISTIC_SIGNATURE_ENGINE",
      isActive: true,
      realtimeEngine: "Magic Byte Inspector + ZIP Bomb Sentry + Macro Rejector + Extension Sanitizer",
      externalAntivirusConnected: false,
      supportedChecks: [
        "Magic bytes / binary file signature inspection",
        "Declared vs detected MIME type consistency verification",
        "Multi-extension & concealed executable detection (e.g. .pdf.exe)",
        "Path traversal sanitization",
        "ZIP bomb decompression ratio & entry count sentry",
        "VBA macro detection & rejection in Office documents (.xlsm, vbaProject.bin)",
        "SHA-256 cryptographic content integrity checksum",
        "Business-scoped duplicate content detection",
      ],
      notice:
        "Files undergo strict server-side heuristic and signature inspection. External ClamAV daemon is not connected in this environment.",
    };
  }

  /**
   * Compute cryptographic SHA-256 checksum of raw buffer.
   */
  public static calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Sanitize filename to prevent path traversal while preserving Tamil and international Unicode characters.
   */
  public static sanitizeFileName(rawFileName: string): string {
    if (!rawFileName || typeof rawFileName !== "string") {
      return "unnamed_document.bin";
    }

    // Strip directory paths (both unix and windows)
    const baseName = path.basename(rawFileName.trim().replace(/[/\\]+/g, "/"));

    // Remove null bytes and non-printable control characters (ASCII 0-31)
    // Preserves all Unicode ranges including Tamil (U+0B80 - U+0BFF)
    const sanitized = baseName.replace(/[\x00-\x1F\x7F]/g, "").trim();

    return sanitized || "unnamed_document.bin";
  }

  /**
   * Validate file extension and check for dangerous double extensions.
   * Example: 'invoice.pdf.exe' or 'report.tar.gz' or 'notes..pdf'
   */
  public static validateExtension(fileName: string): { extension: string; safeBaseName: string } {
    const cleanName = this.sanitizeFileName(fileName);
    const parts = cleanName.split(".").filter(Boolean);

    if (parts.length < 2) {
      throw new AppError("File must have a valid extension.", 400);
    }

    const lastExt = parts[parts.length - 1].toLowerCase();

    // Check all segments for hidden dangerous extensions
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i].toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(seg)) {
        throw new AppError(
          `Security violation: Concealed dangerous extension detected (${seg}). Upload rejected.`,
          400
        );
      }
    }

    if (DANGEROUS_EXTENSIONS.has(lastExt)) {
      throw new AppError(
        `File type .${lastExt} is blocked for security reasons. Executables, scripts, and macro-enabled files are prohibited.`,
        400
      );
    }

    if (!ALLOWED_EXTENSIONS_MAP[lastExt]) {
      throw new AppError(
        `Unsupported file extension .${lastExt}. Allowed types: PDF, PNG, JPG, WEBP, XLSX, XLS, CSV, TXT, DOCX.`,
        400
      );
    }

    return {
      extension: lastExt,
      safeBaseName: cleanName,
    };
  }

  /**
   * Inspect magic bytes / file signatures to detect actual content type.
   */
  public static detectMimeTypeFromBuffer(buffer: Buffer, declaredExt: string): string {
    if (!buffer || buffer.length === 0) {
      throw new AppError("Uploaded file is empty (0 bytes).", 400);
    }

    // 1. PDF: %PDF- (0x25 0x50 0x44 0x46)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return "application/pdf";
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return "image/png";
    }

    // 3. JPEG: FF D8 FF
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return "image/jpeg";
    }

    // 4. WEBP: RIFF ... WEBP
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return "image/webp";
    }

    // 5. ZIP container: PK 03 04 (XLSX, DOCX)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      if (declaredExt === "docx") {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    // 6. Legacy OLE2 Composite File: D0 CF 11 E0 A1 B1 1A E1 (XLS)
    if (
      buffer.length >= 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    ) {
      return "application/vnd.ms-excel";
    }

    // 7. Plain text / CSV inspection
    // Ensure no null bytes or binary control characters except CR, LF, Tab
    const sampleLength = Math.min(buffer.length, 4096);
    let isBinary = false;
    for (let i = 0; i < sampleLength; i++) {
      const byte = buffer[i];
      if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
        isBinary = true;
        break;
      }
    }

    if (!isBinary) {
      if (declaredExt === "csv") {
        return "text/csv";
      }
      return "text/plain";
    }

    // If it is binary but did not match any known safe signature
    return "application/octet-stream";
  }

  /**
   * ZIP archive sentry: guards against ZIP bombs and detects embedded macros in XLSX/DOCX.
   */
  public static inspectZipStructure(buffer: Buffer): {
    hasMacros: boolean;
    isZipBomb: boolean;
    entryCount: number;
    totalUncompressedSize: number;
    details: string[];
  } {
    const details: string[] = [];
    let entryCount = 0;
    let totalUncompressedSize = 0;
    let hasMacros = false;
    let isZipBomb = false;

    // Scan ZIP local file headers (0x04034B50)
    let offset = 0;
    const MAX_ENTRIES = 2000;
    const MAX_UNCOMPRESSED_TOTAL = 60 * 1024 * 1024; // 60 MB

    while (offset + 30 <= buffer.length) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) {
        break; // End of local headers or non-standard alignment
      }

      entryCount++;
      if (entryCount > MAX_ENTRIES) {
        isZipBomb = true;
        details.push(`Exceeded maximum allowed ZIP entry count (${MAX_ENTRIES})`);
        break;
      }

      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const fileNameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      totalUncompressedSize += uncompressedSize;

      if (totalUncompressedSize > MAX_UNCOMPRESSED_TOTAL) {
        isZipBomb = true;
        details.push(`Exceeded maximum uncompressed size (${MAX_UNCOMPRESSED_TOTAL} bytes)`);
        break;
      }

      if (compressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > 100 && uncompressedSize > 1024 * 1024) {
          isZipBomb = true;
          details.push(`Extreme compression ratio detected (${ratio.toFixed(1)}:1)`);
          break;
        }
      }

      const nameStart = offset + 30;
      const nameEnd = nameStart + fileNameLength;
      if (nameEnd <= buffer.length) {
        const entryName = buffer.toString("utf8", nameStart, nameEnd).toLowerCase();

        // Macro check: vbaProject.bin, macros/, etc.
        if (
          entryName.includes("vbaproject.bin") ||
          entryName.includes("vba_project") ||
          entryName.includes("macros/") ||
          entryName.includes("vbadatamodel") ||
          entryName.endsWith(".vba")
        ) {
          hasMacros = true;
          details.push(`VBA Macro component detected: ${entryName}`);
        }
      }

      // Advance to next header: header (30) + filename + extra field + compressed payload
      offset = nameEnd + extraFieldLength + compressedSize;
    }

    return {
      hasMacros,
      isZipBomb,
      entryCount,
      totalUncompressedSize,
      details,
    };
  }

  /**
   * Complete multi-layer validation pipeline for untrusted file uploads.
   */
  public static async validateUploadedFile(
    rawFileName: string,
    buffer: Buffer,
    declaredMimeType?: string
  ): Promise<FileValidationResult> {
    const securityNotes: string[] = [];

    // 1. Sanitize filename and validate extension
    const { extension, safeBaseName } = this.validateExtension(rawFileName);

    // 2. Size limit validation
    const expectedConfig = ALLOWED_EXTENSIONS_MAP[extension];
    const categoryLimit =
      FILE_SIZE_LIMITS[expectedConfig.category] || FILE_SIZE_LIMITS.default;

    if (buffer.length > categoryLimit) {
      const limitMB = (categoryLimit / (1024 * 1024)).toFixed(0);
      throw new AppError(
        `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds allowed limit of ${limitMB} MB for .${extension} files.`,
        400
      );
    }

    if (buffer.length === 0) {
      throw new AppError("File is empty (0 bytes).", 400);
    }

    // 3. Cryptographic checksum (SHA-256)
    const checksum = this.calculateChecksum(buffer);

    // 4. File signature & MIME detection
    const detectedMimeType = this.detectMimeTypeFromBuffer(buffer, extension);

    // 5. Inconsistency / MIME mismatch check
    if (detectedMimeType === "application/octet-stream") {
      throw new AppError(
        `File signature mismatch: File claims to be .${extension}, but actual binary content is unrecognized or dangerous.`,
        400
      );
    }

    // Verify expected MIME family matches detected MIME
    const expectedMime = expectedConfig.mime;
    const isMimeCompatible =
      detectedMimeType === expectedMime ||
      (extension === "csv" && (detectedMimeType === "text/csv" || detectedMimeType === "text/plain")) ||
      (extension === "txt" && detectedMimeType === "text/plain");

    if (!isMimeCompatible) {
      throw new AppError(
        `Security alert: Content type mismatch. File extension is .${extension} (expected ${expectedMime}), but file binary signature detected as ${detectedMimeType}.`,
        400
      );
    }

    // 6. Deep inspection for ZIP-based formats (XLSX, DOCX)
    const isQuarantined = false;
    let quarantineReason: string | undefined;

    if (extension === "xlsx" || extension === "docx") {
      const zipInspection = this.inspectZipStructure(buffer);

      if (zipInspection.isZipBomb) {
        throw new AppError(
          `Security rejection: Compressed archive safety limits exceeded. Possible ZIP bomb detected.`,
          400
        );
      }

      if (zipInspection.hasMacros) {
        throw new AppError(
          `Security rejection: Embedded VBA macros detected in ${safeBaseName}. Macro-enabled spreadsheets (.xlsm) and macro scripts are strictly prohibited.`,
          400
        );
      }

      securityNotes.push(
        `ZIP archive validated: ${zipInspection.entryCount} entries, uncompressed total ${(zipInspection.totalUncompressedSize / 1024).toFixed(1)} KB`
      );
    }

    return {
      isValid: true,
      safeFileName: safeBaseName,
      extension,
      detectedMimeType,
      declaredMimeType: declaredMimeType || detectedMimeType,
      fileSize: buffer.length,
      checksum,
      isQuarantined,
      quarantineReason,
      securityNotes,
    };
  }
}
