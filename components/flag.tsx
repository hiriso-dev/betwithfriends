"use client";

// Maps FIFA 3-letter codes to flagcdn.com slugs (ISO 2-letter, or subdivision for ENG/WAL/SCO)
const CDN: Record<string, string> = {
  ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BRA: "br",
  CAN: "ca", CHI: "cl", CIV: "ci", CMR: "cm", COL: "co",
  CRC: "cr", CRO: "hr", DEN: "dk", ECU: "ec", EGY: "eg",
  ENG: "gb-eng", ESP: "es", FRA: "fr", GER: "de", GHA: "gh",
  GRE: "gr", HON: "hn", HUN: "hu", IRL: "ie", IRN: "ir",
  ISR: "il", ITA: "it", JPN: "jp", KOR: "kr", KSA: "sa",
  MAR: "ma", MEX: "mx", NED: "nl", NGA: "ng", NZL: "nz",
  PAN: "pa", PAR: "py", PER: "pe", PHI: "ph", POL: "pl",
  POR: "pt", QAT: "qa", RSA: "za", SCO: "gb-sct", SEN: "sn",
  SRB: "rs", SUI: "ch", SWE: "se", TUR: "tr", UKR: "ua",
  URU: "uy", USA: "us", VEN: "ve", WAL: "gb-wls",
};

export function Flag({ code }: { code: string }) {
  const slug = CDN[code];
  if (!slug) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${slug}.png`}
      srcSet={`https://flagcdn.com/w80/${slug}.png 2x`}
      alt={code}
      className="inline-block align-middle"
      style={{ height: "1em", width: "auto" }}
    />
  );
}
