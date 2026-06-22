const catalyst = require('zcatalyst-sdk-node');

const DISTRICTS = [
  { name: "Bengaluru Urban", lat: 12.9716, lng: 77.5946 },
  { name: "Bengaluru Rural", lat: 13.1986, lng: 77.5689 },
  { name: "Mysuru", lat: 12.2958, lng: 76.6394 },
  { name: "Mangaluru", lat: 12.9141, lng: 74.856 },
  { name: "Hubballi-Dharwad", lat: 15.3647, lng: 75.1239 },
  { name: "Belagavi", lat: 15.8497, lng: 74.4977 }
];

const CRIME_TYPES = ["Theft", "Burglary", "Assault", "Robbery", "Fraud", "Cybercrime", "Murder", "Kidnapping", "Drug Trafficking", "Domestic Violence"];
const STATIONS = ["Koramangala", "Indiranagar", "Madiwala", "Ashok Nagar", "Jayanagar", "Whitefield", "HSR Layout", "Electronic City", "Cubbon Park", "Banashankari", "Malleswaram", "Hebbal", "Yelahanka", "KR Puram", "Marathahalli"];
const STATUSES = ["Open", "Under Investigation", "Closed", "Chargesheeted", "Acquitted"];

const FIRST_NAMES_MALE = ["Aarav", "Advik", "Akshay", "Anand", "Anil", "Arjun", "Bharat", "Chetan", "Darshan", "Deepak", "Dinesh", "Ganesh", "Girish", "Harish", "Karthik", "Kiran", "Lokesh", "Mahesh", "Manish", "Manjunath", "Manoj", "Mohan", "Naveen", "Nikhil", "Nitin", "Praveen", "Punit", "Rahul", "Rajesh", "Rakesh", "Ramesh", "Ravi", "Sachin", "Sanjay", "Santhosh", "Satish", "Shashank", "Shiva", "Shridhar", "Sridhar", "Srinivas", "Sudeep", "Sunil", "Suresh", "Surya", "Varun", "Venkatesh", "Vijay", "Vikas", "Vinay"];
const FIRST_NAMES_FEMALE = ["Aadhya", "Aishwarya", "Akshatha", "Amulya", "Anitha", "Anjali", "Anusha", "Asha", "Ashwini", "Bhavani", "Bhavya", "Bindu", "Chaithra", "Chandana", "Deepa", "Deepthi", "Divya", "Gowri", "Harshitha", "Jyothi", "Kavitha", "Kavya", "Keerthi", "Lakshmi", "Latha", "Lavanya", "Madhu", "Mamatha", "Manjula", "Meena", "Meghana", "Nandini", "Nayana", "Netra", "Pallavi", "Pooja", "Prashanthi", "Preethi", "Priyanka", "Pushpa", "Radha", "Ramya", "Rashmi", "Rekha", "Roopa", "Sahana", "Sandhya", "Savitha", "Shilpa", "Shruthi", "Shwetha", "Sindhu", "Sowmya", "Spoorthi", "Sujatha", "Suman", "Sunitha", "Sushma", "Swathi", "Usha", "Vidya"];
const LAST_NAMES = ["Gowda", "Reddy", "Patil", "Naik", "Shetty", "Rao", "Kumar", "Babu", "Hegde", "Kulkarni", "Desai", "Joshi", "Bhat", "Nayak", "Prasad", "Murthy", "Raju", "Singh", "Sharma", "Yadav", "Acharya", "Shenoy", "Kamath", "Pai", "Prabhu", "Baliga", "Kini", "Mallya", "Udupa", "Holla", "Maiya", "Hebbar", "Somayaji", "Karanth", "Adiga", "Tantri", "Rai", "Alva", "Bhandary", "Poojary", "Salian", "Amin", "Kotian", "Karkera", "Suvarna", "Puthran", "Kanchan", "Bangera", "Anchan", "Kunder"];

const MODUS_OPERANDI = [
  "Operates at night, targets unoccupied homes using duplicate keys or breaking rear windows.",
  "Uses stolen two-wheelers for getaway after snatching chains or bags.",
  "Impersonates bank officials over phone to extract OTP and CVV details.",
  "Works in a group of 3-4, targets crowded markets and bus stands for pickpocketing.",
  "Uses social engineering to gain trust of elderly residents living alone.",
  "Targets ATMs using skimming devices installed during early morning hours.",
  "Operates in railway stations, posing as passengers to steal luggage.",
  "Uses online classified platforms to execute advance payment frauds.",
  "Forges land ownership documents to sell disputed properties.",
  "Intercepts vehicles on highways during late hours for armed robbery."
];

const DESCRIPTIONS = {
  "Theft": [
    "IPC Sec 379: Theft of a two-wheeler (KA-01-XX-1234) parked outside the victim's residence. Vehicle was locked but taken during night hours.",
    "IPC Sec 379: Mobile phone snatched by two bike-borne miscreants from the victim waiting at a bus stop.",
    "IPC Sec 379, 380: Cash of Rs. 45,000 and 50g gold jewellery stolen from the victim's house. Rear door was found forced open."
  ],
  "Burglary": [
    "IPC Sec 457, 380: House break-in by night. Thieves broke the main door lock and decamped with valuables worth Rs. 5 Lakhs.",
    "IPC Sec 454, 380: Commercial establishment burgled during the weekend. The heavy safe was broken open and cash was taken.",
    "IPC Sec 457: Attempted burglary at an electronics store. The alarm system triggered, causing the perpetrators to flee empty-handed."
  ],
  "Assault": [
    "IPC Sec 323, 324: Victim brutally assaulted with a blunt weapon (iron rod) following a heated dispute over vehicle parking.",
    "IPC Sec 326: Grievous hurt caused to the victim during a gang altercation outside a local bar late at night.",
    "IPC Sec 354: Outraging the modesty of a woman. Accused assaulted the victim in a public place following an argument."
  ],
  "Robbery": [
    "IPC Sec 392: Robbery committed at knifepoint. The victim was forced to hand over his wallet and gold chain in a deserted alley.",
    "IPC Sec 397: Armed robbery at a petrol station. Three masked men threatened the staff with firearms and looted the cash register.",
    "IPC Sec 392, 34: Highway robbery. A truck driver was intercepted by a gang in an SUV, assaulted, and robbed of his consignment."
  ],
  "Fraud": [
    "IPC Sec 420: Cheating and dishonestly inducing delivery of property. Victim transferred Rs. 2 Lakhs to a fraudulent account promising high returns.",
    "IPC Sec 419, 420: Cyber fraud involving OTP. The accused impersonated a bank manager and siphoned off funds from the victim's account.",
    "IPC Sec 468, 420: Forgery for purpose of cheating. The accused created fake property documents to sell a disputed plot of land."
  ],
  "Cybercrime": [
    "IT Act Sec 66C, 66D: Identity theft and impersonation. The accused hacked the victim's social media and sent messages demanding money from contacts.",
    "IT Act Sec 67: Transmitting obscene material in electronic form. The accused sent harassing and inappropriate media to the victim's phone.",
    "IT Act Sec 66: Computer related offences. A ransomware attack encrypted the servers of a small business, demanding cryptocurrency payment."
  ],
  "Murder": [
    "IPC Sec 302: Murder. The victim was found dead with multiple stab wounds in a vacant plot. Personal enmity suspected.",
    "IPC Sec 302, 201: Murder and causing disappearance of evidence. The body was discovered partially burnt in the outskirts of the city.",
    "IPC Sec 302, 120B: Criminal conspiracy and murder. The victim, a local businessman, was shot by unknown assailants on a motorcycle."
  ],
  "Kidnapping": [
    "IPC Sec 363, 364A: Kidnapping for ransom. A 10-year-old child was abducted from a park; kidnappers demanded Rs. 20 Lakhs.",
    "IPC Sec 365: Kidnapping with intent secretly and wrongfully to confine person. A software engineer was abducted in a car by a known acquaintance.",
    "IPC Sec 366: Kidnapping, abducting or inducing woman to compel her marriage. The victim was forced into a vehicle while returning from work."
  ],
  "Drug Trafficking": [
    "NDPS Act Sec 20(b): Illegal possession and transportation of 15 kg of Ganja (Cannabis) concealed in a commercial goods vehicle.",
    "NDPS Act Sec 21, 22: Seizure of 50 grams of MDMA and synthetic drugs from a residential apartment operating as a distribution hub.",
    "NDPS Act Sec 27A: Financing illicit traffic and harbouring offenders. A major interstate drug supply chain was intercepted based on intelligence."
  ],
  "Domestic Violence": [
    "IPC Sec 498A: Husband or relative of husband of a woman subjecting her to cruelty. Victim filed a complaint citing persistent dowry demands and physical abuse.",
    "Domestic Violence Act 2005: Protection order sought by the victim against her husband for severe mental harassment and physical violence.",
    "IPC Sec 304B: Dowry death. A newly married woman was found dead under suspicious circumstances; parents allege continuous harassment for dowry."
  ]
};

const STREETS = ["Main Road", "Cross", "Link Road", "Ring Road", "High Street"];
const LAYOUTS = ["HSR Layout", "BTM Layout", "Jayanagar", "JP Nagar", "Indiranagar", "Koramangala", "Whitefield", "Rajajinagar", "Malleswaram", "Basavanagudi"];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randCoord = (base) => +(base + (Math.random() - 0.5) * 0.1).toFixed(4); 
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const getUniqueName = (globalIndex, gender) => {
    const firstNames = gender === 'Male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
    const first = firstNames[globalIndex % firstNames.length];
    const last = LAST_NAMES[Math.floor(globalIndex / firstNames.length) % LAST_NAMES.length];
    return `${first} ${last}`;
};

module.exports = async (app, batch) => {
  const datastore = app.datastore();
  const firTable = datastore.table('FIR');
  const accusedTable = datastore.table('Accused');
  const victimTable = datastore.table('Victim');
  const linkTable = datastore.table('CriminalLink');

  const BATCH_SIZE = 20;
  const start = batch * BATCH_SIZE;
  const end = start + BATCH_SIZE;

  let inserted = 0;

  for (let i = start; i < end; i++) {
    const accusedStartIndex = i * 2;
    const victimIndex = i;

    const district = DISTRICTS[i % DISTRICTS.length];
    const crimeType = Object.keys(DESCRIPTIONS)[i % Object.keys(DESCRIPTIONS).length];
    const year = randInt(2022, 2024);
    const month = String(randInt(1, 12)).padStart(2, '0');
    const day = String(randInt(1, 28)).padStart(2, '0');
    
    const descriptionList = DESCRIPTIONS[crimeType];
    const description = descriptionList[i % descriptionList.length];

    try {
      const firRow = await firTable.insertRow({
        fir_number: `FIR-${district.name.substring(0,3).toUpperCase()}-${year}-${String(i+1000).padStart(4,'0')}`,
        station: `${STATIONS[i % STATIONS.length]} PS`,
        district: district.name,
        crime_type: crimeType,
        date_of_incident: `${year}-${month}-${day}`,
        status: STATUSES[i % STATUSES.length],
        description: description,
        latitude: randCoord(district.lat),
        longitude: randCoord(district.lng)
      });
      const firId = firRow.ROWID;

      const numAccused = (i % 5 === 0 || i % 7 === 0) ? 2 : 1;
      const localIds = [];
      
      for (let a = 0; a < numAccused; a++) {
        const uniqueAccusedIndex = accusedStartIndex + a;
        const gender = uniqueAccusedIndex % 3 === 0 ? 'Female' : 'Male';
        const name = getUniqueName(uniqueAccusedIndex, gender);
        
        const acc = await accusedTable.insertRow({
          fir_id: firId,
          name: name,
          age: 18 + (uniqueAccusedIndex % 40),
          gender: gender,
          address: `#${100 + (uniqueAccusedIndex % 800)}, ${uniqueAccusedIndex % 15}th ${STREETS[uniqueAccusedIndex % STREETS.length]}, ${LAYOUTS[uniqueAccusedIndex % LAYOUTS.length]}, ${district.name} - 5600${String(uniqueAccusedIndex % 99).padStart(2,'0')}`,
          prior_record: uniqueAccusedIndex % 4 === 0 ? `Previously arrested in ${2015 + (uniqueAccusedIndex % 8)} for ${Object.keys(DESCRIPTIONS)[(uniqueAccusedIndex + 2) % 10]}` : 'No prior record',
          modus_operandi: MODUS_OPERANDI[uniqueAccusedIndex % MODUS_OPERANDI.length]
        });
        localIds.push(acc.ROWID);
      }

      const vGender = victimIndex % 2 === 0 ? 'Female' : 'Male';
      await victimTable.insertRow({
        fir_id: firId,
        name: getUniqueName(victimIndex + 5000, vGender),
        age: 18 + (victimIndex % 60),
        gender: vGender
      });

      if (localIds.length === 2) {
        await linkTable.insertRow({
          accused_id_1: localIds[0],
          accused_id_2: localIds[1],
          link_type: ['associate','gang_member','family','prior_co-accused'][i % 4],
          fir_id: firId
        });
      }

      inserted++;
      await sleep(60);

    } catch(err) {
      console.error(`FIR ${i+1} failed: ${err.message}`);
    }
  }

  return `Batch ${batch} completed strictly. Inserted ${inserted}/20 FIRs (Rows ${start} to ${end-1}). No duplicates generated.`;
};
