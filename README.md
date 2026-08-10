# The Breakaway — Legends 0.2

Et road-cycling-spill med én kontroll: en vertikal watt-slider. Du er i bruddet
med Van der Poel, Van Aert og Abrahamsen, ~23 km igjen, feltet drøyt et minutt bak
— og feltet er kalibrert til å ta den beste av dere med ett eneste sekund.

## Kjør det

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # produksjonsbygg i dist/
npm run preview  # server dist/ lokalt
```

## Kontrollene

| Knapp | Hva den gjør |
| --- | --- |
| **Watt-slideren** | Manuell styring. Velg et tall, lev med det. |
| **RELAY / MANUAL** | Slår rotasjonen av og på. I relay kjører du samme regel som AI-ene. |
| **SIT ON** | Du sitter på og betaler ingenting — du synker bakerst i rekka. |
| **1× 5× 10× 100×** | Simuleringshastighet. |
| **↻** | Nytt løp, ny seed. |

Grønn strek på slideren er terskelen din. Rød strek er alt du har akkurat nå —
brenn fyrstikkene og den synker.

## Sånn er det bygget

- `src/TheBreakaway.jsx` — hele spillet: fysikk, AI, bane og tegning i én fil.
- `src/main.jsx` — React-rot.
- Vite + React 18, canvas-rendering, ingen andre avhengigheter.

Simuleringen kjører ett sekund om gangen:

- **Banen** bygges fra en seeded RNG — stigninger, høyde, vind langs veien.
- **Kroppen** er tre tanker: surge (fyrstikkene), fuel (glykogenet) og legs
  (slitasjen som aldri kommer tilbake). Terskelen leses av rytterens egen
  power–duration-kurve.
- **Samarbeidet** er ett regnskap med like andeler: fronten drar til han er
  overbetalt, svinger av, og faller tilbake på siste hjul som fortsatt jobber.
  Prosenten over hvert hode er hans andel av dragningen.
- **Terrenget** leses forover: hver rytter ser hvor langt det er til toppen av
  stigningen han er i, og den som veier minst i forhold til terskelen sin går fram
  og kjører sitt eget tempo der — terskelen pluss den delen av tanken han er villig
  til å legge igjen før toppen. Ingen er merket som klatrer; regnestykket avgjør.
- **Feltet** er deterministisk, så tiden det krysser målstreken er kjent fra
  start. Det gjør kravet til bruddet til en tidsfrist, ikke en fart — og
  fartsplanen (`breakSchedule`) er den fristen lest av hver 100. meter.
