require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mysql = require("mysql2");

const primaryDbName = process.env.DB_NAME || "employee_list";
const leadsDbName = process.env.LEADS_DB_NAME || primaryDbName;

const leadsDb = mysql.createPool({
  host: process.env.LEADS_DB_HOST || process.env.DB_HOST,
  user: process.env.LEADS_DB_USER || process.env.DB_USER,
  password: process.env.LEADS_DB_PASSWORD || process.env.DB_PASSWORD,
  database: leadsDbName,
  port: Number(process.env.LEADS_DB_PORT || process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = leadsDb.promise();
