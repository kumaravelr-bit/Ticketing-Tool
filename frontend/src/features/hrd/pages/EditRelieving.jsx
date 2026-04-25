import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import RelievingForm from "./RelievingForm";
import { getRelievingLetterById } from "../../../services/hrdService";
import styles from "../../../css/hrd/RelievingForm.module.css";

export default function EditRelieving() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);

  const loadRelieving = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRelievingLetterById(id);
      setInitialData(res.data?.data || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load relieving letter");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRelieving();
  }, [loadRelieving]);

  if (loading) {
    return <div className={styles.stateCard}>Loading...</div>;
  }

  if (!initialData) {
    return <div className={styles.stateCard}>Record not found</div>;
  }

  return (
    <RelievingForm
      mode="edit"
      navigate={navigate}
      initialData={initialData}
      relievingId={id}
    />
  );
}
