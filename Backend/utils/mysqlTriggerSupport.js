const TRIGGER_PRIVILEGE_ERROR_CODES = new Set([
  "ER_BINLOG_CREATE_ROUTINE_NEED_SUPER",
  "ER_SPECIFIC_ACCESS_DENIED_ERROR",
]);

const isTriggerStatement = (statement = "") =>
  /^\s*(CREATE|DROP)\s+TRIGGER\b/i.test(String(statement));

const isTriggerPrivilegeError = (error) =>
  TRIGGER_PRIVILEGE_ERROR_CODES.has(error?.code);

async function runTriggerStatement(connection, statement, context = "trigger setup") {
  try {
    await connection.query(statement);
    return true;
  } catch (error) {
    if (!isTriggerPrivilegeError(error)) {
      throw error;
    }

    const excerpt = String(statement).replace(/\s+/g, " ").trim().slice(0, 140);
    console.warn(
      `Skipping ${context}: MySQL user cannot manage triggers (${error.code}). Statement: ${excerpt}`
    );
    return false;
  }
}

module.exports = {
  isTriggerPrivilegeError,
  isTriggerStatement,
  runTriggerStatement,
};
