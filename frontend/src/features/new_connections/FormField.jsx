import React from "react";
import styles from "../../css/new_connections/NewConnectionForm.module.css";

function FormField({
  label,
  value,
  onChange,
  error,
  type = "text",
  as = "input",
  placeholder = "",
  options = [],
  disabled = false,
  readOnly = false,
  rows = 4,
  min,
}) {
  const normalizedOptions = Array.from(
    new Set(
      [
        ...options,
        value && !options.includes(value) ? value : null,
      ].filter(Boolean)
    )
  );

  const commonProps = {
    className: `leads-input ${error ? "has-error" : ""}`,
    value,
    disabled,
    readOnly,
    placeholder,
    min,
    onChange: (event) => onChange(event.target.value),
  };

  return (
    <div className={styles.field}>
      {label ? <label className={styles.label}>{label}</label> : null}
      {as === "textarea" ? (
        <textarea
          {...commonProps}
          rows={rows}
          className={`${styles.textarea} ${error ? styles.inputError : ""}`}
        />
      ) : as === "select" ? (
        <select
          {...commonProps}
          className={`${styles.select} ${error ? styles.inputError : ""}`}
          disabled={disabled || readOnly}
        >
          <option value="">{placeholder || "Select"}</option>
          {normalizedOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...commonProps}
          type={type}
          className={`${styles.input} ${error ? styles.inputError : ""}`}
        />
      )}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

export default FormField;
