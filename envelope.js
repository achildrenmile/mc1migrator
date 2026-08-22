// Baut eine .mc1backup-Huelle fuer MeshCore One.
//
// Format aus dem Quelltext von Avi0n/MeshCoreOne abgelesen
// (MC1Services/Services/AppBackupEnvelope.swift):
//
//   .mc1backup = zlib-komprimiertes JSON eines AppBackupEnvelope, Version 1
//   Datumsangaben als secondsSince1970, also blanke Zahlen
//   Data-Felder base64, UUIDs in Grossbuchstaben
//
// Diese Datei laeuft unveraendert im Browser und unter Node. Sie kennt die
// Zielstruktur, aber nichts ueber die Quelldatenbank -- das Zuordnen der
// Spalten passiert davor und wird hier nur noch entgegengenommen.

export const ENVELOPE_VERSION = 1;

/** Grossbuchstaben-UUID, wie Swift sie schreibt. */
export function uuid4() {
  const b = new Uint8Array(16);
  (globalThis.crypto ?? require("crypto").webcrypto).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
}

/** Sekunden seit 1970 als Zahl -- Swift decodiert mit .secondsSince1970. */
export function alsDatum(wert) {
  if (wert == null) return null;
  const n = Number(wert);
  if (!Number.isFinite(n)) return null;
  // Millisekunden erkennen und umrechnen: alles nach dem Jahr 2200 in
  // Sekunden gelesen ist in Wahrheit eine Millisekundenangabe.
  return n > 7258118400 ? n / 1000 : n;
}

/**
 * Nachrichtensatz mit allen Feldern, die MeshCore One erwartet.
 * Unbekanntes bleibt null oder auf dem harmlosen Vorgabewert -- ein fehlender
 * Wert ist besser als ein erfundener.
 */
// Aus MC1Services/Models/Message.swift bzw. ProtocolTypes.swift. Die
// Aufzaehlungen sind zahlenbasiert -- Texte lehnt der Einleser ab.
export const RICHTUNG = { eingehend: 0, ausgehend: 1 };
export const STATUS = { pending: 0, sending: 1, sent: 2, delivered: 3, failed: 4, retrying: 5 };
export const TEXTART = { plain: 0, cliData: 1, signedPlain: 2 };

/**
 * Kennung, an der die App doppelt empfangene Nachrichten erkennt.
 * Aus Absender, Zeit und Text -- dieselbe Nachricht ergibt dieselbe Kennung,
 * verschiedene ergeben verschiedene. Kein Sicherheitszweck, nur Unterscheidung.
 */
function dedupSchluessel({ radioID, timestamp, text, channelIndex, contactID }) {
  const roh = [radioID, timestamp, channelIndex ?? "", contactID ?? "", text].join("|");
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < roh.length; i++) {
    const c = roh.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
}

export function nachricht({
  radioID, contactID = null, channelIndex = null, text = "",
  timestamp = 0, createdAt = 0, direction = RICHTUNG.eingehend, status = STATUS.delivered,
  pathLength = 0, snr = null, senderNodeName = null, isRead = true,
}) {
  const zeit = alsDatum(createdAt) ?? 0;
  return {
    id: uuid4(),
    radioID,
    contactID,
    channelIndex,
    text: String(text ?? ""),
    timestamp: Math.max(0, Math.trunc(Number(timestamp) || 0)),
    createdAt: zeit,
    sortDate: zeit,
    direction,
    status,
    textType: TEXTART.plain,
    ackCode: null,
    pathLength: Math.max(0, Math.trunc(Number(pathLength) || 0)),
    snr: snr == null ? null : Number(snr),
    pathNodes: null,
    senderKeyPrefix: null,
    senderNodeName: senderNodeName == null ? null : String(senderNodeName),
    isRead: Boolean(isRead),
    replyToID: null,
    roundTripTime: null,
    heardRepeats: 0,
    sendCount: 0,
    retryAttempt: 0,
    maxRetryAttempts: 0,
    // Die App traegt hier eine Kennung, an der sie doppelt empfangene
    // Nachrichten erkennt. Stand ueberall `null`, sah fuer sie womoeglich
    // aus wie ein und dieselbe Nachricht -- dann bleibt genau eine uebrig.
    deduplicationKey: dedupSchluessel({ radioID, timestamp, text, channelIndex, contactID }),
    linkPreviewURL: null,
    linkPreviewTitle: null,
    linkPreviewImageData: null,
    linkPreviewIconData: null,
    linkPreviewFetched: false,
    containsSelfMention: false,
    mentionSeen: false,
    timestampCorrected: false,
    senderTimestamp: null,
    reactionSummary: null,
    routeType: null,
    regionScope: null,
  };
}

/** Vollstaendige Huelle. `stand` erlaubt einen festen Zeitpunkt fuer Tests. */
export function huelle({ devices = [], contacts = [], channels = [], messages = [],
                         appVersion = "mc1migrator", appBuild = "1", stand = null }) {
  return {
    version: ENVELOPE_VERSION,
    exportDate: stand ?? Math.floor(Date.now() / 1000),
    appVersion,
    appBuild,
    // Feldnamen aus BackupManifest. Der Einleser rechnet sie nach und wirft
    // corruptedManifest, sobald eine Zahl nicht zur Liste passt.
    manifest: {
      deviceCount: devices.length,
      contactCount: contacts.length,
      channelCount: channels.length,
      messageCount: messages.length,
      messageRepeatCount: 0,
      reactionCount: 0,
      roomMessageCount: 0,
      remoteNodeSessionCount: 0,
      savedTracePathCount: 0,
      blockedChannelSenderCount: 0,
      nodeStatusSnapshotCount: 0,
      discoveredNodeCount: 0,
    },
    devices, contacts, channels, messages,
    messageRepeats: [],
    reactions: [],
    roomMessages: [],
    remoteNodeSessions: [],
    savedTracePaths: [],
    blockedChannelSenders: [],
    nodeStatusSnapshots: [],
    discoveredNodes: [],
    userDefaults: null,
  };
}

/** JSON mit sortierten Schluesseln, wie der Erzeuger drueben es schreibt. */
export function alsJSON(obj) {
  return JSON.stringify(obj, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v);
}

/**
 * Komprimieren, wie MeshCore One es erwartet: **rohes DEFLATE ohne Rahmen**.
 *
 * Die Datei entsteht drueben mit `NSData.compressed(using: .zlib)`. Der Name
 * truegt: Apples Compression-Rahmenwerk liefert dabei rohes DEFLATE nach
 * RFC 1951, nicht den zlib-Rahmen nach RFC 1950. Wer hier mit Rahmen packt,
 * bekommt beim Einlesen "Die Sicherungsdatei ist ungueltig oder konnte nicht
 * gelesen werden" -- die Meldung fuer alles, was vor dem JSON schiefgeht.
 *
 * Im Browser heisst das "deflate-raw", unter Node deflateRawSync.
 */
export async function packen(text) {
  const roh = new TextEncoder().encode(text);
  if (typeof CompressionStream === "function") {
    const s = new CompressionStream("deflate-raw");
    const w = s.writable.getWriter();
    w.write(roh); w.close();
    return new Uint8Array(await new Response(s.readable).arrayBuffer());
  }
  const { deflateRawSync } = await import("node:zlib");
  return new Uint8Array(deflateRawSync(roh));
}


/**
 * Auspacken einer echten .mc1backup zum Vergleich.
 *
 * Probiert beide Rahmen: rohes DEFLATE zuerst, dann zlib. Welches drueben
 * herauskommt, haengt an der Fassung des Compression-Rahmenwerks -- und genau
 * darueber laesst sich trefflich irren, deshalb wird es hier gemessen statt
 * angenommen.
 */
export async function auspacken(bytes) {
  const versuche = typeof DecompressionStream === "function"
    ? [["deflate-raw", "rohes DEFLATE"], ["deflate", "zlib mit Rahmen"], ["gzip", "gzip"]]
    : [];
  for (const [art, name] of versuche) {
    try {
      const d = new DecompressionStream(art);
      const w = d.writable.getWriter();
      w.write(bytes); w.close();
      const roh = new Uint8Array(await new Response(d.readable).arrayBuffer());
      return { text: new TextDecoder().decode(roh), art: name };
    } catch { /* naechsten Rahmen probieren */ }
  }
  if (typeof DecompressionStream !== "function") {
    const z = await import("node:zlib");
    for (const [fn, name] of [[z.inflateRawSync, "rohes DEFLATE"], [z.inflateSync, "zlib mit Rahmen"],
                              [z.gunzipSync, "gzip"]]) {
      try { return { text: fn(Buffer.from(bytes)).toString("utf8"), art: name }; } catch {}
    }
  }
  throw new Error("Laesst sich mit keinem bekannten Verfahren auspacken");
}

/** Bauplan eines Objekts: Feldname und Typ, ohne die Inhalte preiszugeben. */
export function bauplan(obj) {
  if (obj == null) return "null";
  if (Array.isArray(obj)) return obj.length ? `[${obj.length}x ...]` : "[]";
  return Object.fromEntries(Object.keys(obj).sort().map((k) => {
    const v = obj[k];
    return [k, v === null ? "null" : Array.isArray(v) ? `[${v.length}]` : typeof v];
  }));
}
