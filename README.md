# MathDecoded

Landing page για ιδιωτικά μαθήματα Μαθηματικών — προετοιμασία **SAT** και
Πανελλήνιες. Ίδιο πνεύμα με τα αδερφά projects
([RoutePal](https://github.com/pangeo57-debug/routiq),
[DropOff](https://github.com/pangeo57-debug/Dropoff)): single-file HTML/CSS/JS,
χωρίς build step, PWA-installable.

Το brand βασίζεται στο υπάρχον Instagram
[@math__decoded](https://www.instagram.com/math__decoded) — το λογότυπο
(μισός εγκέφαλος με τύπους, μισός με γεωμετρικό μοτίβο) αναδημιουργήθηκε ως
vector (`assets/logo-mark.svg`) στα ίδια χρώματα, ώστε να είναι καθαρό σε
κάθε ανάλυση/οθόνη.

## Αρχεία

- `index.html` — όλη η landing page (HTML/CSS/JS), single file.
- `assets/logo-mark.svg` — το λογότυπο σε vector μορφή (πηγή για τα icons).
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png` — παραγμένα από το `logo-mark.svg`.
- `manifest.json`, `sw.js` — PWA (installable, βασικό offline caching).

## Πριν βγει live

Η σελίδα έχει μερικά placeholder σημεία, σημειωμένα με `TODO` μέσα στο
`index.html`:

1. **Βιογραφικό** (ενότητα «Σχετικά») — αντικατέστησε το με τα πραγματικά
   σου στοιχεία/εμπειρία.
2. **Στοιχεία επικοινωνίας** (ενότητα «Επικοινωνία») — βάλε πραγματικό
   email/τηλέφωνο· αυτή τη στιγμή η φόρμα ανοίγει `mailto:` σε placeholder
   διεύθυνση.
3. **Τιμές πακέτων** — τώρα είναι κενές/ενδεικτικές.
4. **Μαρτυρίες μαθητών** — προαιρετικό, πρόσθεσέ τες όταν υπάρξουν.

## Ανάπτυξη

Δεν χρειάζεται τίποτα ιδιαίτερο — άνοιξε το `index.html` σε browser, ή τρέξε
έναν local server (π.χ. `python3 -m http.server`) για σωστή λειτουργία του
Service Worker/manifest.

## Deployment

GitHub Pages πάνω στο `main` branch, root του repo — η σελίδα σερβίρεται
από το `index.html` στο root, π.χ.
`https://pangeo57-debug.github.io/rafattack/`.

## Αλλαγή του λογότυπου

Το `assets/logo-mark.svg` είναι η πηγή. Αν αλλάξεις κάτι εκεί, τα PNG icons
(`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png`) πρέπει
να ξαναπαραχθούν από αυτό (π.χ. με οποιοδήποτε εργαλείο SVG→PNG rendering,
στα ίδια μεγέθη).
