# The Breakaway — Legends 0.4

Et road-cycling-spill med én tommel: en vertikal watt-slider. Du er i et brudd
på fem mann, ~23 km igjen, og feltet bak er kalibrert til å ta den beste av dere
med ett eneste sekund. Motstanderne trekkes fra et felt på 23 legender —
sprintere, brudd-spesialister og klatrere, vektet etter hva dagens finale
betaler — og dagen avgjøres i én av tre finaler: massespurt-flatt, rouleur-vei
eller toppavslutning.

## Kjør det

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # produksjonsbygg i dist/
npm run preview  # server dist/ lokalt
npm run bundle   # dist/breakaway.html — hele spillet i én selvstendig fil
```

## Byggeren

ROLL OUT fra menyen åpner byggeren: dagens finaletype, løypeprofilen, de fire
trukne motstanderne med lag og klasse — og rytteren din. **Vekt** i ekte kilo
(50–86, koster ingen poeng) og fire attributter 1–10 under et budsjett på 24
poeng. Vekten priser seg selv gjennom fysikken: tung kjøper absolutte watt til
flata, lett kjøper W/kg til veggen — 50 kg er best på klatredager, 86 kg på
spurtdager, ingen vekt vinner overalt. Trykk på en rytter (i byggeren eller på
veien) for kortet hans: portrett, meritter og de samme 1–10-pipene som
byggeren bruker — legender og bygg måles på én skala.

## Kontrollene

| Knapp | Hva den gjør |
| --- | --- |
| **Watt-slideren** | Flytter instruksjonsboblen (settpunktet). Den mørke boblen er watt akkurat nå. |
| **MANUAL** | Beina rir settpunktet. Velg et tall, lev med det. |
| **RELAY** | Rotasjonen. Dragene dine — front og gjennomrulling — rir instruksjonswattene dine. |
| **END TURN** | I bruddet er det mannen på fronten som sier når draget er over. Det er denne. |
| **SIT ON** | Du sitter på og betaler ingenting. Du holder plassen din til noen kommer opp bakfra — da viker du nøyaktig ett hakk. |
| **HTFU!** | To ganger per løp: lås opp den delen av tanken slitasjen har stengt. Regningen kommer. |
| **SPRINT** | Hold = alt du har. Slipp = tilbake til MANUAL på terskel. |
| **⏸ / 1× 5× 10× 100×** | Pause og simuleringshastighet. Store hendelser tvinger 1×. |
| **↻** | Nytt løp, ny seed, ny trekning. |

Grønn strek på slideren er terskelen din. Rød strek er alt du har akkurat nå —
brenn fyrstikkene og den synker. På hjul holder autopiloten hjulet for deg
(kroppen tillatende), og hjulet er alltid halen av *toget*: den sammenhengende
kjeden fra fremste mann, brutt der gapet mellom to ryttere er mer enn en
sykkellengde. En slenger som selv har mistet toget er ikke hjulet ditt.

## Sånn er det bygget

Én vei gjennom lagene, aldri motsatt:

```
content  →  sim  →  render  →  ui
 (data)    (motor)  (piksler)  (skall)
              ↑
           tools
```

| Mappe | Hva som ligger der |
| --- | --- |
| `src/content/` | `tuning.js` — alle balansetallene, med begrunnelser. `riders.js` — de 23 legendene. `stage.js` — de tre finaletypene. `builder.js` — bygge-budsjettet og prisingen. |
| `src/sim/` | Motoren: fysikk, kropp, taktikk, felt, fartsplan, ett sekund om gangen. **Rører aldri DOM.** `sim/index.js` er den offentlige flaten. |
| `src/render/` | Leser tilstand, skriver piksler. Endrer aldri noe. |
| `src/ui/` | React-skallet: knapper, skjermer, byggeren, rytterkortet, watt-slideren. |
| `tools/` | Kjører mot `sim/` direkte, uten nettleser. |

Regelen er verdt å håndheve: fordi `sim/` ikke vet at det finnes en skjerm, kan
hundrevis av løp kjøres på sekunder i Node i stedet for å klikkes gjennom en
nettleser. Samme seed gir samme løp, hver gang.

```bash
npm run golden                              # 40 faste løp, krever bit-identisk resultat
npm run solo                                # vakta: en solo fra start skal ALDRI vinne
npm run race -- 1000 --every=100            # ett løp, telemetri per sekund
npm run sweep -- PEL_LEAD -0.03 -0.04 -0.05 # balansesveip over løyper og vind
```

`npm run golden` er sikkerhetsnettet: en refaktorering av simuleringen er enten
bit-identisk eller en feil. Endrer du noe med vilje, skriv ny fasit med
`npm run golden:write` — og se på diffen først.

Vite + React 18, canvas-rendering, ingen andre avhengigheter.

## Simuleringen i korte trekk

- **Banen** bygges fra en seeded RNG — stigninger, høyde, vind langs veien —
  og finaletypen trekkes av seedens første kast.
- **Kroppen** er fire tanker: **fuel** (glykogenet — under terskel betaler
  fettet en ekte andel, så et hjul koster billigere watt, ikke bare færre),
  **surge** (fyrstikkene, W′), **jump** (den alaktiske — spurten, rykket,
  dekningen) og **wear** (slitasjen som aldri kommer tilbake). Terskelen leses
  av rytterens egen power–duration-kurve.
- **Samarbeidet** er ett regnskap med like andeler: fronten drar til han er
  overbetalt, svinger av, og faller tilbake på toget. Å sitte på er et VALG —
  lade et angrep, eller surmule: en mann som har betalt mer enn sin andel mens
  noen som kan jobbe nekter, slutter å dra selv. Sitter du på for lenge,
  slutter bruddet å sykle for deg.
- **Angrepene** har motiv (spurt-taperen går tidlig, den sterkeste motoren
  slipper passasjerene), et vindu fra 15 km, og ekte watt: rykket er det
  rytteren kan holde et halvminutt-pluss (~8–12 W/kg), og doseringen etterpå
  holder igjen en reserve — bortsett fra siste trekket mot streken, som tømmer
  alt. Svaret er et valg per rytter: kan jeg, lønner det seg, trengs jeg.
- **Jakten**: en solo fra start vinner aldri. Bruddet bruker et snaut minutt på
  å organisere seg — så legger rotasjonen seg over og henter deg helt inn.
- **Terrenget** leses forover: den som veier minst i forhold til terskelen sin
  går fram i bakkene og kjører sitt eget tempo. Ingen er merket som klatrer;
  regnestykket avgjør.
- **Feltet** er deterministisk, så tiden det krysser målstreken er kjent fra
  start. Det gjør kravet til bruddet til en tidsfrist, ikke en fart — og
  fristen rir en fast referanserytter, så et svakt bygg ikke sinker bunsjen.
