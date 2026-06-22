const catalyst = require('zcatalyst-sdk-node');

module.exports = async (cronDetails, context) => {
  try {
    const app = catalyst.initialize(context);
    console.log("Nightly Threat Analysis Job Started", new Date().toISOString());
    console.log("Cron details:", JSON.stringify(cronDetails));

    // Simulate scanning FIR database for new patterns
    const zcql = app.zcql();
    const query = `SELECT COUNT(ROWID) FROM FIR WHERE status = 'Open'`;
    
    // In a real scenario, this would aggregate data and possibly write to an Alerts table.
    // We execute a simple query to ensure the DB connection and Catalyst Datastore service is hit.
    const result = await zcql.executeZCQLQuery(query);
    console.log(`Threat Analysis complete. Total Open FIRs scanned:`, result);

    context.closeWithSuccess();
  } catch (err) {
    console.error("Threat Analysis Job Failed:", err);
    context.closeWithFailure();
  }
};
