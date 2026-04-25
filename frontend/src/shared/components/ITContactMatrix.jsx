import { useEffect, useMemo, useState } from "react";
import { getAuthUser } from "../../utils/auth";

const contactRows = [
  {
    title: "Developer Team",
    contact: "developer.team@infonet.local",
    note: "Application issues, production bugs, feature escalation, and release coordination.",
  },
  {
    title: "Infrastructure Desk",
    contact: "infra.support@infonet.local",
    note: "Server availability, network incidents, backups, and environment restoration.",
  },
  {
    title: "Security Desk",
    contact: "security.ops@infonet.local",
    note: "Security approvals, incident escalation, audit support, and policy exceptions.",
  },
];

export default function ITContactMatrix() {
  const [shieldActive, setShieldActive] = useState(false);

  const savedUser = useMemo(() => {
    return getAuthUser() || {};
  }, []);

  const watermarkText = `${savedUser?.name || "Internal User"} • ${
    savedUser?.emp_id || "Restricted"
  } • Confidential`;

  useEffect(() => {
    let shieldTimer;

    const enableShield = () => {
      window.clearTimeout(shieldTimer);
      setShieldActive(true);
      shieldTimer = window.setTimeout(() => setShieldActive(false), 1800);
    };

    const preventContextMenu = (event) => event.preventDefault();
    const preventCopyActions = (event) => event.preventDefault();
    const preventDrag = (event) => event.preventDefault();

    const preventCommonCaptureShortcuts = (event) => {
      const key = event.key?.toLowerCase();
      const isCaptureShortcut =
        key === "printscreen" ||
        (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key)) ||
        (event.ctrlKey && event.shiftKey && ["s", "i", "j", "c"].includes(key)) ||
        (event.ctrlKey && key === "p");

      if (isCaptureShortcut) {
        event.preventDefault();
        enableShield();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        enableShield();
      }
    };

    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("keydown", preventCommonCaptureShortcuts);
    document.addEventListener("copy", preventCopyActions);
    document.addEventListener("cut", preventCopyActions);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(shieldTimer);
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("keydown", preventCommonCaptureShortcuts);
      document.removeEventListener("copy", preventCopyActions);
      document.removeEventListener("cut", preventCopyActions);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
          }
        `}
      </style>

      <div
        style={{
          minHeight: "100vh",
          padding: "clamp(16px, 2vw, 28px)",
          background:
            "radial-gradient(circle at top right, rgba(148, 163, 184, 0.16), transparent 28%), linear-gradient(180deg, var(--bg-main), color-mix(in srgb, var(--bg-main) 88%, black 12%))",
          color: "var(--text-main)",
          userSelect: "none",
          WebkitUserSelect: "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.09,
            backgroundImage:
              `repeating-linear-gradient(-24deg, transparent 0 110px, rgba(255,255,255,0.16) 110px 111px), repeating-linear-gradient(0deg, transparent 0 118px, rgba(255,255,255,0.08) 118px 119px)`,
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "4% -10%",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
            gap: 64,
            transform: "rotate(-18deg)",
            pointerEvents: "none",
            opacity: 0.12,
            fontSize: "clamp(16px, 1.4vw, 24px)",
            fontWeight: 800,
            letterSpacing: 1.6,
            textTransform: "uppercase",
          }}
        >
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index}>{watermarkText}</span>
          ))}
        </div>

        <div
          style={{
            position: "relative",
            maxWidth: 1080,
            margin: "0 auto",
            filter: shieldActive ? "blur(16px)" : "none",
            transition: "filter 0.18s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 22,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#fb923c",
                }}
              >
                Restricted Internal Access
              </p>
              <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(28px, 3vw, 40px)" }}>
                IT Contact Matrix
              </h1>
              <p
                style={{
                  margin: 0,
                  maxWidth: 760,
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                  fontSize: "clamp(14px, 1.1vw, 16px)",
                }}
              >
                This page contains confidential internal contacts. Browser-level copy,
                print, drag, context menu, and common capture shortcuts are hardened here.
              </p>
            </div>

            <div
              style={{
                minWidth: 220,
                padding: "14px 16px",
                borderRadius: 18,
                border: "1px solid var(--border-color)",
                background: "color-mix(in srgb, var(--bg-card) 92%, white 8%)",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>
                Viewing As
              </div>
              <div style={{ marginTop: 8, fontWeight: 800 }}>{savedUser?.name || "Internal User"}</div>
              <div style={{ marginTop: 4, color: "var(--text-secondary)" }}>
                {savedUser?.emp_id || "Restricted"}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {contactRows.map((item) => (
              <section
                key={item.title}
                style={{
                  padding: "20px clamp(16px, 2vw, 22px)",
                  borderRadius: 22,
                  border: "1px solid var(--border-color)",
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, white 6%), color-mix(in srgb, var(--bg-card) 88%, black 12%))",
                  boxShadow: "var(--shadow-medium)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(59, 130, 246, 0.12)",
                    color: "#60a5fa",
                    fontWeight: 800,
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  Confidential Contact
                </div>
                <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>{item.title}</h2>
                <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 15 }}>
                  {item.contact}
                </p>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {item.note}
                </p>
              </section>
            ))}
          </div>
        </div>

        {shieldActive && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(7, 10, 16, 0.55)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                maxWidth: 480,
                width: "100%",
                padding: 22,
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(15, 23, 42, 0.92)",
                color: "#f8fafc",
                textAlign: "center",
                boxShadow: "0 28px 60px rgba(0,0,0,0.35)",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: 1.3, textTransform: "uppercase", color: "#fb923c" }}>
                Confidential Shield
              </p>
              <h2 style={{ margin: "10px 0 8px", fontSize: 24 }}>Capture Restricted</h2>
              <p style={{ margin: 0, lineHeight: 1.6, color: "rgba(248,250,252,0.78)" }}>
                This page is marked confidential. Browser-level protection has been triggered.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
