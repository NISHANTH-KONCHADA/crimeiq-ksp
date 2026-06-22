require("dotenv").config();
const axios = require("axios");

const BASE_URL = `https://api.catalyst.zoho.in/baas/v1/project/${process.env.CATALYST_PROJECT_ID}`;
const HEADERS = {
    Authorization: `Zoho-oauthtoken ${process.env.CATALYST_AUTH_TOKEN}`,
    "Content-Type": "application/json",
};

// ─── Karnataka districts with realistic coordinates ───────────────────────────
const DISTRICTS = [
    { name: "Bengaluru Urban", lat: 12.9716, lng: 77.5946 },
    { name: "Bengaluru Rural", lat: 13.1986, lng: 77.5689 },
    { name: "Mysuru", lat: 12.2958, lng: 76.6394 },
    { name: "Mangaluru", lat: 12.9141, lng: 74.856 },
    { name: "Hubballi-Dharwad", lat: 15.3647, lng: 75.1239 },
    { name: "Belagavi", lat: 15.8497, lng: 74.4977 },
    { name: "Kalaburagi", lat: 17.3297, lng: 76.8343 },
    { name: "Davanagere", lat: 14.4644, lng: 75.9218 },
    { name: "Ballari", lat: 15.1394, lng: 76.9214 },
    { name: "Vijayapura", lat: 16.8302, lng: 75.7100 },
    { name: "Shivamogga", lat: 13.9299, lng: 75.5681 },
    { name: "Tumakuru", lat: 13.3379, lng: 77.1173 },
    { name: "Raichur", lat: 16.2120, lng: 77.3439 },
    { name: "Hassan", lat: 13.0033, lng: 76.0998 },
    { name: "Udupi", lat: 13.3409, lng: 74.7421 },
    { name: "Chikkamagaluru", lat: 13.3161, lng: 75.7720 },
    { name: "Kolar", lat: 13.1360, lng: 78.1294 },
    { name: "Mandya", lat: 12.5218, lng: 76.8951 },
    { name: "Chitradurga", lat: 14.2251, lng: 76.3981 },
    { name: "Bidar", lat: 17.9104, lng: 77.5199 },
    { name: "Bagalkot", lat: 16.1691, lng: 75.6615 },
    { name: "Koppal", lat: 15.3508, lng: 76.1549 },
    { name: "Gadag", lat: 15.4166, lng: 75.6219 },
    { name: "Haveri", lat: 14.7939, lng: 75.3997 },
    { name: "Yadgir", lat: 16.7710, lng: 77.1384 },
    { name: "Chamarajanagar", lat: 11.9261, lng: 76.9437 },
    { name: "Chikkaballapur", lat: 13.4354, lng: 77.7280 },
    { name: "Ramanagara", lat: 12.7157, lng: 77.2817 },
    { name: "Kodagu", lat: 12.4244, lng: 75.7382 },
    { name: "Dharwad", lat: 15.4589, lng: 75.0078 },
];

const CRIME_TYPES = [
    "Theft", "Burglary", "Assault", "Robbery", "Fraud",
    "Cybercrime", "Murder", "Kidnapping", "Drug Trafficking", "Domestic Violence",
];

const STATIONS = [
    "Central", "East", "West", "North", "South",
    "Market", "Highway", "Rural", "City", "Town",
];

const STATUSES = ["Open", "Under Investigation", "Closed", "Chargesheeted", "Acquitted"];

const MALE_NAMES = [
    "Ravi Kumar", "Suresh Babu", "Mahesh Nayak", "Arjun Gowda", "Pradeep Reddy",
    "Venkatesh Rao", "Santhosh Kumar", "Rajesh Patil", "Anil Kumar", "Mohan Das",
    "Girish Naik", "Ramesh Hegde", "Vikas Shetty", "Naveen Kumar", "Deepak Joshi",
    "Kiran Bhat", "Manjunath HK", "Sridhar Murthy", "Lokesh NK", "Prasad Kulkarni",
];

const FEMALE_NAMES = [
    "Lakshmi Devi", "Savitha Kumari", "Rekha Bai", "Sunitha Rao", "Meena Gowda",
    "Kavitha Reddy", "Anitha Shetty", "Pushpa Naik", "Radha Devi", "Usha Kumari",
];

const MODUS_OPERANDI = [
    "Operates at night, targets unoccupied homes",
    "Uses stolen vehicles for getaway",
    "Impersonates bank officials over phone",
    "Works in groups of 3-4, targets crowded markets",
    "Uses social engineering to gain trust",
    "Targets ATMs using skimming devices",
    "Operates in railway stations and bus stands",
    "Uses online platforms for fraud",
    "Targets elderly residents living alone",
    "Forges documents for property fraud",
];

const DESCRIPTIONS = {
    Theft: [
        "Mobile phone stolen from victim in crowded bus stand area.",
        "Two-wheeler stolen from outside residential complex.",
        "Cash and jewellery stolen from house while family was away.",
        "Laptop bag snatched near railway station.",
        "Shoplifting reported at local grocery store.",
    ],
    Burglary: [
        "Residence broken into during night hours, electronic items stolen.",
        "Commercial establishment burgled, cash from safe stolen.",
        "Rear window broken, valuables taken from parked car.",
        "Office premises entered by breaking lock, laptops stolen.",
        "Gold jewellery and cash stolen from locked almirahs.",
    ],
    Assault: [
        "Victim assaulted during argument over parking space.",
        "Physical altercation between neighbours over boundary dispute.",
        "Victim attacked by unknown persons on deserted road.",
        "Group assault following road rage incident.",
        "Victim beaten outside bar after dispute.",
    ],
    Robbery: [
        "Victim robbed at knifepoint near ATM.",
        "Chain snatching incident reported near temple.",
        "Armed robbery at petrol bunk during late night.",
        "Mobile phone and wallet snatched by motorcyclists.",
        "Robbery at jewellery shop by masked persons.",
    ],
    Fraud: [
        "Online banking fraud, victim lost Rs 45,000.",
        "Fake job offer scam targeting unemployed youth.",
        "Land document forgery case reported.",
        "Investment scheme fraud involving multiple victims.",
        "Impersonation of government official to extort money.",
    ],
    Cybercrime: [
        "Social media account hacked and misused.",
        "OTP fraud resulting in Rs 1.2 lakh loss.",
        "Obscene messages sent from fake profile.",
        "Online shopping fraud, goods not delivered after payment.",
        "Ransomware attack on small business computer.",
    ],
    Murder: [
        "Body found near lake, suspected homicide.",
        "Victim stabbed following property dispute.",
        "Murder following domestic altercation.",
        "Victim found with fatal injuries, suspect absconding.",
        "Gang-related killing reported in outskirts.",
    ],
    Kidnapping: [
        "Minor kidnapped for ransom, rescued within 24 hours.",
        "Woman abducted by estranged partner.",
        "Child missing from school premises, later found safe.",
        "Kidnapping attempt foiled by public intervention.",
        "Person held captive for extortion, rescued by police.",
    ],
    "Drug Trafficking": [
        "Ganja consignment seized from truck at checkpost.",
        "Methamphetamine tablets recovered from accused.",
        "Drug peddling network busted in residential area.",
        "NDPS case registered following tip-off.",
        "Heroin seized, interstate trafficking network suspected.",
    ],
    "Domestic Violence": [
        "Wife assaulted by husband under influence of alcohol.",
        "Dowry harassment complaint filed.",
        "Woman seeks protection from abusive partner.",
        "Physical and mental abuse reported over dowry demands.",
        "Woman assaulted by in-laws for not bearing child.",
    ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randCoord = (base, range = 0.3) => +(base + (Math.random() - 0.5) * range).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function generateFIR(index) {
    const district = rand(DISTRICTS);
    const crimeType = rand(CRIME_TYPES);
    const year = randInt(2020, 2024);
    const month = String(randInt(1, 12)).padStart(2, "0");
    const day = String(randInt(1, 28)).padStart(2, "0");
    return {
        fir_number: `FIR-${district.name.substring(0, 3).toUpperCase()}-${year}-${String(index + 1).padStart(4, "0")}`,
        station: `${rand(STATIONS)} Police Station`,
        district: district.name,
        crime_type: crimeType,
        date_of_incident: `${year}-${month}-${day}`,
        status: rand(STATUSES),
        description: rand(DESCRIPTIONS[crimeType]),
        latitude: randCoord(district.lat),
        longitude: randCoord(district.lng),
    };
}

function generateAccused(firRowId) {
    const gender = Math.random() > 0.2 ? "Male" : "Female";
    const name = gender === "Male" ? rand(MALE_NAMES) : rand(FEMALE_NAMES);
    const district = rand(DISTRICTS);
    return {
        fir_id: firRowId,
        name,
        age: randInt(18, 55),
        gender,
        address: `${randInt(1, 200)}, ${rand(["MG Road", "Gandhi Nagar", "Station Road", "Main Street", "Cross Road"])}, ${district.name}`,
        prior_record: Math.random() > 0.6 ? `Previously arrested in ${randInt(2015, 2022)} for ${rand(CRIME_TYPES)}` : "No prior record",
        modus_operandi: rand(MODUS_OPERANDI),
    };
}

function generateVictim(firRowId) {
    const gender = Math.random() > 0.5 ? "Male" : "Female";
    const name = gender === "Male" ? rand(MALE_NAMES) : rand(FEMALE_NAMES);
    return {
        fir_id: firRowId,
        name,
        age: randInt(18, 75),
        gender,
    };
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function insertRow(tableName, data) {
    try {
        const res = await axios.post(
            `${BASE_URL}/table/${tableName}/row`,
            [data],
            { headers: HEADERS }
        );
        return res.data.data[0].ROWID;
    } catch (err) {
        console.error(`❌ Error inserting into ${tableName}:`, err.response?.data || err.message);
        return null;
    }
}

async function insertCriminalLink(id1, id2, firId) {
    const linkTypes = ["associate", "gang_member", "family", "prior_co-accused"];
    await insertRow("CriminalLink", {
        accused_id_1: id1,
        accused_id_2: id2,
        link_type: rand(linkTypes),
        fir_id: firId,
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log("🚀 Starting CrimeIQ data seeding...\n");
    console.log(`📡 Target: ${BASE_URL}\n`);

    const accusedRowIds = [];
    const firRowIds = [];

    for (let i = 0; i < 200; i++) {
        process.stdout.write(`\r⏳ Seeding FIR ${i + 1}/200...`);

        // Insert FIR
        const firData = generateFIR(i);
        const firRowId = await insertRow("FIR", firData);
        if (!firRowId) continue;
        firRowIds.push(firRowId);

        // Insert 1-2 accused per FIR
        const numAccused = Math.random() > 0.4 ? 2 : 1;
        const localAccusedIds = [];
        for (let a = 0; a < numAccused; a++) {
            const accusedData = generateAccused(firRowId);
            const accusedRowId = await insertRow("Accused", accusedData);
            if (accusedRowId) {
                accusedRowIds.push(accusedRowId);
                localAccusedIds.push(accusedRowId);
            }
        }

        // Insert 1 victim per FIR
        await insertRow("Victim", generateVictim(firRowId));

        // If 2 accused in same FIR → create a CriminalLink
        if (localAccusedIds.length === 2) {
            await insertCriminalLink(localAccusedIds[0], localAccusedIds[1], firRowId);
        }

        // Every 20 FIRs → also link two random accused from different FIRs (gang network)
        if (i > 0 && i % 20 === 0 && accusedRowIds.length >= 4) {
            const id1 = accusedRowIds[randInt(0, accusedRowIds.length - 3)];
            const id2 = accusedRowIds[accusedRowIds.length - 1];
            const firId = firRowIds[randInt(0, firRowIds.length - 1)];
            await insertCriminalLink(id1, id2, firId);
        }

        // Small delay to avoid rate limiting
        await sleep(150);
    }

    console.log("\n\n✅ Seeding complete!");
    console.log(`📊 Inserted: 200 FIRs, ~300 Accused, 200 Victims, ~20 Criminal Links`);
    console.log(`\n🎯 Your CrimeIQ database is ready to query!`);
}

main();