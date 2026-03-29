import { useState } from "react";
import styles from "../css/MasterTable.module.css";

function MasterTable({
  title,
  data,
  fields,
  onAdd,
  onUpdate,
  onDelete,
  parentOptions,
  parentKey = "parent_id",
  refresh,
  isOpen,
  onToggle
}) {

  const [addMode, setAddMode] = useState(false);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);

  const safeData = Array.isArray(data) ? data : [];
  const safeParent = Array.isArray(parentOptions) ? parentOptions : [];

  /* ================= ID ================= */
  const getId = (obj) =>
    obj?.type_id ||
    obj?.subtype_id ||
    obj?.designation_id ||
    obj?.team_id ||
    obj?.branch_id ||
    obj?.zone_id ||
    obj?.id;

  /* ================= NAME ================= */
  const getName = (obj) =>
    obj?.name ||
    obj?.type_name ||
    obj?.subtype_name ||
    obj?.zone_name ||
    obj?.branch_name ||
    obj?.team_name ||
    obj?.designation_name ||
    obj?.area_name ||
    "";

  /* ================= PLACEHOLDER ================= */
  const getPlaceholder = () => {
    if (fields.includes("zone_name")) return "Enter Zone Name";
    if (fields.includes("branch_name")) return "Enter Branch Name";
    if (fields.includes("team_name")) return "Enter Team Name";
    if (fields.includes("designation_name")) return "Enter Designation Name";
    if (fields.includes("type_name")) return "Enter Ticket Type";
    if (fields.includes("subtype_name")) return "Enter Ticket Subtype";
    if (fields.includes("area_name")) return "Enter Area Name";
    return "Enter Name";
  };

  /* ================= PAYLOAD ================= */
  const mapPayload = (obj) => {
    let payload = { ...obj };

    if (fields.includes("zone_name")) payload.zone_name = obj.name;

    if (fields.includes("branch_name")) {
      payload.branch_name = obj.name;
      payload.short_name = obj.short_name || null; // ✅ NEW
      payload.zone_id = obj[parentKey];
    }

    if (fields.includes("team_name")) payload.team_name = obj.name;

    if (fields.includes("designation_name")) {
      payload.designation_name = obj.name;
      payload.team_id = obj[parentKey];
      payload.level = obj.level;
    }

    if (fields.includes("type_name")) {
      payload.type_name = obj.name;
    }

    if (fields.includes("subtype_name")) {
      payload.subtype_name = obj.name;
      payload.type_id = obj[parentKey];
    }

    if (fields.includes("area_name")) {
      payload.area_name = obj.name;
      payload.branch_id = obj[parentKey];
    }

    delete payload.name;
    return payload;
  };

  /* ================= ADD ================= */
  const handleAdd = async () => {
    if (!form.name) return alert("Enter name");

    await onAdd(mapPayload(form));

    setForm({});
    setAddMode(false);
    refresh(form[parentKey]);
  };

  /* ================= UPDATE ================= */
  const handleUpdate = async (id) => {
    if (!form.name) return alert("Enter name");

    await onUpdate(id, mapPayload(form));

    setEditId(null);
    setForm({});
    refresh(form[parentKey]);
  };

  return (
    <div className={styles.masterBox}>

      {/* HEADER */}
      <div className={styles.headerRow} onClick={onToggle}>
        <h3>{title}</h3>

        <button
          className={styles.addBtn}
          onClick={(e) => {
            e.stopPropagation();

            if (!isOpen) onToggle();

            setAddMode(true);
            setEditId(null);
            setForm({});
          }}
        >
          +
        </button>
      </div>

      {!isOpen ? null : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Extra</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            {/* ================= ADD ================= */}
            {addMode && (
              <tr>
                <td>
                  <input
                    placeholder={getPlaceholder()}
                    value={form.name || ""}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                  />

                  {/* 🔥 SHORT NAME FOR BRANCH */}
                  {fields.includes("branch_name") && (
                    <input
                      placeholder="Short Name (Ex: CHN)"
                      value={form.short_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, short_name: e.target.value })
                      }
                    />
                  )}
                </td>

                <td>
                  {fields.includes("level") && (
                    <input
                      placeholder="Enter Level"
                      value={form.level || ""}
                      onChange={(e) =>
                        setForm({ ...form, level: e.target.value })
                      }
                    />
                  )}

                  {safeParent.length > 0 && (
                    <select
                      value={form[parentKey] || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [parentKey]: Number(e.target.value)
                        })
                      }
                    >
                      <option value="">Select</option>
                      {safeParent.map((p) => (
                        <option key={getId(p)} value={getId(p)}>
                          {getName(p)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>

                <td>
                  <button onClick={handleAdd}>Add</button>
                  <button onClick={() => setAddMode(false)}>Cancel</button>
                </td>
              </tr>
            )}

            {/* ================= DATA ================= */}
            {safeData.map((d) => {
              const id = getId(d);
              const isEditing = editId === id;

              return (
                <tr key={`${title}-${id}`}>

                  <td>
                    {isEditing ? (
                      <>
                        <input
                          value={form.name || ""}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                        />

                        {fields.includes("branch_name") && (
                          <input
                            placeholder="Short Name"
                            value={form.short_name || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                short_name: e.target.value
                              })
                            }
                          />
                        )}
                      </>
                    ) : (
                      getName(d)
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <>
                        {d.level !== undefined && (
                          <input
                            value={form.level || ""}
                            onChange={(e) =>
                              setForm({ ...form, level: e.target.value })
                            }
                          />
                        )}

                        {safeParent.length > 0 && (
                          <select
                            value={form[parentKey] || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                [parentKey]: Number(e.target.value)
                              })
                            }
                          >
                            <option value="">Select</option>
                            {safeParent.map((p) => (
                              <option key={getId(p)} value={getId(p)}>
                                {getName(p)}
                              </option>
                            ))}
                          </select>
                        )}
                      </>
                    ) : fields.includes("branch_name") ? (
                      d.short_name || "-"
                    ) : (
                      d.level || "-"
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <>
                        <button onClick={() => handleUpdate(id)}>Save</button>
                        <button onClick={() => setEditId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditId(id);
                            setForm({
                              name: getName(d),
                              short_name: d.short_name || "",
                              level: d.level || "",
                              [parentKey]: d[parentKey] || ""
                            });
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onDelete(id);
                            refresh();
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>

                </tr>
              );
            })}

            {/* EMPTY */}
            {safeData.length === 0 && !addMode && (
              <tr>
                <td colSpan="3" style={{ textAlign: "center" }}>
                  No Data Available
                </td>
              </tr>
            )}

          </tbody>
        </table>
      )}
    </div>
  );
}

export default MasterTable;