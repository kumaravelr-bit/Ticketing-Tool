import { useEffect,useState,useMemo } from "react";
import { toast } from "react-toastify";
import styles from "../css/RelievedEmployee.module.css";

import {
  getRelievedEmployees,
  reactivateEmployee,
  getZones,
  getTeams,
  getAllBranches
} from "../services/employeeService";

export default function RelievedEmployees(){

  const [employees,setEmployees] = useState([]);
  const [zones,setZones] = useState([]);
  const [teams,setTeams] = useState([]);
  const [branches,setBranches] = useState([]);

  const [page,setPage] = useState(1);
  const perPage = 10;

  const [filters,setFilters] = useState({
    emp_id:"",
    name:"",
    team:"",
    zone:"",
    branch:""
  });

  const [selectedEmp,setSelectedEmp] = useState(null);
  const [showModal,setShowModal] = useState(false);

/* =============================
   LOAD DATA
=============================*/

  useEffect(()=>{
    loadEmployees();
    loadMasters();
  },[]);

  const loadEmployees = async(filtersData = filters)=>{
    try{

      const res = await getRelievedEmployees(filtersData);

      const clean = (res.data || []).map((emp,i)=>({
        ...emp,
        emp_id: emp.emp_id || `emp-${i}`,
        name: emp.name || "",
        team_name: emp.team_name || "",
        zone_name: emp.zone_name || "",
        branch_name: emp.branch_name || "",
        phone: emp.phone || "",
        status: emp.status || ""
      }));

      setEmployees(clean);

    }catch{
      toast.error("Failed to load data");
    }
  };

  const loadMasters = async()=>{
    try{
      const [z,t] = await Promise.all([
        getZones(),
        getTeams()
      ]);

      setZones(z.data || []);
      setTeams(t.data || []);
    }catch{}
  };

/* =============================
   BRANCH LOAD
=============================*/

  useEffect(()=>{
    if(!filters.zone){
      setBranches([]);
      return;
    }

    getAllBranches(filters.zone)
      .then(res=>setBranches(res.data || []))
      .catch(()=>setBranches([]));
  },[filters.zone]);

/* =============================
   FILTER CHANGE
=============================*/

  const changeFilter = (field,value)=>{
    const updated = {...filters,[field]:value};
    setFilters(updated);
    setPage(1);
    loadEmployees(updated);
  };

  const resetFilters = ()=>{
    const reset = {
      emp_id:"",
      name:"",
      team:"",
      zone:"",
      branch:""
    };
    setFilters(reset);
    setBranches([]);
    loadEmployees(reset);
  };

/* =============================
   PAGINATION
=============================*/

  const paginated = useMemo(()=>{
    const start = (page-1)*perPage;
    return employees.slice(start,start+perPage);
  },[employees,page]);

  const totalPages = Math.ceil(employees.length/perPage);

/* =============================
   REACTIVATE FLOW
=============================*/

  const confirmActivate = (emp)=>{
    setSelectedEmp(emp);
    setShowModal(true);
  };

  const handleActivate = async()=>{
    try{
      await reactivateEmployee(selectedEmp.emp_id);
      toast.success("Employee Activated");
      setShowModal(false);
      loadEmployees();
    }catch{
      toast.error("Failed to activate");
    }
  };

/* =============================
   ROLE CHECK
=============================*/

  const userRole = localStorage.getItem("role");

/* =============================
   UI
=============================*/

  return(


      <div className={styles.pageContainer}>
        <h2>Relieved Employees</h2>

{/* FILTERS */}

        <div className={styles.filters}>

          <input placeholder="EMP ID"
            value={filters.emp_id}
            onChange={e=>changeFilter("emp_id",e.target.value)}
          />

          <input placeholder="Name"
            value={filters.name}
            onChange={e=>changeFilter("name",e.target.value)}
          />

          <select onChange={e=>changeFilter("team",e.target.value)}>
            <option value="">Team</option>
            {teams.map((t,i)=>(
              <option key={t.id||i} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </select>

          <select onChange={e=>changeFilter("zone",e.target.value)}>
            <option value="">Zone</option>
            {zones.map((z,i)=>(
              <option key={z.id||i} value={z.id}>
                {z.zone_name}
              </option>
            ))}
          </select>

          <select onChange={e=>changeFilter("branch",e.target.value)}>
            <option value="">Branch</option>
            {branches.map((b,i)=>(
              <option key={b.id||i} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </select>

          <button onClick={resetFilters}>Reset</button>
        </div>


        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Team</th>
              <th>Zone</th>
              <th>Branch</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map(emp=>(
              <tr key={emp.emp_id}>
                <td>{emp.emp_id}</td>
                <td>{emp.name}</td>
                <td>{emp.team_name || "-"}</td>
                <td>{emp.zone_name || "-"}</td>
                <td>{emp.branch_name || "-"}</td>

                <td>
                  {(userRole==="ADMIN" || userRole==="SUPER_ADMIN" || userRole==="HRD") ? (
                    <select
                      defaultValue={emp.status}
                      onChange={()=>confirmActivate(emp)}
                    >
                      <option value="RELIEVED">RELIEVED</option>
                      <option value="ACTIVE">ACTIVE</option>
                    </select>
                  ) : (
                    emp.status
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Prev</button>
          <span>{page}/{totalPages||1}</span>
          <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
        </div>

{/* MODAL */}

        {showModal && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>Active this Employee?</h3>
              <p>{selectedEmp?.name}</p>

              <button onClick={handleActivate}>Yes</button>
              <button onClick={()=>setShowModal(false)}>Cancel</button>
            </div>
          </div>
        )}

      </div>

  );
}