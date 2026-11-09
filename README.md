# Bokstavhopp

Et tastaturspill for små barn i 3D (three.js). Hver gang barnet trykker på en bokstav,
hopper **både den store og den lille bokstaven** opp samtidig – den store på en sky, den
lille på gresset rett under – med samme farge, googly-øyne og en egen tone. Slik kobles
tasten (som har stor bokstav) til både den store og den lille bokstaven.

## Moduser

- **Fri lek** – skriv fritt. Store bokstaver stiller seg opp på en sky øverst, og de små
  står på gresset rett under, i samme kolonne og med samme farge. Begge dukker opp samtidig,
  med et lite stjernedryss mellom dem. Bokstavene blir stående fra venstre mot høyre,
  så man kan skrive ord:
  ```
  K A T T   E R   S Ø T      <- skyen
  k a t t   e r   s ø t      <- gresset
  ```
  - `Mellomrom`: ordmellomrom. Ordet som er skrevet, blir lest opp og gjør et lite hopp.
  - `Enter`: alle hopper, konfetti, og hele linjen leses opp.
  - `Backspace`: fjerner siste bokstav. `Esc` / `Delete`: tømmer alt.
  - `←` / `→`: bokstavene blåses til siden og spretter tilbake på plass.
  - Når linjen er full, popper alle bokstavene, og man starter på nytt fra venstre.
  - Andre taster: stjernedryss.
  - Å holde inne en tast gir bare én bokstav (se `src/keyfilter.js`).
- **Øving** – en stor «K» dukker opp på skyen og en liten «k» på gresset, og stemmen spør
  «Hvor er K?».
  - Riktig tast: stort hopp, konfetti og en stjerne. 10 stjerner gir en pokal.
  - Feil tast er aldri «feil»: barnet ser og hører bokstaven det trykket på.
  - Etter to bom eller 7 sekunder vises et tastatur nederst der riktig tast blinker.
  - Under *Innstillinger* kan du begrense øvingen til noen bokstaver, f.eks. barnets navn.

## Kjør

```bash
npm install
npm run dev        # http://localhost:5173
```

Eller bygg en statisk versjon:

```bash
npm run build      # resultat i dist/
npm run preview
```

`dist/` må serveres fra en webserver (ikke åpnes direkte som fil).

## Tastaturlås og hvordan du kommer ut

Når spillet starter, går det i fullskjerm og låser tastaturet med
[Keyboard Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard_API).
Da går også `Esc`, `Alt+Tab`, Windows-tasten, `Ctrl+W` osv. til spillet i stedet for
nettleseren.

**Avslutt:** hold inne `Ctrl` + `Shift` og skriv `S` `L` `U` `T` `T`.

Ting du bør vite:

- **Bruk Chrome eller Edge.** Firefox og Safari støtter ikke tastaturlås.
- **Edge anbefales** fordi den har gode norske stemmer innebygd. Hvis nettleseren ikke har
  noen norsk stemme, blir ikke bokstavene lest opp (menyen sier fra om det).
- Hvis noen holder `Esc` inne i ca. 2 sekunder, går Chrome/Edge ut av fullskjerm.
  Da vises et banner, og et klikk hvor som helst går tilbake til fullskjerm.
- `Ctrl+Alt+Del` og noen få andre systemtaster kan ingen nettside stoppe.
- Vil du ha det helt tett, kjør nettleseren i kiosk-modus. Da finnes det ingen vei ut av
  fullskjerm med `Esc`:

  ```bash
  # Windows (Edge)
  msedge --kiosk http://localhost:5173 --edge-kiosk-type=fullscreen
  # Chrome
  chrome --kiosk http://localhost:5173
  ```

  I kiosk-modus lukker du nettleseren med `Alt+F4` etter at du har avsluttet spillet
  med tastekomboen.

Hemmelig kombinasjon og tidsgrense kan endres i `src/lockdown.js` (`EXIT_WORD`).

## Struktur

| Fil | Innhold |
| --- | --- |
| `src/main.js` | Meny, oppstart, tastaturhåndtering og spill-løkke |
| `src/lockdown.js` | Fullskjerm, tastaturlås, avslutningskombo, wake lock |
| `src/hopper.js` | 3D-bokstaver med øyne og sprett-fysikk |
| `src/world.js` | Bokstaver og effekter i scenen |
| `src/scene.js` | Kamera, lys, eng, skyer og blomster |
| `src/particles.js` | Konfetti og stjerner |
| `src/audio.js` | Syntetiske lydeffekter og norsk tale |
| `src/modes/free.js`, `src/modes/practice.js` | De to spillmodusene |
| `scripts/build-font.mjs` | Lager 3D-skriften fra `Andika-Bold.ttf` (`npm run font`) |

## Skrift

Bokstavene bruker [Andika](https://software.sil.org/andika/) fra SIL – en skrift laget
for barn som lærer å lese, med tydelige bokstavformer (f.eks. den enkle «ɑ»-formen).
Lisens: SIL Open Font License 1.1, se `public/fonts/OFL.txt`.
