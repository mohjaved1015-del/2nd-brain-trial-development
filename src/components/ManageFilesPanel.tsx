"use client";

import { useEffect, useMemo, useState } from "react";

interface DocRow {
  id: string;
  title: string;
  folder_path: string;
  created_at: string;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  docs: DocRow[];
}

function buildTree(docs: DocRow[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map(), docs: [] };

  for (const doc of docs) {
    if (!doc.folder_path) {
      root.docs.push(doc);
      continue;
    }
    let node = root;
    const segments = doc.folder_path.split("/");
    let pathSoFar = "";
    for (const segment of segments) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;
      let child = node.children.get(segment);
      if (!child) {
        child = { name: segment, path: pathSoFar, children: new Map(), docs: [] };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.docs.push(doc);
  }

  return root;
}

/**
 * MJ's explicit direction over automatic keyword/embedding linking (see
 * decisions/log.md and src/lib/graph/build.ts): documents are organized
 * into a nested folder tree by hand, and two documents link to each
 * other in the 3D graph only when they share the exact same folder_path
 * (migration 0009). Two ways to move a document:
 *  - drag it onto a folder in the tree below
 *  - edit its path directly in the "All files" list (typing a path that
 *    doesn't exist yet creates it the moment a document is saved into
 *    it — there's no separate folders table, a folder exists only as
 *    the common folder_path of the documents in it)
 *
 * The 3D graph only re-reads its data on page load (see ChatPanel.tsx's
 * refreshGraphSoon for the same constraint), so moves here don't appear
 * in the graph until "Refresh graph" is clicked or the page reloads.
 */
export function ManageFilesPanel({ orgId }: { orgId: string }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/document?orgId=${encodeURIComponent(orgId)}`);
      const data = await response.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [orgId]);

  const tree = useMemo(() => buildTree(docs), [docs]);

  async function moveDocument(id: string, folderPath: string) {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, folder_path: folderPath } : d)));
    setDirty(true);
    await fetch("/api/document", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, folderPath, orgId }),
    });
  }

  function handleDropOn(folderPath: string) {
    setDragOverPath(null);
    if (!dragId) return;
    moveDocument(dragId, folderPath);
    setDragId(null);
  }

  function savePathEdit(doc: DocRow) {
    const next = edits[doc.id];
    if (next === undefined || next === doc.folder_path) return;
    moveDocument(doc.id, next);
  }

  function renderFolder(node: TreeNode, depth: number) {
    const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));
    const isOver = dragOverPath === node.path;

    return (
      <details key={node.path} open className="folder-node" style={{ marginLeft: depth ? 14 : 0 }}>
        <summary
          className={`folder-label${isOver ? " drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverPath(node.path);
          }}
          onDragLeave={() => setDragOverPath((p) => (p === node.path ? null : p))}
          onDrop={(e) => {
            e.preventDefault();
            handleDropOn(node.path);
          }}
        >
          {node.name} <span className="folder-count">{node.docs.length}</span>
        </summary>
        <div className="folder-children">
          {node.docs.map((doc) => (
            <div
              key={doc.id}
              className="file-row"
              draggable
              onDragStart={() => setDragId(doc.id)}
              onDragEnd={() => setDragId(null)}
              title="Drag to another folder"
            >
              {doc.title}
            </div>
          ))}
          {children.map((child) => renderFolder(child, depth + 1))}
        </div>
      </details>
    );
  }

  return (
    <div className="files-panel">
      <div className="files-toolbar">
        <button onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Reload list"}
        </button>
        <button
          className="primary"
          onClick={() => window.location.reload()}
          title="The 3D graph only re-reads folder links on page load"
        >
          Refresh graph{dirty ? " (changes pending)" : ""}
        </button>
      </div>

      <section className="files-section">
        <h3>Folders</h3>
        <div
          className={`folder-tree${dragOverPath === "" ? " drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverPath("");
          }}
          onDragLeave={() => setDragOverPath((p) => (p === "" ? null : p))}
          onDrop={(e) => {
            e.preventDefault();
            handleDropOn("");
          }}
        >
          {docs.length === 0 && !loading && <p className="empty-state">No documents ingested yet.</p>}
          <div className="folder-label root-label">Unfiled <span className="folder-count">{tree.docs.length}</span></div>
          <div className="folder-children">
            {tree.docs.map((doc) => (
              <div
                key={doc.id}
                className="file-row"
                draggable
                onDragStart={() => setDragId(doc.id)}
                onDragEnd={() => setDragId(null)}
                title="Drag onto a folder below"
              >
                {doc.title}
              </div>
            ))}
          </div>
          {[...tree.children.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => renderFolder(child, 0))}
        </div>
      </section>

      <section className="files-section">
        <h3>All files</h3>
        <div className="files-list">
          {docs.map((doc) => (
            <div key={doc.id} className="file-list-row">
              <span className="file-list-title">{doc.title}</span>
              <input
                value={edits[doc.id] ?? doc.folder_path}
                placeholder="e.g. HR/Policies"
                onChange={(e) => setEdits((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && savePathEdit(doc)}
                onBlur={() => savePathEdit(doc)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
