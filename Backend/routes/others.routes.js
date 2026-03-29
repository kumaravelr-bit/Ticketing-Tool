const router = require("express").Router();

const auth = require("../middleware/auth");
const permit = require("../middleware/permission");
const c = require("../controllers/others.controller");

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
router.put("/branches/:id", auth, permit("BRANCH_UPDATE"), c.updateBranch);
router.delete("/branches/:id", auth, permit("BRANCH_DELETE"), c.deleteBranch);
router.post("/branches", auth, permit("BRANCH_CREATE"), c.createBranch);

/* =========================
   TEAMS
========================= */

router.get("/teams", auth, c.getTeams);
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
router.post("/designations", auth, permit("DESIGNATION_CREATE"), c.createDesignation);
router.put("/designations/:id", auth, permit("DESIGNATION_UPDATE"), c.updateDesignation);
router.delete("/designations/:id", auth, permit("DESIGNATION_DELETE"), c.deleteDesignation);

router.get("/areas/by-branch/:branchId", c.getAreasByBranch);
router.post("/areas", c.createArea);
router.put("/areas/:id", c.updateArea);
router.delete("/areas/:id", c.deleteArea);

module.exports = router;