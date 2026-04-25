import { useMemo, useState } from "react";
import styles from "../../../css/masters/ItemMaster.module.css";

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function buildErrorCsv(rows = []) {
  const headers = Object.keys(rows[0] || {
    row_number: "",
    name: "",
    error: "",
  });
  const escape = (value = "") => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}

export default function EmployeeBulkUpload({
  triggerLabel = "Bulk Upload",
  modalTitle = "Bulk Upload",
  note,
  templateFields = [],
  templateFileName = "bulk-upload-template.csv",
  errorReportFileName = "bulk-upload-errors.csv",
  downloadTemplate,
  uploadAction,
  insertedColumns = [],
  failedColumns = [],
  onUploaded,
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const failedRows = result?.failed || [];
  const insertedRows = result?.inserted || [];

  const summaryText = useMemo(() => {
    if (!result?.summary) return "";
    const { total_rows, inserted_count, failed_count } = result.summary;
    return `Total: ${total_rows} | Inserted: ${inserted_count} | Failed: ${failed_count}`;
  }, [result]);

  const handleTemplateDownload = async () => {
    try {
      setDownloading(true);
      const response = await downloadTemplate();
      downloadBlob(response.data, templateFileName);
    } catch (err) {
      setError(err?.response?.data?.message || "Template download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Choose a CSV or Excel file first");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await uploadAction(formData);
      setResult(response.data);
      onUploaded?.(response.data);
    } catch (err) {
      setResult(null);
      setError(err?.response?.data?.message || "Bulk upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!failedRows.length) return;
    const csv = buildErrorCsv(failedRows);
    downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }), errorReportFileName);
  };

  return (
    <>
      <button
        type="button"
        className={styles.bulkTrigger}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className={styles.bulkOverlay}
          onClick={() => {
            if (!uploading) setOpen(false);
          }}
        >
          <div
            className={styles.bulkModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.bulkHeader}>
              <h3>{modalTitle}</h3>
              <button
                type="button"
                className={styles.bulkClose}
                onClick={() => !uploading && setOpen(false)}
              >
                x
              </button>
            </div>

            {note && <p className={styles.bulkNote}>{note}</p>}

            {!!templateFields.length && (
              <div className={styles.bulkFieldList}>
                <strong>Template fields</strong>
                <span>{templateFields.join(", ")}</span>
              </div>
            )}

            <div className={styles.bulkActions}>
              <button type="button" onClick={handleTemplateDownload} disabled={downloading || uploading}>
                {downloading ? "Downloading..." : "Download Template"}
              </button>

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError("");
                }}
              />

              <button type="button" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>

            {file && <div className={styles.bulkFileName}>Selected File: {file.name}</div>}
            {error && <div className={styles.bulkError}>{error}</div>}

            {result && (
              <div className={styles.bulkResult}>
                <div className={styles.bulkSuccess}>{result.message}</div>
                <div className={styles.bulkSummary}>{summaryText}</div>

                {!!insertedRows.length && !!insertedColumns.length && (
                  <div className={styles.bulkSection}>
                    <strong>Inserted Rows</strong>
                    <div className={styles.bulkScroll}>
                      <table className={styles.bulkTable}>
                        <thead>
                          <tr>
                            {insertedColumns.map((column) => (
                              <th key={column.key}>{column.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {insertedRows.map((row, index) => (
                            <tr key={`inserted-${index}`}>
                              {insertedColumns.map((column) => (
                                <td key={`${column.key}-${index}`}>{row[column.key] ?? "-"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!!failedRows.length && !!failedColumns.length && (
                  <div className={styles.bulkSection}>
                    <div className={styles.bulkErrorHeader}>
                      <strong>Failed Rows</strong>
                      <button type="button" onClick={handleDownloadErrors}>
                        Download Error Report
                      </button>
                    </div>

                    <div className={styles.bulkScroll}>
                      <table className={styles.bulkTable}>
                        <thead>
                          <tr>
                            {failedColumns.map((column) => (
                              <th key={column.key}>{column.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {failedRows.map((row, index) => (
                            <tr key={`failed-${index}`}>
                              {failedColumns.map((column) => (
                                <td key={`${column.key}-${index}`}>{row[column.key] ?? "-"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
