const catalyst = require('zcatalyst-sdk-node');

module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();
  const userRolesTable = app.datastore().table('UserRoles');

  // Determine intent: if 'role' param is present, it's a POST (save role).
  // basicIO.getHttpMethod() does NOT exist in zcatalyst-sdk-node v3.x —
  // we distinguish GET vs POST by checking for write-specific arguments.
  const userId = basicIO.getArgument('user_id');
  const role = basicIO.getArgument('role');
  const fullName = basicIO.getArgument('full_name');

  try {
    if (role) {
      // ── POST-equivalent: Save role ────────────────────────────
      if (!userId || !role) {
        basicIO.write(JSON.stringify({ error: 'Missing user_id or role' }));
        context.close();
        return;
      }

      await userRolesTable.insertRow({
        catalyst_user_id: String(userId),
        role: role,
        full_name: fullName || '',
      });

      basicIO.write(JSON.stringify({ success: true, role }));
    } else {
      // ── GET-equivalent: Lookup role ───────────────────────────
      if (!userId) {
        basicIO.write(JSON.stringify({ role: null }));
        context.close();
        return;
      }

      const query = `SELECT * FROM UserRoles WHERE catalyst_user_id = '${String(userId)}' LIMIT 1`;
      const rows = await zcql.executeZCQLQuery(query);

      if (rows.length > 0) {
        const flat = {};
        Object.keys(rows[0]).forEach((table) => Object.assign(flat, rows[0][table]));
        basicIO.write(JSON.stringify({ role: flat.role, full_name: flat.full_name }));
      } else {
        basicIO.write(JSON.stringify({ role: null }));
      }
    }
  } catch (err) {
    basicIO.write(JSON.stringify({ error: err.message }));
  }

  context.close();
};