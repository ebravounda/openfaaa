const CODES = "AF AL DE AD AO AG SA DZ AR AM AU AT AZ BS BD BB BH BE BZ BJ BY BO BA BW BR BN BG BF BI BT CV KH CM CA QA TD CL CN CY CO KM CG KR KP CI CR HR CU DK DM EC EG SV AE ER SK SI ES US EE SZ ET PH FI FJ FR GA GM GE GH GD GR GT GN GQ GW GY HT HN HK HU IN ID IQ IR IE IS IL IT JM JP JO KZ KE KG KI KW LA LS LV LB LR LY LI LT LU MO MK MG MY MW MV ML MT MA MU MR MX FM MD MC MN ME MZ MM NA NR NP NI NE NG NO NZ OM NL PK PW PA PG PY PE PL PT PR GB CF CZ CD DO RW RO RU WS SM VC LC ST SN RS SC SL SG SY SO LK ZA SD SS SE CH SR TH TW TZ TJ TL TG TO TT TN TM TR TV UA UG UY UZ VU VA VE VN YE DJ ZM ZW GI AW CW".split(" ");

export const EU = new Set("AT BE BG CY CZ DE DK EE GR ES FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK".split(" "));

const names = new Intl.DisplayNames(["es"], { type: "region" });
export const COUNTRIES = CODES.map((code) => ({ code, name: names.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

export const countryName = (code) => (code ? names.of(code) || code : "");
export const isExtraEU = (code) => !!code && code !== "ES" && !EU.has(code);

const ES_ID = /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/;
export const looksSpanishId = (v) => ES_ID.test((v || "").toUpperCase().replace(/[\s.-]/g, ""));
