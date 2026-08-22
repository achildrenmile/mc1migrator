# mc1konverter

Wandelt die Datenbankausgabe der offiziellen **MeshCore**-App in eine
`.mc1backup`-Datei um, die **MeshCore One** wiederherstellen kann.

Läuft vollständig im Browser. Nichts wird hochgeladen, es gibt keinen Server,
der etwas zu sehen bekäme — bei einem Nachrichtenverlauf ist das keine
Nebensache, sondern der Grund für diese Bauform.

## Warum es das braucht

Kontakte, Kanäle und Schlüssel liegen im Funkgerät, nicht in der App. Wer die
App wechselt, findet sie beim Koppeln wieder vor. **Der Nachrichtenverlauf
nicht** — der liegt in der Datenbank der jeweiligen App, und ein gemeinsames
Austauschformat gibt es nicht.

MeshCore One kann Verläufe einspielen, aber nur im eigenen Format. Die Anfrage,
auch die rohe SQLite-Datei der offiziellen App zu lesen, liegt seit dem
6. Mai 2026 als [Issue #294](https://github.com/Avi0n/MeshCoreOne/issues/294)
offen, ohne Antwort. Dieses Werkzeug schließt die Lücke von außen.

## Format

Aus dem Quelltext von [Avi0n/MeshCoreOne](https://github.com/Avi0n/MeshCoreOne)
abgelesen, `MC1Services/Sources/MC1Services/Services/AppBackupEnvelope.swift`:

    .mc1backup  =  zlib-komprimiertes JSON eines AppBackupEnvelope, Version 1
    Datumsangaben als secondsSince1970, also blanke Zahlen
    Data-Felder base64, UUIDs in Grossbuchstaben, Schluessel sortiert

Die 37 Felder eines Nachrichtensatzes stammen aus `Models/Message.swift`, die
22 eines Kontakts aus `Models/Contact.swift`.

## Benutzen

`index.html` im Browser öffnen — lokal von der Platte genügt. Chrome, Edge,
Firefox und Safari können alles Nötige; `CompressionStream` erledigt das
Komprimieren, SQLite liest [sql.js](https://sql.js.org) im Ordner `vendor/`.

1. Datenbank der offiziellen App wählen (Einstellungen → Datenbank ausgeben, ab 1.43.0)
2. Spalten zuordnen — geraten wird automatisch, überschreiben geht
3. Vorschau prüfen
4. `.mc1backup` herunterladen und in MeshCore One wiederherstellen

## Warum die Spalten zugeordnet werden müssen

Das Schema der offiziellen App ist nicht dokumentiert, und ich hatte keine
echte Ausgabe zum Nachsehen. Statt eine Struktur zu erfinden, liest das
Werkzeug die Tabellen der Datei aus, rät die Spalten nach ihren Namen und legt
die Zuordnung offen. Wer eine echte Ausgabe hat, kann die Vermutung in einem
Zug prüfen und korrigieren.

## Prüfen

    node test.mjs              # Huelle, Zahlenformate, zlib
    node test-integration.mjs  # ganze Kette an einer echten SQLite-Datei

## Grenzen

- **Übernommen** wird der Verlauf: Text, Zeitpunkt, Richtung, Zuordnung zu
  Partner oder Kanal.
- **Nicht übernommen** werden Kontaktdaten, Kanäle und Schlüssel — die holt
  MeshCore One vom Gerät.
- **Leer** bleiben Signalwerte, Pfade und Empfangsprotokolle, die in der Quelle
  nicht stehen. Ein fehlender Wert ist besser als ein erfundener.
- **Ungeprüft** ist, ob MeshCore One eine fremd erzeugte Sicherung annimmt. Das
  Format stimmt mit dem Quelltext überein, aber es lag noch keine echte Datei
  zum Gegenlesen vor. Die alte App bis zum Beweis nicht löschen.

## Lizenz

MIT.
