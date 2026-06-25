const catalyst = require('zcatalyst-sdk-node');

module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();
  const datastore = app.datastore();

  const batchStr = basicIO.getArgument('batch');
  if (batchStr === null || batchStr === undefined || batchStr === '') {
    basicIO.write(JSON.stringify({ error: "Missing ?batch=N parameter. Use batch=0 for lookups, batch=1+ for data." }));
    return context.close();
  }
  const batch = parseInt(batchStr, 10);

  const TABLES = {
    Victim: datastore.table('Victim'),
    Accused: datastore.table('Accused'),
    inv_arrestsurrenderaccused: datastore.table('inv_arrestsurrenderaccused'),
    ArrestSurrender: datastore.table('ArrestSurrender'),
    CaseMaster: datastore.table('CaseMaster'),
    CaseStatusMaster: datastore.table('CaseStatusMaster'),
    GravityOffence: datastore.table('GravityOffence'),
    Unit: datastore.table('Unit'),
    District: datastore.table('District'),
    CrimeSubHead: datastore.table('CrimeSubHead'),
    CrimeHead: datastore.table('CrimeHead'),
    CaseCategory: datastore.table('CaseCategory'),
    State: datastore.table('State')
  };

  try {
    if (batch === 0) {
      // 1. Cleanup in reverse order
      const cleanupOrder = [
        'Victim', 'Accused', 'inv_arrestsurrenderaccused', 'ArrestSurrender', 
        'CaseMaster', 'CaseStatusMaster', 'GravityOffence', 'Unit', 'District', 
        'CrimeSubHead', 'CrimeHead', 'CaseCategory', 'State'
      ];
      for (const t of cleanupOrder) {
        try {
          await zcql.executeZCQLQuery(`DELETE FROM ${t} WHERE ROWID > 0`);
        } catch (e) {
          console.error(`Failed to delete from ${t}:`, e.message);
        }
      }

      // 2. Seed State
      const stateRow = await TABLES.State.insertRow({ StateName: 'Karnataka', NationalityID: 1, Active: true });
      const stateId = stateRow.ROWID;

      // 3. Seed Districts & Units
      const districtNames = [
        'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 
        'Hubballi-Dharwad', 'Belagavi', 'Kalaburagi', 'Davanagere', 
        'Ballari', 'Shivamogga'
      ];
      const districts = [];
      const units = [];
      for (const dName of districtNames) {
        const dRow = await TABLES.District.insertRow({ DistrictName: dName, StateID: stateId, Active: true });
        districts.push(dRow);
        
        // Add 2-3 units per district
        const unitSuffixes = dName === 'Bengaluru Urban' 
          ? ['Koramangala PS', 'Whitefield PS', 'Jayanagar PS']
          : dName === 'Mysuru'
          ? ['Mysuru North PS', 'Mysuru South PS']
          : [`${dName} Town PS`, `${dName} Rural PS`];
          
        for (const uName of unitSuffixes) {
          const uRow = await TABLES.Unit.insertRow({
            UnitName: uName,
            StateID: stateId,
            DistrictID: dRow.ROWID,
            Active: true
          });
          units.push(uRow);
        }
      }

      // 4. Seed CrimeHeads & CrimeSubHeads
      const crimeStructure = {
        'Crimes Against Body': ['Murder (IPC 302)', 'Assault (IPC 323)', 'Kidnapping (IPC 363)'],
        'Crimes Against Property': ['Theft (IPC 379)', 'Burglary (IPC 457)', 'Robbery (IPC 392)'],
        'Crimes Against Women': ['Domestic Violence (IPC 498A)', 'Sexual Assault (IPC 376)'],
        'Economic Offences': ['Fraud (IPC 420)', 'Cheating (IPC 415)'],
        'Narcotics & Drug Offences': ['Drug Trafficking (NDPS Act S.21)']
      };
      
      for (const [chName, subs] of Object.entries(crimeStructure)) {
        const chRow = await TABLES.CrimeHead.insertRow({ CrimeGroupName: chName });
        for (const subName of subs) {
          await TABLES.CrimeSubHead.insertRow({ CrimeHeadName: subName, CrimeHeadID: chRow.ROWID });
        }
      }

      // 5. Seed GravityOffence
      await TABLES.GravityOffence.insertRow({ LookupValue: 'Heinous' });
      await TABLES.GravityOffence.insertRow({ LookupValue: 'Non-Heinous' });

      // 6. Seed CaseStatusMaster
      const statuses = ['Under Investigation', 'Chargesheeted', 'Closed', 'Acquitted', 'Pending Trial'];
      for (const st of statuses) {
        await TABLES.CaseStatusMaster.insertRow({ CaseStatusName: st });
      }

      // 7. Seed CaseCategory
      await TABLES.CaseCategory.insertRow({ LookupValue: 'FIR' });
      await TABLES.CaseCategory.insertRow({ LookupValue: 'UDR' });
      await TABLES.CaseCategory.insertRow({ LookupValue: 'Zero FIR' });

      basicIO.write(JSON.stringify({ success: true, message: "Batch 0 completed. Lookups seeded." }));
    } 
    else {
      // BATCH N (CaseMaster, Accused, Victim)
      
      // Load lookups
      const loadLookup = async (table) => {
        const res = await zcql.executeZCQLQuery(`SELECT * FROM ${table} LIMIT 200`);
        return res.map(r => r[table]);
      };
      
      const [districts, units, categories, statuses, gravity, crimeSubHeads] = await Promise.all([
        loadLookup('District'),
        loadLookup('Unit'),
        loadLookup('CaseCategory'),
        loadLookup('CaseStatusMaster'),
        loadLookup('GravityOffence'),
        loadLookup('CrimeSubHead')
      ]);

      if (districts.length === 0) {
         basicIO.write(JSON.stringify({ error: "Lookups missing. Run batch=0 first." }));
         return context.close();
      }

      const getRnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
      
      const numCases = 20; // 20 per batch
      let casesInserted = 0;
      
      for (let i = 0; i < numCases; i++) {
        const cat = getRnd(categories);
        const unit = getRnd(units);
        const dist = districts.find(d => String(d.ROWID) === String(unit.DistrictID)) || getRnd(districts);
        const year = 2020 + Math.floor(Math.random() * 7); // 2020-2026
        const serial = (batch * 20) + i + 1;
        
        // CrimeNo format: [1-digit category][4-digit districtID][4-digit unitID][4-digit year][5-digit serial]
        // E.g. Category ID 1 -> "1", DistrictID "100" -> "0100"
        const pad = (num, size) => ('000000000' + num).substr(-size);
        const crimeNo = `${cat.ROWID.toString().substr(0,1)}${pad(dist.ROWID, 4)}${pad(unit.ROWID, 4)}${year}${pad(serial, 5)}`;
        
        const subHead = getRnd(crimeSubHeads);
        const stat = getRnd(statuses);
        const grav = getRnd(gravity);

        // Karnataka bounds approx: Lat 11.5 to 18.5, Lng 74.0 to 78.5
        const lat = 11.5 + (Math.random() * 7);
        const lng = 74.0 + (Math.random() * 4.5);
        
        const cRow = await TABLES.CaseMaster.insertRow({
          CrimeNo: crimeNo,
          CaseNo: String(serial),
          CrimeRegisteredDate: `${year}-0${1 + Math.floor(Math.random()*8)}-15 10:00:00`,
          IncidentFromDate: `${year}-0${1 + Math.floor(Math.random()*8)}-14 08:00:00`,
          PoliceStationID: unit.ROWID,
          CaseStatusID: stat.ROWID,
          GravityOffenceID: grav.ROWID,
          CrimeMajorHeadID: subHead.CrimeHeadID, // FK to CrimeHead
          CrimeMinorHeadID: subHead.ROWID,       // FK to CrimeSubHead
          latitude: lat,
          longitude: lng,
          BriefFacts: `Incident report regarding ${subHead.CrimeHeadName}. Priority logging applied. Suspects observed at coordinates.`
        });
        
        casesInserted++;

        // Accused (1-2)
        const numAccused = 1 + Math.floor(Math.random() * 2);
        for(let a=1; a<=numAccused; a++) {
          await TABLES.Accused.insertRow({
            CaseMasterID: cRow.ROWID,
            AccusedName: `Accused ${crimeNo.substr(-5)}_${a}`,
            PersonID: `A${a}`,
            AgeYear: 18 + Math.floor(Math.random() * 40),
            GenderID: Math.random() > 0.5 ? 'M' : 'F'
          });
        }
        
        // Victim (1)
        await TABLES.Victim.insertRow({
          CaseMasterID: cRow.ROWID,
          VictimName: `Victim ${crimeNo.substr(-5)}`,
          AgeYear: 18 + Math.floor(Math.random() * 40),
          GenderID: Math.random() > 0.5 ? 'M' : 'F',
          VictimPolice: Math.random() > 0.9 ? '1' : '0'
        });
      }

      basicIO.write(JSON.stringify({ success: true, message: `Batch ${batch} completed. ${casesInserted} cases inserted.` }));
    }
  } catch (e) {
    console.error("Seed error:", e);
    basicIO.write(JSON.stringify({ error: e.message, stack: e.stack }));
  }

  context.close();
};