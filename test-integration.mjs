// Prueft die Kette an einer echten SQLite-Datei: lesen, zuordnen, Huelle bauen,
// packen, wieder entpacken. Die Quelldatenbank ist nachgebaut -- ihr echtes
// Schema kennt nur, wer eine Ausgabe der offiziellen App hat. Genau deshalb
// raet das Werkzeug die Spalten, statt eine feste Struktur anzunehmen.
import { strict as assert } from "node:assert";
import { inflateRawSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { huelle, nachricht, alsJSON, packen, uuid4, RICHTUNG, STATUS } from "./envelope.js";
import { geraet } from "./device.js";
import { kontakt, hexZuBase64 } from "./contacts.js";
import { rate, zuordnung, kandidatenAus, zusammenfuehren } from "./tabellen.js";

globalThis.btoa ??= (s) => Buffer.from(s, "binary").toString("base64");

let ok = 0;
const pruefe = (n, f) => { f(); console.log("  ok  " + n); ok++; };

// --- Alt-Datenbank nachbauen, mit absichtlich anderen Spaltennamen ----------
const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE messages (
  id INTEGER PRIMARY KEY, body TEXT, sent_at INTEGER,
  is_outgoing INTEGER, peer TEXT, channel_idx INTEGER, sender_name TEXT)`);
db.exec(`CREATE TABLE settings (k TEXT, v TEXT)`);
const daten = [
  ["Servus aus Noetsch", 1786900000, 0, "a92bd7f9", null, "AT-VL-Gabriel"],
  ["Sota Test",          1786900100, 1, "a92bd7f9", null, null],
  ["CQ auf dem Kanal",   1786900200, 0, null, 3, "AT-HE-CKK-P"],
];
const einfuegen = db.prepare(`INSERT INTO messages (body,sent_at,is_outgoing,peer,channel_idx,sender_name)
  VALUES (?,?,?,?,?,?)`);
for (const d of daten) einfuegen.run(...d);

// --- Genau das tun, was die Seite tut --------------------------------------
pruefe("Tabellen werden gefunden", () => {
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
              .all().map((r) => r.name);
  assert.deepEqual(t, ["messages", "settings"]);
});

const reihen = db.prepare(`SELECT body,sent_at,is_outgoing,peer,channel_idx,sender_name
  FROM messages ORDER BY sent_at`).all().map((v) => ({
    text: v.body, zeit: v.sent_at, richtung: v.is_outgoing,
    partner: v.peer, kanal: v.channel_idx, name: v.sender_name }));

const g = geraet();
const radioID = g.id;
const kontakte = new Map();
const nachrichten = reihen.map((x) => {
  let contactID = null;
  if (x.partner) {
    if (!kontakte.has(x.partner))
      kontakte.set(x.partner, kontakt({ radioID, name: x.name ?? x.partner, publicKeyHex: x.partner, lastMessageDate: x.zeit }));
    contactID = kontakte.get(x.partner).id;
  }
  const raus = String(x.richtung) === "1";
  return nachricht({ radioID, contactID, channelIndex: x.kanal ?? null, text: x.text,
                     timestamp: x.zeit, createdAt: x.zeit,
                     direction: raus ? RICHTUNG.ausgehend : RICHTUNG.eingehend,
                     status: raus ? STATUS.sent : STATUS.delivered, senderNodeName: x.name });
});

const h = huelle({ devices: [g],
                   contacts: [...kontakte.values()], messages: nachrichten, stand: 1787000000 });
const json = alsJSON(h);
const paket = await packen(json);

pruefe("drei Nachrichten, ein Kontakt", () => {
  assert.equal(h.messages.length, 3);
  assert.equal(h.contacts.length, 1);          // beide DMs derselbe Partner
  assert.equal(h.manifest.messageCount, 3);
});

pruefe("Richtung und Status passen zusammen", () => {
  assert.equal(h.messages[0].direction, RICHTUNG.eingehend);
  assert.equal(h.messages[0].status, STATUS.delivered);
  assert.equal(h.messages[1].direction, RICHTUNG.ausgehend);
  assert.equal(h.messages[1].status, STATUS.sent);
});

pruefe("Kanalnachricht hat Kanal und keinen Kontakt", () => {
  const k = h.messages[2];
  assert.equal(k.channelIndex, 3);
  assert.equal(k.contactID, null);
});

pruefe("Direktnachrichten zeigen auf denselben Kontakt", () => {
  assert.equal(h.messages[0].contactID, h.messages[1].contactID);
  assert.equal(h.messages[0].contactID, h.contacts[0].id);
});

pruefe("Public Key als Base64, nicht als Hex", () => {
  assert.equal(h.contacts[0].publicKey, hexZuBase64("a92bd7f9"));
  assert.equal(Buffer.from(h.contacts[0].publicKey, "base64").toString("hex"), "a92bd7f9");
});

pruefe("Datei ist rohes DEFLATE und entpackt sich unveraendert", () => {
  assert.notEqual(paket[0], 0x78);
  const zurueck = JSON.parse(inflateRawSync(Buffer.from(paket)).toString("utf8"));
  assert.equal(zurueck.version, 1);
  assert.equal(zurueck.messages.length, 3);
  assert.equal(zurueck.messages[0].text, "Servus aus Noetsch");
});

console.log(`\n  ${reihen.length} Zeilen gelesen -> ${json.length} Byte JSON -> ${paket.length} Byte .mc1backup`);


// --- Zweite Verlaufstabelle: der Fall, der Nachrichten verschluckt hat ------
// Bis hierher las das Werkzeug nur die groesste Tabelle mit Text und Zeit.
// Legt die App Kanal- und Direktnachrichten getrennt ab, fehlt danach die
// Haelfte -- und die Migration sieht trotzdem gelungen aus.
db.exec(`CREATE TABLE channel_messages (
  id INTEGER PRIMARY KEY, content TEXT, created_at INTEGER,
  channel INTEGER, sender TEXT)`);
const einf2 = db.prepare(`INSERT INTO channel_messages (content,created_at,channel,sender) VALUES (?,?,?,?)`);
einf2.run("Kanal eins", 1786900050, 7, "AT-K-Innere-Stadt");
einf2.run("Kanal zwei", 1786900150, 7, "AT-SP-Spittal");

function tabellenUebersicht() {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => {
    const t = r.name;
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
    const s = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
    return { t, n, s };
  }).sort((a, b) => b.n - a.n);
}

pruefe("beide Verlaufstabellen werden erkannt, settings nicht", () => {
  const k = kandidatenAus(tabellenUebersicht()).map((z) => z.t).sort();
  assert.deepEqual(k, ["channel_messages", "messages"]);
});

pruefe("Spalten der zweiten Tabelle werden richtig geraten", () => {
  const z = zuordnung("channel_messages", ["id", "content", "created_at", "channel", "sender"]);
  assert.equal(z.text, "content");
  assert.equal(z.zeit, "created_at");
  assert.equal(z.kanal, "channel");
});

pruefe("alle fuenf Nachrichten kommen an, nach Zeit geordnet", () => {
  const gelesen = kandidatenAus(tabellenUebersicht()).map((k) => {
    const z = zuordnung(k.t, k.s);
    const sp = [...new Set([z.text, z.zeit, z.richtung, z.partner, z.kanal, z.name].filter(Boolean))];
    return db.prepare(`SELECT ${sp.map((x) => `"${x}"`).join(",")} FROM "${z.tab}"`).all()
      .map((v) => ({ text: v[z.text], zeit: v[z.zeit],
                     kanal: z.kanal ? v[z.kanal] : null, partner: z.partner ? v[z.partner] : null }));
  });
  const alle = zusammenfuehren(gelesen);
  assert.equal(alle.length, 5, "drei aus messages, zwei aus channel_messages");
  const zeiten = alle.map((r) => r.zeit);
  assert.deepEqual(zeiten, [...zeiten].sort((a, b) => a - b));
  assert.ok(alle.some((r) => r.text === "Kanal eins"), "zweite Tabelle fehlt");
  assert.ok(alle.some((r) => r.text === "Servus aus Noetsch"), "erste Tabelle fehlt");
});

pruefe("dieselbe Nachricht aus zwei Tabellen zaehlt einmal", () => {
  const eine = { text: "doppelt", zeit: 1, kanal: 3, partner: null };
  assert.equal(zusammenfuehren([[eine], [{ ...eine }]]).length, 1);
  assert.equal(zusammenfuehren([[eine], [{ ...eine, zeit: 2 }]]).length, 2);
});

console.log(`\n${ok} Pruefungen bestanden`);
