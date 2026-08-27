/**
 * Minimal .xlsx writer — no dependencies.
 *
 * Why not SheetJS: the last npm release (xlsx@0.18.5) carries two unfixed
 * high-severity advisories and weighs ~900 KB against the 300 KB bundle
 * budget in SRS NFR-3. Both advisories concern PARSING hostile files and we
 * only write, but an unfixable high finding fails NFR-11 for as long as the
 * package is installed.
 *
 * An .xlsx is a ZIP of XML parts. This writes the five required parts with
 * STORED (uncompressed) entries, which needs only a CRC-32 — no deflate
 * implementation. Exports run to a few hundred rows, so skipping compression
 * costs nothing that matters.
 *
 * Strings are written inline, so there is no shared-string table.
 */

export type CellValue = string | number | null | undefined;

const enc = new TextEncoder();

/* ------------------------------------------------------------------ crc32 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* -------------------------------------------------------------------- xml */

/**
 * XML 1.0 forbids most control characters; leaving one in makes Excel refuse
 * to open the file. Tab, newline and carriage return are the legal three.
 */
function stripControl(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    if (c === 9 || c === 10 || c === 13 || c >= 32) out += ch;
  }
  return out;
}

function esc(s: string): string {
  return stripControl(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA */
export function colName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sheetXml(rows: CellValue[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v == null || v === "") return "";
          const ref = `${colName(c)}${r + 1}`;
          if (typeof v === "number" && Number.isFinite(v)) {
            return `<c r="${ref}"><v>${v}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

function workbookXml(sheetName: string): string {
  // Excel rejects these characters in a sheet name and caps it at 31 chars.
  const safe = esc(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31)) || "Sheet1";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safe}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

/* -------------------------------------------------------------------- zip */

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

function zip(files: Array<{ name: string; text: string }>): Uint8Array {
  const entries = files.map((f) => {
    const data = enc.encode(f.text);
    return { name: enc.encode(f.name), data, crc: crc32(data) };
  });

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const e of entries) {
    const header = Uint8Array.from([
      ...u32(0x04034b50),
      ...u16(20), // version needed
      ...u16(0x0800), // UTF-8 filename flag
      ...u16(0), // method 0 = stored
      ...u16(0),
      ...u16(0), // fixed mod time/date, so output is deterministic
      ...u32(e.crc),
      ...u32(e.data.length),
      ...u32(e.data.length),
      ...u16(e.name.length),
      ...u16(0),
    ]);
    offsets.push(offset);
    parts.push(header, e.name, e.data);
    offset += header.length + e.name.length + e.data.length;
  }

  const centralStart = offset;
  entries.forEach((e, i) => {
    const central = Uint8Array.from([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(e.crc),
      ...u32(e.data.length),
      ...u32(e.data.length),
      ...u16(e.name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offsets[i]),
    ]);
    parts.push(central, e.name);
    offset += central.length + e.name.length;
  });

  parts.push(
    Uint8Array.from([
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(entries.length),
      ...u16(entries.length),
      ...u32(offset - centralStart),
      ...u32(centralStart),
      ...u16(0),
    ]),
  );

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/* ------------------------------------------------------------------ public */

/** Raw bytes of a single-sheet workbook. */
export function xlsxBytes(sheetName: string, rows: CellValue[][]): Uint8Array {
  return zip([
    { name: "[Content_Types].xml", text: CONTENT_TYPES },
    { name: "_rels/.rels", text: ROOT_RELS },
    { name: "xl/workbook.xml", text: workbookXml(sheetName) },
    { name: "xl/_rels/workbook.xml.rels", text: WORKBOOK_RELS },
    { name: "xl/worksheets/sheet1.xml", text: sheetXml(rows) },
  ]);
}

export function buildXlsx(sheetName: string, rows: CellValue[][]): Blob {
  return new Blob([xlsxBytes(sheetName, rows) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
