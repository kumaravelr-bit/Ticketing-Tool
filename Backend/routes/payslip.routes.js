const express = require("express");

const auth = require("../middleware/auth");
const { canAccessPayslipModule } = require("../middleware/access");
const controller = require("../controllers/payslip.controller");
const uploadSpreadsheet = require("../middleware/uploadSpreadsheet");

const router = express.Router();

router.use(auth, canAccessPayslipModule);

router.get("/employees", controller.searchEmployees);
router.get("/bulk-upload/template", controller.downloadPayslipBulkTemplate);
router.post("/bulk-upload", uploadSpreadsheet.single("file"), controller.bulkUploadPayslips);
router.get("/", controller.getPayslips);
router.post("/", controller.createPayslip);
router.put("/:id", controller.updatePayslip);
router.delete("/:id", controller.deletePayslip);
router.post("/send-mail", controller.sendPayslipMail);
router.get("/:id", controller.getPayslipById);
router.get("/:id/preview", controller.previewPayslip);
router.get("/:id/download", controller.downloadPayslip);

module.exports = router;
