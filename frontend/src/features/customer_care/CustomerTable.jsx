

import * as XLSX from "xlsx";

function getStatusClass(status) {
  const value = (status || "").toString().trim().toLowerCase();

  if (value === "active") return "customer-status-badge active";
  if (value === "drop") return "customer-status-badge drop";
  if (value === "disconnected") return "customer-status-badge disconnected";
  if (value === "pending") return "customer-status-badge pending";
  if (value === "submitted") return "customer-status-badge submitted";
  if (value === "approved") return "customer-status-badge approved";
  if (value === "rejected") return "customer-status-badge rejected";
  if (value === "closed") return "customer-status-badge closed";
  if (value === "recruitment") return "customer-status-badge recruitment";

  return "customer-status-badge";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

export default function CustomerTable({
  rows = [],
  loading = false,
  onEdit
}) {
  const handleExport = () => {
    if (!rows.length) {
      alert("No data to export");
      return;
    }

    const exportData = rows.map((row) => ({
      "Customer ID": row.customer_id,
      "First Name": row.first_name,
      Zone: row.zone,
      Branch: row.branch,
      "Connection Type": row.connection_type,
      Status: row.status,
      "Connection Start Date": row.connection_starting_date,
      "Connection Mode": row.connection_mode,
      "Plan Name": row.plan_name,
      "Plan Amount": row.plan_value,
      "Payment Mode": row.payment_mode,
      "Lat Long": row.lat_long,
      "Customer IP": row.customer_ip,
      "AP Name(SSID)": row.ap_name_ssid,
      "Bridge Mode IP(Branch Entry)": row.bridge_mode_ip_branch_entry,
      "Lat & Long (Branch Entry)": row.lat_long_branch_entry,
      "Area Name(Branch Entry)": row.area_name_branch_entry,
      "Area Incharge Emp ID": row.area_incharge_emp_id,
      "Area Incharge Emp Name": row.area_incharge_emp_name,
      "Technical Emp ID": row.technical_emp_id,
      "Technical Emp Name": row.technical_emp_name,
      "BI Name": row.bi_name,
      "TL Name": row.tl_name,
      "Team Name": row.team_name,
      "Current Bill": row.current_bill,
      Outstanding: row.outstanding,
      "Total Bill": row.total_bill,
      "Total Paid": row.total_paid,
      "Old Balance Paid": row.old_balance_paid,
      Balance: row.balance,
      "New Collection Paid": row.new_collection_paid,
      "Excess Pay": row.excess_pay,
      "Tower Type": row.tower_type,
      "Total BW": row.total_bw,
      "Max Utilisation": row.max_utilisation,
      "Avg Utilisation": row.avg_utilisation,
      "Tower Height": row.tower_height,
      "Device Name - SSID": row.device_name_ssid,
      "Bridge IP": row.bridge_ip,
      "Wep Key": row.wep_key,
      "Wireless Mac": row.wireless_mac,
      "User Name": row.user_name,
      Password: row.password,
      "Port Number": row.port_number,
      "Device Product Name": row.device_product_name,
      "Device Model": row.device_model,
      "Tower Name": row.tower_name,
      "NLD ID": row.nld_id,
      "Tower ID": row.tower_id,
      "Tower ID(Branch Entry)": row.tower_id_branch_entry,
      "AP Name(SSID) - (Branch Entry)": row.ap_name_ssid_branch_entry,
      Code: row.code
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Master");
    XLSX.writeFile(workbook, "customer_master_full.xlsx");
  };

  return (
    <div className="customer-table-section">
      <div className="customer-table-top-row">
        <div />
        <button
          type="button"
          className="customer-primary-btn customer-export-btn"
          onClick={handleExport}
        >
          Export Excel
        </button>
      </div>

      <div className="customer-table-wrap">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>First Name</th>
              <th>Zone</th>
              <th>Branch</th>
              <th>Connection Type</th>
              <th>Status</th>
              <th>Connection Start Date</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="customer-no-data">
                  Loading customers...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="customer-no-data">
                  No customers found
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id || index}>
                  <td>
                    <button
                      type="button"
                      className="customer-link-btn"
                      onClick={() => onEdit(row.id)}
                    >
                      {formatValue(row.customer_id)}
                    </button>
                  </td>
                  <td>{formatValue(row.first_name)}</td>
                  <td>{formatValue(row.zone)}</td>
                  <td>{formatValue(row.branch)}</td>
                  <td>{formatValue(row.connection_type)}</td>
                  <td>
                    <span className={getStatusClass(row.status)}>
                      {formatValue(row.status)}
                    </span>
                  </td>
                  <td>{formatValue(row.connection_starting_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
