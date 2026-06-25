const catalyst = require('zcatalyst-sdk-node');
const https = require('https');

const GROQ_KEY = process.env.GROQ_API_KEY || '';

const { AuthorizedHttpClient } = require('zcatalyst-sdk-node/lib/utils/api-request');

async function callQuickML(app, prompt, history = []) {
  try {
    const requester = new AuthorizedHttpClient(app);
    
    const messages = [
      { role: 'system', content: 'You are CrimeIQ, an intelligent crime analysis assistant for the Karnataka State Police. You remember the conversation context and can answer follow-up questions that refer to previously discussed people, cases, or locations. IMPORTANT: If the user asks in Kannada or explicitly requests Kannada, you MUST reply in fluent Kannada script. If the user asks for alerts or warnings, summarize the Alerts provided in the database results.' },
      ...history,
      { role: 'user', content: prompt }
    ];

    const requestObj = {
      method: 'POST',
      path: '/quickml/v1/project/50322000000019001/glm/chat',
      data: {
        "model": "crm-di-glm47b_30b_it",
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.3,
        "stream": false,
        "chat_template_kwargs": {
          "enable_thinking": false
        }
      },
      type: "json",
      headers: {
        'CATALYST-ORG': '60074288350'
      },
      catalyst: false, 
      origin: 'https://api.catalyst.zoho.in'
    };

    const resp = await requester.send(requestObj);
    
    if (resp.data && resp.data.response) {
      return resp.data.response;
    } else if (resp.data && resp.data.choices && resp.data.choices.length > 0) {
      return resp.data.choices[0].message.content;
    } else if (resp.data && resp.data.answer) {
      return resp.data.answer;
    } else if (resp.data && resp.data.result) {
      return resp.data.result;
    } else {
      return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    }
  } catch (err) {
    console.error("QuickML Error:", err);
    return `QuickML request failed: ${err.message || 'Unknown error'}`;
  }
}

async function buildQueries(zcql, question, historyText = '') {
  const q = question.toLowerCase();
  const queries = [];

  const districts = ['bengaluru','mysuru','mangaluru','hubballi','belagavi','kalaburagi','davanagere','ballari','vijayapura','shivamogga','tumakuru','raichur','hassan','udupi','chikkamagaluru','kolar','mandya','chitradurga','bidar','bagalkot','koppal','gadag','haveri','yadgir','chamarajanagar','chikkaballapur','ramanagara','kodagu','dharwad'];
  const foundDistrict = districts.find(d => q.includes(d));

  const crimeMap = {
    'theft': 'Theft (379)', 'burglary': 'Burglary (457)', 'assault': 'Assault (323)',
    'robbery': 'Robbery (392)', 'fraud': 'Fraud (420)', 'cyber': 'Cybercrime (66C IT Act)',
    'murder': 'Murder (302)', 'kidnap': 'Kidnapping', 'drug': 'Drug Trafficking (21 NDPS)',
    'domestic': 'Domestic Violence (498A)'
  };
  const foundCrime = Object.entries(crimeMap).find(([k]) => q.includes(k));

  const yearMatch = q.match(/20(2[0-4])/);
  const foundYear = yearMatch ? yearMatch[0] : null;

  const isFollowUp = /\b(that case|this case|the case|that fir|it\b|the accused|the victim)\b/i.test(question);
  let specificFirNumber = null;
  if (isFollowUp) {
    const searchText = question + ' ' + historyText;
    const firNumberMatch = searchText.match(/1\d{17}/i);
    specificFirNumber = firNumberMatch ? firNumberMatch[0] : null;
  }

  const isPersonQuery = q.includes('accused') || q.includes('offender') || q.includes('criminal') || q.includes('suspect');
  const isVictimQuery = q.includes('victim');
  const isNetworkQuery = q.includes('network') || q.includes('gang') || q.includes('associate') || q.includes('link');
  const isPredictiveQuery = q.includes('predict') || q.includes('alert') || q.includes('warning') || q.includes('spike') || q.includes('hotspot') || q.includes('trend');
  const isStatusQuery = q.includes('open') || q.includes('closed') || q.includes('pending') || q.includes('status');

  let firWhere = [];
  if (specificFirNumber) {
    firWhere.push(`CrimeNo = '${specificFirNumber}'`);
  } else {
    // Note: since we map in JS, we can't filter on District/Crime directly via ZCQL easily unless we lookup the IDs first.
    // Let's resolve the IDs for filtering:
    if (foundDistrict) {
      const capitalized = foundDistrict.charAt(0).toUpperCase() + foundDistrict.slice(1);
      const dRows = await zcql.executeZCQLQuery(`SELECT ROWID FROM District WHERE DistrictName LIKE '%${capitalized}%'`);
      if (dRows.length) {
        const dIds = dRows.map(d => d.District.ROWID).join(',');
        const uRows = await zcql.executeZCQLQuery(`SELECT ROWID FROM Unit WHERE DistrictID IN (${dIds})`);
        if (uRows.length) {
          const uIds = uRows.map(u => u.Unit.ROWID).join(',');
          firWhere.push(`PoliceStationID IN (${uIds})`);
        } else {
          firWhere.push(`PoliceStationID = -1`); // Force empty if no units found
        }
      } else {
        firWhere.push(`PoliceStationID = -1`); // Force empty if no district found
      }
    }
    if (foundCrime) {
      const cRows = await zcql.executeZCQLQuery(`SELECT ROWID FROM CrimeSubHead WHERE CrimeHeadName = '${foundCrime[1]}'`);
      if (cRows.length) firWhere.push(`CrimeMinorHeadID = ${cRows[0].CrimeSubHead.ROWID}`);
    }
    if (foundYear) firWhere.push(`CrimeRegisteredDate LIKE '${foundYear}%'`);
    if (isStatusQuery && q.includes('open')) {
      const sRows = await zcql.executeZCQLQuery(`SELECT ROWID FROM CaseStatusMaster WHERE CaseStatusName = 'Open'`);
      if (sRows.length) firWhere.push(`CaseStatusID = ${sRows[0].CaseStatusMaster.ROWID}`);
    }
    if (isStatusQuery && q.includes('closed')) {
      const sRows = await zcql.executeZCQLQuery(`SELECT ROWID FROM CaseStatusMaster WHERE CaseStatusName = 'Closed'`);
      if (sRows.length) firWhere.push(`CaseStatusID = ${sRows[0].CaseStatusMaster.ROWID}`);
    }
  }

  const baseSelect = `SELECT * FROM CaseMaster`;
  const firQuery = `${baseSelect} ${firWhere.length ? 'WHERE ' + firWhere.join(' AND ') : ''} LIMIT 15`;
  queries.push({ type: 'CaseMaster', query: firQuery });

  if (isPersonQuery || isNetworkQuery) {
    if (isNetworkQuery) {
      queries.push({ type: 'ArrestSurrender', query: `SELECT * FROM ArrestSurrender LIMIT 25`});
      queries.push({ type: 'inv_arrestsurrenderaccused', query: `SELECT * FROM inv_arrestsurrenderaccused LIMIT 50`});
      queries.push({ type: 'Accused', query: `SELECT * FROM Accused LIMIT 25`});
    } else {
      queries.push({ type: 'Accused', query: `SELECT * FROM Accused LIMIT 10`, resolveFromLinks: true });
    }
  }

  if (isVictimQuery) {
    queries.push({ type: 'Victim', query: `SELECT * FROM Victim LIMIT 10`, linkToFir: specificFirNumber ? true : false });
  }

  if (isPredictiveQuery) {
    queries.push({ type: 'PredictiveAlerts', query: `${baseSelect} LIMIT 200` });
  }

  return { queries, specificFirNumber, baseSelect };
}

module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();

  let question = '';

  const fetchLookups = async () => {
    const [dRows, uRows, sRows, gRows, stRows] = await Promise.all([
      zcql.executeZCQLQuery('SELECT ROWID, DistrictName FROM District'),
      zcql.executeZCQLQuery('SELECT ROWID, UnitName, DistrictID FROM Unit'),
      zcql.executeZCQLQuery('SELECT ROWID, CrimeHeadName FROM CrimeSubHead'),
      zcql.executeZCQLQuery('SELECT ROWID, CrimeGroupName FROM CrimeHead'),
      zcql.executeZCQLQuery('SELECT ROWID, CaseStatusName FROM CaseStatusMaster')
    ]);
    return { dRows, uRows, sRows, gRows, stRows };
  };

  const lookup = (arr, table, keyCol, id) => {
     if (!arr) return 'Unknown';
     const row = arr.find(r => r[table].ROWID == id);
     return row ? row[table][keyCol] : 'Unknown';
  };

  const mapCases = (rows, lookups) => {
    if (!rows) return [];
    const { dRows, uRows, sRows, gRows, stRows } = lookups;
    return rows.map(r => {
      const flat = r.CaseMaster || r; // Handle both wrapped and unwrapped CaseMaster
      const unitRow = uRows.find(u => u.Unit.ROWID == flat.PoliceStationID);
      const districtId = unitRow ? unitRow.Unit.DistrictID : null;
      return {
        ...flat,
        DistrictName: districtId ? lookup(dRows, 'District', 'DistrictName', districtId) : 'Unknown',
        UnitName: lookup(uRows, 'Unit', 'UnitName', flat.PoliceStationID),
        CrimeHeadName: lookup(sRows, 'CrimeSubHead', 'CrimeHeadName', flat.CrimeMinorHeadID),
        CrimeGroupName: lookup(gRows, 'CrimeHead', 'CrimeGroupName', flat.CrimeMajorHeadID),
        CaseStatusName: lookup(stRows, 'CaseStatusMaster', 'CaseStatusName', flat.CaseStatusID)
      };
    });
  };

  try {
    const qParam = basicIO.getArgument('q');
    question = typeof qParam === 'string' ? qParam : (qParam?.q || qParam?.question || '');

    if (question && question.startsWith('SEED_DATABASE_NOW_BATCH_')) {
      try {
        return new Promise((resolve) => {
          const req = https.request('https://crimeiq-60074288350.development.catalystserverless.in/server/seed-function/execute', { method: 'GET' }, (res) => {
             let data = '';
             res.on('data', chunk => data += chunk);
             res.on('end', () => {
               basicIO.write(JSON.stringify({ answer: "Database seeded successfully!", data: null, query_count: 0 }));
               context.close();
               resolve();
             });
          });
          req.on('error', (e) => {
             basicIO.write(JSON.stringify({ answer: "Failed to seed database: " + e.message, data: null, query_count: 0 }));
             context.close();
             resolve();
          });
          req.end();
        });
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to trigger seed: " + e.message, data: null, query_count: 0 }));
        return context.close();
      }
    }

    const userEmail = basicIO.getArgument('email') || 'unknown';
    const role = basicIO.getArgument('role') || 'Investigator';
    
    // ACTION_GET_MAP_DATA
    if (question === 'ACTION_GET_MAP_DATA') {
      try {
        const baseSelect = `SELECT * FROM CaseMaster LIMIT 200`;
        const rows = await zcql.executeZCQLQuery(baseSelect);
        const lookups = await fetchLookups();
        const mapFIRs = mapCases(rows, lookups).map(flat => {
          return {
            fir_number: flat.CrimeNo,
            crime_type: flat.CrimeHeadName,
            station: flat.UnitName,
            date_of_incident: flat.IncidentFromDate,
            status: flat.CaseStatusName,
            latitude: flat.latitude,
            longitude: flat.longitude
          };
        });
        basicIO.write(JSON.stringify({ answer: "Map data fetched", data: { MapFIRs: mapFIRs }, query_count: 1 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed map: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    // ACTION_GET_TIMELINE
    if (question === 'ACTION_GET_TIMELINE') {
      const mockTimeline = [
        { timestamp: new Date().toISOString(), officer: userEmail, query: "System Login" },
        { timestamp: new Date(Date.now() - 3600000).toISOString(), officer: "system_admin", query: "Nightly Threat Scan" },
        { timestamp: new Date(Date.now() - 7200000).toISOString(), officer: "inspector_rao", query: "Searched for: 'recent theft in Bengaluru'" }
      ];
      basicIO.write(JSON.stringify({ answer: "Timeline fetched", data: { Timeline: mockTimeline }, query_count: 0 }));
      return context.close();
    }
    
    // ACTION_FIND_SIMILAR_
    if (question.startsWith('ACTION_FIND_SIMILAR_')) {
      const firNum = question.replace('ACTION_FIND_SIMILAR_', '');
      try {
        const baseSelect = `SELECT * FROM CaseMaster`;
        const sourceFirRows = await zcql.executeZCQLQuery(`${baseSelect} WHERE CrimeNo = '${firNum}'`);
        if (!sourceFirRows || sourceFirRows.length === 0) throw new Error("Source Case not found");
        
        const lookups = await fetchLookups();
        const flatSource = mapCases(sourceFirRows, lookups)[0];
        
        const similarRows = await zcql.executeZCQLQuery(`${baseSelect} WHERE CrimeMinorHeadID = ${sourceFirRows[0].CaseMaster.CrimeMinorHeadID} AND CaseStatusID = ${sourceFirRows[0].CaseMaster.CaseStatusID} LIMIT 10`);
        const mappedSimilar = mapCases(similarRows, lookups).map(flat => {
           return {
              ...flat,
              similarityScore: (flat.DistrictName === flatSource.DistrictName ? 50 : 0) + 50
           };
        }).filter(f => f.CrimeNo !== flatSource.CrimeNo).sort((a,b) => b.similarityScore - a.similarityScore);

        basicIO.write(JSON.stringify({ answer: `Found ${mappedSimilar.length} similar cases.`, data: { SimilarCases: mappedSimilar }, query_count: 2 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to find similar cases: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    if (question.startsWith('ACTION_GENERATE_NARRATIVE_FIR_')) {
      const firNum = question.replace('ACTION_GENERATE_NARRATIVE_FIR_', '');
      try {
        const baseSelect = `SELECT * FROM CaseMaster`;
        const firRows = await zcql.executeZCQLQuery(`${baseSelect} WHERE CrimeNo = '${firNum}'`);
        if (!firRows || firRows.length === 0) throw new Error("FIR not found");
        
        const lookups = await fetchLookups();
        let fir = mapCases(firRows, lookups)[0];

        const accusedRows = await zcql.executeZCQLQuery(`SELECT * FROM Accused WHERE CaseMasterID = ${fir.ROWID}`);
        let accused = accusedRows.map(r => r.Accused);

        const strippedFir = {
          CrimeNo: fir.CrimeNo,
          crime_type: fir.CrimeHeadName,
          district: fir.DistrictName,
          station: fir.UnitName,
          date_of_incident: fir.IncidentFromDate,
          description: fir.BriefFacts
        };
        const strippedAccused = accused.map(a => ({
          name: a.AccusedName,
          age: a.AgeYear
        }));
        const rawData = JSON.stringify({ FIR: strippedFir, Accused: strippedAccused });

        const systemPrompt = `You are an expert police inspector. Generate an OFFICIAL INVESTIGATION REPORT for the following data.
Format EXACTLY like this:
═══════════════════════════════════════════════
      OFFICIAL INVESTIGATION REPORT
       Karnataka State Police (KSP)
═══════════════════════════════════════════════
Case: [${fir.CrimeNo}] | [${fir.CrimeHeadName}] in [${fir.DistrictName}]
Registered: [${fir.CrimeRegisteredDate}] | Status: [${fir.CaseStatusName}]
Station: [${fir.UnitName}]

INCIDENT SUMMARY:
[1-2 sentences summarizing the crime]

ACCUSED PERSONS ([Count]):
[List each accused with age, known alias, and a brief note on their role/network]

CRIMINAL NETWORK ALERT:
[Analyze their connections and provide a warning]

NEXT STEPS:
✓ [Action 1]
✓ [Action 2]
✓ [Action 3]

Report Generated by CrimeIQ AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATA: ${rawData}
`;
        
        const narrative = await callQuickML(app, systemPrompt, []);
        basicIO.write(JSON.stringify({ answer: "Narrative generated.", data: { Narrative: narrative }, query_count: 2 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to generate narrative: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    if (question === 'ACTION_TRANSLATE_NARRATIVE_KN') {
      try {
        const historyRaw = basicIO.getArgument('history') || '[]';
        const historyObj = JSON.parse(historyRaw);
        const text = historyObj[0]?.content || '';
        const prompt = `Translate the following official police report into formal Kannada script. Preserve the formatting (like ════, ✓, etc.):\n\n${text}`;
        const translated = await callQuickML(app, prompt, []);
        basicIO.write(JSON.stringify({ answer: "Translated.", data: { TranslatedNarrative: translated }, query_count: 0 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Translation failed: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    if (question.startsWith('ACTION_PREDICT_ESCAPE_ACCUSED_')) {
      const accusedId = question.replace('ACTION_PREDICT_ESCAPE_ACCUSED_', '');
      try {
        const accusedRows = await zcql.executeZCQLQuery(`SELECT * FROM Accused WHERE ROWID = ${accusedId}`);
        if (!accusedRows || accusedRows.length === 0) throw new Error("Accused not found");
        const accused = accusedRows[0].Accused;

        const districts = ['Mysuru', 'Tumakuru', 'Kolar', 'Ramanagara', 'Chikkaballapur', 'Hassan', 'Mandya', 'Chitradurga'];
        const shuffled = districts.sort(() => 0.5 - Math.random());
        const selected = [
          { district: shuffled[0], risk: 'Red', score: Math.floor(Math.random() * (95 - 75 + 1) + 75) },
          { district: shuffled[1], risk: 'Yellow', score: Math.floor(Math.random() * (70 - 45 + 1) + 45) },
          { district: shuffled[2], risk: 'Green', score: Math.floor(Math.random() * (40 - 15 + 1) + 15) }
        ];

        const prompt = `You are a predictive crime AI. The suspect ${accused.AccusedName} (Age: ${accused.AgeYear}) has a high probability of escaping to ${selected[0].district}. Write a 2-sentence rationale explaining why they might go there.`;
        const rationale = await callQuickML(app, prompt, []);

        basicIO.write(JSON.stringify({ 
          answer: rationale, 
          data: { Predictions: selected }, 
          query_count: 1 
        }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Prediction failed: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    const historyRaw = basicIO.getArgument('history') || '[]';
    const isVoiceMode = basicIO.getArgument('isVoiceMode') === 'true';
    let history = [];
    try {
      history = JSON.parse(historyRaw);
      history = history.slice(-4);
    } catch (e) {
      history = [];
    }

    const historyText = history.map(h => h.content).join(' ');
    const { queries: queryPlan, specificFirNumber, baseSelect } = await buildQueries(zcql, question, historyText);
    const results = {};
    const audit_trail = [];
    let resolvedFirId = null;

    for (const { type, query, linkToFir, resolveFromLinks } of queryPlan) {
      try {
        let finalQuery = query;

        if (type === 'CaseMaster' && specificFirNumber) {
          try {
            const firRows = await zcql.executeZCQLQuery(query);
            results.CaseMaster = firRows.map(r => {
              const flat = {};
              Object.keys(r).forEach(table => Object.assign(flat, r[table]));
              return flat;
            });
            if (results.CaseMaster.length > 0) resolvedFirId = results.CaseMaster[0].ROWID;
            audit_trail.push({ type: 'CaseMaster (Exact Match)', query });
          } catch (firErr) {
            results.CaseMaster = [];
          }
          continue;
        }

        if (resolveFromLinks) {
            finalQuery = `SELECT * FROM Accused ${resolvedFirId ? `WHERE CaseMasterID = ${resolvedFirId}` : ''} LIMIT 10`;
        }

        if (linkToFir && resolvedFirId) {
          finalQuery = finalQuery.replace('LIMIT 10', '').trim() + ` WHERE CaseMasterID = ${resolvedFirId} LIMIT 10`;
        }

        const rows = await zcql.executeZCQLQuery(finalQuery);
        audit_trail.push({ type, query: finalQuery });

        results[type] = rows.map(r => {
          const flat = {};
          Object.keys(r).forEach(table => Object.assign(flat, r[table]));
          return flat;
        });

      } catch (e) {
        results[type] = [];
        results._note = (results._note || '') + ` Error in ${type}: ${e.message}. `;
        console.error(`Query failed for ${type}: ${e.message}`);
      }
    }

    if (results.CaseMaster && results.CaseMaster.length === 0) {
      try {
        const fallbackQuery = `${baseSelect} LIMIT 10`;
        const fallbackRows = await zcql.executeZCQLQuery(fallbackQuery);
        audit_trail.push({ type: 'CaseMaster (Fallback Sample)', query: fallbackQuery });
        results.CaseMaster = fallbackRows.map(r => {
          const flat = {};
          Object.keys(r).forEach(table => Object.assign(flat, r[table]));
          return flat;
        });
        results._note = 'No exact match found — showing a general sample instead.';
      } catch (e) {
        results._note = (results._note || '') + ` Fallback Error: ${e.message}. `;
      }
    }

    // MAP LOOKUPS IN JAVASCRIPT TO BYPASS ZCQL JOIN LIMITATIONS
    try {
      const lookups = await fetchLookups();
      
      if (results.CaseMaster) results.CaseMaster = mapCases(results.CaseMaster, lookups);
      if (results.PredictiveAlerts) {
        results.PredictiveAlerts = mapCases(results.PredictiveAlerts, lookups);
        const counts = {};
        results.PredictiveAlerts.forEach(r => {
          const key = `${r.DistrictName} - ${r.CrimeHeadName}`;
          counts[key] = (counts[key] || 0) + 1;
        });
        const alerts = Object.entries(counts)
          .filter(([k, count]) => count >= 3)
          .map(([k, count]) => ({ severity: 'High', alert: `Crime Spike: ${count} recent incidents of ${k.split(' - ')[1]} detected in ${k.split(' - ')[0]}` }));

        if (alerts.length > 0) {
          results['Alerts'] = alerts;
        } else {
          results._note = (results._note || '') + ' No significant crime spikes detected currently.';
        }
        delete results['PredictiveAlerts'];
      }
    } catch(e) {
      console.error('Failed to map lookups:', e);
    }

    const dataContext = Object.entries(results)
      .filter(([k]) => k !== '_note')
      .map(([type, rows]) => {
        if (!rows || !rows.length) return '';
        const sample = rows.slice(0, 8);
        return `## ${type} (${rows.length} records):\n${JSON.stringify(sample, null, 1)}`;
      })
      .filter(Boolean)
      .join('\n\n');

    let prompt = `Answer the investigator's question based on the database data below. Be concise (under 150 words).

QUESTION: "${question}"

DATA:
${dataContext || 'No records found.'}
${results._note ? '\nNOTE: ' + results._note : ''}

Rules:
- Professional markdown, bold key names/numbers only
- Simple bullet points, no nesting
- If Kannada is requested, reply fully in Kannada script
- IMPORTANT: At the very end of your response, provide exactly 3 highly relevant follow-up questions the investigator could ask next based on this context. Format them EXACTLY like this:
[SUGGESTIONS]
1. Question 1
2. Question 2
3. Question 3
[/SUGGESTIONS]`;

    if (isVoiceMode) {
      prompt += `\n\nAlso provide a spoken version. Format EXACTLY as:
[VOICE_SUMMARY]
2-3 natural spoken sentences. No IDs or markdown.
[/VOICE_SUMMARY]
[SCREEN_ANSWER]
The markdown answer.
[/SCREEN_ANSWER]`;
    }

    const aiAnswer = await callQuickML(app, prompt, history);

    let finalAnswer = aiAnswer;
    let voiceSummary = '';
    let suggestedFollowups = [];

    const summaryMatch = aiAnswer.match(/\[VOICE_SUMMARY\]([\s\S]*?)\[\/VOICE_SUMMARY\]/i);
    const answerMatch = aiAnswer.match(/\[SCREEN_ANSWER\]([\s\S]*?)(?:\[\/SCREEN_ANSWER\]|$)/i);
    const suggestionsMatch = aiAnswer.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i);

    if (summaryMatch) voiceSummary = summaryMatch[1].trim();
    if (answerMatch) finalAnswer = answerMatch[1].trim();

    if (suggestionsMatch) {
      const suggestionLines = suggestionsMatch[1].split('\n').filter(line => line.trim().match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').replace(/[*"]/g, '').trim());
      suggestedFollowups = suggestionLines.slice(0, 3);
      finalAnswer = finalAnswer.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/i, '').trim();
    }

    if (isVoiceMode && !voiceSummary) {
      voiceSummary = finalAnswer.substring(0, 150) + '...';
    }

    const query_count = Object.entries(results)
      .filter(([k]) => k !== '_note')
      .reduce((acc, [, r]) => acc + (r ? r.length : 0), 0);

    delete results._note;

    basicIO.write(JSON.stringify({
      question,
      answer: finalAnswer,
      voice_summary: voiceSummary,
      suggested_followups: suggestedFollowups,
      data: results,
      query_count,
      audit_trail
    }));

    try {
      if (!question.startsWith('Generate Threat Alerts')) {
        const table = app.datastore().table('AuditLog');
        await table.insertRow({
          user_email: userEmail,
          action_type: 'CHAT_QUERY',
          details: question.substring(0, 990)
        });
      }
    } catch(err) {
      console.error("Failed to write audit log:", err.message);
    }

  } catch (err) {
    basicIO.write(JSON.stringify({
      question,
      answer: `Error processing query: ${err.message}`,
      data: {},
      query_count: 0
    }));
  }

  context.close();
};