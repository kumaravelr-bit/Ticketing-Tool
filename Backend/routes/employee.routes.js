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
   EMPLOYEE ROUTES
=========================== */

// Managers (Hierarchy)
router.get("/managers", c.getManagers); // 🔹 Updated endpoint

// Create Employee
router.post(
  "/employees",
  auth,
  permit("EMP_CREATE"),
  upload.single("profile_photo"),
  c.createEmployee
);

// All Employees
router.get("/employees", auth, c.getEmployees);

// Active Employees
router.get("/active", auth, c.getActiveEmployees);



// Update Employee
router.put(
  "/employees/:empId",
  auth,
  permit("EMP_UPDATE"),
  c.updateEmployee
);

// Delete Employee
router.delete(
  "/employees/:empId",
  auth,
  permit("EMP_DELETE"),
  c.deleteEmployee
);

router.get("/employees/:empId", auth, c.getEmployeeById);

// Relieved Employees
router.get("/relieved", auth, c.getRelievedEmployees);

// Reactivate Employee
router.put(
  "/reactivate/:empId",
  auth,
  c.reactivateEmployee
);

module.exports = router;