require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const {
  isTriggerPrivilegeError,
  isTriggerStatement,
} = require("../utils/mysqlTriggerSupport");

const DEFAULT_PRIMARY_DB_NAME = process.env.DB_NAME || "employee_list";
const DEFAULT_LEADS_DB_NAME = process.env.LEADS_DB_NAME || DEFAULT_PRIMARY_DB_NAME;

const SCHEMA_CONFIGS = [
  {
    dbName: DEFAULT_PRIMARY_DB_NAME,
    schemaFile: path.join(__dirname, "Optimized Sql Query Updated.sql"),
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT || 3306),
    required: true,
  },
  {
    dbName: DEFAULT_LEADS_DB_NAME,
    schemaFile: path.join(__dirname, "Lead_Query.sql"),
    requiredTables: ["leads"],
    host: process.env.LEADS_DB_HOST || process.env.DB_HOST || "localhost",
    user: process.env.LEADS_DB_USER || process.env.DB_USER || "root",
    password: process.env.LEADS_DB_PASSWORD || process.env.DB_PASSWORD || "",
    port: Number(process.env.LEADS_DB_PORT || process.env.DB_PORT || 3306),
    required: DEFAULT_LEADS_DB_NAME === DEFAULT_PRIMARY_DB_NAME
      ? true
      : String(process.env.LEADS_DB_REQUIRED || "false").trim().toLowerCase() === "true",
  },
];

const IGNORED_ERROR_CODES = new Set([
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_DUP_ENTRY",
  "ER_CANT_DROP_FIELD_OR_KEY",
  "ER_TRG_ALREADY_EXISTS",
  "ER_FK_DUP_NAME",
  "ER_BAD_TABLE_ERROR",
  "ER_DB_DROP_EXISTS",
]);

const getSkipReason = (statement) => {
  const normalized = statement.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "empty statement";
  }

  if (/^SELECT\s+/i.test(normalized)) {
    return "report/query statement";
  }

  if (/^CREATE DATABASE\b/i.test(normalized) || /^USE\b/i.test(normalized)) {
    return "database handled by bootstrap";
  }

  if (/CREATE TRIGGER\s+sync_manpower_location/i.test(normalized)) {
    return "legacy incompatible trigger";
  }

  return null;
};

const parseSqlStatements = (sqlContent) => {
  const statements = [];
  const lines = sqlContent.replace(/^\uFEFF/, "").split(/\r?\n/);
  let delimiter = ";";
  let buffer = [];

  const flushBuffer = () => {
    const statement = buffer.join("\n").trim();
    if (statement) {
      statements.push(statement);
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();

    if (/^DELIMITER\s+/i.test(trimmedLine)) {
      flushBuffer();
      delimiter = trimmedLine.split(/\s+/)[1] || ";";
      continue;
    }

    if (trimmedLine.startsWith("--")) {
      continue;
    }

    buffer.push(rawLine);

    if (delimiter === ";" && trimmedLine.endsWith(";")) {
      flushBuffer();
      continue;
    }

    if (delimiter !== ";" && trimmedLine.endsWith(delimiter)) {
      const lastLine = buffer[buffer.length - 1];
      buffer[buffer.length - 1] = lastLine.slice(0, -delimiter.length);
      flushBuffer();
    }
  }

  flushBuffer();
  return statements;
};

const extractExpectedTables = (statements = []) => {
  const tableNames = new Set();

  for (const statement of statements) {
    const normalized = statement.replace(/\s+/g, " ").trim();
    const createMatch = normalized.match(/^CREATE TABLE(?: IF NOT EXISTS)?\s+`?([A-Za-z0-9_]+)`?/i);

    if (createMatch?.[1]) {
      tableNames.add(createMatch[1]);
    }
  }

  return [...tableNames];
};

async function verifyExpectedTables(connection, dbName, expectedTables = []) {
  await connection.query(`USE \`${dbName}\``);

  const [tableRows] = await connection.query("SHOW TABLES");
  const availableTables = new Set(
    tableRows.flatMap((row) => Object.values(row).map((value) => String(value)))
  );

  const missingTables = expectedTables.filter((tableName) => !availableTables.has(tableName));

  if (missingTables.length) {
    throw new Error(
      `Schema verification failed for ${dbName}. Missing tables: ${missingTables.join(", ")}`
    );
  }

  console.log(
    `Schema verified: ${dbName} | tables present: ${expectedTables.length}/${expectedTables.length}`
  );
}

async function runPostBootstrapMaintenance(connection, dbName) {
  if (dbName !== DEFAULT_LEADS_DB_NAME) {
    return;
  }

  await connection.query(`USE \`${dbName}\``);

  const [leadTables] = await connection.query("SHOW TABLES LIKE 'leads'");
  if (!leadTables.length) {
    return;
  }

  await connection.query(`
    ALTER TABLE leads
    MODIFY COLUMN lead_number VARCHAR(40) DEFAULT NULL
  `);

  const [mobileIndexes] = await connection.query("SHOW INDEX FROM leads WHERE Key_name = 'uq_mobile'");
  if (mobileIndexes.length) {
    await connection.query("ALTER TABLE leads DROP INDEX uq_mobile");
  }
}

async function initializeSchema(connection, { dbName, schemaFile }) {
  const schemaName = path.basename(schemaFile);
  const schemaConfig = SCHEMA_CONFIGS.find((item) => item.dbName === dbName && item.schemaFile === schemaFile);

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_bootstrap_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      schema_name VARCHAR(255) NOT NULL UNIQUE,
      schema_signature VARCHAR(64) NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  const [bootstrapLogColumns] = await connection.query("SHOW COLUMNS FROM schema_bootstrap_log LIKE 'schema_signature'");
  if (!bootstrapLogColumns.length) {
    await connection.query("ALTER TABLE schema_bootstrap_log ADD COLUMN schema_signature VARCHAR(64) NULL");
  }

  if (!fs.existsSync(schemaFile)) {
    throw new Error(`Schema file not found: ${schemaFile}`);
  }

  const sqlContent = fs.readFileSync(schemaFile, "utf8");
  const schemaSignature = crypto.createHash("sha256").update(sqlContent).digest("hex");
  const statements = parseSqlStatements(sqlContent);
  const expectedTables = extractExpectedTables(statements);

  const [bootstrapRows] = await connection.query(
    "SELECT id, applied_at, schema_signature FROM schema_bootstrap_log WHERE schema_name = ? LIMIT 1",
    [schemaName]
  );

  let missingRequiredTables = [];
  if (Array.isArray(schemaConfig?.requiredTables) && schemaConfig.requiredTables.length) {
    const [tableRows] = await connection.query("SHOW TABLES");
    const availableTables = new Set(
      tableRows.flatMap((row) => Object.values(row).map((value) => String(value)))
    );
    missingRequiredTables = schemaConfig.requiredTables.filter((tableName) => !availableTables.has(tableName));
  }

  const previousSignature = bootstrapRows[0]?.schema_signature || null;
  const schemaChanged = previousSignature !== schemaSignature;

  if (bootstrapRows.length > 0 && missingRequiredTables.length === 0 && !schemaChanged) {
    await runPostBootstrapMaintenance(connection, dbName);
    await verifyExpectedTables(connection, dbName, expectedTables);
    console.log(
      `Database ready: ${dbName} | schema already initialized from ${schemaName} on ${bootstrapRows[0].applied_at}`
    );
    return;
  }

  if (missingRequiredTables.length > 0) {
    console.log(
      `Database ${dbName} is missing required tables (${missingRequiredTables.join(", ")}). Reapplying ${schemaName}.`
    );
  }
  if (schemaChanged) {
    console.log(`Schema change detected for ${dbName}. Applying latest ${schemaName}.`);
  }

  let applied = 0;
  let skipped = 0;
  const skippedStatements = [];

  for (const statement of statements) {
    const skipReason = getSkipReason(statement);
    if (skipReason) {
      skipped += 1;
      skippedStatements.push({
        reason: skipReason,
        statement: statement.slice(0, 180).replace(/\s+/g, " "),
      });
      continue;
    }

    try {
      await connection.query(statement);
      applied += 1;
    } catch (error) {
      if (IGNORED_ERROR_CODES.has(error.code)) {
        skipped += 1;
        skippedStatements.push({
          reason: error.code,
          statement: statement.slice(0, 180).replace(/\s+/g, " "),
        });
        continue;
      }

      if (isTriggerStatement(statement) && isTriggerPrivilegeError(error)) {
        skipped += 1;
        skippedStatements.push({
          reason: `${error.code} (trigger privileges unavailable)`,
          statement: statement.slice(0, 180).replace(/\s+/g, " "),
        });
        continue;
      }

      const excerpt = statement.slice(0, 180).replace(/\s+/g, " ");
      throw new Error(
        `${error.code || "SQL_ERROR"} while bootstrapping ${dbName} using ${schemaName}: ${excerpt}`
      );
    }
  }

  console.log(`Database ready: ${dbName} | applied: ${applied} | skipped: ${skipped}`);
  if (skippedStatements.length) {
    console.log(`Skipped statements for ${dbName}:`);
    skippedStatements.forEach((item, index) => {
      console.log(`${index + 1}. [${item.reason}] ${item.statement}`);
    });
  }

  await connection.query(
    `
      INSERT INTO schema_bootstrap_log (schema_name, schema_signature)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        schema_signature = VALUES(schema_signature),
        applied_at = CURRENT_TIMESTAMP
    `,
    [schemaName, schemaSignature]
  );
  await runPostBootstrapMaintenance(connection, dbName);
  await verifyExpectedTables(connection, dbName, expectedTables);
}

async function initializeDatabases() {
  for (const schemaConfig of SCHEMA_CONFIGS) {
    let connection;

    try {
      connection = await mysql.createConnection({
        host: schemaConfig.host,
        user: schemaConfig.user,
        password: schemaConfig.password,
        port: Number(schemaConfig.port || 3306),
        multipleStatements: false,
      });

      await initializeSchema(connection, schemaConfig);
    } catch (error) {
      const message =
        error?.code === "ER_DBACCESS_DENIED_ERROR"
          ? `Access denied for user '${schemaConfig.user}' to database '${schemaConfig.dbName}'. ` +
            `Check ${schemaConfig.dbName === DEFAULT_LEADS_DB_NAME ? "LEADS_DB_*" : "DB_*"} credentials and grants.`
          : error.message || String(error);

      if (!schemaConfig.required) {
        console.warn(`Skipping optional database '${schemaConfig.dbName}': ${message}`);
        continue;
      }

      if (error?.code === "ER_DBACCESS_DENIED_ERROR") {
        throw new Error(message);
      }

      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
}

module.exports = initializeDatabases;
