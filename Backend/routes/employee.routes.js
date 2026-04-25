const router        = require("express").Router();
const auth          = require("../middleware/auth");
const permit        = require("../middleware/permission");
const { requireRole } = require("../middleware/access");
const c             = require("../controllers/employee.controller");
const bulk          = require("../controllers/employee.bulk.controller");
const uploadProfile = require("../middleware/uploadProfile");
const uploadSpreadsheet = require("../middleware/uploadSpreadsheet");

/* ── Managers dropdown ── */
router.get("/managers",       auth, c.getManagers);
router.get("/options",        auth, (req, res) => res.json({}));
router.get("/bulk-upload/template", auth, permit("EMP_CREATE"), bulk.downloadEmployeeBulkTemplate);
router.post(
  "/bulk-upload",
  auth, permit("EMP_CREATE"),
  uploadSpreadsheet.single("file"),
  bulk.bulkUploadEmployees
);

/* ── Create ── */
router.post(
  "/employees",
  auth, permit("EMP_CREATE"),
  uploadProfile.single("profile_photo"),
  c.createEmployee
);

/* ── Update ── */
router.put(
  "/employees/:empId",
  auth, permit("EMP_UPDATE"),
  uploadProfile.single("profile_photo"),
  c.updateEmployee
);

/* ── Delete (soft, SUPER_ADMIN only) ── */
router.delete("/employees/:empId", auth, requireRole("SUPER_ADMIN"), c.deleteEmployee);

/* ── Reactivate ── */
router.put("/reactivate/:empId", auth, c.reactivateEmployee);

/* ── List ── */
router.get("/employees",         auth, c.getEmployees);
router.get("/active",            auth, c.getActiveEmployees);
router.get("/relieved",          auth, c.getRelievedEmployees);
router.get("/employees/:empId",  auth, c.getEmployeeById);

/* ── Export (same scope as list, no LIMIT) ── */
router.get("/export/active",   auth, c.exportActiveEmployees);
router.get("/export/relieved", auth, c.exportRelievedEmployees);

module.exports = router;
