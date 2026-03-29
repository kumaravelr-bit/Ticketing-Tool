import { useEffect,useState,useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  getActiveEmployees,
  getZones,
  getTeams,
  getAllBranches
} from "../services/employeeService";

import styles from "../css/ActiveEmployee.module.css";

export default function ActiveEmployees(){

  const navigate = useNavigate();

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

/* =============================
   LOAD DATA
=============================*/

  useEffect(()=>{
    loadEmployees();
    loadMasters();
  },[]);

  const loadEmployees = async(filtersData = filters)=>{
    try{

      const res = await getActiveEmployees(filtersData); // ✅ PASS FILTERS

      const cleanData = (res.data || []).map((emp,index)=>({
        ...emp,
        emp_id: emp.emp_id || `emp-${index}`,
        name: emp.name || "",
        team_name: emp.team_name || "",
        zone_name: emp.zone_name || "",
        branch_name: emp.branch_name || "",
        phone: emp.phone || "",
        status: emp.status || "",
        dob: emp.dob || ""
      }));

      setEmployees(cleanData);

    }catch{
      toast.error("Failed to load active employees");
    }
  };

  const loadMasters = async()=>{

    try{

      const [z,t] = await Promise.all([
        getZones(),
        getTeams()
      ]);

      // 🔥 CLEAN MASTER DATA (FIX UNDEFINED ID)
      const cleanZones = (z.data || []).map((item,i)=>({
        id: item.id ?? `zone-${i}`,
        zone_name: item.zone_name || "Unknown"
      }));

      const cleanTeams = (t.data || []).map((item,i)=>({
        id: item.id ?? `team-${i}`,
        team_name: item.team_name || "Unknown"
      }));

      setZones(cleanZones);
      setTeams(cleanTeams);

    }catch{
      toast.error("Failed to load master data");
    }

  };

/* =============================
   LOAD BRANCHES WHEN ZONE CHANGES
=============================*/

  useEffect(()=>{

    if(!filters.zone){
      setBranches([]);
      return;
    }

    getAllBranches(filters.zone)
      .then(res=>{
        const cleanBranches = (res.data || []).map((b,i)=>({
          id: b.id ?? `branch-${i}`,
          branch_name: b.branch_name || "Unknown"
        }));
        setBranches(cleanBranches);
      })
      .catch(()=>setBranches([]));

  },[filters.zone]);

/* =============================
   HANDLE FILTER CHANGE
=============================*/

const changeFilter = (field,value)=>{

  const updatedFilters = {
    ...filters,
    [field]: value || ""   // ✅ prevent 0 / NaN issues
  };

  // 🔥 RESET BRANCH when ZONE changes
  if(field === "zone"){
    updatedFilters.branch = "";
    setBranches([]);
  }

  setFilters(updatedFilters);
  setPage(1);

  loadEmployees(updatedFilters);
};

/* =============================
   RESET FILTERS
=============================*/

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
    setPage(1);

    loadEmployees(reset);

  };

/* =============================
   FILTERED DATA (KEEPED BUT LIGHT)
=============================*/

  const filteredEmployees = useMemo(()=>{
    return employees;
  },[employees,filters]);

/* =============================
   PAGINATION
=============================*/

  const paginatedEmployees = useMemo(()=>{

    const start = (page-1)*perPage;
    return filteredEmployees.slice(start,start+perPage);

  },[filteredEmployees,page]);

  const totalPages =
    Math.ceil(filteredEmployees.length/perPage);

/* =============================
   FORMAT DOB
=============================*/

  const formatDOB = (dob)=>{

    if(!dob) return "-";

    try{
      return new Date(dob).toLocaleDateString();
    }catch{
      return "-";
    }

  };

/* =============================
   UI
=============================*/

  return(

    <div className={styles.container}>

      <h2>Active Employees</h2>

      <div className={styles.filters}>

        <input
          placeholder="Search EMP ID"
          value={filters.emp_id}
          onChange={e=>changeFilter("emp_id",e.target.value)}
        />

        <input
          placeholder="Search EMP Name"
          value={filters.name}
          onChange={e=>changeFilter("name",e.target.value)}
        />

        <select
          value={filters.team}
          onChange={e=>changeFilter("team", Number(e.target.value))}
        >
          <option value="">Team</option>
          {teams.map((t,index)=>(
            <option
              key={t.id || `team-${index}`}   // ✅ FIXED
              value={t.id}                   // ✅ SEND ID
            >
              {t.team_name}
            </option>
          ))}
        </select>

        <select
          value={filters.zone}
          onChange={e=>changeFilter("zone", Number(e.target.value))}
        >
          <option value="">Zone</option>
          {zones.map((z,index)=>(
            <option
              key={z.id || `zone-${index}`}   // ✅ FIXED
              value={z.id}                  // ✅ SEND ID
            >
              {z.zone_name}
            </option>
          ))}
        </select>

        <select
          value={filters.branch}
          onChange={e=>changeFilter("branch", Number(e.target.value))}
        >
          <option value="">Branch</option>
          {branches.map((b,index)=>(
            <option
              key={b.id || `branch-${index}`}  // ✅ FIXED
              value={b.id}                   // ✅ SEND ID
            >
              {b.branch_name}
            </option>
          ))}
        </select>

        <button
          className={styles.resetBtn}
          onClick={resetFilters}
        >
          Reset
        </button>

      </div>

      <div className={styles.tableWrapper}>

        <table className={styles.table}>

          <thead>

            <tr>
              <th>EMP ID</th>
              <th>EMP Name</th>
              <th>DOB</th>
              <th>Team</th>
              <th>Contact No</th>
              <th>Branch</th>
              <th>Status</th>
            </tr>

          </thead>

          <tbody>

            {paginatedEmployees.map((emp,index)=>(

              <tr key={emp.emp_id || index}>

                <td>
                  <span
                    className={styles.empLink}
                    onClick={()=>navigate(`/employee/edit/${emp.emp_id}`)}
                  >
                    {emp.emp_id}
                  </span>
                </td>

                <td>{emp.name || "-"}</td>
                <td>{formatDOB(emp.dob)}</td>
                <td>{emp.team_name || "-"}</td>
                <td>{emp.phone || "-"}</td>
                <td>{emp.branch_name || "-"}</td>
                <td>{emp.status || "-"}</td>

              </tr>

            ))}

            {paginatedEmployees.length === 0 && (
              <tr>
                <td colSpan="7" className={styles.empty}>
                  No employees found
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

      <div className={styles.pagination}>

        <button
          disabled={page===1}
          onClick={()=>setPage(p=>p-1)}
        >
          Prev
        </button>

        <span>
          Page {page} / {totalPages || 1}
        </span>

        <button
          disabled={page===totalPages || totalPages===0}
          onClick={()=>setPage(p=>p+1)}
        >
          Next
        </button>

      </div>

    </div>

  );

}