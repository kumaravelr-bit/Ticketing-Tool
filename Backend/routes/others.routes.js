const router = require("express").Router();

const auth = require("../middleware/auth");
const permit = require("../middleware/permission");
const c = require("../controllers/others.controller");

/* =========================
   ZONES
========================= */

router.get("/zones", auth, c.getZones);
router.post("/zones", auth, permit("ZONE_CREATE"), c.createZone);

/* =========================
   BRANCHES
========================= */

router.get("/branches", auth, c.getBranches);
router.get("/branches/by-zone/:zoneId", auth, c.getBranchesByZone);
router.post("/branches", auth, permit("BRANCH_CREATE"), c.createBranch);

/* =========================
   TEAMS (GLOBAL)
========================= */

router.get("/teams", auth, c.getTeams);
router.post("/teams", auth, permit("TEAM_CREATE"), c.createTeam);

/* =========================
   EMPLOYEES FILTER
========================= */

router.get("/employees/by-branch-team", auth, c.getEmployeesByBranchTeam);

/* =========================
   DESIGNATIONS
========================= */

router.get("/designations/by-team/:teamId", auth, c.getDesignationsByTeam);
router.post("/designations", auth, permit("DESIGNATION_CREATE"), c.createDesignation);

module.exports = router;