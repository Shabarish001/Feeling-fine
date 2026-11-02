"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "user-files";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const formatSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const formatDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Upload, view and delete your own files (e.g. photos of clothes, size charts).
// Files go to a private Supabase Storage folder named after your user id.
export default function FileManager({ initialFiles, userId, demo }) {
  const [files, setFiles] = useState(initialFiles);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const inputRef = useRef(null);

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) return setMsg({ type: "error", text: "That file is too big. The limit is 10 MB." });
    if (!ACCEPT.split(",").includes(file.type)) return setMsg({ type: "error", text: "Please choose a photo (JPG, PNG, WebP) or a PDF." });

    const supabase = createClient();
    setBusy(true);
    setMsg(null);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${userId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setMsg({ type: "error", text: "Upload didn't work. Please try again." });
    }
    const { data, error } = await supabase
      .from("user_files")
      .insert({ file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size })
      .select()
      .single();
    setBusy(false);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return setMsg({ type: "error", text: "Upload didn't work. Please try again." });
    }
    setFiles((f) => [data, ...f]);
    setMsg({ type: "success", text: `“${file.name}” uploaded.` });
  }

  async function view(file) {
    const supabase = createClient();
    // A private link that works for 60 seconds.
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 60);
    if (error) return setMsg({ type: "error", text: "We couldn't open that file." });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(file) {
    if (!window.confirm(`Delete “${file.file_name}”? This can't be undone.`)) return;
    const supabase = createClient();
    const { error: stErr } = await supabase.storage.from(BUCKET).remove([file.storage_path]);
    const { error } = await supabase.from("user_files").delete().eq("id", file.id);
    if (stErr || error) return setMsg({ type: "error", text: "We couldn't delete that file. Please try again." });
    setFiles((f) => f.filter((x) => x.id !== file.id));
    setMsg({ type: "success", text: "File deleted." });
  }

  return (
    <section className="card" aria-labelledby="files-heading">
      <div className="section-head">
        <h2 id="files-heading">My files</h2>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy || demo}>
          {busy ? "Uploading…" : "Upload a file"}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={upload} hidden aria-label="Choose a file to upload" />
      </div>
      <p className="muted">Save photos of clothes you like, size charts or notes. Only you can see them. (Photos or PDF, up to 10 MB.)</p>

      {msg && (
        <div className={`alert ${msg.type === "error" ? "alert-error" : "alert-success"}`} role={msg.type === "error" ? "alert" : "status"}>
          {msg.text}
        </div>
      )}

      {files.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>You haven&apos;t uploaded any files yet.</p>
      ) : (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.id} className="file-row">
              <div>
                <div className="name">{f.file_name}</div>
                <div className="muted" style={{ fontSize: "0.88rem" }}>
                  Uploaded {formatDate(f.uploaded_at)} · {formatSize(f.size_bytes || 0)}
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn btn-small btn-secondary" onClick={() => view(f)}>View</button>
                <button type="button" className="btn btn-small btn-danger" onClick={() => remove(f)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
