const router = require("express").Router();

const auth = require("../middleware/auth");
const permit = require("../middleware/permission");
const c = require("../controllers/others.controller");
const bulk = require("../controllers/employee.bulk.controller");
const uploadSpreadsheet = require("../middleware/uploadSpreadsheet");
const uploadHrManagerSign = require("../middleware/uploadHrManagerSign");

/* =========================
   ZONES
========================= */

router.get("/zones", auth, c.getZones);
router.post("/zones", auth, permit("ZONE_CREATE"), c.createZone);
router.put("/zones/:id", auth, permit("ZONE_UPDATE"), c.updateZone);
router.delete("/zones/:id", auth, permit("ZONE_DELETE"), c.deleteZone);

/* =========================
   BRANCHES
========================= */

router.get("/branches", auth, c.getBranches);
router.get("/branches/by-zone/:zoneId", auth, c.getBranchesByZone);
router.get("/branches/bulk-upload/template", auth, permit("BRANCH_CREATE"), bulk.downloadBranchBulkTemplate);
router.post(
  "/branches/bulk-upload",
  auth, permit("BRANCH_CREATE"),
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadBranches
);
router.put("/branches/:id", auth, permit("BRANCH_UPDATE"), c.updateBranch);
router.delete("/branches/:id", auth, permit("BRANCH_DELETE"), c.deleteBranch);
router.post("/branches", auth, permit("BRANCH_CREATE"), c.createBranch);

/* =========================
   TEAMS
========================= */

router.get("/teams", auth, c.getTeams);
router.get("/teams/bulk-upload/template", auth, permit("TEAM_CREATE"), bulk.downloadTeamBulkTemplate);
router.post(
  "/teams/bulk-upload",
  auth, permit("TEAM_CREATE"),
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadTeams
);
router.post("/teams", auth, permit("TEAM_CREATE"), c.createTeam);
router.put("/teams/:id", auth, permit("TEAM_UPDATE"), c.updateTeam);
router.delete("/teams/:id", auth, permit("TEAM_DELETE"), c.deleteTeam);

/* =========================
   EMPLOYEE FILTER
========================= */

router.get("/employees/by-branch-team", auth, c.getEmployeesByBranchTeam);

/* =========================
   DESIGNATIONS
========================= */

router.get("/designations/by-team/:teamId", auth, c.getDesignationsByTeam);
router.get("/designations", auth, c.getAllDesignations);
router.get("/designations/bulk-upload/template", auth, permit("DESIGNATION_CREATE"), bulk.downloadDesignationBulkTemplate);
router.post(
  "/designations/bulk-upload",
  auth, permit("DESIGNATION_CREATE"),
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadDesignations
);
router.post("/designations", auth, permit("DESIGNATION_CREATE"), c.createDesignation);
router.put("/designations/:id", auth, permit("DESIGNATION_UPDATE"), c.updateDesignation);
router.delete("/designations/:id", auth, permit("DESIGNATION_DELETE"), c.deleteDesignation);

router.get("/designation-manager-rules", auth, c.getDesignationManagerRules);
router.get(
  "/designation-manager-rules/bulk-upload/template",
  auth,
  permit("DESIGNATION_UPDATE"),
  bulk.downloadManagerMappingBulkTemplate
);
router.post(
  "/designation-manager-rules/bulk-upload",
  auth,
  permit("DESIGNATION_UPDATE"),
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadManagerMappings
);
router.post("/designation-manager-rules", auth, permit("DESIGNATION_UPDATE"), c.createDesignationManagerRule);
router.put("/designation-manager-rules/:id", auth, permit("DESIGNATION_UPDATE"), c.updateDesignationManagerRule);
router.delete("/designation-manager-rules/:id", auth, permit("DESIGNATION_UPDATE"), c.deleteDesignationManagerRule);
router.get("/scope-owner-employees", auth, c.getScopeOwnerEmployees);
router.get("/scope-owner-mappings", auth, c.getScopeOwnerMappings);
router.get(
  "/scope-owner-mappings/bulk-upload/template",
  auth,
  permit("DESIGNATION_UPDATE"),
  bulk.downloadScopeOwnerMappingBulkTemplate
);
router.post(
  "/scope-owner-mappings/bulk-upload",
  auth,
  permit("DESIGNATION_UPDATE"),
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadScopeOwnerMappings
);
router.post("/scope-owner-mappings", auth, permit("DESIGNATION_UPDATE"), c.createScopeOwnerMapping);
router.put("/scope-owner-mappings/:id", auth, permit("DESIGNATION_UPDATE"), c.updateScopeOwnerMapping);
router.delete("/scope-owner-mappings/:id", auth, permit("DESIGNATION_UPDATE"), c.deleteScopeOwnerMapping);

router.get("/areas/by-branch/:branchId", auth, c.getAreasByBranch);
router.get("/areas/bulk-upload/template", auth, bulk.downloadAreaBulkTemplate);
router.post(
  "/areas/bulk-upload",
  auth,
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadAreas
);
router.post("/areas", auth, c.createArea);
router.put("/areas/:id", auth, c.updateArea);
router.delete("/areas/:id", auth, c.deleteArea);

router.get("/hr-manager-sign", auth, c.getHrManagerSign);
router.post(
  "/hr-manager-sign",
  auth,
  uploadHrManagerSign.single("file"),
  c.uploadHrManagerSign
);
router.delete("/hr-manager-sign", auth, c.deleteHrManagerSign);

module.exports = router;
