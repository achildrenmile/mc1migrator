// Geraetesatz fuer die .mc1backup-Huelle.
//
// Felder aus MC1Services/Sources/MC1Services/Models/Device.swift. Alle sind
// nicht optional: Swift bricht das Einlesen ab, sobald einer fehlt -- und
// meldet dann schlicht "Format nicht kompatibel", ohne zu sagen, welcher.
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
  return {
    id: rid,
    radioID: rid,
    publicKey: hexZuBase64(publicKeyHex),
    nodeName: String(nodeName),
    firmwareVersion: 0,
    firmwareVersionString: "",
    manufacturerName: "",
    buildDate: "",
    maxContacts: 350,
    maxChannels: 8,
    frequency,
    bandwidth,
    spreadingFactor,
    codingRate,
    txPower: 0,
    maxTxPower: 0,
    latitude: 0,
    longitude: 0,
    blePin: 0,
    clientRepeat: false,
    pathHashMode: 0,
    defaultFloodScopeName: null,
  };
}
