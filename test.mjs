// Prueft, was ohne die App pruefbar ist: Struktur, Zahlenformate und dass die
// Datei wirklich zlib ist und sich wieder zu demselben JSON entpacken laesst.
import { strict as assert } from "node:assert";
import { inflateRawSync } from "node:zlib";
import { huelle, nachricht, alsJSON, packen, alsDatum, uuid4, RICHTUNG, STATUS, TEXTART } from "./envelope.js";
import { geraet } from "./device.js";
import { kontakt } from "./contacts.js";
globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");

let ok = 0;
const pruefe = (name, fn) => { fn(); console.log("  ok  " + name); ok++; };

pruefe("UUID hat Version 4 und Grossbuchstaben", () => {
  const u = uuid4();
  assert.match(u, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
});

pruefe("Datum bleibt in Sekunden, Millisekunden werden erkannt", () => {
  assert.equal(alsDatum(1787000000), 1787000000);
  assert.equal(alsDatum(1787000000000), 1787000000);   // Millisekunden
  assert.equal(alsDatum(null), null);
  assert.equal(alsDatum("keine Zahl"), null);
});

pruefe("Nachricht traegt alle 37 Felder der Zielstruktur", () => {
  const m = nachricht({ radioID: uuid4(), text: "Test" });
  // Namen aus MC1Services/Sources/MC1Services/Models/Message.swift
  const erwartet = ["id","radioID","contactID","channelIndex","text","timestamp",
    "createdAt","sortDate","direction","status","textType","ackCode","pathLength",
    "snr","pathNodes","senderKeyPrefix","senderNodeName","isRead","replyToID",
    "roundTripTime","heardRepeats","sendCount","retryAttempt","maxRetryAttempts",
    "deduplicationKey","linkPreviewURL","linkPreviewTitle","linkPreviewImageData",
    "linkPreviewIconData","linkPreviewFetched","containsSelfMention","mentionSeen",
    "timestampCorrected","senderTimestamp","reactionSummary","routeType","regionScope"];
  assert.deepEqual(Object.keys(m).sort(), erwartet.sort());
  assert.equal(erwartet.length, 37);
});

pruefe("Zeitstempel sind Zahlen, kein ISO-Text", () => {
  const m = nachricht({ radioID: uuid4(), createdAt: 1787000000 });
  assert.equal(typeof m.createdAt, "number");
  assert.equal(typeof m.sortDate, "number");
  assert.equal(m.createdAt, m.sortDate);
});

pruefe("Aufzaehlungen sind Zahlen, keine Texte", () => {
  // Swift deklariert MessageDirection/MessageStatus als Int, TextType als UInt8.
  // Ein Text laesst den Einleser scheitern -- mit der Meldung "Format nicht
  // kompatibel", die nicht verraet, woran es lag.
  const m = nachricht({ radioID: uuid4() });
  for (const f of ["direction", "status", "textType", "pathLength", "timestamp"])
    assert.equal(typeof m[f], "number", f + " muss eine Zahl sein");
  assert.equal(RICHTUNG.eingehend, 0);
  assert.equal(RICHTUNG.ausgehend, 1);
  assert.equal(STATUS.sent, 2);
  assert.equal(STATUS.delivered, 3);
  assert.equal(TEXTART.plain, 0);
});

pruefe("Manifest traegt genau die zwoelf Felder von BackupManifest", () => {
  const h = huelle({});
  assert.deepEqual(Object.keys(h.manifest).sort(), [
    "blockedChannelSenderCount","channelCount","contactCount","deviceCount",
    "discoveredNodeCount","messageCount","messageRepeatCount","nodeStatusSnapshotCount",
    "reactionCount","remoteNodeSessionCount","roomMessageCount","savedTracePathCount"].sort());
});

pruefe("Manifest zaehlt, was tatsaechlich drin ist", () => {
  // parseBackup vergleicht den Manifest gegen die Listen und wirft sonst
  // corruptedManifest.
  const g = geraet();
  const h = huelle({ devices: [g], contacts: [kontakt({ radioID: g.id })],
                     messages: [nachricht({ radioID: g.id })] });
  assert.equal(h.manifest.deviceCount, h.devices.length);
  assert.equal(h.manifest.contactCount, h.contacts.length);
  assert.equal(h.manifest.messageCount, h.messages.length);
  assert.equal(h.manifest.roomMessageCount, h.roomMessages.length);
});

// Stand frueher ueberall `null`. Die App erkennt daran doppelt empfangene
// Nachrichten -- bei gleichem Wert bleibt womoeglich nur eine uebrig, und der
// Verlauf sieht aus, als waere er nicht angekommen.
pruefe("Entdopplungsschluessel ist gesetzt und unterscheidet", () => {
  const a = nachricht({ radioID: "R", text: "eins", timestamp: 1787000000, createdAt: 1787000000, channelIndex: 3 });
  const b = nachricht({ radioID: "R", text: "zwei", timestamp: 1787000001, createdAt: 1787000001, channelIndex: 3 });
  const c = nachricht({ radioID: "R", text: "eins", timestamp: 1787000000, createdAt: 1787000000, channelIndex: 3 });
  assert.ok(a.deduplicationKey, "darf nicht leer sein");
  assert.equal(typeof a.deduplicationKey, "string");
  assert.notEqual(a.deduplicationKey, b.deduplicationKey);
  assert.equal(a.deduplicationKey, c.deduplicationKey, "gleiche Nachricht, gleicher Schluessel");
});

pruefe("sortDate traegt den Zeitpunkt, nicht die Null", () => {
  const n = nachricht({ radioID: "R", text: "x", timestamp: 1787000000, createdAt: 1787000000 });
  assert.equal(n.sortDate, 1787000000);
  assert.notEqual(n.sortDate, 0, "sonst landet alles im Jahr 1970 und wirkt verschwunden");
});

// Diese Liste stammt nicht aus dem Quelltext, sondern aus einer echten
// Sicherung von MeshCore One 1.3.0 (Build 195) -- also aus dem, was die App
// tatsaechlich schreibt. Ein frueherer Bauplan hatte 22 Felder und wurde beim
// Einlesen abgewiesen, ohne dass die App das fehlende Feld genannt haette.
pruefe("Geraetesatz traegt alle 35 Felder von DeviceDTO 1.3.0", () => {
  const erwartet = ["id","radioID","publicKey","nodeName","firmwareVersion",
    "firmwareVersionString","manufacturerName","buildDate","ocvPreset",
    "maxContacts","maxChannels",
    "frequency","bandwidth","spreadingFactor","codingRate","txPower","maxTxPower",
    "latitude","longitude","blePin","clientRepeat","pathHashMode","multiAcks",
    "isActive","connectionMethods","knownRegions","lastConnected","lastContactSync",
    "autoAddConfig","autoAddMaxHops","manualAddContacts",
    "advertLocationPolicy","telemetryModeBase","telemetryModeEnv","telemetryModeLoc"];
  assert.deepEqual(Object.keys(geraet()).sort(), erwartet.sort());
  assert.equal(erwartet.length, 35);
});

// Das Feld gab es in einer aelteren Fassung des Bauplans und in 1.3.0 nicht.
pruefe("defaultFloodScopeName ist nicht mehr dabei", () => {
  assert.ok(!("defaultFloodScopeName" in geraet()));
});

// Die echte Sicherung 1.3.0 fuehrt 17 Felder. Die fuenf zusaetzlichen hier
// (nickname, ocvPreset, customOCVArrayString, avatarImageData, lastMessageDate)
// ueberliest Swift beim Einlesen; alle 17 noetigen sind enthalten.
pruefe("Kontaktsatz traegt alle 22 Felder von ContactDTO", () => {
  const erwartet = ["id","radioID","publicKey","name","typeRawValue","flags",
    "outPathLength","outPath","lastAdvertTimestamp","latitude","longitude","lastModified",
    "nickname","isBlocked","isMuted","isFavorite","lastMessageDate","unreadCount",
    "unreadMentionCount","ocvPreset","customOCVArrayString","avatarImageData"];
  assert.deepEqual(Object.keys(kontakt({ radioID: uuid4() })).sort(), erwartet.sort());
  assert.equal(erwartet.length, 22);
});

pruefe("Huelle nennt Version 1 und zaehlt richtig", () => {
  const rid = uuid4();
  const h = huelle({ devices: [geraet({ id: rid })], messages: [nachricht({ radioID: rid })], stand: 1787000000 });
  assert.equal(h.version, 1);
  assert.equal(h.manifest.messageCount, 1);
  assert.equal(h.manifest.deviceCount, 1);
  assert.equal(typeof h.exportDate, "number");
  // Leere Listen muessen da sein, nicht fehlen -- Swift erwartet die Schluessel.
  for (const k of ["messageRepeats","reactions","roomMessages","remoteNodeSessions",
                   "savedTracePaths","blockedChannelSenders","nodeStatusSnapshots",
                   "discoveredNodes"]) assert.ok(Array.isArray(h[k]), k + " fehlt");
});

pruefe("JSON hat sortierte Schluessel", () => {
  const t = alsJSON({ b: 1, a: 2, c: { z: 1, y: 2 } });
  assert.equal(t, '{"a":2,"b":1,"c":{"y":2,"z":1}}');
});

await (async () => {
  const rid = uuid4();
  const h = huelle({ devices: [geraet({ id: rid })],
                     messages: [nachricht({ radioID: rid, text: "Grüße aus Nötsch", createdAt: 1787000000 })],
                     stand: 1787000000 });
  const text = alsJSON(h);
  const paket = await packen(text);
  pruefe("Ausgabe ist rohes DEFLATE, nicht zlib mit Rahmen", () => {
    // Apples NSData.compressed(using: .zlib) liefert rohes DEFLATE. Ein
    // zlib-Rahmen faengt mit 0x78 an -- steht der da, nimmt MeshCore One die
    // Datei nicht an.
    assert.notEqual(paket[0], 0x78, "zlib-Rahmen vorhanden, erwartet wird roh");
    assert.equal(inflateRawSync(Buffer.from(paket)).toString("utf8"), text);
  });
  pruefe("Umlaute ueberleben die Runde", () => {
    assert.match(inflateRawSync(Buffer.from(paket)).toString("utf8"), /Grüße aus Nötsch/);
  });
  console.log(`\n  ${text.length} Byte JSON -> ${paket.length} Byte gepackt`);
})();

console.log(`\n${ok} Pruefungen bestanden`);
