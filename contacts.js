// Kontaktsaetze fuer die .mc1backup-Huelle.
//
// Felder aus MC1Services/Sources/MC1Services/Models/Contact.swift. Die meisten
// beschreiben Funkzustand -- Pfad, Position, letztes Advert. Den kennt der
// Node ohnehin besser als jede Sicherung, hier stehen deshalb neutrale Werte.
// Zweck dieser Saetze ist allein, dass die uebernommenen Nachrichten einem
// Gespraech zugeordnet werden koennen.

import { uuid4, alsDatum } from "./envelope.js";

/** Hex-Text zu Base64, wie Swift `Data` erwartet. Leer bei Unsinn. */
export function hexZuBase64(hex) {
  const sauber = String(hex ?? "").replace(/[^0-9a-fA-F]/g, "");
  if (sauber.length < 2) return "";
  const bytes = new Uint8Array(sauber.length >> 1);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(sauber.substr(i * 2, 2), 16);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function kontakt({ radioID, name = "", publicKeyHex = "", lastMessageDate = null }) {
  return {
    id: uuid4(),
    radioID,
    publicKey: hexZuBase64(publicKeyHex),
    name: String(name ?? ""),
    typeRawValue: 1,          // 1 = Companion; Repeater lernt der Node selbst
    flags: 0,
    outPathLength: 0,
    outPath: "",
    lastAdvertTimestamp: 0,
    latitude: 0,
    longitude: 0,
    lastModified: 0,
    nickname: null,
    isBlocked: false,
    isMuted: false,
    isFavorite: false,
    lastMessageDate: alsDatum(lastMessageDate),
    unreadCount: 0,
    unreadMentionCount: 0,
    ocvPreset: null,
    customOCVArrayString: null,
    avatarImageData: null,
  };
}
