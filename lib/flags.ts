const FLAG: Record<string, string> = {
  ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹", BEL: "🇧🇪", BRA: "🇧🇷",
  CAN: "🇨🇦", CHI: "🇨🇱", CIV: "🇨🇮", CMR: "🇨🇲", COL: "🇨🇴",
  CRC: "🇨🇷", CRO: "🇭🇷", DEN: "🇩🇰", ECU: "🇪🇨", EGY: "🇪🇬",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󁿢", ESP: "🇪🇸", FRA: "🇫🇷", GER: "🇩🇪", GHA: "🇬🇭",
  GRE: "🇬🇷", HON: "🇭🇳", HUN: "🇭🇺", IRL: "🇮🇪", IRN: "🇮🇷",
  ISR: "🇮🇱", ITA: "🇮🇹", JPN: "🇯🇵", KOR: "🇰🇷", KSA: "🇸🇦",
  MAR: "🇲🇦", MEX: "🇲🇽", NED: "🇳🇱", NGA: "🇳🇬", NZL: "🇳🇿",
  PAN: "🇵🇦", PAR: "🇵🇾", PER: "🇵🇪", PHI: "🇵🇭", POL: "🇵🇱",
  POR: "🇵🇹", QAT: "🇶🇦", RSA: "🇿🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󁿢", SEN: "🇸🇳",
  SRB: "🇷🇸", SUI: "🇨🇭", SWE: "🇸🇪", TUR: "🇹🇷", UKR: "🇺🇦",
  URU: "🇺🇾", USA: "🇺🇸", VEN: "🇻🇪", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󁿢",
};

export function flag(code: string): string {
  return FLAG[code] ?? "";
}
