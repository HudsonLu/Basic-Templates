/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type UploadUrlResponse = { uploadUrl: string; key: string };

export default function Home() {
  const [status, setStatus] = useState<string>("Ready.");
  const [lastKey, setLastKey] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Display-only settings (server uses .env)
  const [endpoint, setEndpoint] = useState("http://localhost:9000");
  const [bucket, setBucket] = useState("uploads");
  const [publicRead, setPublicRead] = useState(false);

  // Game ID flow: draft (editable) + locked (used for uploads)
  const [gameIdDraft, setGameIdDraft] = useState<string>("");
  const [lockedGameId, setLockedGameId] = useState<string>("");

  // To reset file input reliably
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const envHint = useMemo(() => {
    return [
      `S3_ENDPOINT=${endpoint}`,
      `S3_BUCKET=${bucket}`,
      `PUBLIC_READ=${publicRead ? "true" : "false"}`,
      `GAME_ID=${lockedGameId || "(not set)"}`,
    ].join("\n");
  }, [endpoint, bucket, publicRead, lockedGameId]);

  const uploadsEnabled = !!lockedGameId && !busy;

  function resetFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function sanitizeGameId(raw: string) {
    // keep it simple: digits only (adjust if you want UUIDs later)
    return raw.trim().replace(/[^0-9]/g, "");
  }

  function onDone() {
    const cleaned = sanitizeGameId(gameIdDraft);
    if (!cleaned) {
      setStatus("Please enter a valid Game ID (digits only).");
      return;
    }
    setLockedGameId(cleaned);
    setLastKey("");
    resetFilePicker();
    setStatus(`Locked to game ${cleaned}. Now select a file to upload.`);
  }

  function onEdit() {
    setLockedGameId("");
    setLastKey("");
    resetFilePicker();
    setStatus("Edit mode: set a Game ID then click Done.");
  }

  async function requestUploadUrl(file: File): Promise<UploadUrlResponse> {
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        gameId: lockedGameId, // IMPORTANT: server uses this to prefix key as games/<id>/
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("upload-url failed:", data);
      throw new Error(data?.error || "upload-url failed");
    }

    if (!data?.uploadUrl || !data?.key) {
      console.error("Missing fields. Response was:", data);
      throw new Error("Missing uploadUrl/key in /api/upload-url response");
    }

    return data as UploadUrlResponse;
  }

  async function uploadFile(file: File) {
    if (!lockedGameId) {
      setStatus("Set a Game ID and click Done first.");
      return;
    }

    setBusy(true);
    setStatus("Requesting pre-signed URL...");

    try {
      const { uploadUrl, key } = await requestUploadUrl(file);

      setStatus("Uploading to MinIO...");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (!putRes.ok) {
        const text = await putRes.text();
        console.error("PUT failed:", putRes.status, text);
        throw new Error(`PUT to MinIO failed (${putRes.status})`);
      }

      setLastKey(key);
      setStatus("Upload complete ✅");
    } catch (e: any) {
      setStatus(`Upload failed ❌ ${e?.message || ""}`);
    } finally {
      setBusy(false);
      // This lets you re-upload the same file name again (browser otherwise may not fire onChange)
      resetFilePicker();
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
  }

  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.logoDot} />
            <span className={styles.brandText}>Upload Studio</span>
          </div>

          <nav className={styles.nav}>
            <a className={styles.navLink} href="#settings">
              Settings
            </a>
            <a className={styles.navLink} href="/uploads">
              Uploads
            </a>
            <a className={styles.navLink} href="#status">
              Status
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 className={styles.h1}>S3-style uploads — but local.</h1>
            <p className={styles.subhead}>
              Configure settings, pick a Game ID, click Done, then upload a file to MinIO
              using a pre-signed URL.
            </p>

            <div className={styles.heroStats}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Mode</div>
                <div className={styles.statValue}>Local Dev</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Bucket</div>
                <div className={styles.statValue}>{bucket}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Game</div>
                <div className={styles.statValue}>{lockedGameId || "—"}</div>
              </div>
            </div>

            <div className={styles.heroActions}>
              <a className={styles.primaryBtn} href="#upload">
                Start upload
              </a>
              <a
                className={styles.secondaryBtn}
                href="http://localhost:9001"
                target="_blank"
                rel="noreferrer"
              >
                Open MinIO Console
              </a>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.panelTitle}>Environment Preview</div>
            <pre className={styles.codeBox}>{envHint}</pre>
            <div className={styles.panelHint}>
              Tip: these values typically live in <code>.env.local</code> and are used server-side.
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className={styles.main}>
        <section id="settings" className={styles.grid}>
          {/* Settings Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>Settings</h2>
              <p className={styles.muted}>
                Pick a Game ID and click Done. Uploads will go into{" "}
                <code>games/&lt;gameId&gt;/</code>.
              </p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.label}>
                <span>Endpoint (display)</span>
                <input
                  className={styles.input}
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="http://localhost:9000"
                  disabled={!!lockedGameId}
                />
              </label>

              <label className={styles.label}>
                <span>Bucket (display)</span>
                <input
                  className={styles.input}
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="uploads"
                  disabled={!!lockedGameId}
                />
              </label>

              <label className={styles.label}>
                <span>Game ID</span>
                <input
                  className={styles.input}
                  value={gameIdDraft}
                  onChange={(e) => setGameIdDraft(e.target.value)}
                  placeholder="e.g. 3"
                  disabled={!!lockedGameId}
                />
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={publicRead}
                  onChange={(e) => setPublicRead(e.target.checked)}
                  disabled={!!lockedGameId}
                />
                <span>Public read (demo toggle)</span>
              </label>

              {!!lockedGameId ? (
                <button className={styles.secondaryBtn} type="button" onClick={onEdit}>
                  Edit
                </button>
              ) : (
                <button className={styles.primaryBtn} type="button" onClick={onDone}>
                  Done
                </button>
              )}
            </div>
          </div>

          {/* Upload Card */}
          <div id="upload" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>Upload</h2>
              <p className={styles.muted}>
                {lockedGameId
                  ? `Uploads go to folder: games/${lockedGameId}/`
                  : "Uploads are disabled until you set a Game ID and click Done."}
              </p>
            </div>

            <div className={styles.uploadBox}>
              <div className={styles.uploadLeft}>
                <div className={styles.uploadTitle}>Choose a file</div>
                <div className={styles.uploadDesc}>
                  Images, PDFs, anything — sent via PUT to your pre-signed URL.
                </div>
              </div>

              <div className={styles.uploadRight}>
                <label className={styles.fileBtn} aria-disabled={!uploadsEnabled}>
                  {busy ? "Uploading..." : "Select file"}
                  <input
                    ref={fileInputRef}
                    className={styles.fileInput}
                    type="file"
                    onChange={onPickFile}
                    disabled={!uploadsEnabled}
                  />
                </label>
                <div className={styles.smallHint}>Max size depends on your backend validation.</div>
              </div>
            </div>

            {lastKey ? (
              <div className={styles.result}>
                <div className={styles.resultLabel}>Last uploaded key</div>
                <code className={styles.resultKey}>{lastKey}</code>
              </div>
            ) : null}
          </div>
        </section>

        {/* Status */}
        <section id="status" className={styles.statusRow}>
          <div className={styles.statusDot} data-busy={busy ? "1" : "0"} />
          <div className={styles.statusText}>
            <div className={styles.statusTitle}>Status</div>
            <div className={styles.statusMsg}>{status}</div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <span className={styles.brandMini}>
              <span className={styles.logoDot} /> Upload Studio
            </span>
            <span className={styles.footerMuted}>Local dev demo for pre-signed uploads.</span>
          </div>

          <div className={styles.footerRight}>
            <a className={styles.footerLink} href="#settings">
              Settings
            </a>
            <a className={styles.footerLink} href="#upload">
              Upload
            </a>
            <a className={styles.footerLink} href="#status">
              Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
