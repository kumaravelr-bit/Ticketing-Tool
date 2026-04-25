import { useNavigate } from "react-router-dom";

export default function FeaturePlaceholder({
  title = "Coming Soon",
  description = "This page is ready for the next implementation step.",
}) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "48px auto",
        padding: 32,
        borderRadius: 20,
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-medium)",
        color: "var(--text-main)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 30 }}>{title}</h1>
        <p style={{ margin: "12px 0 0", color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>

      <div  
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/active")}
          style={{
            padding: "11px 18px",
            borderRadius: 12,
            border: "1px solid transparent",
            background: "var(--btn-primary-bg)",
            color: "var(--btn-primary-text)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back to Employees
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            padding: "11px 18px",
            borderRadius: 12,
            border: "1px solid var(--border-color)",
            background: "var(--btn-secondary-bg)",
            color: "var(--btn-secondary-text)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
