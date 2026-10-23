import { createServiceClient } from "@/lib/supabase/server";

/**
 * Builds the graph JSON the 3D-Brain renderer expects, from Supabase
 * instead of local Markdown files (the renderer's original data source —
 * see .claude/skills/3d-brain/assets/template/build.mjs in the personal-
 * AIOS kit, which this is adapted from).
 *
 * One node per document (not per chunk) — a business's PDFs/FAQs don't
 * have the wikilink structure the original tool used to draw real
 * connections. MJ's explicit call over automatic keyword/embedding
 * similarity (see decisions/log.md): connections are manual, via the
 * "Manage files" folder tree (ManageFilesPanel.tsx, folder_path column,
 * migration 0009) — two documents link to each other only when they sit
 * in the exact same folder path. A document with no folder_path set
 * ("" — unfiled) gets no links, same as before this existed.
 */

const BRAIN_NAME = "Second Brain";
const SOURCE_ID = "documents";
const SOURCE_LABEL = "Documents";
const SOURCE_COLOR = "#38BDF8";
// Matches the original local-file tool's maxNodes default. No pagination
// UI exists yet for beyond this — it's a safety cap, not a real limit.
const MAX_NODES = 3000;

interface GraphNode {
  id: string;
  source: string;
  kind: string;
  title: string;
  slug: string;
  summary: string;
  path: string;
  relativePath: string;
  inRepo: boolean;
  updated: number;
  created: number | null;
  words: number;
  tags: string[];
  degree: number;
  flags: string[];
  broken: string[];
  ageDays: number;
  linkTargets: Record<string, string | null>;
  folderPath: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function summarize(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 260);
}

export async function buildGraph(orgId: string) {
  const supabase = createServiceClient();

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, title, raw_text, source, folder_path, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(MAX_NODES);

  if (error) throw new Error(`Failed to load documents: ${error.message}`);

  const warnings: string[] = [];
  if (!documents || documents.length === 0) {
    warnings.push("No documents ingested yet for this organization.");
  } else if (documents.length >= MAX_NODES) {
    warnings.push(`Reached the ${MAX_NODES}-document limit. Not all documents are shown.`);
  }

  const nodes: GraphNode[] = (documents ?? []).map((doc) => {
    const updated = new Date(doc.created_at).getTime();
    const ageDays = Math.max(0, Math.round((Date.now() - updated) / 86_400_000));
    const words = (doc.raw_text.match(/\S+/g) ?? []).length;
    const flags: string[] = [];
    if (words < 60) flags.push("stub");

    const folderPath = doc.folder_path ?? "";

    return {
      id: doc.id,
      source: SOURCE_ID,
      kind: "note",
      title: doc.title,
      slug: slugify(doc.title),
      summary: summarize(doc.raw_text),
      path: doc.id,
      relativePath: doc.id,
      inRepo: true,
      updated,
      created: updated,
      words,
      tags: folderPath ? [folderPath] : [],
      degree: 0,
      flags,
      broken: [],
      ageDays,
      linkTargets: {},
      folderPath,
    };
  });

  // Two documents link only when they sit in the exact same folder
  // path — see the module doc comment above. An unfiled document
  // (folderPath === "") stays isolated, same as before folders existed.
  const links: Array<{ source: string; target: string; kind: string }> = [];
  const byFolder = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    if (!node.folderPath) continue;
    const bucket = byFolder.get(node.folderPath) ?? [];
    bucket.push(node);
    byFolder.set(node.folderPath, bucket);
  }
  for (const bucket of byFolder.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]!;
        const b = bucket[j]!;
        links.push({ source: a.id, target: b.id, kind: "folder" });
        a.degree += 1;
        b.degree += 1;
      }
    }
  }

  const generatedAt = new Date().toISOString();
  const bySource = {
    [SOURCE_ID]: {
      id: SOURCE_ID,
      label: SOURCE_LABEL,
      color: SOURCE_COLOR,
      type: "markdown",
      staleDays: 90,
      short: SOURCE_LABEL,
      blurb: "Documents fed into this organization's second brain.",
      root: SOURCE_ID,
      count: nodes.length,
      kinds: { note: nodes.length },
      words: nodes.reduce((sum, n) => sum + n.words, 0),
      newest: nodes.length ? Math.max(...nodes.map((n) => n.updated)) : null,
      oldest: nodes.length ? Math.min(...nodes.map((n) => n.updated)) : null,
      flagged: nodes.filter((n) => n.flags.length).length,
    },
  };

  const flags: Record<string, string[]> = {};
  for (const flag of ["stale", "quiet", "orphan", "stub", "broken-links", "missing-folder", "archived", "not-ingested"]) {
    flags[flag] = nodes.filter((n) => n.flags.includes(flag)).map((n) => n.id);
  }

  return {
    brain: { name: BRAIN_NAME },
    generatedAt,
    builtAt: Date.now(),
    sources: [bySource[SOURCE_ID]],
    nodes,
    links,
    warnings,
    inventory: {
      generatedAt,
      totals: { nodes: nodes.length, links: links.length, words: nodes.reduce((sum, n) => sum + n.words, 0) },
      bySource,
      flags,
      navigation: [],
      hubs: [],
      linkKinds: {},
    },
  };
}
