const catalyst = require('zcatalyst-sdk-node');
const https = require('https');

// API key is set as an environment variable in the Catalyst console:
// Serverless → Functions → chat-function → Configurations → Environment Variables → GROQ_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY || '';

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
      max_tokens: 400
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
- If Kannada is requested, reply fully in Kannada script`;

    if (isVoiceMode) {
      prompt += `\n\nAlso provide a spoken version. Format EXACTLY as:
[VOICE_SUMMARY]
2-3 natural spoken sentences. No IDs or markdown.
[/VOICE_SUMMARY]
[SCREEN_ANSWER]
The markdown answer.
[/SCREEN_ANSWER]`;
    }

    const aiAnswer = await callGroq(prompt, history);

    let finalAnswer = aiAnswer;
    let voiceSummary = '';

    const summaryMatch = aiAnswer.match(/\[VOICE_SUMMARY\]([\s\S]*?)\[\/VOICE_SUMMARY\]/i);
    const answerMatch = aiAnswer.match(/\[SCREEN_ANSWER\]([\s\S]*?)(?:\[\/SCREEN_ANSWER\]|$)/i);

    if (summaryMatch) voiceSummary = summaryMatch[1].trim();
    if (answerMatch) finalAnswer = answerMatch[1].trim();

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
      data: results,
      query_count,
      audit_trail
    }));

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