// World Cup 2026 teams. `name` is the canonical pick value stored for special bets.
export type WcTeam = { name: string; code: string };

export const WC_TEAMS: WcTeam[] = [
  { name: "Argentina",     code: "ARG" }, { name: "Australia",    code: "AUS" },
  { name: "Belgium",       code: "BEL" }, { name: "Brazil",       code: "BRA" },
  { name: "Cameroon",      code: "CMR" }, { name: "Canada",       code: "CAN" },
  { name: "Chile",         code: "CHI" }, { name: "Colombia",     code: "COL" },
  { name: "Croatia",       code: "CRO" }, { name: "Denmark",      code: "DEN" },
  { name: "Ecuador",       code: "ECU" }, { name: "Egypt",        code: "EGY" },
  { name: "England",       code: "ENG" }, { name: "France",       code: "FRA" },
  { name: "Germany",       code: "GER" }, { name: "Ghana",        code: "GHA" },
  { name: "Greece",        code: "GRE" }, { name: "Honduras",     code: "HON" },
  { name: "Hungary",       code: "HUN" }, { name: "Iran",         code: "IRN" },
  { name: "Israel",        code: "ISR" }, { name: "Italy",        code: "ITA" },
  { name: "Japan",         code: "JPN" }, { name: "South Korea",  code: "KOR" },
  { name: "Mexico",        code: "MEX" }, { name: "Morocco",      code: "MAR" },
  { name: "Netherlands",   code: "NED" }, { name: "Nigeria",      code: "NGA" },
  { name: "New Zealand",   code: "NZL" }, { name: "Panama",       code: "PAN" },
  { name: "Paraguay",      code: "PAR" }, { name: "Peru",         code: "PER" },
  { name: "Poland",        code: "POL" }, { name: "Portugal",     code: "POR" },
  { name: "Saudi Arabia",  code: "KSA" }, { name: "Senegal",      code: "SEN" },
  { name: "Serbia",        code: "SRB" }, { name: "South Africa", code: "RSA" },
  { name: "Spain",         code: "ESP" }, { name: "Switzerland",  code: "SUI" },
  { name: "Turkey",        code: "TUR" }, { name: "Ukraine",      code: "UKR" },
  { name: "United States", code: "USA" }, { name: "Uruguay",      code: "URU" },
  { name: "Venezuela",     code: "VEN" }, { name: "Wales",        code: "WAL" },
];
