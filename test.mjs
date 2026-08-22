// Prueft, was ohne die App pruefbar ist: Struktur, Zahlenformate und dass die
// Datei wirklich zlib ist und sich wieder zu demselben JSON entpacken laesst.
import { strict as assert } from "node:assert";
import { inflateSync } from "node:zlib";
import { huelle, nachricht, alsJSON, packen, alsDatum, uuid4 } from "./envelope.js";

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

pruefe("Huelle nennt Version 1 und zaehlt richtig", () => {
  const rid = uuid4();
  const h = huelle({ devices: [{ id: rid }], messages: [nachricht({ radioID: rid })], stand: 1787000000 });
  assert.equal(h.version, 1);
  assert.equal(h.manifest.messages, 1);
  assert.equal(h.manifest.devices, 1);
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
  const h = huelle({ devices: [{ id: rid }],
                     messages: [nachricht({ radioID: rid, text: "Grüße aus Nötsch", createdAt: 1787000000 })],
                     stand: 1787000000 });
  const text = alsJSON(h);
  const paket = await packen(text);
  pruefe("Ausgabe ist echtes zlib und entpackt sich zum selben JSON", () => {
    assert.equal(paket[0], 0x78, "zlib-Kennung fehlt");   // 0x78 = zlib
    assert.equal(inflateSync(Buffer.from(paket)).toString("utf8"), text);
  });
  pruefe("Umlaute ueberleben die Runde", () => {
    assert.match(inflateSync(Buffer.from(paket)).toString("utf8"), /Grüße aus Nötsch/);
  });
  console.log(`\n  ${text.length} Byte JSON -> ${paket.length} Byte gepackt`);
})();

console.log(`\n${ok} Pruefungen bestanden`);
