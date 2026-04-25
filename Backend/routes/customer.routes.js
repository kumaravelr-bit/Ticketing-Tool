const router = require("express").Router();
const auth = require("../middleware/auth");
const permit = require("../middleware/permission");
const c = require("../controllers/customer.controller");

/* ===========================
   CUSTOMER ROUTES
=========================== */

// Filter Options
router.get("/options", auth, c.getFilterOptions);

// All Customers
router.get("/", auth, c.getCustomers);

// Get Customer by ID
router.get("/:id", auth, c.getCustomerById);

// Create Customer
router.post("/", auth, permit("CUSTOMER_CREATE"), c.createCustomer);

// Update Customer
router.put("/:id", auth, permit("CUSTOMER_UPDATE"), c.updateCustomer);

module.exports = router;