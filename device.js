// Geraetesatz fuer die .mc1backup-Huelle.
//
// Feldliste abgeglichen gegen eine echte Sicherung aus MeshCore One 1.3.0
// (Build 195): 35 Felder. Swift bricht das Einlesen ab, sobald ein nicht
// optionales Feld fehlt -- und meldet dann schlicht "Format nicht kompatibel",
// ohne zu sagen, welches. Eine frueher gebaute Fassung hatte nur 22 Felder und
// wurde genau deshalb abgewiesen.
//
// Wer eine echte Sicherung als Vorlage laedt, braucht das hier nicht: dann
// wird deren Geraetesatz unveraendert uebernommen, was auch kuenftige
// Feldwechsel ueberlebt. Dieser Bauplan ist nur der Notweg ohne Vorlage.
//
// Die Werte beschreiben Funkzustand, den der Node beim naechsten Verbinden
// ohnehin selbst liefert. Hier steht deshalb Neutrales. Der Satz ist nur da,
// damit die uebernommenen Nachrichten ein Geraet haben, an dem sie haengen.

import { uuid4 } from "./envelope.js";
import { hexZuBase64 } from "./contacts.js";

/** Vorgabe: EU-Preset des CarinthiaMesh, 869,618 MHz / 62,5 kHz / SF8 / CR8. */
export function geraet({ id = null, nodeName = "Übernommen aus MeshCore",
                         publicKeyHex = "", frequency = 869618, bandwidth = 62500,
                         spreadingFactor = 8, codingRate = 8 } = {}) {
  const rid = id ?? uuid4();
  const jetzt = Math.floor(Date.now() / 1000);
  return {
    id: rid,
    radioID: rid,
    publicKey: hexZuBase64(publicKeyHex),
    nodeName: String(nodeName),

    // Firmware und Hardware
    firmwareVersion: 0,
    firmwareVersionString: "",
    manufacturerName: "",
    buildDate: "",
    ocvPreset: "",

    // Grenzen
    maxContacts: 350,
    maxChannels: 40,

    // Funk
    frequency,
    bandwidth,
    spreadingFactor,
    codingRate,
    txPower: 0,
    maxTxPower: 0,

    // Standort
    latitude: 0,
    longitude: 0,

    // Betrieb
    blePin: 0,
    clientRepeat: false,
    pathHashMode: 0,
    multiAcks: 0,
    isActive: false,
    connectionMethods: [],
    knownRegions: [],
    lastConnected: jetzt,
    lastContactSync: jetzt,

    // Kontakte automatisch aufnehmen
    autoAddConfig: 0,
    autoAddMaxHops: 0,
    manualAddContacts: false,

    // Telemetrie
    advertLocationPolicy: 0,
    telemetryModeBase: 0,
    telemetryModeEnv: 0,
    telemetryModeLoc: 0,
  };
}
