/**
 * Cloudflare Worker: προωθεί την ερώτηση/λάθος απάντηση του μαθητή στο Claude API
 * και επιστρέφει μια σύντομη εξήγηση του πιθανού λάθους σκεπτικού.
 *
 * Deploy:
 *   1. wrangler login
 *   2. wrangler secret put ANTHROPIC_API_KEY   (βάζεις το δικό σου κλειδί από console.anthropic.com)
 *   3. wrangler deploy
 *   4. Στο askiseis.html, άλλαξε το EXPLAIN_ENDPOINT στο URL που θα σου δώσει το deploy
 *      (π.χ. https://mathdecoded-explain.<σου>.workers.dev)
 *
 * Rate limiting: ίδιας λογικής με το contact-proxy.js — 1 αίτημα κάθε 20 δευτερόλεπτα
 * ανά IP, μέσω Cloudflare KV, για να μην τρώγεται το API budget από bot/spam.
 * Αν δεν έχεις ήδη KV namespace, βάλε ένα στο wrangler.toml:
 *   [[kv_namespaces]]
 *   binding = "RATE_LIMIT_KV"
 *   id = "<το id του namespace σου>"
 */

const RATE_LIMIT_SECONDS = 20;
const ALLOWED_ORIGIN = 'https://pangeo57-debug.github.io'; // άλλαξέ το στο δικό σου domain όταν το πάρεις

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // --- rate limit ανά IP ---
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env.RATE_LIMIT_KV) {
      const key = `explain:${ip}`;
      const hit = await env.RATE_LIMIT_KV.get(key);
      if (hit) {
        return new Response(JSON.stringify({ error: 'Πολύ συχνά αιτήματα — περίμενε λίγα δευτερόλεπτα.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      await env.RATE_LIMIT_KV.put(key, '1', { expirationTtl: RATE_LIMIT_SECONDS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Λανθασμένο αίτημα.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { question, options, correctAnswer, studentAnswer, explain } = body || {};
    if (!question || !options || correctAnswer === undefined || studentAnswer === undefined) {
      return new Response(JSON.stringify({ error: 'Λείπουν στοιχεία.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // βασικά όρια μήκους, ώστε να μην μπορεί κανείς να στείλει τεράστιο payload
    const clip = (s, n) => String(s).slice(0, n);

    const userPrompt = `Άσκηση: ${clip(question, 500)}
Επιλογές: ${options.map((o, i) => `${i + 1}) ${clip(o, 150)}`).join(' · ')}
Σωστή απάντηση: ${clip(correctAnswer, 150)}
Απάντηση μαθητή (λάθος): ${clip(studentAnswer, 150)}
Επίσημη εξήγηση λύσης: ${clip(explain || '', 500)}

Εξήγησε σε 2-4 προτάσεις, στα ελληνικά, ποιο είναι το πιθανό λάθος σκεπτικό που οδήγησε τον μαθητή σε αυτή τη λανθασμένη απάντηση (π.χ. λάθος πρόσημο, ξέχασε να διαιρέσει, μπέρδεψε τη σειρά πράξεων κτλ), και δώσε μία μικρή συμβουλή για να το αποφύγει την επόμενη φορά. Μίλα απευθείας στον μαθητή, φιλικά και σύντομα — όχι ακαδημαϊκό ύφος.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'Σφάλμα στην κλήση AI.', detail: errText.slice(0, 300) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = await resp.json();
    const text = data?.content?.[0]?.text || 'Δεν βρέθηκε εξήγηση.';

    return new Response(JSON.stringify({ explanation: text }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },
};
