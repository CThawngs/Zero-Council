/**
 * Reading a file the human drops into the room, entirely in their browser.
 *
 * Same stance as `read-link-web.ts`: no upload endpoint. An unauthenticated route that accepts
 * arbitrary files is an open door for storage and parsing cost, and that call belongs to the
 * product owner. Reading locally also means the file never leaves the user's machine except as
 * the text they chose to pin, sent to the provider they already gave a key for.
 *
 * Formats:
 *  - txt / md / csv / tsv / json / log : decoded as text.
 *  - docx / pptx / xlsx : these are ZIP files of XML. A minimal ZIP reader plus the browser's own
 *    `DecompressionStream` is enough, so there is no dependency for them.
 *  - pdf : needs a real parser (`unpdf`, a worker-free build of pdf.js), loaded lazily so the cost
 *    is only paid by someone who actually attaches a PDF.
 *
 * Ceilings, stated plainly: legacy binary Office files (.doc/.ppt/.xls) are not read; scanned PDFs
 * and images have no text layer and there is no OCR; xlsx dates arrive as serial numbers; text is
 * cut at MAX_FILE_TEXT and the attachment says so. Nothing is dropped silently — an unreadable
 * file becomes an `UnreadableFileError` whose reason the room shows.
 */

/** Keeps a pasted 200 MB file from freezing the tab. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/**
 * Pinned text rides in every advisor's prompt on every turn, on the user's own key. This is the
 * one knob that trades completeness against cost.
 */
export const MAX_FILE_TEXT = 30_000;
/** Guards against a zip bomb: a tiny archive that inflates to gigabytes. */
const MAX_INFLATED_BYTES = 40 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [
  '.txt', '.md', '.csv', '.tsv', '.json', '.log',
  '.docx', '.pptx', '.xlsx', '.pdf',
] as const;

/** Value for `<input type="file" accept>`. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',');

const LEGACY_OFFICE = new Set(['.doc', '.ppt', '.xls']);

export class UnreadableFileError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'UnreadableFileError';
    this.reason = reason;
  }
}

/** The slice of `File` this module needs, so tests can pass a stub. */
export interface FileLike {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface FileReading {
  text: string;
  /** True when the file had more text than MAX_FILE_TEXT and the rest was cut. */
  truncated: boolean;
  /** Characters in the whole file's text, before cutting. */
  totalChars: number;
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

/* ------------------------------------------------------------------ text */

const decodeText = (bytes: Uint8Array): string => {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  // A NUL byte in plain text almost always means a binary file renamed to .txt.
  const probe = bytes.subarray(0, 8000);
  for (let i = 0; i < probe.length; i += 1) {
    if (probe[i] === 0) throw new UnreadableFileError('This does not look like a text file.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    // Old Vietnamese files are often Windows-1258, not UTF-8. Better than showing mojibake.
    try {
      return new TextDecoder('windows-1258').decode(bytes);
    } catch {
      throw new UnreadableFileError('The text encoding is not supported. Save it as UTF-8 and try again.');
    }
  }
};

/* ------------------------------------------------------------------- zip */

interface ZipEntry {
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
}

const readZipDirectory = (bytes: Uint8Array): Map<string, ZipEntry> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is at least 22 bytes and may be followed by a comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new UnreadableFileError('This file is damaged or is not an Office document.');

  const count = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  if (count === 0xffff || pointer === 0xffffffff) {
    throw new UnreadableFileError('This archive is too large to read (ZIP64).');
  }

  const entries = new Map<string, ZipEntry>();
  const utf8 = new TextDecoder('utf-8');
  for (let n = 0; n < count; n += 1) {
    if (pointer + 46 > bytes.length || view.getUint32(pointer, true) !== 0x02014b50) {
      throw new UnreadableFileError('This file is damaged or is not an Office document.');
    }
    const flags = view.getUint16(pointer + 8, true);
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const uncompressedSize = view.getUint32(pointer + 24, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const offset = view.getUint32(pointer + 42, true);
    const name = utf8.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    if (flags & 0x1) throw new UnreadableFileError('This file is password-protected.');
    entries.set(name, { method, compressedSize, uncompressedSize, offset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const inflateEntry = async (bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> => {
  if (entry.uncompressedSize > MAX_INFLATED_BYTES) {
    throw new UnreadableFileError('This document is too large to read.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) {
    throw new UnreadableFileError('This file is damaged or is not an Office document.');
  }
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new UnreadableFileError('This file uses a compression the reader does not support.');

  // The size in the header can lie, so the limit is enforced on what actually comes out.
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new UnreadableFileError('This document is too large to read.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

type Zip = { entries: Map<string, ZipEntry>; bytes: Uint8Array };

const zipText = async (zip: Zip, path: string): Promise<string | null> => {
  const entry = zip.entries.get(path);
  if (!entry) return null;
  return new TextDecoder('utf-8').decode(await inflateEntry(zip.bytes, entry));
};

/* ------------------------------------------------------------------- xml */

const decodeXml = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const key = entity.toLowerCase();
    if (key === 'amp') return '&';
    if (key === 'lt') return '<';
    if (key === 'gt') return '>';
    if (key === 'quot') return '"';
    if (key === 'apos') return "'";
    const code = key.startsWith('#x') ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
    try {
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    } catch {
      return whole;
    }
  });

const attr = (tag: string, name: string): string | null => {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return match ? decodeXml(match[1]) : null;
};

/** Paths in .rels files are relative to the part's folder unless they start with "/". */
const resolveTarget = (base: string, target: string): string => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = `${base}/${target}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
};

const relationships = async (zip: Zip, path: string, base: string): Promise<Map<string, string>> => {
  const xml = await zipText(zip, path);
  const map = new Map<string, string>();
  if (!xml) return map;
  for (const match of xml.matchAll(/<Relationship\s[^>]*?\/?>/g)) {
    const id = attr(match[0], 'Id');
    const target = attr(match[0], 'Target');
    if (id && target) map.set(id, resolveTarget(base, target));
  }
  return map;
};

/* ------------------------------------------------------------------ docx */

const docxText = async (zip: Zip): Promise<string> => {
  const xml = await zipText(zip, 'word/document.xml');
  if (!xml) throw new UnreadableFileError('This is not a Word document (.docx).');
  // `<w:t` must be followed by space or ">" so `<w:tbl>` and `<w:tab/>` are not mistaken for text.
  const token = /<w:t(?:\s[^>]*[^/>])?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\s*\/>|<\/w:p>|<\/w:tc>|<\/w:tr>/g;
  let out = '';
  for (const match of xml.matchAll(token)) {
    const piece = match[0];
    if (match[1] !== undefined) out += decodeXml(match[1]);
    else if (piece.startsWith('<w:tab')) out += '\t';
    else if (piece.startsWith('<w:br') || piece.startsWith('<w:cr') || piece === '</w:p>') out += '\n';
    // A cell's last paragraph already ended in a newline; the cell separator replaces it so a
    // table row stays on one line.
    else if (piece === '</w:tc>') out = out.endsWith('\n') ? `${out.slice(0, -1)}\t` : `${out}\t`;
    else out = `${out.replace(/\t$/, '')}\n`;
    if (out.length > MAX_FILE_TEXT * 4) break;
  }
  return out;
};

/* ------------------------------------------------------------------ pptx */

const pptxText = async (zip: Zip): Promise<string> => {
  const presentation = await zipText(zip, 'ppt/presentation.xml');
  if (!presentation) throw new UnreadableFileError('This is not a PowerPoint file (.pptx).');

  // Slide order lives in presentation.xml, not in the file names: a reordered deck keeps its
  // slide1.xml, slide2.xml names. Fall back to numeric order if the list cannot be resolved.
  const rels = await relationships(zip, 'ppt/_rels/presentation.xml.rels', 'ppt');
  let paths: string[] = [];
  for (const match of presentation.matchAll(/<p:sldId\s[^>]*?\/?>/g)) {
    const target = rels.get(attr(match[0], 'r:id') ?? '');
    if (target) paths.push(target);
  }
  if (paths.length === 0) {
    paths = [...zip.entries.keys()]
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  }

  let out = '';
  for (let index = 0; index < paths.length; index += 1) {
    const xml = await zipText(zip, paths[index]);
    if (!xml) continue;
    let slide = '';
    for (const match of xml.matchAll(/<a:t(?:\s[^>]*[^/>])?>([\s\S]*?)<\/a:t>|<a:br\s*\/>|<\/a:p>/g)) {
      if (match[1] !== undefined) slide += decodeXml(match[1]);
      else slide += '\n';
    }
    out += `## Slide ${index + 1}\n${slide.replace(/\n{3,}/g, '\n\n').trim()}\n\n`;
    if (out.length > MAX_FILE_TEXT * 4) break;
  }
  return out;
};

/* ------------------------------------------------------------------ xlsx */

const columnIndex = (ref: string): number => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Za-z]/g, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const sharedStrings = async (zip: Zip): Promise<string[]> => {
  const xml = await zipText(zip, 'xl/sharedStrings.xml');
  if (!xml) return [];
  const strings: string[] = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g)) {
    let text = '';
    // Rich text splits one string across several <t>; phonetic runs (<rPh>) are not the value.
    const body = (si[1] ?? '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    for (const t of body.matchAll(/<t(?:\s[^>]*[^/>])?>([\s\S]*?)<\/t>/g)) text += decodeXml(t[1]);
    strings.push(text);
  }
  return strings;
};

const xlsxText = async (zip: Zip): Promise<string> => {
  const workbook = await zipText(zip, 'xl/workbook.xml');
  if (!workbook) throw new UnreadableFileError('This is not an Excel file (.xlsx).');
  const rels = await relationships(zip, 'xl/_rels/workbook.xml.rels', 'xl');
  const strings = await sharedStrings(zip);

  let out = '';
  for (const sheetTag of workbook.matchAll(/<sheet\s[^>]*?\/?>/g)) {
    const name = attr(sheetTag[0], 'name') ?? 'Sheet';
    const path = rels.get(attr(sheetTag[0], 'r:id') ?? '');
    const xml = path ? await zipText(zip, path) : null;
    if (!xml) continue;

    out += `## Sheet: ${name}\n`;
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const header = cell[1];
        const body = cell[2] ?? '';
        const type = attr(header, 't');
        let value = '';
        if (type === 'inlineStr') {
          for (const t of body.matchAll(/<t(?:\s[^>]*[^/>])?>([\s\S]*?)<\/t>/g)) value += decodeXml(t[1]);
        } else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
          if (v !== undefined) {
            if (type === 's') value = strings[Number(v)] ?? '';
            else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
            else value = decodeXml(v);
          }
        }
        const ref = attr(header, 'r');
        const at = ref ? columnIndex(ref) : cells.length;
        while (cells.length < at) cells.push('');
        // Tabs and newlines inside a cell would break the row, so they become spaces.
        cells[at] = value.replace(/[\t\r\n]+/g, ' ');
      }
      const line = cells.join('\t').replace(/\t+$/, '');
      if (line) out += `${line}\n`;
      if (out.length > MAX_FILE_TEXT * 4) break;
    }
    out += '\n';
    if (out.length > MAX_FILE_TEXT * 4) break;
  }
  return out;
};

/* ------------------------------------------------------------------- pdf */

const pdfText = async (bytes: Uint8Array): Promise<string> => {
  try {
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    throw new UnreadableFileError('The PDF could not be opened. It may be password-protected or damaged.');
  }
};

/* ---------------------------------------------------------------- public */

const cut = (text: string): FileReading => {
  const cleaned = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= MAX_FILE_TEXT) {
    return { text: cleaned, truncated: false, totalChars: cleaned.length };
  }
  let end = MAX_FILE_TEXT;
  // Do not cut a surrogate pair in half.
  const last = cleaned.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return { text: cleaned.slice(0, end), truncated: true, totalChars: cleaned.length };
};

export const readFileInBrowser = async (file: FileLike): Promise<FileReading> => {
  const extension = extensionOf(file.name);

  if (LEGACY_OFFICE.has(extension)) {
    throw new UnreadableFileError(
      `Old ${extension} files are not supported. Save it as ${extension}x and attach that.`
    );
  }
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new UnreadableFileError(`Supported files: ${ACCEPTED_EXTENSIONS.join(', ')}.`);
  }
  if (file.size === 0) throw new UnreadableFileError('The file is empty.');
  if (file.size > MAX_FILE_BYTES) {
    throw new UnreadableFileError(`The file is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;

  if (extension === '.pdf') {
    text = await pdfText(bytes);
    if (text.trim().length < 20) {
      throw new UnreadableFileError('This PDF has no text to read. It is probably a scan, and there is no OCR yet.');
    }
  } else if (extension === '.docx' || extension === '.pptx' || extension === '.xlsx') {
    let zip: Zip;
    try {
      zip = { entries: readZipDirectory(bytes), bytes };
    } catch (error) {
      if (error instanceof UnreadableFileError) throw error;
      throw new UnreadableFileError('This file is damaged or is not an Office document.');
    }
    try {
      text = extension === '.docx' ? await docxText(zip) : extension === '.pptx' ? await pptxText(zip) : await xlsxText(zip);
    } catch (error) {
      if (error instanceof UnreadableFileError) throw error;
      throw new UnreadableFileError('This file could not be read. It may be damaged.');
    }
  } else {
    text = decodeText(bytes);
  }

  const reading = cut(text);
  if (!reading.text) throw new UnreadableFileError('No readable text was found in this file.');
  return reading;
};
