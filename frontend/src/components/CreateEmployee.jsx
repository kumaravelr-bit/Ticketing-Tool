import { useEffect, useState } from "react";
import styles from "../css/CreateEmployee.module.css";
import {
  getZones,
  getTeams,
  getAllBranches,
  getDesignations,
  getManagers,
  createEmployee,
  getAreasByBranch
} from "../services/employeeService";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function CreateEmployee() {

const [areas, setAreas] = useState([]);
  const [zones,setZones] = useState([]);
  const [branches,setBranches] = useState([]);
  const [teams,setTeams] = useState([]);
  const [designations,setDesignations] = useState([]);
  const [managers,setManagers] = useState([]);
  const [loading,setLoading] = useState(false);

  const [form,setForm] = useState({
    joining_status:"TRAINEE",
    name:"",
    father_name:"",
    gender:"",
    email:"",
    dob:"",
    joining_date:"",
    phone:"",
    emergency_contact:"",
    marital_status:"",
    experience_year:"",
    experience_month:"",
    qualification:"",
    permanent_address:"",
    temporary_address:"",
    same_address:false,
    zone_id:"",
    primary_branch_id: "",     // ✅ MAIN BRANCH
    crm_branch_ids: [],        // ✅ CRM
    ticket_branch_ids: [],     // ✅ Ticketing
    area_ids: [],              // ✅ ERP
    branch_ids:[],
    team_id:"",
    designation_id:"",
    manager_id:"",
    role:"USER_ACCOUNT",
    status:"ACTIVE",
    profile_photo:null
  });

  const myRole = localStorage.getItem("role");

  const roles =
    myRole === "SUPER_ADMIN"
      ? ["USER_ACCOUNT","ADMIN","SUPER_ADMIN"]
      : ["USER_ACCOUNT"];

  /* ---------------- MASTER DATA ---------------- */

  useEffect(()=>{
    loadZones();
    loadTeams();
    loadAllBranches();
  },[]);

  const loadZones = async()=>{
    try{
      const res = await getZones();
      setZones(res.data || []);
    }catch{
      setZones([]);
    }
  };

  const loadTeams = async()=>{
    try{
      const res = await getTeams();
      setTeams(res.data || []);
    }catch{
      setTeams([]);
    }
  };

useEffect(() => {
  if (!form.primary_branch_id) {
    setAreas([]);
    return;
  }

  getAreasByBranch(form.primary_branch_id)
    .then(res => setAreas(res.data || []))
    .catch(() => setAreas([]));

}, [form.primary_branch_id]);

const loadAllBranches = async () => {
  try {
    const res = await getAllBranches();
    const data = res.data || [];

    // ✅ Normalize keys (VERY IMPORTANT)
    const formatted = data.map(b => ({
      branch_id: b.branch_id || b.id,
      name: b.name || b.branch_name,
      zone_id: Number(b.zone_id)
    }));

    setBranches(formatted);

  } catch {
    setBranches([]);
  }
};

useEffect(() => {
  if (!form.zone_id) return;

  const filtered = branches.filter(
    b => Number(b.zone_id) === Number(form.zone_id)
  );

  // Auto-clear invalid selections
  setForm(prev => ({
    ...prev,
    crm_branch_ids: prev.crm_branch_ids.filter(id =>
      filtered.some(b => Number(b.branch_id) === Number(id))
    )
  }));

}, [form.zone_id, branches]);

  /* ---------------- DESIGNATIONS ---------------- */

  useEffect(()=>{

    if(!form.team_id){
      setDesignations([]);
      return;
    }

    const loadDesignations = async()=>{
      try{
        const res = await getDesignations(form.team_id);
        setDesignations(res.data || []);
      }catch{
        setDesignations([]);
      }
    };

    loadDesignations();

  },[form.team_id]);

  /* ---------------- MANAGERS ---------------- */

useEffect(() => {
  if (form.team_id && form.designation_id) {

    getManagers({
      team_id: Number(form.team_id),
      zone_id: Number(form.zone_id) || null,
      designation_id: Number(form.designation_id)
    })
      .then(res => {
        setManagers(res.data || []);
      })
      .catch(() => setManagers([]));
  }
}, [form.team_id, form.zone_id, form.designation_id]);

  /* ---------------- INPUT ---------------- */

  const handleChange = (field,value)=>{

if (field === "zone_id") {
    setForm(prev => ({
      ...prev,
      zone_id: value,
      primary_branch_id: "",
      crm_branch_ids: []   // ✅ reset
    }));
    return;
  }

  if (field === "primary_branch_id") {
    setForm(prev => ({
      ...prev,
      primary_branch_id: value,
      area_ids: [] // reset ERP areas
    }));
    return;
  }

    if(field==="same_address" && value===true){
      setForm(prev=>({
        ...prev,
        same_address:true,
        temporary_address:prev.permanent_address
      }));
      return;
    }

    if(field==="permanent_address" && form.same_address){
      setForm(prev=>({
        ...prev,
        permanent_address:value,
        temporary_address:value
      }));
      return;
    }

    setForm(prev=>({
      ...prev,
      [field]:value
    }));
  };

  /* ---------------- SUBMIT ---------------- */

  const submit = async()=>{

    if(loading) return;

    if(!form.name || !form.email || !form.dob){
      toast.error("Please fill all required fields");
      return;
    }

    if(form.branch_ids.length===0){
      toast.error("Please select at least one branch");
      return;
    }

const data = new FormData();

Object.keys(form).forEach(key => {
  if (Array.isArray(form[key])) {
    data.append(key, JSON.stringify(form[key]));
  } else {
    data.append(key, form[key] || "");
  }
});

data.append(
  "experience",
  `${form.experience_year || 0}.${form.experience_month || 0}`
);

    try{

      setLoading(true);

      const res = await createEmployee(data);

      toast.success(
        `Employee Created | ID: ${res.data.emp_id} | Password: ${res.data.password}`
      );

      setTimeout(()=>{
        window.location.reload();
      },1500);

    }catch(err){

      toast.error(
        err.response?.data?.message || "Error creating employee"
      );

    }finally{
      setLoading(false);
    }

  };

  const maxDOB = new Date(
    new Date().setFullYear(new Date().getFullYear()-18)
  ).toISOString().split("T")[0];


  /* ---------------- UI ---------------- */

  return(

    <div className={styles.container}>

      <h2>Create Employee</h2>

      {/* JOINING STATUS */}
      <div className={styles["form-group"]}>
        <label>Joining Status</label>
        <select
          value={form.joining_status}
          onChange={e=>handleChange("joining_status",e.target.value)}
        >
          <option value="TRAINEE">TRAINEE</option>
          <option value="PERMANENT">PERMANENT</option>
        </select>
      </div>

      {/* JOINING DATE */}
      <div className={styles["form-group"]}>
        <label>Joining Date</label>
        <input
          type="date"
          value={form.joining_date}
          onChange={e=>handleChange("joining_date",e.target.value)}
        />
      </div>

      {/* NAME */}
      <div className={styles["form-group"]}>
        <label>Name *</label>
        <input value={form.name}
          onChange={e=>handleChange("name",e.target.value)} />
      </div>

      {/* FATHER NAME */}
      <div className={styles["form-group"]}>
        <label>Father Name</label>
        <input value={form.father_name}
          onChange={e=>handleChange("father_name",e.target.value)} />
      </div>

      {/* GENDER */}
      <div className={styles["form-group"]}>
        <label>Gender</label>
        <select
          value={form.gender}
          onChange={e=>handleChange("gender",e.target.value)}
        >
          <option value="">Select</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
          <option value="OTHERS">OTHERS</option>
        </select>
      </div>

      {/* EMAIL */}
      <div className={styles["form-group"]}>
        <label>Email *</label>
        <input type="email"
          value={form.email}
          onChange={e=>handleChange("email",e.target.value)} />
      </div>

      {/* DOB */}
      <div className={styles["form-group"]}>
        <label>DOB *</label>
        <input type="date"
          max={maxDOB}
          value={form.dob}
          onChange={e=>handleChange("dob",e.target.value)} />
      </div>

      {/* PHONE */}
      <div className={styles["form-group"]}>
        <label>Phone</label>
        <input value={form.phone}
          onChange={e=>handleChange("phone",e.target.value)} />
      </div>

      {/* EMERGENCY */}
      <div className={styles["form-group"]}>
        <label>Emergency Contact</label>
        <input value={form.emergency_contact}
          onChange={e=>handleChange("emergency_contact",e.target.value)} />
      </div>

      {/* MARITAL */}
      <div className={styles["form-group"]}>
        <label>Marital Status</label>
        <select
          value={form.marital_status}
          onChange={e=>handleChange("marital_status",e.target.value)}
        >
          <option value="">Select</option>
          <option value="SINGLE">SINGLE</option>
          <option value="MARRIED">MARRIED</option>
        </select>
      </div>

      {/* EXPERIENCE */}
      <div className={styles["form-group"]}>
        <label>Experience</label>
        <div style={{display:"flex",gap:"10px"}}>
          <input type="number" placeholder="Year"
            value={form.experience_year}
            onChange={e=>handleChange("experience_year",e.target.value)} />
          <input type="number" placeholder="Month"
            value={form.experience_month}
            onChange={e=>handleChange("experience_month",e.target.value)} />
        </div>
      </div>

      {/* QUALIFICATION */}
      <div className={styles["form-group"]}>
        <label>Qualification</label>
        <select
          value={form.qualification}
          onChange={e=>handleChange("qualification",e.target.value)}
        >
          <option value="">Select</option>
          <option>SSLC</option>
          <option>HSC</option>
          <option>DIPLOMA</option>
          <option>UG</option>
          <option>PG</option>
        </select>
      </div>

      {/* ADDRESS */}
      <div className={styles["form-group"]}>
        <label>Permanent Address</label>
        <textarea value={form.permanent_address}
          onChange={e=>handleChange("permanent_address",e.target.value)} />
      </div>

      <div className={styles["form-group"]}>
        <label>
          <input type="checkbox"
            checked={form.same_address}
            onChange={e=>handleChange("same_address",e.target.checked)} />
          Same as Permanent
        </label>
      </div>

      <div className={styles["form-group"]}>
        <label>Temporary Address</label>
        <textarea value={form.temporary_address}
          onChange={e=>handleChange("temporary_address",e.target.value)} />
      </div>

      {/* ZONE */}
      <div className={styles["form-group"]}>
        <label>Zone</label>
<select
  value={form.zone_id}
  onChange={e => handleChange("zone_id", Number(e.target.value))}
>
          <option value="">Select Zone</option>
          {zones.map(z=>(
            <option key={z.zone_id} value={z.zone_id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

<div className={styles["form-group"]}>
  <label>Primary Branch *</label>
  <select
    value={form.primary_branch_id}
    onChange={e => handleChange("primary_branch_id", e.target.value)}
  >
    <option value="">Select</option>
    {/* {branches.map(b => (
      <option key={b.branch_id} value={b.branch_id}>
        {b.name}
      </option>
    ))} */}
    {branches
  .filter(b => Number(b.zone_id) === Number(form.zone_id))
  .map(b => (
    <option key={b.branch_id} value={b.branch_id}>
      {b.name}
    </option>
  ))}
  </select>
</div>

<div className={styles["form-group"]}>
  <label>CRM Branch Access</label>

  <select
    multiple
    value={form.crm_branch_ids}
    onChange={(e) =>
      handleChange(
        "crm_branch_ids",
        Array.from(e.target.selectedOptions, o => o.value)
      )
    }
  >
{form.zone_id === "" ? (
  <option disabled>Select Zone First</option>
) : branches.filter(b => Number(b.zone_id) === Number(form.zone_id)).length === 0 ? (
  <option disabled>No Branches Available</option>
) : (
  branches
    .filter(b => Number(b.zone_id) === Number(form.zone_id))
    .map(b => (
      <option key={b.branch_id} value={b.branch_id}>
        {b.name}
      </option>
    ))
)}
  </select>
</div>

<div className={styles["form-group"]}>
  <label>Ticket / Lead Branch Access</label>

  <select
    multiple
    value={form.ticket_branch_ids}
    onChange={(e) =>
      handleChange(
        "ticket_branch_ids",
        Array.from(e.target.selectedOptions, o => o.value)
      )
    }
  >
    {branches.map(b => (
      <option key={b.branch_id} value={b.branch_id}>
        {b.name}
      </option>
    ))}
  </select>
</div>

<div className={styles["form-group"]}>
  <label>ERP Area Access</label>

  <select
    multiple
    value={form.area_ids}
    onChange={(e) =>
      handleChange(
        "area_ids",
        Array.from(e.target.selectedOptions, o => o.value)
      )
    }
  >
{!form.primary_branch_id ? (
  <option disabled>Select Branch First</option>
) : areas.length === 0 ? (
  <option disabled>No Areas Available</option>
) : (
  areas.map(a => (
    <option key={a.id} value={a.id}>
      {a.area_name}
    </option>
  ))
)}
  </select>
</div>

 {/* BRANCH MULTI SELECT */}
<div className={styles["form-group"]}>
  <label>Branches *</label>

  <select
    multiple
    value={form.branch_ids}
    onChange={(e) => {
      const selectedValues = Array.from(
        e.target.selectedOptions,
        option => option.value
      );
      handleChange("branch_ids", selectedValues);
    }}
  >
    {branches.map(b => (
      <option key={b.branch_id} value={String(b.branch_id)}>
        {b.name}
      </option>
    ))}
  </select>
</div>

      {/* TEAM */}
      <div className={styles["form-group"]}>
        <label>Team</label>
        <select value={form.team_id}
          onChange={e=>handleChange("team_id",e.target.value)}>
          <option value="">Select</option>
          {teams.map(t=>(
            <option key={t.team_id} value={t.team_id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* DESIGNATION */}
      <div className={styles["form-group"]}>
        <label>Designation</label>
        <select value={form.designation_id}
          onChange={e=>handleChange("designation_id",e.target.value)}>
          <option value="">Select</option>
          {designations.map(d=>(
            <option key={d.designation_id} value={d.designation_id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* MANAGER */}
      <div className={styles["form-group"]}>
        <label>Manager</label>
        <select value={form.manager_id}
          onChange={e=>handleChange("manager_id",e.target.value)}>
          <option value="">None</option>
          {managers.map(m=>(
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* ROLE */}
      <div className={styles["form-group"]}>
        <label>Role</label>
        <select value={form.role}
          onChange={e=>handleChange("role",e.target.value)}>
          {roles.map(r=>(<option key={r}>{r}</option>))}
        </select>
      </div>

      {/* PROFILE */}
      <div className={styles["form-group"]}>
        <label>Profile Photo</label>
        <input type="file"
          onChange={e=>handleChange("profile_photo",e.target.files[0])}/>
      </div>

      <button className={styles.button}
        onClick={submit}
        disabled={loading}>
        {loading ? "Creating..." : "Save Employee"}
      </button>

      <ToastContainer position="top-right" autoClose={3000}/>

    </div>
  );
}