const bcrypt = require("bcrypt");
const path = require("path");
const db = require("../config/db");
const { ensureEmployeeHierarchyRuntime } = require("./employee.controller");

const VALID_JOINING_STATUS = new Set(["TRAINEE", "PERMANENT"]);
const VALID_GENDER = new Set(["MALE", "FEMALE", "OTHERS"]);
const VALID_MARITAL_STATUS = new Set(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]);
const VALID_ROLE = new Set(["SUPER_ADMIN", "ADMIN", "USER_ACCOUNT"]);
const VALID_STATUS = new Set(["ACTIVE", "RELIEVED", "DEACTIVATED"]);

const TEMPLATE_HEADERS = [
  "emp_id",
  "joining_status",
  "name",
  "father_name",
  "gender",
  "dob",
  "email",
  "phone",
  "emergency_contact",
  "password",
  "marital_status",
  "experience",
  "role",
  "team",
  "designation",
  "manager_emp_id",
  "primary_branch",
  "zone",
  "qualification",
  "joining_date",
  "permanent_address",
  "temporary_address",
  "status",
  "crm_branch_access",
  "ticket_lead_branch_access",
  "erp_area_access",
];

const TEMPLATE_SAMPLE_ROW = [
  "",
  "PERMANENT",
  "Sample Employee",
  "Sample Father",
  "MALE",
  "1998-01-15",
  "sample.employee@company.com",
  "9876543210",
  "9876543211",
  "",
  "SINGLE",
  "2.6",
  "USER_ACCOUNT",
  "IT",
  "IT",
  "ICEEMP0002",
  "Namakkal",
  "NAMAKKAL",
  "B.Sc Computer Science",
  "2026-04-01",
  "Namakkal Address",
  "Namakkal Address",
  "ACTIVE",
  "Namakkal|Rasipuram",
  "Namakkal|Rasipuram",
  "Area 1|Area 2",
];

const BRANCH_TEMPLATE_HEADERS = ["branch_name", "short_name", "zone"];
const BRANCH_TEMPLATE_SAMPLE_ROW = ["Namakkal", "NKL", "NAMAKKAL"];

const AREA_TEMPLATE_HEADERS = ["area_name", "branch"];
const AREA_TEMPLATE_SAMPLE_ROW = ["Namakkal Town", "Namakkal"];

const TEAM_TEMPLATE_HEADERS = ["team_name"];
const TEAM_TEMPLATE_SAMPLE_ROW = ["TECHNICAL"];

const DESIGNATION_TEMPLATE_HEADERS = ["designation_name", "team", "level"];
const DESIGNATION_TEMPLATE_SAMPLE_ROW = ["TECH LEAD", "TECHNICAL", "5"];

const MANAGER_MAPPING_TEMPLATE_HEADERS = [
  "child_team",
  "child_designation",
  "parent_team",
  "parent_designation",
  "scope_type",
  "is_active",
];
const MANAGER_MAPPING_TEMPLATE_SAMPLE_ROW = [
  "TECHNICAL",
  "SR EXECUTIVE TECHNICAL",
  "TECHNICAL",
  "TECH LEAD",
  "BRANCH",
  "1",
];

const SCOPE_OWNER_MAPPING_TEMPLATE_HEADERS = [
  "team",
  "zone",
  "branch",
  "designation",
  "employee_emp_id",
  "is_active",
];
const SCOPE_OWNER_MAPPING_TEMPLATE_SAMPLE_ROW = [
  "TECHNICAL",
  "CHENNAI",
  "",
  "TECH LEAD",
  "ICEEMP1079",
  "1",
];

const normalizeKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeText = (value = "") => String(value).trim().toUpperCase();

const normalizeNullableText = (value = "") => {
  const text = String(value ?? "").trim();
  return text ? text.toUpperCase() : "";
};

const toUploadFlag = (value, fallback = 1) => {
  const text = normalizeNullableText(value);
  if (!text) return fallback;
  if (["1", "TRUE", "YES", "Y", "ACTIVE"].includes(text)) return 1;
  if (["0", "FALSE", "NO", "N", "INACTIVE"].includes(text)) return 0;
  throw new Error(`Invalid boolean value '${value}'`);
};

const toNullableId = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid id value '${value}'`);
  }
  return number;
};

const buildManagerScopeFlags = (value) => {
  const scopeType = normalizeNullableText(value) || "TEAM";

  if (!["TEAM", "BRANCH", "ZONE", "GLOBAL"].includes(scopeType)) {
    throw new Error(`Invalid scope_type '${value}'`);
  }

  return {
    scopeType,
    same_team_only: scopeType === "TEAM" ? 1 : 0,
    same_branch_only: scopeType === "BRANCH" ? 1 : 0,
    same_zone_only: scopeType === "ZONE" ? 1 : 0,
  };
};

const splitAccessValues = (value) =>
  String(value || "")
    .split(/[|,\n;]+/)
    .map((item) => String(item).trim())
    .filter(Boolean);

const csvEscape = (value = "") => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.replace(/\r/g, "").trim());
}

function parseCsvBuffer(buffer) {
  const content = String(buffer || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");

  const lines = content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeKey);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] ?? "";
    });
    row.__rowNumber = index + 2;
    return row;
  });
}

function parseExcelBuffer(buffer) {
  let xlsx;
  try {
    xlsx = require("xlsx");
  } catch (error) {
    error.message =
      "Excel upload requires the 'xlsx' package. Run npm install in Backend before uploading .xlsx/.xls files.";
    throw error;
  }

  const workbook = xlsx.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });

  return rows.map((rawRow, index) => {
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value])
    );
    row.__rowNumber = index + 2;
    return row;
  });
}

function readUploadRows(file) {
  const ext = path.extname(file?.originalname || "").toLowerCase();
  if (!file?.buffer?.length) {
    throw new Error("Uploaded file is empty");
  }
  if (ext === ".csv") return parseCsvBuffer(file.buffer);
  if (ext === ".xlsx" || ext === ".xls") return parseExcelBuffer(file.buffer);
  throw new Error("Unsupported file type");
}

function normalizeDateInput(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Invalid date value '${text}'`);
}

function getField(row, aliases) {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function buildResponsePayload(rows, inserted, failed, successMessage, partialMessage) {
  return {
    message: failed.length ? partialMessage : successMessage,
    summary: {
      total_rows: rows.length,
      inserted_count: inserted.length,
      failed_count: failed.length,
    },
    inserted,
    failed,
  };
}

function createDesignationLookup(designations) {
  const byId = new Map();
  const byTeamAndName = new Map();
  const byName = new Map();

  for (const row of designations) {
    const idKey = String(row.id);
    const nameKey = normalizeText(row.designation_name);
    const teamIdKey = String(row.team_id);
    const teamNameKey = normalizeText(row.team_name || "");
    const compositeKeys = new Set([
      `${teamIdKey}__${nameKey}`,
      `${teamNameKey}__${nameKey}`,
    ]);

    byId.set(idKey, row);

    compositeKeys.forEach((key) => {
      if (key && !key.startsWith("__")) {
        byTeamAndName.set(key, row);
      }
    });

    const existing = byName.get(nameKey) || [];
    existing.push(row);
    byName.set(nameKey, existing);
  }

  return { byId, byTeamAndName, byName };
}

function resolveEntity(value, maps, entityName) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return maps.byId.get(raw) || maps.byName.get(normalizeText(raw)) || null;
}

function resolveDesignationForMappingUpload({
  value,
  teamValue,
  lookup,
  fieldLabel,
}) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error(`${fieldLabel} is required`);
  }

  const byId = lookup.byId.get(raw);
  if (byId) return byId;

  const normalizedName = normalizeText(raw);
  const teamRaw = String(teamValue ?? "").trim();

  if (teamRaw) {
    const teamCandidates = [
      `${teamRaw}__${normalizedName}`,
      `${normalizeText(teamRaw)}__${normalizedName}`,
    ];

    for (const key of teamCandidates) {
      const matched = lookup.byTeamAndName.get(key);
      if (matched) return matched;
    }

    throw new Error(`${fieldLabel} '${raw}' not found for team '${teamRaw}'`);
  }

  const rows = lookup.byName.get(normalizedName) || [];
  if (rows.length === 1) {
    return rows[0];
  }
  if (rows.length > 1) {
    throw new Error(`${fieldLabel} '${raw}' is ambiguous. Provide team also.`);
  }

  throw new Error(`${fieldLabel} '${raw}' not found`);
}

async function assignDefaultPermissions(conn, empId, role) {
  const map = {
    SUPER_ADMIN: ["EMP_CREATE", "EMP_UPDATE", "EMP_DELETE", "EMP_VIEW", "TICKET_ALL", "HRD_ALL", "REPORTS_ALL"],
    ADMIN: ["EMP_CREATE", "EMP_UPDATE", "EMP_VIEW", "TICKET_ALL", "HRD_ALL", "REPORTS_ALL"],
    USER_ACCOUNT: ["EMP_VIEW", "TICKET_CREATE", "TICKET_VIEW"],
  };

  const keys = map[role] || map.USER_ACCOUNT;
  if (!keys.length) return;

  const [rows] = await conn.query(
    `SELECT id FROM permissions WHERE permission_key IN (${keys.map(() => "?").join(",")})`,
    keys
  );

  if (!rows.length) return;

  await conn.query(
    "INSERT IGNORE INTO employee_permissions (emp_id, permission_id) VALUES ?",
    [rows.map((row) => [empId, row.id])]
  );
}

const MANAGER_FALLBACK_PRIORITY = [
  "BRANCH INCHARGE",
  "TECH LEAD",
  "ASM",
  "CMO",
  "SALES HEAD",
  "MANAGER",
  "CTO",
  "CEO",
  "MD",
];

const getManagerPriorityRank = (designationName) => {
  const normalized = String(designationName || "").trim().toUpperCase();
  const index = MANAGER_FALLBACK_PRIORITY.indexOf(normalized);
  return index === -1 ? 999 : index;
};

const GLOBAL_MANAGER_DESIGNATIONS = new Set(["CTO", "CEO", "MD", "CMO", "SALES HEAD"]);

const isGlobalManagerDesignation = (designationName, managerScope) => {
  const normalized = String(designationName || "").trim().toUpperCase();
  return managerScope === "GLOBAL" || GLOBAL_MANAGER_DESIGNATIONS.has(normalized);
};

async function getParentManagerRules(conn, childDesignationId) {
  const [rows] = await conn.query(
    `SELECT
       r.parent_designation_id,
       r.same_team_only,
       r.same_branch_only,
       r.same_zone_only,
       d.designation_name,
       d.level,
       d.manager_scope
     FROM designation_reporting_rules r
     INNER JOIN designations d
       ON d.id = r.parent_designation_id
     WHERE r.child_designation_id = ?
       AND r.is_active = 1`,
    [childDesignationId]
  );

  return rows.sort((a, b) => {
    const priorityDiff =
      getManagerPriorityRank(a.designation_name) - getManagerPriorityRank(b.designation_name);
    if (priorityDiff !== 0) return priorityDiff;
    if ((a.level || 0) !== (b.level || 0)) return (a.level || 0) - (b.level || 0);
    return (a.parent_designation_id || 0) - (b.parent_designation_id || 0);
  });
}

async function findScopeOwnerEmployee(conn, { parentDesignationId, rule, teamId, branchId, zoneId }) {
  const [rows] = await conn.query(
    `SELECT som.employee_id
     FROM scope_owner_mapping som
     INNER JOIN employees e
       ON e.id = som.employee_id
      AND e.status = 'ACTIVE'
     WHERE som.designation_id = ?
       AND som.is_active = 1
       AND (? = 0 OR som.team_id = ?)
       AND (? = 0 OR som.branch_id = ?)
       AND (? = 0 OR som.zone_id = ?)
     ORDER BY
       (som.branch_id IS NOT NULL) DESC,
       (som.zone_id IS NOT NULL) DESC,
       (som.team_id IS NOT NULL) DESC,
       som.id ASC
     LIMIT 1`,
    [
      parentDesignationId,
      Number(rule.same_team_only) || 0,
      teamId || null,
      Number(rule.same_branch_only) || 0,
      branchId || null,
      Number(rule.same_zone_only) || 0,
      zoneId || null,
    ]
  );

  if (rows[0]?.employee_id) return rows[0].employee_id;

  if (!isGlobalManagerDesignation(rule.designation_name, rule.manager_scope)) {
    return null;
  }

  const [globalRows] = await conn.query(
    `SELECT som.employee_id
     FROM scope_owner_mapping som
     INNER JOIN employees e
       ON e.id = som.employee_id
      AND e.status = 'ACTIVE'
     WHERE som.designation_id = ?
       AND som.is_active = 1
     ORDER BY
       (som.branch_id IS NULL) DESC,
       (som.zone_id IS NULL) DESC,
       (som.team_id IS NULL) DESC,
       som.id ASC
     LIMIT 1`,
    [parentDesignationId]
  );

  return globalRows[0]?.employee_id || null;
}

async function resolveAutoManagerId(conn, { teamId, branchId, zoneId, designationId }) {
  if (!designationId) return null;

  await ensureEmployeeHierarchyRuntime(conn);

  const visited = new Set();

  const resolveFromDesignation = async (childDesignationId) => {
    if (!childDesignationId || visited.has(childDesignationId)) return null;
    visited.add(childDesignationId);

    const parentRules = await getParentManagerRules(conn, childDesignationId);

    for (const rule of parentRules) {
      const directOwnerId = await findScopeOwnerEmployee(conn, {
        parentDesignationId: rule.parent_designation_id,
        rule,
        teamId,
        branchId,
        zoneId,
      });

      if (directOwnerId) return directOwnerId;

      const higherOwnerId = await resolveFromDesignation(rule.parent_designation_id);
      if (higherOwnerId) return higherOwnerId;
    }

    return null;
  };

  return resolveFromDesignation(Number(designationId));
}

async function getNextEmpId(conn, joiningStatus) {
  const prefix = joiningStatus === "TRAINEE" ? "T" : "ICEEMP";
  const [last] = await conn.query(
    "SELECT emp_id FROM employees WHERE emp_id LIKE ? ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  );

  const next = last.length
    ? parseInt(String(last[0].emp_id).replace(prefix, ""), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

function buildLookupMaps(data) {
  const lookup = {
    branchById: new Map(),
    branchByName: new Map(),
    branchByShortName: new Map(),
    teamById: new Map(),
    teamByName: new Map(),
    designationById: new Map(),
    designationsByName: new Map(),
    employeesByEmpId: new Map(),
    areaById: new Map(),
    areasByName: new Map(),
    zonesById: new Map(),
    zonesByName: new Map(),
    existingEmails: new Set(),
    existingEmpIds: new Set(),
  };

  data.branches.forEach((row) => {
    lookup.branchById.set(String(row.id), row);
    lookup.branchByName.set(normalizeText(row.branch_name), row);
    if (row.short_name) {
      lookup.branchByShortName.set(normalizeText(row.short_name), row);
    }
  });

  data.teams.forEach((row) => {
    lookup.teamById.set(String(row.id), row);
    lookup.teamByName.set(normalizeText(row.team_name), row);
  });

  data.designations.forEach((row) => {
    lookup.designationById.set(String(row.id), row);
    const key = normalizeText(row.designation_name);
    if (!lookup.designationsByName.has(key)) {
      lookup.designationsByName.set(key, []);
    }
    lookup.designationsByName.get(key).push(row);
  });

  data.employees.forEach((row) => {
    lookup.employeesByEmpId.set(normalizeText(row.emp_id), row);
    if (row.emp_id) lookup.existingEmpIds.add(normalizeText(row.emp_id));
    if (row.email) lookup.existingEmails.add(normalizeText(row.email));
  });

  data.areas.forEach((row) => {
    lookup.areaById.set(String(row.id), row);
    const key = normalizeText(row.area_name);
    if (!lookup.areasByName.has(key)) {
      lookup.areasByName.set(key, []);
    }
    lookup.areasByName.get(key).push(row);
  });

  data.zones.forEach((row) => {
    lookup.zonesById.set(String(row.id), row);
    lookup.zonesByName.set(normalizeText(row.zone_name), row);
  });

  return lookup;
}

async function loadImportData(conn) {
  const [branches] = await conn.query(`
    SELECT b.id, b.branch_name, b.short_name, b.zone_id, z.zone_name
    FROM branches b
    LEFT JOIN zones z ON b.zone_id = z.id
  `);
  const [teams] = await conn.query("SELECT id, team_name FROM teams");
  const [designations] = await conn.query(
    "SELECT id, team_id, designation_name FROM designations"
  );
  const [employees] = await conn.query(
    "SELECT id, emp_id, email FROM employees"
  );
  const [areas] = await conn.query(
    `SELECT a.id, a.area_name, a.branch_id, b.branch_name
     FROM areas a
     LEFT JOIN branches b ON a.branch_id = b.id`
  );
  const [zones] = await conn.query("SELECT id, zone_name FROM zones");

  return buildLookupMaps({ branches, teams, designations, employees, areas, zones });
}

function resolveBranch(token, lookup) {
  const value = String(token || "").trim();
  if (!value) return null;
  return (
    lookup.branchById.get(value) ||
    lookup.branchByName.get(normalizeText(value)) ||
    lookup.branchByShortName.get(normalizeText(value)) ||
    null
  );
}

function resolveZone(token, lookup) {
  const value = String(token || "").trim();
  if (!value) return null;
  return (
    lookup.zonesById.get(value) ||
    lookup.zonesByName.get(normalizeText(value)) ||
    null
  );
}

function resolveTeam(token, lookup) {
  const value = String(token || "").trim();
  if (!value) return null;
  return (
    lookup.teamById.get(value) ||
    lookup.teamByName.get(normalizeText(value)) ||
    null
  );
}

function resolveDesignation(token, teamId, lookup) {
  const value = String(token || "").trim();
  if (!value) return null;

  const exactById = lookup.designationById.get(value);
  if (exactById) {
    if (teamId && Number(exactById.team_id) !== Number(teamId)) {
      throw new Error("Designation does not belong to the selected team");
    }
    return exactById;
  }

  const matches = lookup.designationsByName.get(normalizeText(value)) || [];
  if (!matches.length) return null;

  if (!teamId && matches.length > 1) {
    throw new Error(`Designation '${value}' is mapped to multiple teams. Use designation id or correct team`);
  }

  const matched = teamId
    ? matches.find((row) => Number(row.team_id) === Number(teamId))
    : matches[0];

  if (!matched) {
    throw new Error("Designation does not belong to the selected team");
  }

  return matched;
}

function resolveArea(token, lookup) {
  const value = String(token || "").trim();
  if (!value) return null;

  const byId = lookup.areaById.get(value);
  if (byId) return byId;

  const byName = lookup.areasByName.get(normalizeText(value)) || [];
  if (byName.length > 1) {
    throw new Error(`Area '${value}' is duplicated across branches. Use unique area name or area id`);
  }
  return byName[0] || null;
}

function resolveAccessBranches(value, primaryBranchId, lookup) {
  const tokens = splitAccessValues(value);
  if (!tokens.length) {
    return primaryBranchId ? [primaryBranchId] : [];
  }

  if (tokens.some((token) => normalizeText(token) === "ALL")) {
    return [...lookup.branchById.values()].map((row) => Number(row.id));
  }

  const ids = new Set(primaryBranchId ? [Number(primaryBranchId)] : []);
  tokens.forEach((token) => {
    const branch = resolveBranch(token, lookup);
    if (!branch) {
      throw new Error(`Branch access '${token}' not found`);
    }
    ids.add(Number(branch.id));
  });
  return [...ids];
}

function resolveAreaAccess(value, lookup) {
  const tokens = splitAccessValues(value);
  if (!tokens.length) return [];

  if (tokens.some((token) => normalizeText(token) === "ALL")) {
    return [...lookup.areaById.values()].map((row) => Number(row.id));
  }

  const ids = new Set();
  tokens.forEach((token) => {
    const area = resolveArea(token, lookup);
    if (!area) {
      throw new Error(`ERP area '${token}' not found`);
    }
    ids.add(Number(area.id));
  });
  return [...ids];
}

async function insertBranchAccess(conn, empId, primaryBranchId, crmBranchIds, ticketBranchIds) {
  await conn.query(
    "INSERT INTO employee_branches (emp_id, branch_id, access_type, module) VALUES (?,?,'PRIMARY','ALL')",
    [empId, primaryBranchId]
  );

  for (const branchId of crmBranchIds) {
    await conn.query(
      "INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module) VALUES (?,?,'CRM','CRM')",
      [empId, branchId]
    );
  }

  for (const branchId of ticketBranchIds) {
    await conn.query(
      "INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module) VALUES (?,?,'SUPPORT','TICKETING')",
      [empId, branchId]
    );
    try {
      await conn.query(
        "INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module) VALUES (?,?,'SUPPORT','LEAD')",
        [empId, branchId]
      );
    } catch (error) {
      if (!["ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", "WARN_DATA_TRUNCATED"].includes(error.code)) {
        throw error;
      }
    }
  }
}

async function insertAreaAccess(conn, empId, areaIds) {
  if (!areaIds.length) return;
  await conn.query(
    "INSERT IGNORE INTO employee_areas (emp_id, area_id) VALUES ?",
    [areaIds.map((areaId) => [empId, areaId])]
  );
}

async function prepareRowForInsert(conn, row, lookup, currentUser) {
  await ensureEmployeeHierarchyRuntime(conn);
  const joiningStatus = normalizeText(getField(row, ["joining_status"])) || "TRAINEE";
  if (!VALID_JOINING_STATUS.has(joiningStatus)) {
    throw new Error("joining_status must be TRAINEE or PERMANENT");
  }

  const name = String(getField(row, ["name"])).trim();
  const email = String(getField(row, ["email"])).trim().toLowerCase();
  const dob = normalizeDateInput(getField(row, ["dob"]));
  const phone = String(getField(row, ["phone"])).trim();

  if (!name) throw new Error("name is required");
  if (!email) throw new Error("email is required");
  if (!dob) throw new Error("dob is required");
  if (!phone) throw new Error("phone is required");

  if (lookup.existingEmails.has(normalizeText(email))) {
    throw new Error(`Email '${email}' already exists`);
  }

  let empId = String(getField(row, ["emp_id"])).trim();
  if (empId) {
    if (lookup.existingEmpIds.has(normalizeText(empId))) {
      throw new Error(`Employee ID '${empId}' already exists`);
    }
  } else {
    empId = await getNextEmpId(conn, joiningStatus);
    while (lookup.existingEmpIds.has(normalizeText(empId))) {
      empId = await getNextEmpId(conn, joiningStatus);
    }
  }

  const role = normalizeText(getField(row, ["role"])) || "USER_ACCOUNT";
  if (!VALID_ROLE.has(role)) {
    throw new Error("role must be SUPER_ADMIN, ADMIN, or USER_ACCOUNT");
  }
  if (currentUser.role !== "SUPER_ADMIN" && ["SUPER_ADMIN", "ADMIN"].includes(role)) {
    throw new Error("Only SUPER_ADMIN can upload ADMIN or SUPER_ADMIN employees");
  }

  const status = normalizeText(getField(row, ["status"])) || "ACTIVE";
  if (!VALID_STATUS.has(status)) {
    throw new Error("status must be ACTIVE, RELIEVED, or DEACTIVATED");
  }

  const genderText = normalizeText(getField(row, ["gender"]));
  const gender = genderText ? (VALID_GENDER.has(genderText) ? genderText : null) : null;
  if (genderText && !gender) throw new Error("gender must be MALE, FEMALE, or OTHERS");

  const maritalText = normalizeText(getField(row, ["marital_status"]));
  const maritalStatus = maritalText
    ? VALID_MARITAL_STATUS.has(maritalText)
      ? maritalText
      : null
    : null;
  if (maritalText && !maritalStatus) {
    throw new Error("marital_status must be SINGLE, MARRIED, DIVORCED, or WIDOWED");
  }

  const team = resolveTeam(getField(row, ["team", "team_name", "team_id"]), lookup);
  if (!team) throw new Error("team is required and must exist");

  const designation = resolveDesignation(
    getField(row, ["designation", "designation_name", "designation_id"]),
    team.id,
    lookup
  );
  if (!designation) throw new Error("designation is required and must exist");

  const primaryBranch = resolveBranch(
    getField(row, ["primary_branch", "branch", "branch_name", "branch_id"]),
    lookup
  );
  if (!primaryBranch) throw new Error("primary_branch is required and must exist");

  const zoneValue = getField(row, ["zone", "zone_name", "zone_id"]);
  if (zoneValue) {
    const zone = resolveZone(zoneValue, lookup);
    if (!zone) throw new Error(`zone '${zoneValue}' not found`);
    if (Number(zone.id) !== Number(primaryBranch.zone_id)) {
      throw new Error("Selected zone does not match the primary branch");
    }
  }

  const managerEmpId = normalizeText(getField(row, ["manager_emp_id", "manager", "reporting_manager_emp_id"]));
  let managerId = null;
  if (managerEmpId) {
    const manager = lookup.employeesByEmpId.get(managerEmpId);
    if (!manager) throw new Error(`manager_emp_id '${managerEmpId}' not found`);
    managerId = manager.id;
  } else {
    managerId = await resolveAutoManagerId(conn, {
      teamId: Number(team.id),
      branchId: Number(primaryBranch.id),
      zoneId: Number(primaryBranch.zone_id),
      designationId: Number(designation.id),
    });
  }

  const passwordText = String(getField(row, ["password"])).trim();
  const rawPassword = passwordText || `Info@${empId.replace(/[^0-9]/g, "").slice(-4) || "1234"}`;
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const crmBranchIds = resolveAccessBranches(
    getField(row, ["crm_branch_access", "crm_access", "crm_branch_ids"]),
    primaryBranch.id,
    lookup
  );

  const ticketBranchIds = resolveAccessBranches(
    getField(row, ["ticket_lead_branch_access", "ticket_access", "ticket_branch_access", "lead_branch_access"]),
    primaryBranch.id,
    lookup
  );

  const areaIds = resolveAreaAccess(
    getField(row, ["erp_area_access", "erp_access", "area_access", "erp_area_ids"]),
    lookup
  );

  return {
    empId,
    rawPassword,
    values: {
      emp_id: empId,
      joining_status: joiningStatus,
      name,
      father_name: String(getField(row, ["father_name"])).trim() || null,
      gender,
      email,
      password: hashedPassword,
      dob,
      joining_date: normalizeDateInput(getField(row, ["joining_date"])) || null,
      phone,
      emergency_contact: String(getField(row, ["emergency_contact"])).trim() || null,
      marital_status: maritalStatus,
      experience: String(getField(row, ["experience"])).trim() || null,
      qualification: String(getField(row, ["qualification"])).trim() || null,
      permanent_address: String(getField(row, ["permanent_address"])).trim() || null,
      temporary_address: String(getField(row, ["temporary_address"])).trim() || null,
      role,
      team_id: Number(team.id),
      designation_id: Number(designation.id),
      manager_id: managerId,
      branch_id: Number(primaryBranch.id),
      zone_id: Number(primaryBranch.zone_id),
      status,
    },
    access: {
      primaryBranchId: Number(primaryBranch.id),
      crmBranchIds,
      ticketBranchIds,
      areaIds,
    },
  };
}

async function insertEmployeeRow(conn, prepared) {
  const {
    emp_id,
    joining_status,
    name,
    father_name,
    gender,
    email,
    password,
    dob,
    joining_date,
    phone,
    emergency_contact,
    marital_status,
    experience,
    qualification,
    permanent_address,
    temporary_address,
    role,
    team_id,
    designation_id,
    manager_id,
    branch_id,
    zone_id,
    status,
  } = prepared.values;

  const [result] = await conn.query(
    `INSERT INTO employees (
      emp_id, joining_status, name, father_name, gender,
      email, password, dob, joining_date,
      phone, emergency_contact, marital_status, experience,
      qualification, permanent_address, temporary_address,
      role, team_id, designation_id, manager_id,
      branch_id, zone_id, status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      emp_id,
      joining_status,
      name,
      father_name,
      gender,
      email,
      password,
      dob,
      joining_date,
      phone,
      emergency_contact,
      marital_status,
      experience,
      qualification,
      permanent_address,
      temporary_address,
      role,
      team_id,
      designation_id,
      manager_id,
      branch_id,
      zone_id,
      status,
    ]
  );

  await insertBranchAccess(
    conn,
    emp_id,
    prepared.access.primaryBranchId,
    prepared.access.crmBranchIds,
    prepared.access.ticketBranchIds
  );

  await insertAreaAccess(conn, emp_id, prepared.access.areaIds);
  await assignDefaultPermissions(conn, emp_id, role);
  return result.insertId || null;
}

exports.downloadEmployeeBulkTemplate = async (req, res) => {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_SAMPLE_ROW]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="employee-bulk-upload-template.csv"'
  );
  res.send(`\uFEFF${csv}`);
};

function sendTemplateCsv(res, fileName, headers, sampleRow) {
  const csv = [headers, sampleRow]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(`\uFEFF${csv}`);
}

exports.bulkUploadEmployees = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No employee rows found in the upload file" });
    }

    if (rows.length > 2000) {
      return res.status(400).json({ message: "Bulk upload is limited to 2000 rows per file" });
    }

    const lookup = await loadImportData(conn);
    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        await conn.beginTransaction();

        const prepared = await prepareRowForInsert(conn, row, lookup, req.user);
        const insertId = await insertEmployeeRow(conn, prepared);
        await conn.commit();

        lookup.existingEmpIds.add(normalizeText(prepared.empId));
        lookup.existingEmails.add(normalizeText(prepared.values.email));
        lookup.employeesByEmpId.set(normalizeText(prepared.empId), {
          id: insertId,
          emp_id: prepared.empId,
          email: prepared.values.email,
        });

        inserted.push({
          row_number: row.__rowNumber,
          emp_id: prepared.empId,
          name: prepared.values.name,
          email: prepared.values.email,
          password: prepared.rawPassword,
        });
      } catch (error) {
        await conn.rollback();
        failed.push({
          row_number: row.__rowNumber,
          emp_id: getField(row, ["emp_id"]),
          name: getField(row, ["name"]),
          email: getField(row, ["email"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json({
      message: failed.length
        ? "Bulk upload completed with some failed rows"
        : "Bulk upload completed successfully",
      summary: {
        total_rows: rows.length,
        inserted_count: inserted.length,
        failed_count: failed.length,
      },
      inserted,
      failed,
      template_fields: TEMPLATE_HEADERS,
    });
  } catch (error) {
    console.error("bulkUploadEmployees:", error);
    return res.status(500).json({
      message: error.message || "Bulk upload failed",
    });
  } finally {
    conn.release();
  }
};

exports.downloadBranchBulkTemplate = async (req, res) => {
  sendTemplateCsv(
    res,
    "branch-bulk-upload-template.csv",
    BRANCH_TEMPLATE_HEADERS,
    BRANCH_TEMPLATE_SAMPLE_ROW
  );
};

exports.bulkUploadBranches = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No branch rows found in the upload file" });
    }

    const [zones] = await conn.query("SELECT id, zone_name FROM zones");
    const [branches] = await conn.query("SELECT id, branch_name, short_name, zone_id FROM branches");

    const zoneById = new Map(zones.map((row) => [String(row.id), row]));
    const zoneByName = new Map(zones.map((row) => [normalizeText(row.zone_name), row]));
    const existingBranchKeys = new Set(
      branches.map((row) => `${normalizeText(row.branch_name)}__${Number(row.zone_id)}`)
    );

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const branchName = String(getField(row, ["branch_name", "name"])).trim();
        const shortName = String(getField(row, ["short_name"])).trim() || null;
        const zoneValue = String(getField(row, ["zone", "zone_name", "zone_id"])).trim();

        if (!branchName) throw new Error("branch_name is required");
        if (!zoneValue) throw new Error("zone is required");

        const zone = zoneById.get(zoneValue) || zoneByName.get(normalizeText(zoneValue));
        if (!zone) throw new Error(`zone '${zoneValue}' not found`);

        const duplicateKey = `${normalizeText(branchName)}__${Number(zone.id)}`;
        if (existingBranchKeys.has(duplicateKey)) {
          throw new Error("Branch already exists in the selected zone");
        }

        await conn.query(
          "INSERT INTO branches (branch_name, short_name, zone_id) VALUES (?, ?, ?)",
          [branchName, shortName, zone.id]
        );

        existingBranchKeys.add(duplicateKey);
        inserted.push({
          row_number: row.__rowNumber,
          name: branchName,
          short_name: shortName || "-",
          zone: zone.zone_name,
        });
      } catch (error) {
        failed.push({
          row_number: row.__rowNumber,
          name: getField(row, ["branch_name", "name"]),
          zone: getField(row, ["zone", "zone_name", "zone_id"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json({
      message: failed.length
        ? "Branch bulk upload completed with some failed rows"
        : "Branch bulk upload completed successfully",
      summary: {
        total_rows: rows.length,
        inserted_count: inserted.length,
        failed_count: failed.length,
      },
      inserted,
      failed,
    });
  } catch (error) {
    console.error("bulkUploadBranches:", error);
    return res.status(500).json({ message: error.message || "Branch bulk upload failed" });
  } finally {
    conn.release();
  }
};

exports.downloadAreaBulkTemplate = async (req, res) => {
  sendTemplateCsv(
    res,
    "area-bulk-upload-template.csv",
    AREA_TEMPLATE_HEADERS,
    AREA_TEMPLATE_SAMPLE_ROW
  );
};

exports.bulkUploadAreas = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No area rows found in the upload file" });
    }

    const [branches] = await conn.query(
      `SELECT b.id, b.branch_name, b.short_name, z.zone_name
       FROM branches b
       LEFT JOIN zones z ON b.zone_id = z.id`
    );
    const [areas] = await conn.query("SELECT id, area_name, branch_id FROM areas");

    const branchById = new Map(branches.map((row) => [String(row.id), row]));
    const branchByName = new Map(branches.map((row) => [normalizeText(row.branch_name), row]));
    const branchByShortName = new Map(
      branches.filter((row) => row.short_name).map((row) => [normalizeText(row.short_name), row])
    );
    const existingAreaKeys = new Set(
      areas.map((row) => `${normalizeText(row.area_name)}__${Number(row.branch_id)}`)
    );

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const areaName = String(getField(row, ["area_name", "name"])).trim();
        const branchValue = String(getField(row, ["branch", "branch_name", "branch_id"])).trim();

        if (!areaName) throw new Error("area_name is required");
        if (!branchValue) throw new Error("branch is required");

        const branch =
          branchById.get(branchValue) ||
          branchByName.get(normalizeText(branchValue)) ||
          branchByShortName.get(normalizeText(branchValue));

        if (!branch) throw new Error(`branch '${branchValue}' not found`);

        const duplicateKey = `${normalizeText(areaName)}__${Number(branch.id)}`;
        if (existingAreaKeys.has(duplicateKey)) {
          throw new Error("Area already exists in the selected branch");
        }

        await conn.query(
          "INSERT INTO areas (area_name, branch_id) VALUES (?, ?)",
          [areaName, branch.id]
        );

        existingAreaKeys.add(duplicateKey);
        inserted.push({
          row_number: row.__rowNumber,
          name: areaName,
          branch: branch.branch_name,
          zone: branch.zone_name || "-",
        });
      } catch (error) {
        failed.push({
          row_number: row.__rowNumber,
          name: getField(row, ["area_name", "name"]),
          branch: getField(row, ["branch", "branch_name", "branch_id"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json({
      message: failed.length
        ? "Area bulk upload completed with some failed rows"
        : "Area bulk upload completed successfully",
      summary: {
        total_rows: rows.length,
        inserted_count: inserted.length,
        failed_count: failed.length,
      },
      inserted,
      failed,
    });
  } catch (error) {
    console.error("bulkUploadAreas:", error);
    return res.status(500).json({ message: error.message || "Area bulk upload failed" });
  } finally {
    conn.release();
  }
};

exports.downloadTeamBulkTemplate = async (req, res) => {
  sendTemplateCsv(
    res,
    "team-bulk-upload-template.csv",
    TEAM_TEMPLATE_HEADERS,
    TEAM_TEMPLATE_SAMPLE_ROW
  );
};

exports.bulkUploadTeams = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No team rows found in the upload file" });
    }

    const [teams] = await conn.query("SELECT id, team_name FROM teams");
    const existingTeamNames = new Set(teams.map((row) => normalizeText(row.team_name)));

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const teamName = String(getField(row, ["team_name", "name"])).trim();
        if (!teamName) throw new Error("team_name is required");

        const normalized = normalizeText(teamName);
        if (existingTeamNames.has(normalized)) {
          throw new Error("Team already exists");
        }

        await conn.query("INSERT INTO teams (team_name) VALUES (?)", [teamName]);
        existingTeamNames.add(normalized);

        inserted.push({
          row_number: row.__rowNumber,
          name: teamName,
        });
      } catch (error) {
        failed.push({
          row_number: row.__rowNumber,
          name: getField(row, ["team_name", "name"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json({
      message: failed.length
        ? "Team bulk upload completed with some failed rows"
        : "Team bulk upload completed successfully",
      summary: {
        total_rows: rows.length,
        inserted_count: inserted.length,
        failed_count: failed.length,
      },
      inserted,
      failed,
    });
  } catch (error) {
    console.error("bulkUploadTeams:", error);
    return res.status(500).json({ message: error.message || "Team bulk upload failed" });
  } finally {
    conn.release();
  }
};

exports.downloadDesignationBulkTemplate = async (req, res) => {
  sendTemplateCsv(
    res,
    "designation-bulk-upload-template.csv",
    DESIGNATION_TEMPLATE_HEADERS,
    DESIGNATION_TEMPLATE_SAMPLE_ROW
  );
};

exports.bulkUploadDesignations = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No designation rows found in the upload file" });
    }

    const [teams] = await conn.query("SELECT id, team_name FROM teams");
    const [designations] = await conn.query(
      "SELECT id, designation_name, team_id, level FROM designations"
    );

    const teamById = new Map(teams.map((row) => [String(row.id), row]));
    const teamByName = new Map(teams.map((row) => [normalizeText(row.team_name), row]));
    const existingDesignationKeys = new Set(
      designations.map((row) => `${normalizeText(row.designation_name)}__${Number(row.team_id)}`)
    );

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const designationName = String(getField(row, ["designation_name", "name"])).trim();
        const teamValue = String(getField(row, ["team", "team_name", "team_id"])).trim();
        const levelValue = String(getField(row, ["level"])).trim();

        if (!designationName) throw new Error("designation_name is required");
        if (!teamValue) throw new Error("team is required");
        if (!levelValue) throw new Error("level is required");

        const team =
          teamById.get(teamValue) ||
          teamByName.get(normalizeText(teamValue));
        if (!team) throw new Error(`team '${teamValue}' not found`);

        const level = Number(levelValue);
        if (!Number.isInteger(level) || level <= 0) {
          throw new Error("level must be a positive integer");
        }

        const duplicateKey = `${normalizeText(designationName)}__${Number(team.id)}`;
        if (existingDesignationKeys.has(duplicateKey)) {
          throw new Error("Designation already exists for the selected team");
        }

        await conn.query(
          "INSERT INTO designations (designation_name, team_id, level) VALUES (?, ?, ?)",
          [designationName, team.id, level]
        );

        existingDesignationKeys.add(duplicateKey);
        inserted.push({
          row_number: row.__rowNumber,
          name: designationName,
          team: team.team_name,
          level,
        });
      } catch (error) {
        failed.push({
          row_number: row.__rowNumber,
          name: getField(row, ["designation_name", "name"]),
          team: getField(row, ["team", "team_name", "team_id"]),
          level: getField(row, ["level"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json({
      message: failed.length
        ? "Designation bulk upload completed with some failed rows"
        : "Designation bulk upload completed successfully",
      summary: {
        total_rows: rows.length,
        inserted_count: inserted.length,
        failed_count: failed.length,
      },
      inserted,
      failed,
    });
  } catch (error) {
    console.error("bulkUploadDesignations:", error);
    return res.status(500).json({ message: error.message || "Designation bulk upload failed" });
  } finally {
    conn.release();
  }
};

exports.downloadManagerMappingBulkTemplate = async (req, res) => {
  sendTemplateCsv(
    res,
    "manager-mapping-bulk-upload-template.csv",
    MANAGER_MAPPING_TEMPLATE_HEADERS,
    MANAGER_MAPPING_TEMPLATE_SAMPLE_ROW
  );
};

exports.bulkUploadManagerMappings = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No manager mapping rows found in the upload file" });
    }

    const [designationRows] = await conn.query(`
      SELECT d.id, d.designation_name, d.team_id, d.level, d.is_manager, t.team_name
      FROM designations d
      INNER JOIN teams t ON d.team_id = t.id
    `);
    const [existingRules] = await conn.query(`
      SELECT child_designation_id, parent_designation_id
      FROM designation_reporting_rules
    `);

    const designationLookup = createDesignationLookup(designationRows);
    const existingRuleKeys = new Set(
      existingRules.map((row) => `${Number(row.child_designation_id)}__${Number(row.parent_designation_id)}`)
    );

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const childTeamValue = getField(row, ["child_team", "child_team_name", "child_team_id"]);
        const childDesignationValue = getField(row, ["child_designation", "child_designation_name", "child_designation_id"]);
        const parentTeamValue = getField(row, ["parent_team", "parent_team_name", "parent_team_id"]);
        const parentDesignationValue = getField(row, ["parent_designation", "parent_designation_name", "parent_designation_id"]);
        const { scopeType, same_team_only, same_branch_only, same_zone_only } = buildManagerScopeFlags(
          getField(row, ["scope_type", "scope", "scope_rule"])
        );
        const isActive = toUploadFlag(getField(row, ["is_active", "active", "status"]), 1);

        const childDesignation = resolveDesignationForMappingUpload({
          value: childDesignationValue,
          teamValue: childTeamValue,
          lookup: designationLookup,
          fieldLabel: "child_designation",
        });
        const parentDesignation = resolveDesignationForMappingUpload({
          value: parentDesignationValue,
          teamValue: parentTeamValue,
          lookup: designationLookup,
          fieldLabel: "parent_designation",
        });

        if (Number(childDesignation.id) === Number(parentDesignation.id)) {
          throw new Error("Child and Parent designation cannot be the same");
        }

        if (Number(parentDesignation.level) <= Number(childDesignation.level)) {
          throw new Error("Parent designation must have a higher level than child designation");
        }

        const ruleKey = `${Number(childDesignation.id)}__${Number(parentDesignation.id)}`;
        if (existingRuleKeys.has(ruleKey)) {
          throw new Error("Manager mapping already exists for this child and parent designation");
        }

        if (Number(parentDesignation.is_manager) !== 1) {
          await conn.query(
            "UPDATE designations SET is_manager = 1 WHERE id = ?",
            [parentDesignation.id]
          );
          parentDesignation.is_manager = 1;
        }

        await conn.query(
          `INSERT INTO designation_reporting_rules (
            child_designation_id,
            parent_designation_id,
            same_team_only,
            same_branch_only,
            same_zone_only,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            childDesignation.id,
            parentDesignation.id,
            same_team_only,
            same_branch_only,
            same_zone_only,
            isActive,
          ]
        );

        existingRuleKeys.add(ruleKey);
        inserted.push({
          row_number: row.__rowNumber,
          child_team: childDesignation.team_name,
          child_designation: childDesignation.designation_name,
          parent_team: parentDesignation.team_name,
          parent_designation: parentDesignation.designation_name,
          scope_type: scopeType,
          is_active: isActive ? "Active" : "Inactive",
        });
      } catch (error) {
        failed.push({
          row_number: row.__rowNumber,
          child_team: getField(row, ["child_team", "child_team_name", "child_team_id"]),
          child_designation: getField(row, ["child_designation", "child_designation_name", "child_designation_id"]),
          parent_team: getField(row, ["parent_team", "parent_team_name", "parent_team_id"]),
          parent_designation: getField(row, ["parent_designation", "parent_designation_name", "parent_designation_id"]),
          scope_type: getField(row, ["scope_type", "scope", "scope_rule"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json(
      buildResponsePayload(
        rows,
        inserted,
        failed,
        "Manager mapping bulk upload completed successfully",
        "Manager mapping bulk upload completed with some failed rows"
      )
    );
  } catch (error) {
    console.error("bulkUploadManagerMappings:", error);
    return res.status(500).json({ message: error.message || "Manager mapping bulk upload failed" });
  } finally {
    conn.release();
  }
};

exports.downloadScopeOwnerMappingBulkTemplate = async (req, res) => {
  sendTemplateCsv(
    res,
    "scope-owner-mapping-bulk-upload-template.csv",
    SCOPE_OWNER_MAPPING_TEMPLATE_HEADERS,
    SCOPE_OWNER_MAPPING_TEMPLATE_SAMPLE_ROW
  );
};

exports.bulkUploadScopeOwnerMappings = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload file is required" });
  }

  const conn = await db.getConnection();

  try {
    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "No scope owner mapping rows found in the upload file" });
    }

    const [teamRows] = await conn.query("SELECT id, team_name FROM teams");
    const [zoneRows] = await conn.query("SELECT id, zone_name FROM zones");
    const [branchRows] = await conn.query("SELECT id, branch_name, short_name FROM branches");
    const [designationRows] = await conn.query(`
      SELECT d.id, d.designation_name, d.team_id, d.level, t.team_name
      FROM designations d
      INNER JOIN teams t ON d.team_id = t.id
    `);
    const [employeeRows] = await conn.query(`
      SELECT e.id, e.emp_id, e.name, e.team_id, e.zone_id, e.branch_id, e.designation_id, e.status
      FROM employees e
    `);
    const [existingMappings] = await conn.query(`
      SELECT team_id, zone_id, branch_id, designation_id
      FROM scope_owner_mapping
    `);

    const teamsById = new Map(teamRows.map((row) => [String(row.id), row]));
    const teamsByName = new Map(teamRows.map((row) => [normalizeText(row.team_name), row]));
    const zonesById = new Map(zoneRows.map((row) => [String(row.id), row]));
    const zonesByName = new Map(zoneRows.map((row) => [normalizeText(row.zone_name), row]));
    const branchesById = new Map(branchRows.map((row) => [String(row.id), row]));
    const branchesByName = new Map(branchRows.map((row) => [normalizeText(row.branch_name), row]));
    const branchesByShortName = new Map(
      branchRows.filter((row) => row.short_name).map((row) => [normalizeText(row.short_name), row])
    );
    const designationLookup = createDesignationLookup(designationRows);
    const employeesById = new Map(employeeRows.map((row) => [String(row.id), row]));
    const employeesByEmpId = new Map(employeeRows.map((row) => [normalizeText(row.emp_id), row]));
    const existingMappingKeys = new Set(
      existingMappings.map(
        (row) =>
          `${row.team_id == null ? "null" : Number(row.team_id)}__${row.zone_id == null ? "null" : Number(row.zone_id)}__${row.branch_id == null ? "null" : Number(row.branch_id)}__${Number(row.designation_id)}`
      )
    );

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const teamValue = getField(row, ["team", "team_name", "team_id"]);
        const zoneValue = getField(row, ["zone", "zone_name", "zone_id"]);
        const branchValue = getField(row, ["branch", "branch_name", "branch_id", "branch_short_name"]);
        const designationValue = getField(row, ["designation", "designation_name", "designation_id"]);
        const employeeValue = getField(row, ["employee_emp_id", "employee", "emp_id", "employee_id"]);
        const isActive = toUploadFlag(getField(row, ["is_active", "active", "status"]), 1);

        const team = resolveEntity(teamValue, { byId: teamsById, byName: teamsByName }, "team");
        const zone = resolveEntity(zoneValue, { byId: zonesById, byName: zonesByName }, "zone");

        let branch = null;
        const branchRaw = String(branchValue ?? "").trim();
        if (branchRaw) {
          branch =
            branchesById.get(branchRaw) ||
            branchesByName.get(normalizeText(branchRaw)) ||
            branchesByShortName.get(normalizeText(branchRaw)) ||
            null;
          if (!branch) {
            throw new Error(`branch '${branchRaw}' not found`);
          }
        }

        const designation = resolveDesignationForMappingUpload({
          value: designationValue,
          teamValue,
          lookup: designationLookup,
          fieldLabel: "designation",
        });

        const employeeRaw = String(employeeValue ?? "").trim();
        if (!employeeRaw) {
          throw new Error("employee_emp_id is required");
        }

        const employee =
          employeesById.get(employeeRaw) ||
          employeesByEmpId.get(normalizeText(employeeRaw)) ||
          null;
        if (!employee) {
          throw new Error(`employee '${employeeRaw}' not found`);
        }

        if (employee.status !== "ACTIVE") {
          throw new Error("Selected employee must be active");
        }

        if (Number(employee.designation_id) !== Number(designation.id)) {
          throw new Error("Employee designation must match mapping designation");
        }

        const mappingKey = `${team ? Number(team.id) : "null"}__${zone ? Number(zone.id) : "null"}__${branch ? Number(branch.id) : "null"}__${Number(designation.id)}`;
        if (existingMappingKeys.has(mappingKey)) {
          throw new Error("Scope owner mapping already exists for this scope and designation");
        }

        await conn.query(
          `INSERT INTO scope_owner_mapping (
            team_id, zone_id, branch_id, designation_id, employee_id, is_active
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            team ? team.id : null,
            zone ? zone.id : null,
            branch ? branch.id : null,
            designation.id,
            employee.id,
            isActive,
          ]
        );

        existingMappingKeys.add(mappingKey);
        inserted.push({
          row_number: row.__rowNumber,
          team: team?.team_name || "All",
          zone: zone?.zone_name || "All",
          branch: branch?.branch_name || "All",
          designation: `${designation.team_name} - ${designation.designation_name}`,
          employee_emp_id: employee.emp_id,
          is_active: isActive ? "Active" : "Inactive",
        });
      } catch (error) {
        failed.push({
          row_number: row.__rowNumber,
          team: getField(row, ["team", "team_name", "team_id"]),
          zone: getField(row, ["zone", "zone_name", "zone_id"]),
          branch: getField(row, ["branch", "branch_name", "branch_id", "branch_short_name"]),
          designation: getField(row, ["designation", "designation_name", "designation_id"]),
          employee_emp_id: getField(row, ["employee_emp_id", "employee", "emp_id", "employee_id"]),
          error: error.message || "Upload failed",
        });
      }
    }

    return res.json(
      buildResponsePayload(
        rows,
        inserted,
        failed,
        "Scope owner mapping bulk upload completed successfully",
        "Scope owner mapping bulk upload completed with some failed rows"
      )
    );
  } catch (error) {
    console.error("bulkUploadScopeOwnerMappings:", error);
    return res.status(500).json({ message: error.message || "Scope owner mapping bulk upload failed" });
  } finally {
    conn.release();
  }
};
