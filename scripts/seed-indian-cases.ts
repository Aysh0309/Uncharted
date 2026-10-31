import fs from "fs";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { embed } from "../lib/llm";

// ----------------------------------------------------
// Load Environment Variables (.env.local / .env)
// ----------------------------------------------------
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "casememory";

// ----------------------------------------------------
// 1. The 3 Indian Investigators
// ----------------------------------------------------
const INDIAN_INVESTIGATORS = [
  {
    key: "sharma",
    name: "Insp. Rajesh Sharma",
    email: "rajesh.sharma@casememory.in",
    password: "SharmaPass123!",
    role: "investigator",
    badge: "MH-CID-4109",
  },
  {
    key: "iyer",
    name: "Insp. Priya Iyer",
    email: "priya.iyer@casememory.in",
    password: "PriyaPass123!",
    role: "investigator",
    badge: "KA-CID-2084",
  },
  {
    key: "deshmukh",
    name: "SI Kabir Deshmukh",
    email: "kabir.deshmukh@casememory.in",
    password: "KabirPass123!",
    role: "investigator",
    badge: "DL-CID-7812",
  },
];

// ----------------------------------------------------
// 2. The 3 Realistic Indian Cases
// ----------------------------------------------------
interface CaseDefinition {
  title: string;
  location: string;
  description: string;
  summary: string;
  notes: Array<{
    authorKey: "sharma" | "iyer" | "deshmukh";
    date: Date;
    text: string;
    events: Array<{
      what: string;
      who: string[];
      whenText: string;
      whenISO: string | null;
      where: string;
      confidence: number;
    }>;
    openQuestions: string[];
  }>;
  entities: Array<{
    name: string;
    aliases: string[];
    type: "person" | "vehicle" | "place" | "phone" | "object";
    role: "victim" | "suspect" | "witness" | "other";
    alibiStatus: "unknown" | "claimed" | "verified" | "broken";
    alibiDetails: string;
  }>;
}

const INDIAN_CASES: CaseDefinition[] = [
  // ----------------------------------------------------
  // CASE 1: Mumbai - Bandra Kurla Complex
  // ----------------------------------------------------
  {
    title: "The BKC Diamond Bourse Vault Heist",
    location: "Bandra Kurla Complex (BKC), Mumbai, Maharashtra",
    description:
      "Forensic investigation into a midnight subterranean vault breach at Parekh Gems & Exports within the Bharat Diamond Bourse, resulting in the theft of ₹14.5 Crore in uncut diamonds.",
    summary:
      "At 11:45 PM on October 18, Vault 2B of Parekh Gems at Bharat Diamond Bourse was penetrated with an authorized master keycard. High-speed cameras at Bandra-Worli Sea Link captured a dark grey Mahindra XUV700 (MH-02-DW-4912) fleeing BKC. Key suspect Vikram Malhotra claims an alibi at Juhu Beach, which CCTV and BKC cell tower telemetry directly refute.",
    entities: [
      {
        name: "Vikram Malhotra",
        aliases: ["Vicky", "Vicky Malhotra"],
        type: "person",
        role: "suspect",
        alibiStatus: "broken",
        alibiDetails:
          "Claimed he was walking alone at Juhu Beach from 11 PM to 1 AM; refuted by Sea Link toll camera capture at 11:42 PM and BKC cell tower pings.",
      },
      {
        name: "Sameer Khan",
        aliases: ["Bunty", "Bunty Kurla"],
        type: "person",
        role: "suspect",
        alibiStatus: "unknown",
        alibiDetails:
          "Known hawala transporter. Outgoing calls from a recovered burner phone near Mithi River link him to Vikram Malhotra.",
      },
      {
        name: "Bipin Parekh",
        aliases: ["Parekh Ji"],
        type: "person",
        role: "victim",
        alibiStatus: "verified",
        alibiDetails:
          "Managing Director of Parekh Gems & Exports. Was attending a verified trade dinner in Marine Lines.",
      },
      {
        name: "Neha Kulkarni",
        aliases: ["Auditor Kulkarni"],
        type: "person",
        role: "witness",
        alibiStatus: "verified",
        alibiDetails:
          "Chief Security Systems Officer. Confirmed laser grid sensors in Zone 3 were tampered with from the central console.",
      },
      {
        name: "Ratan Yadav",
        aliases: ["Yadav"],
        type: "person",
        role: "witness",
        alibiStatus: "claimed",
        alibiDetails:
          "Night shift security guard who claims his RFID access badge was stolen from the locker room 30 minutes before the vault breach.",
      },
      {
        name: "Mahindra XUV700",
        aliases: ["MH-02-DW-4912", "Dark Grey XUV700"],
        type: "vehicle",
        role: "other",
        alibiStatus: "unknown",
        alibiDetails: "Registered to Vikram Malhotra. Recorded speeding away from BKC at 11:52 PM.",
      },
    ],
    notes: [
      {
        authorKey: "sharma",
        date: new Date("2026-10-19T02:30:00Z"),
        text: "Dispatched to Bharat Diamond Bourse, G-Block, BKC following an automated silent distress beacon at 00:15 AM. Subterranean Vault 2B belonging to Parekh Gems & Exports was accessed without physical forced entry. The pneumatic time-lock mechanism was bypassed using an insider digital override code, and ₹14.5 Crore in uncut industrial grade diamonds are missing.",
        events: [
          {
            what: "Subterranean Vault 2B penetrated and diamonds stolen",
            who: ["Parekh Gems & Exports", "Bipin Parekh"],
            whenText: "11:45 PM, October 18, 2026",
            whenISO: "2026-10-18T23:45:00Z",
            where: "Bharat Diamond Bourse, BKC, Mumbai",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Who had possession of the pneumatic time-lock override code on the night of October 18?",
        ],
      },
      {
        authorKey: "iyer",
        date: new Date("2026-10-19T06:15:00Z"),
        text: "Reviewed security logs and interviewed Chief Security Officer Neha Kulkarni. Kulkarni confirmed that the secondary infrared laser tripwire in Zone 3 was manually disabled at 11:38 PM via Terminal 4. Night guard Ratan Yadav claimed his access badge was misplaced or stolen from the guardroom locker at 11:15 PM.",
        events: [
          {
            what: "Secondary infrared laser tripwires manually disabled",
            who: ["Neha Kulkarni", "Ratan Yadav"],
            whenText: "11:38 PM, October 18, 2026",
            whenISO: "2026-10-18T23:38:00Z",
            where: "Security Control Terminal 4, BKC Diamond Bourse",
            confidence: 0.95,
          },
        ],
        openQuestions: [
          "Verify if Ratan Yadav filed a lost badge report prior to the alarm or only after investigators arrived.",
        ],
      },
      {
        authorKey: "deshmukh",
        date: new Date("2026-10-19T10:45:00Z"),
        text: "Processed Mumbai Traffic Police automated ANPR camera feeds. At 11:52 PM, a dark grey Mahindra XUV700 bearing license plate MH-02-DW-4912 was captured speeding past the BKC connector onto the Bandra-Worli Sea Link at 98 km/h. Vehicle registration records confirm ownership under Vikram Malhotra, Senior Vault Operations Manager.",
        events: [
          {
            what: "Mahindra XUV700 captured speeding towards Sea Link",
            who: ["Vikram Malhotra", "Mahindra XUV700"],
            whenText: "11:52 PM, October 18, 2026",
            whenISO: "2026-10-18T23:52:00Z",
            where: "BKC Connector / Bandra-Worli Sea Link, Mumbai",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Check whether toll plaza FASTag records match Vikram Malhotra's registered credit card.",
        ],
      },
      {
        authorKey: "sharma",
        date: new Date("2026-10-19T15:20:00Z"),
        text: "Formal interrogation of Vikram Malhotra at BKC Police Station. Malhotra claimed an alibi of sitting alone at Juhu Beach between 11:00 PM and 01:00 AM. However, cellular CDR telemetry places his mobile device pinging the BKC MTNL tower at 11:47 PM. His claimed alibi is broken by forensic cell tower records.",
        events: [
          {
            what: "Vikram Malhotra interrogated; alibi broken by cell tower logs",
            who: ["Vikram Malhotra", "Insp. Rajesh Sharma"],
            whenText: "11:00 PM to 01:00 AM time window",
            whenISO: "2026-10-18T23:47:00Z",
            where: "BKC Police Station, Mumbai",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Trace financial transactions between Vikram Malhotra and known cricket betting rings in Kurla.",
        ],
      },
      {
        authorKey: "iyer",
        date: new Date("2026-10-20T09:00:00Z"),
        text: "Forensic recovery unit dredged a Samsung burner phone from the stormwater drain near Mithi River bridge. Call logs show 4 brief outgoing calls between 11:20 PM and 11:55 PM to an unlisted number traced to Sameer 'Bunty' Khan, an interstate hawala courier with prior arrests in Dongri.",
        events: [
          {
            what: "Burner phone recovered near Mithi River linked to Sameer Khan",
            who: ["Sameer Khan", "Vikram Malhotra"],
            whenText: "11:20 PM to 11:55 PM, October 18, 2026",
            whenISO: "2026-10-18T23:20:00Z",
            where: "Mithi River Bridge, BKC, Mumbai",
            confidence: 0.9,
          },
        ],
        openQuestions: [
          "Execute warrant to locate Sameer Khan's hideout in Kurla West.",
        ],
      },
    ],
  },

  // ----------------------------------------------------
  // CASE 2: Bengaluru - Indiranagar / Electronic City
  // ----------------------------------------------------
  {
    title: "The Indiranagar Autonomous Drone Espionage",
    location: "100 Feet Road, Indiranagar & Electronic City, Bengaluru, Karnataka",
    description:
      "Homicide investigation into the death of Senior Robotics Architect Rohan Murthy and the simultaneous theft of defense-grade drone telemetry encryption drives from Astraea Aerospace Labs.",
    summary:
      "On October 22 at 01:15 AM, Senior Architect Rohan Murthy was discovered deceased in the high-security server room at Astraea Labs, Indiranagar. The solid-state telemetry drives containing DRDO-contracted drone flight algorithms were physically extracted. Dr. Ananya Sen claimed an alibi at Kempegowda Airport, but toll records prove her vehicle exited into the city at 10:15 PM.",
    entities: [
      {
        name: "Rohan Murthy",
        aliases: ["Murthy"],
        type: "person",
        role: "victim",
        alibiStatus: "unknown",
        alibiDetails: "Senior Systems Architect found deceased at his workstation.",
      },
      {
        name: "Dr. Ananya Sen",
        aliases: ["Dr. Sen", "Ananya Sen"],
        type: "person",
        role: "suspect",
        alibiStatus: "broken",
        alibiDetails:
          "Claimed she was waiting at Kempegowda Airport arrival lounge until 2 AM; refuted by airport parking toll records showing her Creta exited at 10:15 PM.",
      },
      {
        name: "Rakesh Verma",
        aliases: ["Verma"],
        type: "person",
        role: "suspect",
        alibiStatus: "unknown",
        alibiDetails:
          "Disgruntled firmware engineer terminated 3 weeks ago; received suspicious ₹50 Lakh offshore cryptocurrency wire.",
      },
      {
        name: "Kavita Nair",
        aliases: ["Nair"],
        type: "person",
        role: "witness",
        alibiStatus: "verified",
        alibiDetails:
          "Operations Director who discovered the breached server rack and notified Bengaluru City Police.",
      },
      {
        name: "Farhan Siddiqui",
        aliases: ["Farhan"],
        type: "person",
        role: "witness",
        alibiStatus: "claimed",
        alibiDetails:
          "Night cleaning supervisor whose cloned RFID card was swiped at Server Bay 4 at 01:14 AM.",
      },
      {
        name: "Hyundai Creta",
        aliases: ["KA-03-MR-8821", "White Creta"],
        type: "vehicle",
        role: "other",
        alibiStatus: "unknown",
        alibiDetails: "Registered to Dr. Ananya Sen; spotted on 100 Feet Road at 01:05 AM.",
      },
    ],
    notes: [
      {
        authorKey: "iyer",
        date: new Date("2026-10-22T03:00:00Z"),
        text: "Arrived at Astraea Aerospace Labs on 100 Feet Road, Indiranagar following a 02:15 AM call. Victim Rohan Murthy was found unresponsive inside Server Suite 4. Preliminary forensic observation indicates blunt force trauma to the temple. The primary cold-storage server rack holding DRDO-contracted autonomous drone telemetry algorithms was opened and two high-capacity NVMe drives were missing.",
        events: [
          {
            what: "Rohan Murthy discovered deceased and telemetry drives stolen",
            who: ["Rohan Murthy", "Astraea Aerospace Labs"],
            whenText: "01:15 AM, October 22, 2026",
            whenISO: "2026-10-22T01:15:00Z",
            where: "Server Suite 4, Astraea Labs, Indiranagar, Bengaluru",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Determine if Server Suite 4 required dual-factor biometric authorization.",
        ],
      },
      {
        authorKey: "deshmukh",
        date: new Date("2026-10-22T08:30:00Z"),
        text: "Examined biometric turnstile access logs. A digital RFID badge assigned to night cleaning supervisor Farhan Siddiqui was registered entering the second floor corridor at 01:14 AM. Farhan Siddiqui was questioned and stated he had lost his lanyard while cleaning the cafeteria at 09:30 PM and had not entered the server wing.",
        events: [
          {
            what: "Cloned RFID badge of Farhan Siddiqui swiped at server wing",
            who: ["Farhan Siddiqui"],
            whenText: "01:14 AM, October 22, 2026",
            whenISO: "2026-10-22T01:14:00Z",
            where: "Second Floor Server Wing, Indiranagar, Bengaluru",
            confidence: 0.95,
          },
        ],
        openQuestions: [
          "Check CCTV outside the cafeteria to verify when Farhan dropped his badge.",
        ],
      },
      {
        authorKey: "sharma",
        date: new Date("2026-10-22T13:45:00Z"),
        text: "Traffic management surveillance along 100 Feet Road identified a white Hyundai Creta (KA-03-MR-8821) entering the side lane behind Astraea Labs at 01:05 AM with headlights switched off, departing at 01:38 AM towards Old Airport Road. Vehicle registration is linked to Dr. Ananya Sen, Vice President of Autonomous Systems.",
        events: [
          {
            what: "White Hyundai Creta observed outside Astraea Labs with headlights off",
            who: ["Dr. Ananya Sen", "Hyundai Creta"],
            whenText: "01:05 AM to 01:38 AM, October 22, 2026",
            whenISO: "2026-10-22T01:05:00Z",
            where: "100 Feet Road, Indiranagar, Bengaluru",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Identify who was in the passenger seat of the white Creta at 01:38 AM.",
        ],
      },
      {
        authorKey: "iyer",
        date: new Date("2026-10-22T18:00:00Z"),
        text: "Questioned Dr. Ananya Sen at her Lavelle Road residence. Sen insisted she was flying in on an IndiGo flight from New Delhi and waited inside Kempegowda International Airport lounge until 02:00 AM due to heavy rain. However, subpoenaed Devanahalli toll plaza FASTag logs record her vehicle crossing into Bengaluru city limits at 10:15 PM, directly breaking her claimed airport alibi.",
        events: [
          {
            what: "Dr. Ananya Sen questioned; claimed airport alibi refuted by FASTag logs",
            who: ["Dr. Ananya Sen", "Insp. Priya Iyer"],
            whenText: "10:15 PM October 21 to 02:00 AM October 22",
            whenISO: "2026-10-21T22:15:00Z",
            where: "Kempegowda Airport Toll Plaza / Indiranagar",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Subpoena flight passenger manifest to verify if Dr. Sen was even aboard the New Delhi flight.",
        ],
      },
      {
        authorKey: "deshmukh",
        date: new Date("2026-10-23T11:00:00Z"),
        text: "Cyber forensics unit analyzed the deceased victim Rohan Murthy's encrypted ProtonMail inbox. Murthy had prepared a whistleblower report addressed to the Ministry of Defence detailing unauthorized code repositories maintained by former employee Rakesh Verma. Bank records show Verma received three rapid USDT transactions totaling ₹50 Lakh on October 21.",
        events: [
          {
            what: "Whistleblower dossier discovered linking Rakesh Verma to offshore crypto payments",
            who: ["Rohan Murthy", "Rakesh Verma", "Dr. Ananya Sen"],
            whenText: "October 21, 2026",
            whenISO: "2026-10-21T18:00:00Z",
            where: "Electronic City & Indiranagar, Bengaluru",
            confidence: 0.95,
          },
        ],
        openQuestions: [
          "Issue lookout circular (LOC) for Rakesh Verma at all international departure terminals.",
        ],
      },
    ],
  },

  // ----------------------------------------------------
  // CASE 3: New Delhi - Connaught Place / Barakhamba
  // ----------------------------------------------------
  {
    title: "The Barakhamba Bullion Depot Robbery",
    location: "Barakhamba Road, Connaught Place & DND Flyway, New Delhi",
    description:
      "Multi-agency investigation into an armed midnight raid at an unlisted precious metals repository near Connaught Place, resulting in the theft of 40 kg in stamped Swiss gold bullion and severe assault on security personnel.",
    summary:
      "At 02:15 AM on October 26, the subterranean gold vault behind Barakhamba Road was raided by masked assailants during a guard rotation. Night security guard Suraj Yadav was incapacitated. A silver Maruti Suzuki Brezza (DL-10-CB-3190) registered to interstate transporter Devraj Gujjar fled across DND Flyway. Logistics manager Harpreet Singh's claimed alibi in Karol Bagh was broken by Barakhamba cell tower CDR records.",
    entities: [
      {
        name: "Suraj Yadav",
        aliases: ["Guard Yadav"],
        type: "person",
        role: "victim",
        alibiStatus: "verified",
        alibiDetails: "Armed night security guard, sustained concussion from iron pipe, admitted to RML Hospital.",
      },
      {
        name: "Harpreet Singh",
        aliases: ["Honey", "Honey Singh"],
        type: "person",
        role: "suspect",
        alibiStatus: "broken",
        alibiDetails:
          "Claimed he was attending a family religious jagran in Karol Bagh until 4 AM; cell tower CDR places his phone within 200m of Barakhamba Road at 02:15 AM.",
      },
      {
        name: "Amitav Ghosh",
        aliases: ["Ghosh"],
        type: "person",
        role: "suspect",
        alibiStatus: "claimed",
        alibiDetails:
          "Head Bullion Accountant caught remotely attempting to delete ERP transaction manifests at 03:30 AM from his Noida residence.",
      },
      {
        name: "Devraj Gujjar",
        aliases: ["Gujjar"],
        type: "person",
        role: "suspect",
        alibiStatus: "unknown",
        alibiDetails:
          "Interstate fleet operator with active police history in Ghaziabad; vehicle recorded at DND toll plaza.",
      },
      {
        name: "Sunita Mehra",
        aliases: ["Mehra"],
        type: "person",
        role: "witness",
        alibiStatus: "verified",
        alibiDetails:
          "Assistant Branch Manager who called PCR 112 after finding the alarm power backup batteries severed.",
      },
      {
        name: "Maruti Suzuki Brezza",
        aliases: ["DL-10-CB-3190", "Silver Brezza"],
        type: "vehicle",
        role: "other",
        alibiStatus: "unknown",
        alibiDetails: "Silver Brezza registered to Devraj Gujjar. Captured on DND Flyway cameras at 02:44 AM.",
      },
    ],
    notes: [
      {
        authorKey: "deshmukh",
        date: new Date("2026-10-26T03:15:00Z"),
        text: "Responded to distress call from an unlisted bullion trading depot in the basement of Antriksh Bhawan on Barakhamba Road, Connaught Place. Armed guard Suraj Yadav was found unconscious with severe head trauma. The reinforced steel door of the consignment locker was cut open with an oxy-acetylene torch, and 40 stamped 1-kilogram Swiss gold bullion bars were stolen.",
        events: [
          {
            what: "Armed robbery at Barakhamba Bullion Depot; guard Suraj Yadav assaulted",
            who: ["Suraj Yadav", "Barakhamba Bullion Depot"],
            whenText: "02:15 AM, October 26, 2026",
            whenISO: "2026-10-26T02:15:00Z",
            where: "Antriksh Bhawan, Barakhamba Road, Connaught Place, New Delhi",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Recover hospital toxicology report for Suraj Yadav to confirm weapon type.",
        ],
      },
      {
        authorKey: "sharma",
        date: new Date("2026-10-26T07:45:00Z"),
        text: "Delhi Police CCTV surveillance footage from Connaught Place Inner and Outer Circle shows a silver Maruti Suzuki Brezza (DL-10-CB-3190) parking in the alley behind Barakhamba Road at 01:50 AM with hazard indicators active. Two individuals carrying heavy canvas duffel bags boarded the vehicle at 02:22 AM.",
        events: [
          {
            what: "Silver Brezza parked in rear alley; suspects loaded duffel bags",
            who: ["Maruti Suzuki Brezza", "Devraj Gujjar"],
            whenText: "01:50 AM to 02:22 AM, October 26, 2026",
            whenISO: "2026-10-26T01:50:00Z",
            where: "Barakhamba Road Alley, Connaught Place, New Delhi",
            confidence: 0.95,
          },
        ],
        openQuestions: [
          "Scan traffic cameras along Vikas Marg and Ring Road for secondary escape route.",
        ],
      },
      {
        authorKey: "iyer",
        date: new Date("2026-10-26T12:00:00Z"),
        text: "DND Flyway toll plaza FASTag transaction records reveal the silver Brezza (DL-10-CB-3190) sped across Lane 4 towards Noida at 02:44 AM. Ownership of the Brezza is registered to Devraj Gujjar, a transport operator previously flagged for contraband movement across the Delhi-Haryana border.",
        events: [
          {
            what: "Silver Brezza crossed DND Flyway toll plaza into Noida at 02:44 AM",
            who: ["Devraj Gujjar", "Maruti Suzuki Brezza"],
            whenText: "02:44 AM, October 26, 2026",
            whenISO: "2026-10-26T02:44:00Z",
            where: "DND Flyway Toll Plaza, Mayur Vihar / Noida",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Coordinate with UP Police STF to raid Devraj Gujjar's warehouse in Sector 63, Noida.",
        ],
      },
      {
        authorKey: "deshmukh",
        date: new Date("2026-10-26T16:30:00Z"),
        text: "Logistics coordinator Harpreet 'Honey' Singh was called into Connaught Place Police Station. Singh insisted he was attending an overnight family religious function in Karol Bagh from 10:00 PM until 04:30 AM. However, cellular CDR records from Airtel tower CP-09 show his phone placed two calls while connected to the Barakhamba Road cell tower between 02:10 AM and 02:30 AM, breaking his alibi.",
        events: [
          {
            what: "Harpreet Singh interrogated; Karol Bagh alibi broken by CP cell tower CDR logs",
            who: ["Harpreet Singh", "SI Kabir Deshmukh"],
            whenText: "02:10 AM to 02:30 AM, October 26, 2026",
            whenISO: "2026-10-26T02:10:00Z",
            where: "Connaught Place Police Station, New Delhi",
            confidence: 1.0,
          },
        ],
        openQuestions: [
          "Obtain search warrant for Harpreet Singh's locker at Punjab National Bank.",
        ],
      },
      {
        authorKey: "sharma",
        date: new Date("2026-10-27T10:15:00Z"),
        text: "Digital forensics audit of the depot's ERP accounting software revealed that Head Accountant Amitav Ghosh logged into the corporate portal remotely via VPN at 03:30 AM from his IP in Sector 15 Noida, attempting to purge shipment receipt #BL-8902 which recorded the 40 kg gold delivery.",
        events: [
          {
            what: "Amitav Ghosh caught attempting remote deletion of gold shipment ledgers",
            who: ["Amitav Ghosh"],
            whenText: "03:30 AM, October 26, 2026",
            whenISO: "2026-10-26T03:30:00Z",
            where: "Remote VPN / Sector 15, Noida",
            confidence: 0.95,
          },
        ],
        openQuestions: [
          "Seize Amitav Ghosh's personal laptop and inspect browser cache for communications with Devraj Gujjar.",
        ],
      },
    ],
  },
];

// ----------------------------------------------------
// Master Seeding Script Execution
// ----------------------------------------------------
async function seedIndianCases() {
  console.log("==================================================================");
  console.log(" CaseMemory: Seeding 3 Indian Investigators & 3 Collaborative Cases");
  console.log("==================================================================");

  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✓ Connected to MongoDB Atlas cluster.\n");
    const db = client.db(dbName);

    const usersCol = db.collection("users");
    const casesCol = db.collection("cases");
    const notesCol = db.collection("notes");
    const eventsCol = db.collection("events");
    const entitiesCol = db.collection("entities");
    const questionsCol = db.collection("openQuestions");

    // ----------------------------------------------------
    // Step 1: Upsert the 3 Indian Investigators
    // ----------------------------------------------------
    console.log("1. Upserting 3 Indian Investigators...");
    const investigatorIds: Record<string, string> = {};
    const allInvestigatorUserIds: string[] = [];

    for (const inv of INDIAN_INVESTIGATORS) {
      const passwordHash = await bcrypt.hash(inv.password, 10);
      const res = await usersCol.findOneAndUpdate(
        { email: inv.email },
        {
          $set: {
            name: inv.name,
            role: inv.role,
            passwordHash,
            badge: inv.badge,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      const id = res?._id?.toString() || "";
      investigatorIds[inv.key] = id;
      allInvestigatorUserIds.push(id);

      console.log(`  ✓ [INVESTIGATOR] ${inv.name}`);
      console.log(`    Email:    ${inv.email}`);
      console.log(`    Password: ${inv.password}`);
      console.log(`    Badge:    ${inv.badge} (ID: ${id})`);
    }

    // Also get Admin and default Demo Investigator IDs to give them access too
    const adminUser = await usersCol.findOne({ role: "admin" });
    const demoInvestigator = await usersCol.findOne({ email: "investigator@casememory.local" });

    const sharedMemberIds = Array.from(
      new Set([
        ...allInvestigatorUserIds,
        adminUser?._id?.toString() || "",
        demoInvestigator?._id?.toString() || "",
      ])
    ).filter(Boolean);

    console.log(`\nAll 3 Investigators + Admin will collaborate on all cases:`);
    console.log(`  Member IDs: [${sharedMemberIds.join(", ")}]\n`);

    // ----------------------------------------------------
    // Step 2: Seed the 3 Cases with Notes, Events, & Entities
    // ----------------------------------------------------
    for (let cIdx = 0; cIdx < INDIAN_CASES.length; cIdx++) {
      const caseDef = INDIAN_CASES[cIdx];
      console.log("------------------------------------------------------------------");
      console.log(`[Case ${cIdx + 1}/3] "${caseDef.title}"`);
      console.log(`Location: ${caseDef.location}`);
      console.log(`------------------------------------------------------------------`);

      // Idempotent cleanup of prior version of this case
      const existing = await casesCol.findOne({ title: caseDef.title });
      if (existing) {
        const oldId = existing._id.toString();
        console.log(`  Cleaning previous seed records for Case ID ${oldId}...`);
        await notesCol.deleteMany({ caseId: oldId });
        await eventsCol.deleteMany({ caseId: oldId });
        await entitiesCol.deleteMany({ caseId: oldId });
        await questionsCol.deleteMany({ caseId: oldId });
        await casesCol.deleteOne({ _id: existing._id });
      }

      // Create Case Document
      const caseInsert = await casesCol.insertOne({
        title: caseDef.title,
        description: caseDef.description,
        status: "active",
        memberIds: sharedMemberIds,
        summary: caseDef.summary,
        createdBy: investigatorIds.sharma || "system",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const caseId = caseInsert.insertedId.toString();
      console.log(`  ✓ Created Case Document (ID: ${caseId})`);

      const allCaseEventIds: string[] = [];
      const allCaseNoteIds: string[] = [];

      // Ingest Notes and Events
      for (let nIdx = 0; nIdx < caseDef.notes.length; nIdx++) {
        const noteDef = caseDef.notes[nIdx];
        const authorId = investigatorIds[noteDef.authorKey] || investigatorIds.sharma;

        console.log(`    Note ${nIdx + 1}/${caseDef.notes.length}: Generating embedding...`);
        const noteEmbedding = await embed(noteDef.text);

        const noteInsert = await notesCol.insertOne({
          caseId,
          authorId,
          text: noteDef.text,
          embedding: noteEmbedding,
          createdAt: noteDef.date,
        });
        const noteId = noteInsert.insertedId.toString();
        allCaseNoteIds.push(noteId);

        // Store Events with embeddings
        for (const ev of noteDef.events) {
          const eventText = `${ev.what}. Who: ${ev.who.join(", ")}. When: ${ev.whenText}. Where: ${ev.where}`;
          const eventEmbedding = await embed(eventText);

          const evInsert = await eventsCol.insertOne({
            caseId,
            noteId,
            what: ev.what,
            who: ev.who,
            whenText: ev.whenText,
            whenISO: ev.whenISO,
            where: ev.where,
            confidence: ev.confidence,
            embedding: eventEmbedding,
            createdAt: noteDef.date,
          });
          allCaseEventIds.push(evInsert.insertedId.toString());
        }

        // Store Open Questions
        for (const q of noteDef.openQuestions) {
          await questionsCol.insertOne({
            caseId,
            text: q,
            status: "open",
            noteId,
            createdAt: noteDef.date,
          });
        }
      }

      console.log(`  ✓ Ingested ${caseDef.notes.length} Notes & Extracted Events with 768-dim Embeddings`);

      // Seed Entities and link them to the case's noteIds and eventIds
      for (const ent of caseDef.entities) {
        await entitiesCol.insertOne({
          caseId,
          name: ent.name,
          aliases: ent.aliases,
          type: ent.type,
          role: ent.role,
          alibiStatus: ent.alibiStatus,
          alibiDetails: ent.alibiDetails,
          eventIds: allCaseEventIds,
          noteIds: allCaseNoteIds,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      console.log(`  ✓ Seeded ${caseDef.entities.length} Profiled Entities with Alibi Tracking`);
    }

    console.log("\n==================================================================");
    console.log(" ✅ SEEDING COMPLETE: 3 Investigators & 3 Collaborative Cases Ready!");
    console.log("==================================================================");
    console.log("\nDEMO LOGIN CREDENTIALS:");
    console.log("1. Insp. Rajesh Sharma: rajesh.sharma@casememory.in / SharmaPass123!");
    console.log("2. Insp. Priya Iyer:    priya.iyer@casememory.in    / PriyaPass123!");
    console.log("3. SI Kabir Deshmukh:   kabir.deshmukh@casememory.in / KabirPass123!");
    console.log("\nCASES READY IN TERMINAL:");
    console.log("• The BKC Diamond Bourse Vault Heist (Mumbai)");
    console.log("• The Indiranagar Autonomous Drone Espionage (Bengaluru)");
    console.log("• The Barakhamba Bullion Depot Robbery (New Delhi)");
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("❌ Seeding Error:", err?.message || err);
  } finally {
    await client.close();
  }
}

seedIndianCases();

