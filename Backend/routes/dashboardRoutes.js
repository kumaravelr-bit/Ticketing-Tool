const express = require("express");
const {
  getDashboard,
  getDashboardCounts,
  getFilters,
  getNldFormOptions,
  masterLookup,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/dashboard", getDashboard);
router.get("/dashboard-counts", getDashboardCounts);
router.get("/filters", getFilters);
router.get("/nld-form-options", getNldFormOptions);
router.get("/master-lookup", masterLookup);

module.exports = router;
