import { useParams, useNavigate } from "react-router-dom";
import RelievingForm from "./RelievingForm";

export default function RelievingRequest() {
  const navigate = useNavigate();
  const { employeeId } = useParams();

  return (
    <RelievingForm
      mode="create"
      navigate={navigate}
      prefillEmployeeId={employeeId || ""}
    />
  );
}