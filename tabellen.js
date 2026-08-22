// Erkennen, welche Tabellen einer fremden SQLite-Datei den Nachrichtenverlauf
// enthalten, und ihre Zeilen zusammenfuehren.
//
// Das Schema der offiziellen MeshCore-App ist nirgends dokumentiert, deshalb
// wird nach den ueblichen Benennungen gesucht statt eine feste Struktur
// anzunehmen. Und es wird nach *allen* passenden Tabellen gesucht, nicht nur
// nach der groessten: Kanal- und Direktnachrichten koennen getrennt liegen,
// und wer nur eine Tabelle nimmt, verliert die andere Haelfte, ohne dass es
// auffaellt -- die Migration sieht dann erfolgreich aus und ist es nicht.

export const MUSTER = {
  text:      [/^(text|body|message|content|msg)$/i, /text|body|content/i],
  zeit:      [/^(timestamp|created_?at|date|time|sent_?at)$/i, /time|date/i],
  richtung:  [/^(direction|is_?outgoing|outgoing|sent|from_me|is_?sender)$/i, /outgoing|direction/i],
  partner:   [/^(contact_?id|contact|peer|sender|pubkey|public_?key)$/i, /contact|peer|sender|pub/i],
  kanal:     [/^(channel_?index|channel_?idx|channel)$/i, /channel/i],
  name:      [/^(sender_?name|name|nickname)$/i, /name/i],
};

/** Passende Spalte einer Art finden. Genaue Treffer gehen vor unscharfen. */
export function rate(spalten, art) {
  for (const m of MUSTER[art]) { const t = spalten.find((s) => m.test(s)); if (t) return t; }
  return "";
}

/** Zuordnung fuer eine Tabelle raten. `s` sind ihre Spaltennamen. */
export function zuordnung(tab, s) {
  return { tab, text: rate(s, "text"), zeit: rate(s, "zeit"), richtung: rate(s, "richtung"),
           partner: rate(s, "partner"), kanal: rate(s, "kanal"), name: rate(s, "name") };
}

/**
 * Alle Tabellen, die nach Verlauf aussehen: nicht leer, mit Text- und
 * Zeitspalte. `zeilen` ist [{t, n, s}] -- Name, Zeilenzahl, Spalten.
 */
export function kandidatenAus(zeilen) {
  return zeilen.filter((z) => z.n > 0 && rate(z.s, "text") && rate(z.s, "zeit"));
}

/**
 * Zeilen mehrerer Tabellen zu einem Verlauf verbinden: doppelte entfernen und
 * nach Zeit ordnen. Doppelte entstehen, wenn eine Tabelle eine Sicht auf eine
 * andere ist -- dann stuende jede Nachricht zweimal im Verlauf.
 */
export function zusammenfuehren(listen) {
  const gesehen = new Set();
  const eindeutig = [];
  for (const r of listen.flat()) {
    const k = [r.text, r.zeit, r.kanal ?? "", r.partner ?? ""].join("|");
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    eindeutig.push(r);
  }
  eindeutig.sort((a, b) => (Number(a.zeit) || 0) - (Number(b.zeit) || 0));
  return eindeutig;
}
