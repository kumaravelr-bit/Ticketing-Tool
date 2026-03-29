require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/employee", require("./routes/employee.routes"));
app.use("/api/others", require("./routes/others.routes"));
app.use("/api/tickets", require("./routes/ticket.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/offer-letter", (req, res, next) => {
  console.log("🔥 Offer Letter Route Hit:", req.method, req.url);
  next();
}, require("./routes/hrd.routes"));
app.use("/api/manpower", require("./routes/manpower.routes"));

/* ================= HEALTH ================= */
app.get("/", (req, res) => {
  res.json({ message: "API Running 🚀" });
});

app.listen(process.env.PORT || 8090, () =>
  console.log("Server running on port", process.env.PORT)
);

module.exports = app;