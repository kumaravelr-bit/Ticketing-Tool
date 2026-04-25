import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../../css/hrd/UniformRequest.css";
import { getZones, getAllBranches } from "../../../services/employeeService";
import {
  getUniformRequests,
  getUniformRequestById,
  reviewUniformRequest,
  exportUniformRequests,
} from "../../../services/uniformService";
import { getAuthItem, getAuthUser } from "../../../utils/auth";

const REQUEST_TYPES = [
  { value: "UNIFORM", label: "Uniform Request" },
  { value: "BUSINESS_CARD", label: "Business Card Request" },
  { value: "ID_CARD", label: "ID Card Request" },
];

function UniformRequest() {
  const [user] = useState(() => {
    return getAuthUser();
  });

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedZone, setSelectedZone] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRequestType, setSelectedRequestType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const fallbackRole = getAuthItem("role");
  const fallbackTeam = getAuthItem("team");
  const fallbackEmpId = getAuthItem("emp_id");

  const currentUser = {
    ...user,
    role: (user?.role || fallbackRole || "").toString().trim().toUpperCase(),
    team: (
      user?.team ||
      user?.team_name ||
      fallbackTeam ||
      ""
    )
      .toString()
      .trim()
      .toUpperCase(),
    emp_id: user?.emp_id || fallbackEmpId || "",
    name: user?.name || user?.employee_name || user?.emp_id || fallbackEmpId || "",
  };

  const selectedRequestStatus = String(selectedRequest?.status || "PENDING")
    .trim()
    .toUpperCase();
  const canTakeReviewAction = Boolean(selectedRequest?.can_review);
  const isReviewCompleted =
    selectedRequestStatus === "APPROVED" ||
    selectedRequestStatus === "REJECTED";
  const showReviewCommentToAll =
    isReviewCompleted && !!selectedRequest?.review_comment?.trim();
  const showReviewActions = canTakeReviewAction && !isReviewCompleted;

  const navigate = useNavigate();

  useEffect(() => {
    loadZones();
    loadBranches();
    loadRequests();
  }, []);

  const loadZones = async () => {
    try {
      const res = await getZones();
      setZones(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading zones:", error);
      setZones([]);
    }
  };

  const loadBranches = async () => {
    try {
      const res = await getAllBranches();
      setBranches(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading branches:", error);
      setBranches([]);
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await getUniformRequests();
      setRequests(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast.error(error?.response?.data?.message || "Failed to load requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      const matchesZone = selectedZone
        ? String(item.zone_id) === String(selectedZone)
        : true;

      const matchesBranch = selectedBranch
        ? String(item.branch_id) === String(selectedBranch)
        : true;

      const matchesRequestType = selectedRequestType
        ? String(item.request_type) === String(selectedRequestType)
        : true;

      const matchesStatus = selectedStatus
        ? String(item.status || "PENDING") === String(selectedStatus)
        : true;

      const q = search.trim().toLowerCase();
      const matchesSearch = q
        ? [
            item.employee_id,
            item.employee_name,
            item.request_type,
            item.branch_name,
            item.zone_name,
            item.designation,
            item.department,
            item.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true;

      return (
        matchesZone &&
        matchesBranch &&
        matchesRequestType &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    requests,
    selectedZone,
    selectedBranch,
    selectedRequestType,
    selectedStatus,
    search,
  ]);

  const summaryCards = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(
      (r) => String(r.status || "PENDING") === "PENDING"
    ).length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    const uniform = requests.filter((r) => r.request_type === "UNIFORM").length;
    const businessCard = requests.filter(
      (r) => r.request_type === "BUSINESS_CARD"
    ).length;
    const idCard = requests.filter((r) => r.request_type === "ID_CARD").length;

    return [
      { title: "Total", value: total },
      { title: "Pending", value: pending },
      { title: "Approved", value: approved },
      { title: "Rejected", value: rejected },
      { title: "Uniform", value: uniform },
      { title: "Business Card", value: businessCard + idCard },
    ];
  }, [requests]);

  const resetFilters = () => {
    setSearch("");
    setSelectedZone("");
    setSelectedBranch("");
    setSelectedRequestType("");
    setSelectedStatus("");
  };

  const handleExport = async () => {
    try {
      const res = await exportUniformRequests({
        zone_id: selectedZone || undefined,
        branch_id: selectedBranch || undefined,
        request_type: selectedRequestType || undefined,
        status: selectedStatus || undefined,
        search: search.trim() || undefined,
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `uniform-requests-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(
        error?.response?.data?.message || "Failed to export requests"
      );
    }
  };

  const openReviewModal = async (requestId) => {
    try {
      const res = await getUniformRequestById(requestId);
      setSelectedRequest(res?.data);
      setReviewComment(res?.data?.review_comment || "");
      setShowReviewModal(true);
    } catch (error) {
      console.error("Error loading request details:", error);
      toast.error(
        error?.response?.data?.message || "Failed to load request details"
      );
    }
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedRequest(null);
    setReviewComment("");
  };

  const submitReview = async (status) => {
    if (!selectedRequest || !currentUser || !canTakeReviewAction) {
      toast.error("You are not authorized to review this request");
      return;
    }

    if (isReviewCompleted) {
      toast.error("This request has already been reviewed");
      return;
    }

    try {
      setReviewLoading(true);

      const payload = {
        status,
        review_comment: reviewComment,
        reviewed_by_role: currentUser.role,
        reviewed_by_name: currentUser.name,
      };

      const res = await reviewUniformRequest(selectedRequest.id, payload);
      toast.success(res?.data?.message || "Review updated successfully");
      closeReviewModal();
      loadRequests();
    } catch (error) {
      console.error("Review update error:", error);
      toast.error(error?.response?.data?.message || "Failed to update review");
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="uniform-page">
      <div className="uniform-container">
        <div className="uniform-card">
          <div className="uniform-header">
            <div className="uniform-header-top">
              <h1>Uniform Requests</h1>
              <button
                type="button"
                className="new-request-btn"
                onClick={() => navigate("/hrd/uniform/new")}
              >
                + New Request
              </button>
            </div>
          </div>

          <section className="stats-grid">
            {summaryCards.map((card) => (
              <div key={card.title} className="stat-box">
                <p>{card.title}</p>
                <h3>{card.value}</h3>
              </div>
            ))}
          </section>

          <section className="filters-row">
            <input
              type="text"
              className="filter-input search-input"
              placeholder="Search Request / Name / Employee ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="filter-input"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="">All Zones</option>
              {zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.name}
                </option>
              ))}
            </select>

            <select
              className="filter-input"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option
                  key={branch.branch_id ?? branch.id}
                  value={branch.branch_id ?? branch.id}
                >
                  {branch.name ?? branch.branch_name}
                </option>
              ))}
            </select>

            <select
              className="filter-input"
              value={selectedRequestType}
              onChange={(e) => setSelectedRequestType(e.target.value)}
            >
              <option value="">All Request Types</option>
              {REQUEST_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="filter-input"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <button
              type="button"
              className="reset-btn"
              onClick={resetFilters}
            >
              Reset
            </button>

            <button
              type="button"
              className="export-btn"
              onClick={handleExport}
            >
              Export
            </button>
          </section>

          <section className="table-section">
            {loading ? (
              <div className="no-data">Loading data...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="no-data">No records found</div>
            ) : (
              <div className="table-wrapper">
                <table className="uniform-table">
                  <thead>
                    <tr>
                      <th>Request_ID</th>
                      <th>Request Type</th>
                      <th>Emp ID</th>
                      <th>Name</th>
                      <th>Zone</th>
                      <th>Branch</th>
                      <th>Department</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item) => (
                      <tr key={item.id}>
                        <td>{item.request_code || "-"}</td>
                        <td>{item.request_type}</td>
                        <td>{item.employee_id}</td>
                        <td>{item.employee_name}</td>
                        <td>{item.zone_name}</td>
                        <td>{item.branch_name}</td>
                        <td>{item.department || "-"}</td>
                        <td>{item.quantity || "-"}</td>
                        <td>
                          <span
                            className={`status-pill status-${String(
                              item.status || "PENDING"
                            ).toLowerCase()}`}
                          >
                            {item.status || "PENDING"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => openReviewModal(item.id)}
                          >
                            {item.can_review ? "Review" : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {showReviewModal && selectedRequest && (
        <div className="drawer-overlay" onClick={closeReviewModal}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2>Request Review</h2>
                <p>Approve or reject this request</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={closeReviewModal}
              >
                ✕
              </button>
            </div>

            <div className="review-grid">
              <div>
                <strong>Request Type:</strong> {selectedRequest.request_type}
              </div>
              <div>
                <strong>Status:</strong> {selectedRequest.status}
              </div>
              <div>
                <strong>Zone:</strong> {selectedRequest.zone_name}
              </div>
              <div>
                <strong>Branch:</strong> {selectedRequest.branch_name}
              </div>
              <div>
                <strong>Employee ID:</strong> {selectedRequest.employee_id}
              </div>
              <div>
                <strong>Employee Name:</strong> {selectedRequest.employee_name}
              </div>
              <div>
                <strong>Designation:</strong> {selectedRequest.designation || "-"}
              </div>
              <div>
                <strong>Department:</strong> {selectedRequest.department || "-"}
              </div>
              <div>
                <strong>Mobile:</strong> {selectedRequest.mobile_no || "-"}
              </div>
              <div>
                <strong>Quantity:</strong> {selectedRequest.quantity || "-"}
              </div>

              {selectedRequest.request_type === "UNIFORM" && (
                <>
                  <div>
                    <strong>Shirt Size:</strong> {selectedRequest.shirt_size || "-"}
                  </div>
                  <div>
                    <strong>Pant Size:</strong> {selectedRequest.pant_size || "-"}
                  </div>
                  <div>
                    <strong>T-Shirt Size:</strong> {selectedRequest.tshirt_size || "-"}
                  </div>
                  <div>
                    <strong>Blazer Size:</strong> {selectedRequest.blazer_size || "-"}
                  </div>
                  <div>
                    <strong>Shoe Size:</strong> {selectedRequest.shoe_size || "-"}
                  </div>
                </>
              )}

              <div className="full-width">
                <strong>Request Remarks:</strong>
                <div className="detail-box">{selectedRequest.remarks || "-"}</div>
              </div>

              {showReviewCommentToAll && !canTakeReviewAction && (
                <div className="full-width">
                  <label className="field-label">Comments</label>
                  <div className="detail-box">
                    {selectedRequest.review_comment}
                  </div>
                </div>
              )}

              {canTakeReviewAction && (
                <div className="full-width">
                  <label className="field-label">Comments</label>
                  {isReviewCompleted ? (
                    <div className="detail-box">
                      {selectedRequest.review_comment || "-"}
                    </div>
                  ) : (
                    <textarea
                      className="field-input field-textarea"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Enter approval/rejection comments"
                    />
                  )}
                </div>
              )}
            </div>

            {showReviewActions && (
              <div className="review-actions">
                <button
                  type="button"
                  className="reject-btn"
                  onClick={() => submitReview("REJECTED")}
                  disabled={reviewLoading}
                >
                  {reviewLoading ? "Processing..." : "Reject"}
                </button>

                <button
                  type="button"
                  className="approve-btn"
                  onClick={() => submitReview("APPROVED")}
                  disabled={reviewLoading}
                >
                  {reviewLoading ? "Processing..." : "Approve"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default UniformRequest;
