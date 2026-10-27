/**
 * The browser-side file reader — what actually runs when a human drops a file into the room.
 *
 * docx / pptx / xlsx are ZIPs of XML, so the fixtures are built here with a tiny zip writer
 * rather than committed as binaries. PDF is not covered: it needs `unpdf` and a real PDF, and a
 * stubbed parser would only prove the stub.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync, crc32 } from 'node:zlib';

const { readFileInBrowser, UnreadableFileError, MAX_FILE_TEXT, MAX_FILE_BYTES } = await import(
  '../web/src/prototype/chat/read-file-web.ts'
);

/** Minimal ZIP writer: one local header + data per file, then the central directory. */
const zip = (files, { method = 8 } = {}) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(content);
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
};

const asFile = (name, buffer) => ({
  name,
  size: buffer.length,
  arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
});

const read = (name, buffer) => readFileInBrowser(asFile(name, Buffer.from(buffer)));
const reasonOf = async (promise) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof UnreadableFileError, `expected UnreadableFileError, got ${error}`);
    return error.reason;
  }
  assert.fail('expected the read to be refused');
};

test('plain text is read, BOM stripped', async () => {
  const r = await read('note.txt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Xin chào')]));
  assert.equal(r.text, 'Xin chào');
  assert.equal(r.truncated, false);
});

test('UTF-16 text is read', async () => {
  const r = await read('v.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Việt Nam', 'utf16le')]));
  assert.equal(r.text, 'Việt Nam');
});

test('a Windows-1258 file does not come out as mojibake', async () => {
  // 0xE0 is "à" in windows-1258 and an invalid lead byte in UTF-8.
  const r = await read('old.txt', Buffer.from([0x68, 0xe0, 0x6e, 0x67]));
  assert.equal(r.text, 'hàng');
});

test('a binary file renamed to .txt is refused', async () => {
  assert.match(await reasonOf(read('fake.txt', Buffer.from([0x61, 0x00, 0x01]))), /text file/);
});

test('docx: paragraphs, tabs, entities and table rows', async () => {
  const xml = `<w:document><w:body>
    <w:p><w:r><w:t>Kế hoạch</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">A &amp; B </w:t></w:r><w:r><w:t>&lt;10%</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Mục</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Tiền</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  </w:body></w:document>`;
  const r = await read('a.docx', zip({ 'word/document.xml': xml }));
  assert.equal(r.text, 'Kế hoạch\nA & B <10%\nMục\tTiền');
});

test('docx: a zip with no document.xml says it is not Word', async () => {
  assert.match(await reasonOf(read('a.docx', zip({ 'other.xml': '<x/>' }))), /not a Word/);
});

test('docx: a stored (uncompressed) entry is read too', async () => {
  const r = await read('a.docx', zip({ 'word/document.xml': '<w:p><w:r><w:t>raw</w:t></w:r></w:p>' }, { method: 0 }));
  assert.equal(r.text, 'raw');
});

test('pptx: slides follow presentation order, not file names', async () => {
  const slide = (text) => `<p:sld><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
  const r = await read(
    'a.pptx',
    zip({
      'ppt/presentation.xml': '<p:sldIdLst><p:sldId id="1" r:id="rId2"/><p:sldId id="2" r:id="rId1"/></p:sldIdLst>',
      'ppt/_rels/presentation.xml.rels':
        '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
      'ppt/slides/slide1.xml': slide('Mở đầu'),
      'ppt/slides/slide2.xml': slide('Kết luận'),
    })
  );
  assert.equal(r.text, '## Slide 1\nKết luận\n\n## Slide 2\nMở đầu');
});

test('xlsx: shared strings, numbers, booleans, gaps and several sheets', async () => {
  const r = await read(
    'a.xlsx',
    zip({
      'xl/workbook.xml': '<workbook><sheets><sheet name="Doanh thu" sheetId="1" r:id="rId1"/><sheet name="Chi" sheetId="2" r:id="rId2"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
      'xl/sharedStrings.xml': '<sst><si><t>Tháng</t></si><si><r><t>Số </t></r><r><t>tiền</t></r></si></sst>',
      'xl/worksheets/sheet1.xml':
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>7</v></c><c r="C2" t="b"><v>1</v></c></row></sheetData></worksheet>',
      'xl/worksheets/sheet2.xml':
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>inline</t></is></c></row></sheetData></worksheet>',
    })
  );
  assert.equal(r.text, '## Sheet: Doanh thu\nTháng\tSố tiền\n7\t\tTRUE\n\n## Sheet: Chi\ninline');
});

test('legacy Office formats and unknown types are refused with a way forward', async () => {
  assert.match(await reasonOf(read('old.doc', Buffer.from('x'))), /Save it as \.docx/);
  assert.match(await reasonOf(read('old.xls', Buffer.from('x'))), /Save it as \.xlsx/);
  assert.match(await reasonOf(read('pic.png', Buffer.from('x'))), /Supported files/);
});

test('an empty file, an oversized file and a damaged archive are each named', async () => {
  assert.match(await reasonOf(read('e.txt', Buffer.alloc(0))), /empty/);
  assert.match(
    await reasonOf(readFileInBrowser({ name: 'big.txt', size: MAX_FILE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(1) })),
    /larger than/
  );
  assert.match(await reasonOf(read('broken.docx', Buffer.from('not a zip at all, really'))), /damaged/);
});

test('long text is cut and says so', async () => {
  const r = await read('long.txt', Buffer.from('a'.repeat(MAX_FILE_TEXT + 500)));
  assert.equal(r.truncated, true);
  assert.equal(r.text.length, MAX_FILE_TEXT);
  assert.equal(r.totalChars, MAX_FILE_TEXT + 500);
});
