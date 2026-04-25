import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../../css/new_connections/NewConnectionForm.module.css";

function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  disabled = false,
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  return (
    <div className={`${styles.field} ${styles.searchableField}`} ref={rootRef}>
      {label ? <label className={styles.label}>{label}</label> : null}
      <input
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {open && !disabled ? (
        <div className={styles.searchDropdown}>
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`${styles.searchOption} ${value === option ? styles.searchOptionSelected : ""}`}
                onClick={() => {
                  onChange(option);
                  setQuery(option);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            ))
          ) : (
            <div className={styles.searchEmpty}>No matches found</div>
          )}
        </div>
      ) : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}

export default SearchableSelect;
