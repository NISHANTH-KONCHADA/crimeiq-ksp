const catalyst = require('zcatalyst-sdk-node');
const https = require('https');

// API key is set as an environment variable in the Catalyst console:
// Serverless → Functions → chat-function → Configurations → Environment Variables → GROQ_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY || '';

// ── QuickML Implementation ───────────────────────────────────────────────────
// Using the Catalyst QuickML VLM endpoint generated from the console
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
    
    // Handle standard VLM/GLM response formats
    if (resp.data && resp.data.response) {
      // GLM 4.7 Flash seems to return the text inside 'response'
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

// ── Groq Fallback (Commented Out) ──────────────────────────────────────────
/*
function callGroq(prompt, history = []) {
  return new Promise((resolve, reject) => {
    const messages = [
      { role: 'system', content: 'You are CrimeIQ, an intelligent crime analysis assistant for the Karnataka State Police. You remember the conversation context and can answer follow-up questions that refer to previously discussed people, cases, or locations. IMPORTANT: If the user asks in Kannada or explicitly requests Kannada, you MUST reply in fluent Kannada script. If the user asks for alerts or warnings, summarize the Alerts provided in the database results.' },
      ...history,
      { role: 'user', content: prompt }
    ];

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.3,
      max_tokens: 2048
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 20000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            resolve(`Groq error: ${parsed.error.message}`);
            return;
          }
          const text = parsed.choices?.[0]?.message?.content || 'No response from AI.';
          resolve(text);
        } catch (e) {
          resolve('Failed to parse Groq response: ' + data.substring(0, 200));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve('AI response timed out. Please try again.');
    });
    req.on('error', (e) => resolve('Groq request failed: ' + e.message));
    req.write(body);
    req.end();
  });
}
*/

// ── Query builder ────────────────────────────────────────────────────────────
function buildQueries(question, historyText = '') {
  const q = question.toLowerCase();
  const queries = [];

  const districts = ['bengaluru','mysuru','mangaluru','hubballi','belagavi','kalaburagi','davanagere','ballari','vijayapura','shivamogga','tumakuru','raichur','hassan','udupi','chikkamagaluru','kolar','mandya','chitradurga','bidar','bagalkot','koppal','gadag','haveri','yadgir','chamarajanagar','chikkaballapur','ramanagara','kodagu','dharwad'];
  const foundDistrict = districts.find(d => q.includes(d));

  const crimeMap = {
    'theft': 'Theft', 'burglary': 'Burglary', 'assault': 'Assault',
    'robbery': 'Robbery', 'fraud': 'Fraud', 'cyber': 'Cybercrime',
    'murder': 'Murder', 'kidnap': 'Kidnapping', 'drug': 'Drug Trafficking',
    'domestic': 'Domestic Violence'
  };
  const foundCrime = Object.entries(crimeMap).find(([k]) => q.includes(k));

  const yearMatch = q.match(/20(2[0-4])/);
  const foundYear = yearMatch ? yearMatch[0] : null;

  const isFollowUp = /\b(that case|this case|the case|that fir|it\b|the accused|the victim)\b/i.test(question);
  let specificFirNumber = null;
  if (isFollowUp) {
    const searchText = question + ' ' + historyText;
    const firNumberMatch = searchText.match(/FIR-[A-Z]{3}-\d{4}-\d{4}/i);
    specificFirNumber = firNumberMatch ? firNumberMatch[0].toUpperCase() : null;
  }

  const isPersonQuery = q.includes('accused') || q.includes('offender') || q.includes('criminal') || q.includes('suspect');
  const isVictimQuery = q.includes('victim');
  const isNetworkQuery = q.includes('network') || q.includes('gang') || q.includes('associate') || q.includes('link');
  const isPredictiveQuery = q.includes('predict') || q.includes('alert') || q.includes('warning') || q.includes('spike') || q.includes('hotspot') || q.includes('trend');
  const isStatusQuery = q.includes('open') || q.includes('closed') || q.includes('pending') || q.includes('status');

  let firWhere = [];
  if (specificFirNumber) {
    firWhere.push(`fir_number = '${specificFirNumber}'`);
  } else {
    if (foundDistrict) {
      const capitalized = foundDistrict.charAt(0).toUpperCase() + foundDistrict.slice(1);
      firWhere.push(`district = '${capitalized}'`);
    }
    if (foundCrime) firWhere.push(`crime_type = '${foundCrime[1]}'`);
    if (foundYear) firWhere.push(`date_of_incident LIKE '${foundYear}%'`);
    if (isStatusQuery && q.includes('open')) firWhere.push(`status = 'Open'`);
    if (isStatusQuery && q.includes('closed')) firWhere.push(`status = 'Closed'`);
  }

  const firQuery = `SELECT * FROM FIR ${firWhere.length ? 'WHERE ' + firWhere.join(' AND ') : ''} LIMIT 15`;
  queries.push({ type: 'FIR', query: firQuery });

  if (isPersonQuery || isNetworkQuery) {
    queries.push({ type: 'CriminalLink', query: `SELECT * FROM CriminalLink LIMIT 15` });
    queries.push({ type: 'Accused', query: `SELECT * FROM Accused LIMIT 10`, resolveFromLinks: true });
  }

  if (isVictimQuery) {
    queries.push({ type: 'Victim', query: `SELECT * FROM Victim LIMIT 10`, linkToFir: specificFirNumber ? true : false });
  }

  if (isPredictiveQuery) {
    queries.push({ type: 'PredictiveAlerts', query: `SELECT district, crime_type, date_of_incident FROM FIR LIMIT 200` });
  }

  return { queries, specificFirNumber };
}

// ── Main function ─────────────────────────────────────────────────────────
module.exports = async (context, basicIO) => {
  const app = catalyst.initialize(context);
  const zcql = app.zcql();

  let question = '';

  try {
    const qParam = basicIO.getArgument('q');
    question = typeof qParam === 'string' ? qParam : (qParam?.q || qParam?.question || '');

    // SECRET SEED TRIGGER
    if (question && question.startsWith('SEED_DATABASE_NOW_BATCH_')) {
      const batchNum = parseInt(question.split('_').pop());
      const seedScript = require('./seed');
      const seedResult = await seedScript(app, batchNum);
      basicIO.write(JSON.stringify({ answer: seedResult, data: null, query_count: 0 }));
      return context.close();
    }

    const userEmail = basicIO.getArgument('userEmail') || 'unknown_user';

    // 1. Audit Log Fetcher
    if (question === 'ACTION_GET_AUDIT_LOGS') {
      try {
        const logs = await zcql.executeZCQLQuery(`SELECT * FROM AuditLog ORDER BY CREATEDTIME DESC LIMIT 50`);
        const mappedLogs = logs.map(l => l.AuditLog);
        basicIO.write(JSON.stringify({ answer: "Audit logs retrieved.", data: { AuditLogs: mappedLogs }, query_count: 0 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to fetch audit logs: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    // 2. Geospatial Map Data Fetcher
    if (question === 'ACTION_GET_MAP_DATA') {
      try {
        const firs = await zcql.executeZCQLQuery(`SELECT fir_number, station, district, crime_type, date_of_incident, status, latitude, longitude FROM FIR LIMIT 300`);
        const mappedFirs = firs.map(f => f.FIR);
        basicIO.write(JSON.stringify({ answer: "Map data retrieved.", data: { MapFIRs: mappedFirs }, query_count: 0 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to fetch map data: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    // 3. Officer Timeline: Track FIR
    if (question.startsWith('ACTION_TRACK_FIR_')) {
      const firNum = question.replace('ACTION_TRACK_FIR_', '');
      try {
        const existing = await zcql.executeZCQLQuery(`SELECT ROWID, tracked_firs FROM UserActivity WHERE user_email = '${userEmail}'`);
        let tracked = [];
        let rowId = null;
        if (existing && existing.length > 0) {
          rowId = existing[0].UserActivity.ROWID;
          try { tracked = JSON.parse(existing[0].UserActivity.tracked_firs || '[]'); } catch(e){}
        }
        
        if (!tracked.includes(firNum)) {
          tracked.unshift(firNum);
          if (tracked.length > 20) tracked = tracked.slice(0, 20);
        }

        const table = app.datastore().table('UserActivity');
        if (rowId) {
          await table.updateRow({ ROWID: rowId, tracked_firs: JSON.stringify(tracked) });
        } else {
          await table.insertRow({ user_email: userEmail, tracked_firs: JSON.stringify(tracked) });
        }
        
        basicIO.write(JSON.stringify({ answer: `Tracking updated for ${firNum}`, data: null, query_count: 0 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to track FIR: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    // 4. Officer Timeline: Get Tracked
    if (question === 'ACTION_GET_TIMELINE') {
      try {
        const existing = await zcql.executeZCQLQuery(`SELECT tracked_firs FROM UserActivity WHERE user_email = '${userEmail}'`);
        let tracked = [];
        if (existing && existing.length > 0) {
          try { tracked = JSON.parse(existing[0].UserActivity.tracked_firs || '[]'); } catch(e){}
        }
        basicIO.write(JSON.stringify({ answer: "Timeline retrieved.", data: { Timeline: tracked }, query_count: 0 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to fetch timeline: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    // 5. Case Similarity Matcher
    if (question.startsWith('ACTION_FIND_SIMILAR_')) {
      const firNum = question.replace('ACTION_FIND_SIMILAR_', '');
      try {
        const sourceFirRows = await zcql.executeZCQLQuery(`SELECT * FROM FIR WHERE fir_number = '${firNum}'`);
        if (!sourceFirRows || sourceFirRows.length === 0) throw new Error("Source FIR not found");
        const sourceFir = sourceFirRows[0].FIR;
        
        const similarRows = await zcql.executeZCQLQuery(`SELECT * FROM FIR WHERE crime_type = '${sourceFir.crime_type}' AND status = 'Open' AND ROWID != ${sourceFir.ROWID} LIMIT 10`);
        const mappedSimilar = similarRows.map(r => r.FIR).map(f => ({
          ...f,
          similarityScore: (f.district === sourceFir.district ? 50 : 0) + 50
        })).sort((a,b) => b.similarityScore - a.similarityScore);

        basicIO.write(JSON.stringify({ answer: `Found ${mappedSimilar.length} similar cases.`, data: { SimilarCases: mappedSimilar }, query_count: 2 }));
      } catch (e) {
        basicIO.write(JSON.stringify({ answer: "Failed to find similar cases: " + e.message, data: null, query_count: 0 }));
      }
      return context.close();
    }

    // 6. AI-Generated Case Narrative
    if (question.startsWith('ACTION_GENERATE_NARRATIVE_FIR_')) {
      const firNum = question.replace('ACTION_GENERATE_NARRATIVE_FIR_', '');
      try {
        const firRows = await zcql.executeZCQLQuery(`SELECT * FROM FIR WHERE fir_number = '${firNum}'`);
        if (!firRows || firRows.length === 0) throw new Error("FIR not found");
        const fir = firRows[0].FIR;

        const links = await zcql.executeZCQLQuery(`SELECT * FROM CriminalLink WHERE fir_id = ${fir.ROWID} LIMIT 10`);
        const idSet = new Set();
        links.forEach(l => {
          if (l.CriminalLink.accused_id_1) idSet.add(l.CriminalLink.accused_id_1);
          if (l.CriminalLink.accused_id_2) idSet.add(l.CriminalLink.accused_id_2);
        });
        const ids = Array.from(idSet);
        let accused = [];
        if (ids.length > 0) {
          const accusedRows = await zcql.executeZCQLQuery(`SELECT * FROM Accused WHERE ROWID IN (${ids.join(',')})`);
          accused = accusedRows.map(r => r.Accused);
        }

        const strippedFir = {
          fir_number: fir.fir_number,
          crime_type: fir.crime_type,
          district: fir.district,
          station: fir.station,
          date_of_incident: fir.date_of_incident,
          description: fir.description
        };
        const strippedAccused = accused.map(a => ({
          name: a.first_name + ' ' + a.last_name,
          age: a.age,
          address: a.address
        }));
        const rawData = JSON.stringify({ FIR: strippedFir, Accused: strippedAccused });

        const systemPrompt = `You are an expert police inspector. Generate an OFFICIAL INVESTIGATION REPORT for the following data.
Format EXACTLY like this:
═══════════════════════════════════════════════
      OFFICIAL INVESTIGATION REPORT
       Karnataka State Police (KSP)
═══════════════════════════════════════════════
Case: [FIR Number] | [Crime Type] in [District]
Registered: [Date] | Status: [Status]
Station: [Station]

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

    // 7. Translate Narrative to Kannada
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

    // 8. Geo-Based Crime Predictor
    if (question.startsWith('ACTION_PREDICT_ESCAPE_ACCUSED_')) {
      const accusedId = question.replace('ACTION_PREDICT_ESCAPE_ACCUSED_', '');
      try {
        const accusedRows = await zcql.executeZCQLQuery(`SELECT * FROM Accused WHERE ROWID = ${accusedId}`);
        if (!accusedRows || accusedRows.length === 0) throw new Error("Accused not found");
        const accused = accusedRows[0].Accused;

        // Simplified logic: Pick 3 districts to simulate AI prediction
        const districts = ['Mysuru', 'Tumakuru', 'Kolar', 'Ramanagara', 'Chikkaballapur', 'Hassan', 'Mandya', 'Chitradurga'];
        const shuffled = districts.sort(() => 0.5 - Math.random());
        const selected = [
          { district: shuffled[0], risk: 'Red', score: Math.floor(Math.random() * (95 - 75 + 1) + 75) },
          { district: shuffled[1], risk: 'Yellow', score: Math.floor(Math.random() * (70 - 45 + 1) + 45) },
          { district: shuffled[2], risk: 'Green', score: Math.floor(Math.random() * (40 - 15 + 1) + 15) }
        ];

        const prompt = `You are a predictive crime AI. The suspect ${accused.first_name} ${accused.last_name} (Age: ${accused.age}) has a high probability of escaping to ${selected[0].district}. Write a 2-sentence rationale explaining why they might go there (e.g. gang connections, avoiding high-security checkpoints).`;
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
      history = history.slice(-4); // Reduced from 6 to 4 to save tokens
    } catch (e) {
      history = [];
    }

    const historyText = history.map(h => h.content).join(' ');
    const { queries: queryPlan, specificFirNumber } = buildQueries(question, historyText);
    const results = {};
    const audit_trail = [];
    let resolvedFirId = null;

    for (const { type, query, linkToFir, resolveFromLinks } of queryPlan) {
      try {
        let finalQuery = query;

        if (type === 'FIR' && specificFirNumber) {
          try {
            const firRows = await zcql.executeZCQLQuery(query);
            results.FIR = firRows.map(r => {
              const flat = {};
              Object.keys(r).forEach(table => Object.assign(flat, r[table]));
              return flat;
            });
            if (results.FIR.length > 0) resolvedFirId = results.FIR[0].ROWID;
            audit_trail.push({ type: 'FIR (Exact Match)', query });
          } catch (firErr) {
            results.FIR = [];
          }
          continue;
        }

        if (resolveFromLinks && results.CriminalLink) {
          const idSet = new Set();
          results.CriminalLink.forEach(l => {
            if (l.accused_id_1) idSet.add(l.accused_id_1);
            if (l.accused_id_2) idSet.add(l.accused_id_2);
          });
          const ids = Array.from(idSet).slice(0, 20);
          if (ids.length > 0) {
            finalQuery = `SELECT * FROM Accused WHERE ROWID IN (${ids.join(',')})`;
          } else {
            results[type] = [];
            continue;
          }
        }

        if (linkToFir && resolvedFirId) {
          finalQuery = finalQuery.replace('LIMIT 10', '').trim() + ` WHERE fir_id = ${resolvedFirId} LIMIT 10`;
        }

        const rows = await zcql.executeZCQLQuery(finalQuery);
        audit_trail.push({ type, query: finalQuery });

        results[type] = rows.map(r => {
          const flat = {};
          Object.keys(r).forEach(table => Object.assign(flat, r[table]));
          return flat;
        });

        // Compute hotspots for early warnings
        if (type === 'PredictiveAlerts') {
          const counts = {};
          results[type].forEach(r => {
            const key = `${r.district} - ${r.crime_type}`;
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

      } catch (e) {
        results[type] = [];
        console.error(`Query failed for ${type}: ${e.message}`);
      }
    }

    if (results.FIR && results.FIR.length === 0) {
      try {
        const fallbackQuery = 'SELECT * FROM FIR LIMIT 10';
        const fallbackRows = await zcql.executeZCQLQuery(fallbackQuery);
        audit_trail.push({ type: 'FIR (Fallback Sample)', query: fallbackQuery });
        results.FIR = fallbackRows.map(r => {
          const flat = {};
          Object.keys(r).forEach(table => Object.assign(flat, r[table]));
          return flat;
        });
        results._note = 'No exact match found — showing a general sample instead.';
      } catch (e) {}
    }

    const dataContext = Object.entries(results)
      .filter(([k]) => k !== '_note')
      .map(([type, rows]) => {
        if (!rows || !rows.length) return '';
        // Limit data sent to Groq to avoid huge prompts
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