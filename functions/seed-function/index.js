const catalyst = require('zcatalyst-sdk-node');
module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();
  try {
    const q1 = await zcql.executeZCQLQuery("SELECT ROWID, PoliceStationID FROM CaseMaster LIMIT 2");
    const q2 = await zcql.executeZCQLQuery("SELECT CaseMaster.ROWID, Unit.UnitName FROM CaseMaster INNER JOIN Unit ON CaseMaster.PoliceStationID = Unit.ROWID LIMIT 2");
    const q3 = await zcql.executeZCQLQuery("SELECT CaseMaster.ROWID, CrimeSubHead.CrimeHeadName FROM CaseMaster INNER JOIN CrimeSubHead ON CaseMaster.CrimeMinorHeadID = CrimeSubHead.ROWID LIMIT 2");
    const q4 = await zcql.executeZCQLQuery("SELECT CaseMaster.ROWID, CrimeHead.CrimeGroupName FROM CaseMaster INNER JOIN CrimeHead ON CaseMaster.CrimeMajorHeadID = CrimeHead.ROWID LIMIT 2");
    const q5 = await zcql.executeZCQLQuery("SELECT CaseMaster.ROWID, GravityOffence.LookupValue FROM CaseMaster INNER JOIN GravityOffence ON CaseMaster.GravityOffenceID = GravityOffence.ROWID LIMIT 2");
    const q6 = await zcql.executeZCQLQuery("SELECT CaseMaster.ROWID, CaseStatusMaster.CaseStatusName FROM CaseMaster INNER JOIN CaseStatusMaster ON CaseMaster.CaseStatusID = CaseStatusMaster.ROWID LIMIT 2");
    const q7 = await zcql.executeZCQLQuery("SELECT CaseMaster.ROWID, District.DistrictName FROM CaseMaster INNER JOIN Unit ON CaseMaster.PoliceStationID = Unit.ROWID INNER JOIN District ON Unit.DistrictID = District.ROWID LIMIT 2");
    basicIO.write(JSON.stringify({ q1, q2, q3, q4, q5, q6, q7 }));
  } catch(e) {
    basicIO.write(JSON.stringify({ error: e.message }));
  }
  context.close();
};