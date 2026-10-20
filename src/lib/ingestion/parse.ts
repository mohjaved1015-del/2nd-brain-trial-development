/**
 * Document parsing via Unstructured.io. Kept isolated behind this one
 * function so the parsing vendor can be swapped without touching
 * chunking, embedding, or anything upstream.
 */
export async function parseDocument(file: Buffer, filename: string): Promise<string> {
  const apiUrl = process.env.UNSTRUCTURED_API_URL;
  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("Missing UNSTRUCTURED_API_URL or UNSTRUCTURED_API_KEY");
  }

  // Buffer's underlying ArrayBufferLike isn't assignable to BlobPart under
  // strict TS; a plain Uint8Array copy of the same bytes is.
  const bytes = new Uint8Array(file);

  const form = new FormData();
  form.append("files", new Blob([bytes]), filename);
  form.append("strategy", "auto");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "unstructured-api-key": apiKey },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Unstructured.io parse failed (${response.status}): ${await response.text()}`);
  }

  const elements: Array<{ text?: string }> = await response.json();
  return elements
    .map((element) => element.text ?? "")
    .filter(Boolean)
    .join("\n\n");
}
