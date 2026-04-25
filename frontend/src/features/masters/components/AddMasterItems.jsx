import { useState, useEffect } from "react";
import api from "../../../services/api";
import styles from "../../../css/employees/CreateEmployee.module.css";

export default function AddMasterItem({ type, parentOptions, parentKey }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [parentId, setParentId] = useState("");

  const submit = async () => {
    if (!name || (type === "designation" && (!parentId || !level))) {
      alert("All required fields must be filled");
      return;
    }

    try {
      let data = { [type + "_name"]: name };
      if (type === "branch") data.zone_id = parentId;
      if (type === "designation") data.team_id = parentId;
      if (type === "designation") data.level = level;

      await api.post(`/${type === "zone" ? "zones" : type === "branch" ? "branches" : type === "team" ? "teams" : "designations"}`, data);
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`);
      setName(""); setParentId(""); setLevel("");
    } catch (err) {
      alert(err.response?.data?.message || "Error");
    }
  };

  return (
    <div className={styles["form-group"]}>
      <label>
        {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
        {type !== "zone" && parentOptions && (
          <select value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">Select {parentKey}</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>{p[`${parentKey}_name`]}</option>
            ))}
          </select>
        )}
      </label>
      <input
        type="text"
        placeholder={`Enter ${type} name`}
        value={name}
        onChange={e => setName(e.target.value)}
      />
      {type === "designation" && (
        <input
          type="number"
          placeholder="Level"
          value={level}
          onChange={e => setLevel(e.target.value)}
        />
      )}
      <button className={styles.button} onClick={submit}>Add</button>
    </div>
  );
}
