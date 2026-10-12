# Cloudflare Worker — AI εξήγηση λάθους μαθητή

Το `explain-mistake.js` είναι ένας Cloudflare Worker που παίρνει την άσκηση +
τη λάθος απάντηση του μαθητή και ρωτάει το **Claude API** να εξηγήσει πού
πιθανόν μπέρδεψε ο μαθητής τη λύση — π.χ. λάθος πρόσημο, ξέχασε να διαιρέσει,
μπέρδεψε τη σειρά πράξεων. Η εξήγηση εμφανίζεται στο `askiseis.html` όταν ο
μαθητής πατήσει το κουμπί **«Ρώτα τον βοηθό AI»** που εμφανίζεται μόνο όταν
απαντήσει λάθος.

## Γιατί Worker και όχι απευθείας κλήση από τη σελίδα

Το API key του Claude δεν πρέπει ΠΟΤΕ να μπει μέσα στο `askiseis.html` — θα
ήταν ορατό σε όλους. Ο Worker κρατά το κλειδί κρυφό (server-side secret) και
λειτουργεί σαν ασφαλής "μεσάζων" ανάμεσα στη σελίδα και το Claude API.

## Βήματα deploy

1. Φτιάξε δωρεάν λογαριασμό Cloudflare (αν δεν έχεις) και εγκατέστησε το
   Wrangler CLI: `npm install -g wrangler`
2. `wrangler login`
3. Μέσα σε αυτό το φάκελο, φτιάξε `wrangler.toml`:
   ```toml
   name = "mathdecoded-explain"
   main = "explain-mistake.js"
   compatibility_date = "2024-01-01"

   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "<βάλε εδώ το id namespace που θα φτιάξεις στο βήμα 4>"
   ```
4. Φτιάξε ένα KV namespace για rate limiting (προαιρετικό αλλά συστήνεται,
   ώστε να μην αδειάσει το API budget σου από κατάχρηση):
   `wrangler kv namespace create RATE_LIMIT_KV`
   (θα σου δώσει ένα id, βάλτο στο wrangler.toml παραπάνω)
5. Βάλε το δικό σου Anthropic API key ως secret (παίρνεις κλειδί από
   https://console.anthropic.com):
   `wrangler secret put ANTHROPIC_API_KEY`
6. `wrangler deploy`
7. Θα σου δώσει ένα URL σαν
   `https://mathdecoded-explain.<όνομα-σου>.workers.dev` — βάλτο στο
   `askiseis.html`, στη μεταβλητή `EXPLAIN_ENDPOINT` στην αρχή του `<script>`.
8. Στο `explain-mistake.js`, άλλαξε το `ALLOWED_ORIGIN` στο πραγματικό
   domain όπου θα ζει η σελίδα (π.χ. `https://pangeo57-debug.github.io`
   ή το δικό σου custom domain), ώστε μόνο η δική σου σελίδα να μπορεί να
   καλέσει τον Worker.

## Κόστος

Το Claude API χρεώνεται ανά token. Με `claude-haiku-5-5` (το πιο οικονομικό
μοντέλο) και όριο `max_tokens: 300`, κάθε εξήγηση κοστίζει πολύ λίγο (κλάσματα
του σεντ). Το rate limiting (1 αίτημα / 20 δευτ. ανά IP) είναι επιπλέον
προστασία ώστε να μη φάει κάποιος bot όλο το budget.

## Μέχρι να γίνει deploy

Μέχρι να ακολουθήσεις τα βήματα παραπάνω, το κουμπί «Ρώτα τον βοηθό AI» θα
εμφανίζεται στη σελίδα αλλά θα δείχνει μήνυμα ότι η υπηρεσία δεν είναι ακόμα
συνδεδεμένη (το `EXPLAIN_ENDPOINT` είναι άδειο by default).
