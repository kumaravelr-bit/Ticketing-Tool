import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/RelievingForm.module.css";
import {
  createRelievingLetter,
  getRelievingCandidates,
  updateRelievingLetter,
} from "../../../services/hrdService";

const initialFormState = {
  employee_id: "",
  employee_name: "",
  emp_id: "",
  department: "",
  designation: "",
  date_of_joining: "",
  letter_date: "",
  relieving_date: "",
  last_working_date: "",
  remarks: "",
};

const pad = (value) => String(value).padStart(2, "0");

export default function RelievingForm({
  mode = "create",
  navigate,
  prefillEmployeeId = "",
  initialData = null,
  relievingId = "",
}) {
  const [formData, setFormData] = useState(initialFormState);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = mode === "edit";
  const isApproved =
    isEdit &&
    String(initialData?.approval_status || "").trim().toUpperCase() === "APPROVED";

  const formatDateForInput = useCallback((value) => {
    if (!value) return "";

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return "";
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
        value.getDate(),
      )}`;
    }

    const raw = String(value).trim();
    if (!raw) return "";

    const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (directMatch) {
      return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
    }

    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return "";

    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
      dt.getDate(),
    )}`;
  }, []);

  const applySelectedEmployee = useCallback(
    (employee) => {
      setFormData((prev) => ({
        ...prev,
        employee_id: employee.employee_pk || employee.id || "",
        employee_name: employee.employee_name || "",
        emp_id: employee.employee_id || employee.emp_id || "",
        department: employee.department || "",
        designation: employee.designation || "",
        date_of_joining: formatDateForInput(
          employee.date_of_joining || employee.joining_date,
        ),
      }));

      setEmployeeSearch(
        `${employee.employee_id || employee.emp_id || ""} - ${employee.employee_name || ""}`.trim(),
      );
      setEmployeeOptions([]);
    },
    [formatDateForInput],
  );

  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        employee_id: initialData.employee_id || initialData.employee_pk || "",
        employee_name: initialData.employee_name || "",
        emp_id: initialData.emp_id || initialData.employee_id || "",
        department: initialData.department || "",
        designation: initialData.designation || "",
        date_of_joining: formatDateForInput(
          initialData.date_of_joining || initialData.joining_date,
        ),
        letter_date: formatDateForInput(initialData.letter_date),
        relieving_date: formatDateForInput(initialData.relieving_date),
        last_working_date: formatDateForInput(initialData.last_working_date),
        remarks: initialData.remarks || "",
      });

      setEmployeeSearch(
        `${initialData.emp_id || initialData.employee_id || ""} - ${initialData.employee_name || ""}`.trim(),
      );
    }
  }, [isEdit, initialData, formatDateForInput]);

  const loadPrefillEmployee = useCallback(
    async (employeeId) => {
      try {
        setLoadingEmployees(true);
        const res = await getRelievingCandidates({
          employee_id: employeeId,
          limit: 1,
        });

        const rows = res.data?.data || [];
        const selected = rows[0];

        if (!selected) {
          toast.error("Employee not found or relieving letter already created");
          return;
        }

        applySelectedEmployee(selected);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load employee");
      } finally {
        setLoadingEmployees(false);
      }
    },
    [applySelectedEmployee],
  );

  useEffect(() => {
    if (!prefillEmployeeId || isEdit) return;
    loadPrefillEmployee(prefillEmployeeId);
  }, [prefillEmployeeId, isEdit, loadPrefillEmployee]);

  useEffect(() => {
    if (isEdit) return;

    const timer = setTimeout(async () => {
      const search = String(employeeSearch || "").trim();

      if (!search) {
        setEmployeeOptions([]);
        return;
      }

      try {
        setLoadingEmployees(true);

        const res = await getRelievingCandidates({
          search,
          limit: 20,
        });

        setEmployeeOptions(res.data?.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to search employees");
      } finally {
        setLoadingEmployees(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [employeeSearch, isEdit]);

  const summary = useMemo(
    () => ({
      canSubmit:
        !!formData.employee_id &&
        !!formData.letter_date &&
        !!formData.relieving_date &&
        !!formData.last_working_date,
    }),
    [formData],
  );

  const handleChange = ({ target: { name, value } }) => {
    if (isApproved) return;

    setFormData((prev) => {
      if (
        name === "relieving_date" &&
        (!prev.last_working_date || prev.last_working_date === prev.relieving_date)
      ) {
        return {
          ...prev,
          relieving_date: value,
          last_working_date: value,
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async () => {
    try {
      if (isApproved) {
        toast.info("Approved relieving letter is view-only");
        return;
      }

      if (!summary.canSubmit) {
        toast.error(
          "Employee, letter date, relieving date and last working date are required",
        );
        return;
      }

      setSubmitting(true);

      const payload = {
        employee_id: Number(formData.employee_id),
        letter_date: formData.letter_date,
        relieving_date: formData.relieving_date,
        last_working_date: formData.last_working_date,
        date_of_joining: formData.date_of_joining,
        remarks: formData.remarks?.trim() || "",
      };

      if (isEdit) {
        await updateRelievingLetter(relievingId, payload);
        toast.success("Relieving letter updated successfully");
      } else {
        await createRelievingLetter(payload);
        toast.success("Relieving letter created successfully");
      }

      navigate("/hrd/relieving");
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Failed to save relieving letter",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/hrd/relieving")}
        >
          Back to Dashboard
        </button>
      </div>

      <h2 className={styles.title}>
        {isEdit ? "Edit Relieving Letter" : "Relieving Letter Request"}
      </h2>

      {isApproved && (
        <div className={styles.stateCard}>
          This relieving request is approved, so it is available in view-only mode.
        </div>
      )}

      <div className={styles.grid}>
        {!isEdit && (
          <div className={`${styles.formGroup} ${styles.full}`}>
            <label>Search Employee</label>
            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search by Employee ID / Name / Email"
            />

            {loadingEmployees && (
              <small className={styles.helperText}>Searching...</small>
            )}

            {!loadingEmployees && employeeOptions.length > 0 && (
              <div className={styles.searchResults}>
                {employeeOptions.map((emp) => (
                  <button
                    key={`${emp.employee_pk || emp.id || emp.employee_id}`}
                    type="button"
                    onClick={() => applySelectedEmployee(emp)}
                    className={styles.searchOption}
                  >
                    {(emp.employee_id || emp.emp_id) ?? ""} - {emp.employee_name} -{" "}
                    {emp.department || "-"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.formGroup}>
          <label>Employee Name</label>
          <input value={formData.employee_name} disabled />
        </div>

        <div className={styles.formGroup}>
          <label>Employee ID</label>
          <input value={formData.emp_id} disabled />
        </div>

        <div className={styles.formGroup}>
          <label>Department</label>
          <input value={formData.department} disabled />
        </div>

        <div className={styles.formGroup}>
          <label>Designation</label>
          <input value={formData.designation} disabled />
        </div>

        <div className={styles.formGroup}>
          <label>Date of Joining</label>
          <input value={formData.date_of_joining} disabled />
        </div>

        <div className={styles.formGroup}>
          <label>Letter Date</label>
          <input
            type="date"
            name="letter_date"
            value={formData.letter_date}
            onChange={handleChange}
            disabled={isApproved}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Relieving Date</label>
          <input
            type="date"
            name="relieving_date"
            value={formData.relieving_date}
            onChange={handleChange}
            disabled={isApproved}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Last Working Date</label>
          <input
            type="date"
            name="last_working_date"
            value={formData.last_working_date}
            onChange={handleChange}
            disabled={isApproved}
          />
        </div>

        <div className={`${styles.formGroup} ${styles.full}`}>
          <label>Remarks</label>
          <textarea
            name="remarks"
            rows="4"
            value={formData.remarks}
            onChange={handleChange}
            disabled={isApproved}
          />
        </div>

        {!isApproved && (
          <div className={styles.full}>
            <button
              className={styles.button}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? isEdit
                  ? "Updating..."
                  : "Creating..."
                : isEdit
                  ? "Update Relieving Letter"
                  : "Generate Relieving Letter"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
