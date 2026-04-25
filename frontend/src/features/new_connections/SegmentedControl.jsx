import React from "react";
import styles from "../../css/new_connections/NewConnectionForm.module.css";

function SegmentedControl({ label, options, value, onChange, disabled = false }) {
  return (
    <div className={styles.segmentedBlock}>
      <label className={styles.blockLabel}>{label}</label>
      <div className={styles.segmentedGroup}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`${styles.segmentedButton} ${value === option ? styles.segmentedButtonActive : ""}`}
            onClick={() => onChange(option)}
            disabled={disabled}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SegmentedControl;
