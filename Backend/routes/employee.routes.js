const router = require("express").Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const permit = require("../middleware/permission");
const c = require("../controllers/employee.controller");

/* ===========================
   FILE UPLOAD CONFIG
=========================== */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});

const upload = multer({ storage });

/* ===========================
   ZONE ROUTES
=========================== */
router.get("/zones", c.getZones);
router.post("/zones", auth, permit("ZONE_CREATE"), c.createZone);

/* ===========================
   BRANCH ROUTES
=========================== */
router.get("/branches/by-zone/:zoneId", c.getBranchesByZone);
router.post("/branches", auth, permit("BRANCH_CREATE"), c.createBranch);

/* ===========================
   TEAM ROUTES
=========================== */
router.get("/teams", c.getTeams);
router.post("/teams", auth, permit("TEAM_CREATE"), c.createTeam);

/* ===========================
   DESIGNATION ROUTES
=========================== */
router.get("/designations/by-team/:teamId", c.getDesignationsByTeam);
router.post("/designations",auth,permit("DESIGNATION_CREATE"),c.createDesignation);

/* ================= EMPLOYEES ================= */

/* Active */
router.get("/active", auth, c.getActiveEmployees);
router.get("/employees/relieved", auth, c.getRelievedEmployees);

/* 🔥 SINGLE EMPLOYEE (FIXED) */
router.get("/employees/:empId", auth, c.getEmployeeByEmpId);

/* Managers */
router.get("/managers", auth, c.getManagers);

/* Create */
router.post("/employees",auth,permit("EMP_CREATE"),upload.single("profile_photo"),c.createEmployee);

/* Update */
router.put("/employees/:empId",auth,permit("EMP_UPDATE"),c.updateEmployee);

/* Delete */
router.delete("/employees/:empId",auth,permit("EMP_DELETE"),c.deleteEmployee);

module.exports = router;
