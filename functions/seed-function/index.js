const catalyst = require('zcatalyst-sdk-node');

const DISTRICTS_DATA = [
  { name: "Bengaluru Urban", lat: 12.9716, lng: 77.5946 },
  { name: "Bengaluru Rural", lat: 13.1986, lng: 77.5689 },
  { name: "Mysuru", lat: 12.2958, lng: 76.6394 },
  { name: "Mangaluru", lat: 12.9141, lng: 74.856 },
  { name: "Hubballi-Dharwad", lat: 15.3647, lng: 75.1239 },
  { name: "Belagavi", lat: 15.8497, lng: 74.4977 }
];

const STATIONS_DATA = ["Koramangala", "Indiranagar", "Madiwala", "Ashok Nagar", "Jayanagar", "Whitefield", "HSR Layout", "Electronic City", "Cubbon Park", "Banashankari", "Malleswaram", "Hebbal", "Yelahanka", "KR Puram", "Marathahalli"];
const STATUSES_DATA = ["Open", "Under Investigation", "Closed", "Chargesheeted", "Acquitted"];
const GRAVITY_DATA = ["Heinous", "Non-Heinous"];

const CRIME_HIERARCHY = {
  "Crimes Against Body": [
    { name: "Murder (302)", gravity: "Heinous" },
    { name: "Rape (376)", gravity: "Heinous" },
    { name: "Assault (323)", gravity: "Non-Heinous" }
  ],
  "Crimes Against Property": [
    { name: "Theft (379)", gravity: "Non-Heinous" },
    { name: "Robbery (392)", gravity: "Heinous" },
    { name: "Burglary (457)", gravity: "Non-Heinous" }
  ],
  "White Collar Crimes": [
    { name: "Fraud (420)", gravity: "Non-Heinous" }
  ],
  "Cyber Crimes": [
    { name: "Cybercrime (66C IT Act)", gravity: "Non-Heinous" }
  ],
  "Narcotics": [
    { name: "Drug Trafficking (21 NDPS)", gravity: "Heinous" }
  ],
  "Crimes Against Women": [
    { name: "Domestic Violence (498A)", gravity: "Non-Heinous" }
  ]
};

const FIRST_NAMES_MALE = ["Aarav", "Advik", "Akshay", "Anand", "Anil", "Arjun", "Bharat", "Chetan", "Darshan", "Deepak", "Dinesh", "Ganesh", "Girish", "Harish", "Karthik", "Kiran", "Lokesh", "Mahesh", "Manish", "Manjunath", "Manoj", "Mohan", "Naveen", "Nikhil", "Nitin", "Praveen", "Punit", "Rahul", "Rajesh", "Rakesh", "Ramesh", "Ravi", "Sachin", "Sanjay", "Santhosh", "Satish", "Shashank", "Shiva", "Shridhar", "Sridhar", "Srinivas", "Sudeep", "Sunil", "Suresh", "Surya", "Varun", "Venkatesh", "Vijay", "Vikas", "Vinay"];
const FIRST_NAMES_FEMALE = ["Aadhya", "Aishwarya", "Akshatha", "Amulya", "Anitha", "Anjali", "Anusha", "Asha", "Ashwini", "Bhavani", "Bhavya", "Bindu", "Chaithra", "Chandana", "Deepa", "Deepthi", "Divya", "Gowri", "Harshitha", "Jyothi", "Kavitha", "Kavya", "Keerthi", "Lakshmi", "Latha", "Lavanya", "Madhu", "Mamatha", "Manjula", "Meena", "Meghana", "Nandini", "Nayana", "Netra", "Pallavi", "Pooja", "Prashanthi", "Preethi", "Priyanka", "Pushpa", "Radha", "Ramya", "Rashmi", "Rekha", "Roopa", "Sahana", "Sandhya", "Savitha", "Shilpa", "Shruthi", "Shwetha", "Sindhu", "Sowmya", "Spoorthi", "Sujatha", "Suman", "Sunitha", "Sushma", "Swathi", "Usha", "Vidya"];
const LAST_NAMES = ["Gowda", "Reddy", "Patil", "Naik", "Shetty", "Rao", "Kumar", "Babu", "Hegde", "Kulkarni", "Desai", "Joshi", "Bhat", "Nayak", "Prasad", "Murthy", "Raju", "Singh", "Sharma", "Yadav", "Acharya", "Shenoy", "Kamath", "Pai", "Prabhu", "Baliga", "Kini", "Mallya", "Udupa", "Holla", "Maiya", "Hebbar", "Somayaji", "Karanth", "Adiga", "Tantri", "Rai", "Alva", "Bhandary", "Poojary", "Salian", "Amin", "Kotian", "Karkera", "Suvarna", "Puthran", "Kanchan", "Bangera", "Anchan", "Kunder"];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randCoord = (base) => +(base + (Math.random() - 0.5) * 0.1).toFixed(4);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const getUniqueName = (globalIndex, gender) => {
    const firstNames = gender === 'Male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
    const first = firstNames[globalIndex % firstNames.length];
    const last = LAST_NAMES[Math.floor(globalIndex / firstNames.length) % LAST_NAMES.length];
    return `${first} ${last}`;
};

async function getOrInsertLookup(table, column, value) {
  let rows = await table.getPagedRows({ maxRows: 100 });
  let existing = rows.data.find(r => r[table.tableName][column] === value);
  if (existing) return existing[table.tableName].ROWID;
  const newRow = await table.insertRow({ [column]: value });
  return newRow.ROWID;
}

module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();
  const datastore = app.datastore();

  const tables = {
    District: datastore.table('District'),
    Unit: datastore.table('Unit'),
    CaseStatusMaster: datastore.table('CaseStatusMaster'),
    GravityOffence: datastore.table('GravityOffence'),
    CrimeHead: datastore.table('CrimeHead'),
    CrimeSubHead: datastore.table('CrimeSubHead'),
    CaseMaster: datastore.table('CaseMaster'),
    Accused: datastore.table('Accused'),
    Victim: datastore.table('Victim'),
    ArrestSurrender: datastore.table('ArrestSurrender'),
    inv_arrestsurrenderaccused: datastore.table('inv_arrestsurrenderaccused')
  };

  const batch = parseInt(basicIO.getArgument('batch')) || 0;
  const BATCH_SIZE = 20;
  const start = batch * BATCH_SIZE;
  const end = start + BATCH_SIZE;

  try {
    basicIO.write('Setting up lookup tables...\\n');
    
    // 1. Seed Lookups
    const lookupMaps = {
      district: {}, unit: {}, status: {}, gravity: {}, head: {}, subhead: {}
    };

    // Districts
    for (let i=0; i<DISTRICTS_DATA.length; i++) {
      lookupMaps.district[i] = await getOrInsertLookup(tables.District, 'DistrictName', DISTRICTS_DATA[i].name);
    }
    // Units
    for (let i=0; i<STATIONS_DATA.length; i++) {
      let dIndex = i % DISTRICTS_DATA.length;
      let existingUnit = await zcql.executeZCQLQuery(`SELECT ROWID FROM Unit WHERE UnitName = '${STATIONS_DATA[i]} PS'`);
      if (existingUnit && existingUnit.length > 0) {
        lookupMaps.unit[i] = existingUnit[0].Unit.ROWID;
      } else {
        const u = await tables.Unit.insertRow({ UnitName: `${STATIONS_DATA[i]} PS`, DistrictID: lookupMaps.district[dIndex] });
        lookupMaps.unit[i] = u.ROWID;
      }
    }
    // Status
    for (let i=0; i<STATUSES_DATA.length; i++) {
      lookupMaps.status[i] = await getOrInsertLookup(tables.CaseStatusMaster, 'CaseStatusName', STATUSES_DATA[i]);
    }
    // Gravity
    for (let i=0; i<GRAVITY_DATA.length; i++) {
      lookupMaps.gravity[GRAVITY_DATA[i]] = await getOrInsertLookup(tables.GravityOffence, 'LookupValue', GRAVITY_DATA[i]);
    }
    // Heads & SubHeads
    const flatSubHeads = [];
    for (const headName of Object.keys(CRIME_HIERARCHY)) {
      let hID = await getOrInsertLookup(tables.CrimeHead, 'CrimeGroupName', headName);
      lookupMaps.head[headName] = hID;
      for (const sub of CRIME_HIERARCHY[headName]) {
        let existingSub = await zcql.executeZCQLQuery(`SELECT ROWID FROM CrimeSubHead WHERE CrimeHeadName = '${sub.name}'`);
        let sID;
        if (existingSub && existingSub.length > 0) {
          sID = existingSub[0].CrimeSubHead.ROWID;
        } else {
          const s = await tables.CrimeSubHead.insertRow({ CrimeHeadID: hID, CrimeHeadName: sub.name });
          sID = s.ROWID;
        }
        flatSubHeads.push({ id: sID, headId: hID, name: sub.name, gravityId: lookupMaps.gravity[sub.gravity] });
      }
    }

    let inserted = 0;

    for (let i = start; i < end; i++) {
      const accusedStartIndex = i * 2;
      const victimIndex = i;

      const dIndex = i % DISTRICTS_DATA.length;
      const district = DISTRICTS_DATA[dIndex];
      const uIndex = i % STATIONS_DATA.length;
      const statusId = lookupMaps.status[i % STATUSES_DATA.length];
      const subHead = flatSubHeads[i % flatSubHeads.length];
      
      const year = randInt(2022, 2024);
      const month = String(randInt(1, 12)).padStart(2, '0');
      const day = String(randInt(1, 28)).padStart(2, '0');
      const dateStr = `${year}-${month}-${day} 10:00:00`;
      
      // CrimeNo format: [1-digit category][4-digit districtID][4-digit stationID][4-digit year][5-digit serial]
      const distStr = String(dIndex + 1).padStart(4, '0');
      const statStr = String(uIndex + 1).padStart(4, '0');
      const serialStr = String(i + 1).padStart(5, '0');
      const crimeNo = `1${distStr}${statStr}${year}${serialStr}`;
      const caseNo = `${year}${serialStr}`;
      
      const desc = `Detailed incident report for ${subHead.name}. Suspects were observed in the vicinity. Priority intelligence logging applied.`;

      const caseRow = await tables.CaseMaster.insertRow({
        CrimeNo: crimeNo,
        CaseNo: caseNo,
        CrimeRegisteredDate: dateStr,
        IncidentFromDate: dateStr,
        PoliceStationID: lookupMaps.unit[uIndex],
        GravityOffenceID: subHead.gravityId,
        CrimeMajorHeadID: subHead.headId,
        CrimeMinorHeadID: subHead.id,
        CaseStatusID: statusId,
        latitude: randCoord(district.lat),
        longitude: randCoord(district.lng),
        BriefFacts: desc
      });
      const caseId = caseRow.ROWID;

      const numAccused = (i % 5 === 0 || i % 7 === 0) ? 2 : 1;
      const accusedIds = [];
      
      for (let a = 0; a < numAccused; a++) {
        const uniqueAccusedIndex = accusedStartIndex + a;
        const gender = uniqueAccusedIndex % 3 === 0 ? 'F' : 'M';
        const name = getUniqueName(uniqueAccusedIndex, gender === 'M' ? 'Male' : 'Female');
        
        const acc = await tables.Accused.insertRow({
          CaseMasterID: caseId,
          AccusedName: name,
          AgeYear: 18 + (uniqueAccusedIndex % 40),
          GenderID: gender,
          PersonID: `A${a+1}`
        });
        accusedIds.push(acc.ROWID);
      }

      const vGender = victimIndex % 2 === 0 ? 'F' : 'M';
      await tables.Victim.insertRow({
        CaseMasterID: caseId,
        VictimName: getUniqueName(victimIndex + 5000, vGender === 'M' ? 'Male' : 'Female'),
        AgeYear: 18 + (victimIndex % 60),
        GenderID: vGender
      });

      // Network graph connection: link accused to CaseMaster via ArrestSurrender + junction
      if (accusedIds.length > 0) {
        const arr = await tables.ArrestSurrender.insertRow({
          CaseMasterID: caseId,
          ArrestSurrenderDate: dateStr
        });
        
        for (let accId of accusedIds) {
          await tables.inv_arrestsurrenderaccused.insertRow({
            ArrestSurrenderID: arr.ROWID,
            AccusedMasterID: accId
          });
        }
      }

      inserted++;
      await sleep(60);
    }

    if (!basicIO.isResponseSent) {
        basicIO.write(`Batch ${batch} completed. Seeded ${inserted} CaseMaster rows into KSP Production Schema.`);
    }
  } catch(err) {
    if (!basicIO.isResponseSent) {
      basicIO.write(`Error during seed: ${err.message}`);
    }
  }
  context.close();
};