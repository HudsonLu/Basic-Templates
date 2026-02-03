/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type UploadUrlResponse = { uploadUrl: string; key: string };

export default function Home() {
  const [status, setStatus] = useState<string>("Ready.");
  const [lastKey, setLastKey] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // “Settings” UI (display only)
  const [endpoint, setEndpoint] = useState("http://localhost:9000");
  const [bucket, setBucket] = useState("uploads");
  const [publicRead, setPublicRead] = useState(false);

  const envHint = useMemo(() => {
    return `S3_ENDPOINT=${endpoint}\nS3_BUCKET=${bucket}\nPUBLIC_READ=${publicRead ? "true" : "false"}`;
  }, [endpoint, bucket, publicRead]);

  async function requestUploadUrl(file: File): Promise<UploadUrlResponse> {
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        // optional: only include if your API route supports it
        publicRead,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("upload-url failed:", data);
      throw new Error(data?.error || `upload-url failed (${res.status})`);
    }

    if (!data?.uploadUrl || !data?.key) {
      console.error("Missing uploadUrl/key. Response was:", data);
      throw new Error("Invalid /api/upload-url response (missing uploadUrl/key)");
    }

    return data as UploadUrlResponse;
  }

  async function putToMinio(uploadUrl: string, file: File) {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      console.error("PUT failed:", putRes.status, text);
      throw new Error(`PUT to MinIO failed (${putRes.status})`);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // allow selecting the same file twice (important)
    e.target.value = "";

    if (!file) return;

    try {
      setBusy(true);
      setStatus("Requesting upload URL...");

      const { uploadUrl, key } = await requestUploadUrl(file);

      setStatus("Uploading to MinIO...");
      await putToMinio(uploadUrl, file);

      setLastKey(key);
      setStatus(`Uploaded ✅ (${key})`);
    } catch (err: any) {
      setStatus(`Upload failed ❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
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
              A polished demo page for pre-signed uploads to MinIO/S3. Configure settings, upload a file, and track results.
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
                <div className={styles.statLabel}>Endpoint</div>
                <div className={styles.statValue}>{new URL(endpoint).host}</div>
              </div>
            </div>

            <div className={styles.heroActions}>
              <a className={styles.primaryBtn} href="#upload">
                Start upload
              </a>
              <a className={styles.secondaryBtn} href="http://localhost:9001" target="_blank" rel="noreferrer">
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
              <p className={styles.muted}>Adjust display settings (optional). Your API route can also use these later.</p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.label}>
                <span>Endpoint</span>
                <input
                  className={styles.input}
                  value={endpoint}
                  onChange={(ev) => setEndpoint(ev.target.value)}
                  placeholder="http://localhost:9000"
                />
              </label>

              <label className={styles.label}>
                <span>Bucket</span>
                <input
                  className={styles.input}
                  value={bucket}
                  onChange={(ev) => setBucket(ev.target.value)}
                  placeholder="uploads"
                />
              </label>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={publicRead}
                  onChange={(ev) => setPublicRead(ev.target.checked)}
                />
                <span>Public read (demo toggle)</span>
              </label>
            </div>
          </div>

          {/* Upload Card */}
          <div id="upload" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.h2}>Upload</h2>
              <p className={styles.muted}>Generates a pre-signed URL and uploads directly to storage.</p>
            </div>

            <div className={styles.uploadBox}>
              <div className={styles.uploadLeft}>
                <div className={styles.uploadTitle}>Choose a file</div>
                <div className={styles.uploadDesc}>Images, PDFs, anything — sent via PUT to your pre-signed URL.</div>
              </div>

              <div className={styles.uploadRight}>
                <label className={styles.fileBtn}>
                  {busy ? "Uploading..." : "Select file"}
                  <input
                    className={styles.fileInput}
                    type="file"
                    onChange={handleFileChange}
                    disabled={busy}
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
