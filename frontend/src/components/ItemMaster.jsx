import { useEffect, useState, useCallback } from "react";
import MasterTable from "./MasterTable";
import * as masterService from "../services/masterServices";
import styles from "../css/ItemMaster.module.css";

export default function ItemMaster() {

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [areas, setAreas] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const getSafe = (res) => res?.data || res || [];

  const loadAll = useCallback(async () => {
    try {
      const [z, b, t] = await Promise.all([
        masterService.getZones(),
        masterService.getBranches(),
        masterService.getTeams()
      ]);

      setZones(getSafe(z));
      setBranches(getSafe(b));
      setTeams(getSafe(t));
    } catch (err) {
      console.error("Load error:", err);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

const loadTypes = async () => {
  try {
    const res = await masterService.getTicketTypes();
    setTypes(res.data || []);
  } catch (err) {
    console.error("Type load error:", err);
  }
};

const loadSubtypes = async (typeId) => {
  if (!typeId) return setSubtypes([]);

  try {
    const res = await masterService.getSubtypesByType(typeId);
    setSubtypes(res.data || []);
  } catch (err) {
    console.error("Subtype load error:", err);
  }
};

const loadAreas = async (branchId) => {
  if (!branchId) {
    setAreas([]);
    return;
  }

  try {
    const res = await masterService.getAreasByBranch(branchId);
    setAreas(res.data || []);
  } catch (err) {
    console.error("Area load error:", err);
    setAreas([]);
  }
};

const handleBranchChange = (branchId) => {
  const id = Number(branchId);
  setSelectedBranch(id);
  loadAreas(id);

  setActiveTab("Area");
};

const handleTypeChange = (id) => {
  setSelectedType(id);
  loadSubtypes(id);

  setActiveTab("Subtype");
};

useEffect(() => {
  loadTypes();
}, []);

  const loadDesignation = async (teamId) => {
    if (!teamId) {
      setDesignations([]);
      return;
    }

    try {
      const res = await masterService.getDesignationsByTeam(Number(teamId));
      setDesignations(getSafe(res));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTeamChange = (teamId) => {
    const id = Number(teamId);
    setSelectedTeam(id);
    loadDesignation(id);

    setActiveTab("Designation");
  };

  const refresh = (teamId) => {
    loadAll();
    const id = teamId || selectedTeam;
    if (id) loadDesignation(id);
  };

  return (
    <div className={styles.container}>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ZONE */}
      <MasterTable
        title="Zone"
        data={zones}
        fields={["zone_name"]}
        isOpen={activeTab === "Zone"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "Zone" ? "" : "Zone"))
        }
        onAdd={async (d) => {
          await masterService.createZone(d);
          showToast("Zone Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateZone(id, d);
          showToast("Zone Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteZone(id);
          showToast("Zone Deleted");
        }}
        refresh={refresh}
      />

      {/* BRANCH */}
      <MasterTable
        title="Branch"
        data={branches}
        fields={["branch_name", "short_name"]}
        parentOptions={zones}
        parentKey="zone_id"
        isOpen={activeTab === "Branch"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "Branch" ? "" : "Branch"))
        }
        onAdd={async (d) => {
          await masterService.createBranch(d);
          showToast("Branch Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateBranch(id, d);
          showToast("Branch Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteBranch(id);
          showToast("Branch Deleted");
        }}
        refresh={refresh}
      />

      {/* AREA FILTER */}
      <div className={styles.teamFilter}>
        <label>Select Branch for Area</label>

        <select
          value={selectedBranch || ""}
          onChange={(e) => handleBranchChange(e.target.value)}
        >
          <option value="">Select Branch</option>
          {branches.map((b) => (
            <option key={b.branch_id} value={b.branch_id}>
              {b.name || b.branch_name}
            </option>
          ))}
        </select>
      </div>

      {/* AREA */}
      <MasterTable
        title="Area"
        data={areas}
        fields={["area_name"]}
        parentOptions={branches}
        parentKey="branch_id"
        isOpen={activeTab === "Area"}
        onToggle={() => setActiveTab("Area")}
        onAdd={async (d) => {
          await masterService.createArea(d);
          showToast("Area Added");
          loadAreas(selectedBranch);
        }}
        onUpdate={async (id, d) => {
          await masterService.updateArea(id, d);
          showToast("Area Updated");
          loadAreas(selectedBranch);
        }}
        onDelete={async (id) => {
          await masterService.deleteArea(id);
          showToast("Area Deleted");
          loadAreas(selectedBranch);
        }}
        refresh={() => loadAreas(selectedBranch)}
      />

      {/* TEAM */}
      <MasterTable
        title="Team"
        data={teams}
        fields={["team_name"]}
        isOpen={activeTab === "Team"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "Team" ? "" : "Team"))
        }
        onAdd={async (d) => {
          await masterService.createTeam(d);
          showToast("Team Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateTeam(id, d);
          showToast("Team Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteTeam(id);
          showToast("Team Deleted");
        }}
        refresh={refresh}
      />

      {/* TEAM FILTER */}
      <div className={styles.teamFilter}>
        <label>Select Team for Designation</label>

        <select
          value={selectedTeam || ""}
          onChange={(e) => handleTeamChange(e.target.value)}
        >
          <option value="">Select Team</option>

          {teams.map((t, i) => (
            <option key={t.team_id ?? i} value={t.team_id}>
              {t.team_name || t.name}
            </option>
          ))}
        </select>
      </div>

      {/* DESIGNATION */}
      <MasterTable
        title="Designation"
        data={designations}
        fields={["designation_name", "level"]}
        parentOptions={teams}
        parentKey="team_id"
        isOpen={activeTab === "Designation"}
        onToggle={() =>
          setActiveTab((prev) =>
            prev === "Designation" ? "" : "Designation"
          )
        }
        onAdd={async (d) => {
          await masterService.createDesignation(d);
          showToast("Designation Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateDesignation(id, d);
          showToast("Designation Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteDesignation(id);
          showToast("Designation Deleted");
        }}
        refresh={(teamId) => refresh(teamId || selectedTeam)}
      />

      <MasterTable
  title="Ticket Type"
  data={types}
  fields={["type_name"]}
  isOpen={activeTab === "Type"}
  onToggle={() =>
  setActiveTab((prev) => (prev === "Type" ? "" : "Type"))
}
  onAdd={async (d) => {
    await masterService.createTicketType(d);
    showToast("Type Added");
    loadTypes();
  }}
  onUpdate={async (id, d) => {
    await masterService.updateTicketType(id, d);
    showToast("Type Updated");
    loadTypes();
  }}
  onDelete={async (id) => {
    await masterService.deleteTicketType(id);
    showToast("Type Deleted");
    loadTypes();
  }}
  refresh={loadTypes}
/>

<div className={styles.teamFilter}>
  <label>Select Type for Subtype</label>

  <select
    value={selectedType || ""}
    onChange={(e) => handleTypeChange(e.target.value)}
  >
    <option value="">Select Type</option>

{types.map((t) => (
  <option key={t.type_id} value={t.type_id}>
    {t.name || t.type_name}
  </option>
))}
  </select>
</div>

<MasterTable
  title="Ticket Subtype"
  data={subtypes}
  fields={["subtype_name"]}
  parentOptions={types}
  parentKey="type_id"
  isOpen={activeTab === "Subtype"}
  onToggle={() =>
  setActiveTab((prev) => (prev === "Subtype" ? "" : "Subtype"))
}
  onAdd={async (d) => {
    await masterService.createSubtype(d);
    showToast("Subtype Added");
    loadSubtypes(selectedType);
  }}
  onUpdate={async (id, d) => {
    await masterService.updateSubtype(id, d);
    showToast("Subtype Updated");
    loadSubtypes(selectedType);
  }}
  onDelete={async (id) => {
    await masterService.deleteSubtype(id);
    showToast("Subtype Deleted");
    loadSubtypes(selectedType);
  }}
  refresh={() => loadSubtypes(selectedType)}
/>

    </div>
  );
}