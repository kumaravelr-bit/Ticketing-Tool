const express = require("express");
const auth = require("../middleware/auth");
const {
  createLead,
  deleteLead,
  exportLeads,
  getLeadById,
  getLeads,
  updateLead,
} = require("../controllers/newConnection.controller");

const router = express.Router();

router.get("/", getLeads);
router.get("/export/excel", exportLeads);
router.get("/:id", getLeadById);
router.post("/", auth, createLead);
router.put("/:id", auth, updateLead);
router.delete("/:id", auth, deleteLead);

module.exports = router;
