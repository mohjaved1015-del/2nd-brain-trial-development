import pdfParse from "pdf-parse";
import mammoth from "mammoth";

/**
 * Local, zero-vendor document parsing — no API key, no signup, no
 * external service. Replaced Unstructured.io (see decisions/log.md):
 * their signup required a work email MJ didn't have, and this avoids
 * depending on a vendor at all for a capability small open-source
 * libraries already handle well for the formats in scope.
 *
 * Scope, same as the earlier video-is-out-of-scope decision: text, PDF,
 * and Word (.docx) work today. Images (OCR) and legacy .doc are
 * deferred — both would need a heavier library/vendor decision of their
 * own, not a quick addition here.
 */
export async function parseDocument(file: Buffer, filename: string): Promise<string> {
  const extension = filename.toLowerCase().split(".").pop() ?? "";

  switch (extension) {
    case "txt":
    case "md":
      return file.toString("utf-8");

    case "pdf": {
      const result = await pdfParse(file);
      return result.text;
    }

    case "docx": {
      const result = await mammoth.extractRawText({ buffer: file });
      return result.value;
    }

    case "doc":
      throw new Error("Legacy .doc files aren't supported yet — save as .docx and try again.");

    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      throw new Error("Image upload (OCR) isn't supported yet — deferred, same as video. Text/PDF/Word work today.");

    default:
      throw new Error(`Unsupported file type: .${extension}. Supported: .txt, .md, .pdf, .docx.`);
  }
}
