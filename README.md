# Tagesform

Eigene Fitness- und Ernährungs-App (PWA) – kostenlos, läuft auf iPhone und PC.

- Ernährung tracken: Suche (Grundnahrungsmittel + Open Food Facts), Barcode, Foto vom Teller, Nährwerttabelle
- „Was soll ich jetzt essen?“ – Vorschläge passend zu den offenen Kalorien/Eiweiß
- Wochen-Check mit Tipps für die nächste Woche
- Trainingsplan fürs Studio rund um Handball: passt sich an Tagesform und Schmerzen an, Sätze loggen, automatische Steigerung
- Übungen mit Bildern, Bewegungsanimation und Schritt-für-Schritt-Anleitung (Bilder: free-exercise-db, Public Domain)
- Wochenkalender auf der Startseite

Sync über dasselbe Firebase-Projekt wie Kartenschatz (eigener Bereich `users/{uid}/tf_*`).
KI über einen kostenlosen Google-AI-Studio-Schlüssel, der in der App eingetragen wird.

`_quellcode/` enthält den Quellcode (`npm install && node build.mjs` baut nach `web/`).
