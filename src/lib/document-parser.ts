import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
export const MAX_DOCUMENT_BYTES = 30 * 1024 * 1024;
export const MAX_TEXT_CHARS = 120000;
export function documentType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) return "image";
  if (["pdf", "docx", "xlsx", "csv"].includes(ext ?? "")) return ext!;
  throw new Error("仅支持 JPG、PNG、WEBP、PDF、XLSX、CSV、DOCX 文件");
}
export async function parseDocument(bytes: Buffer, type: string) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("文件不能为空，单文件不能超过 30MB");
  let text = "";
  if (type === "pdf") {
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("PDF 文件内容无效");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try { const info = await parser.getInfo(); if (info.total > 200) throw new Error("PDF 超过 200 页，请拆分后上传"); text = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else if (type === "docx") text = (await mammoth.extractRawText({ buffer: bytes })).value;
  else if (type === "xlsx") {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    if (workbook.worksheets.length > 30) throw new Error("参数表超过 30 个工作表，请拆分后上传");
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > 10000 || sheet.columnCount > 100) throw new Error("参数表过大，请保留产品相关数据后上传");
      text += `\n工作表：${sheet.name}\n`;
      sheet.eachRow(row => { const cells: string[] = []; row.eachCell({ includeEmpty: true }, cell => cells.push(cell.text.replace(/\s*\n\s*/g, " "))); text += cells.join(" | ") + "\n"; });
    }
  } else if (type === "csv") {
    const rows: string[][] = parse(bytes.toString("utf8"), { bom: true, skip_empty_lines: true, relax_column_count: true, max_record_size: 20000 });
    if (rows.length > 10000) throw new Error("CSV 超过 10000 行，请拆分后上传");
    text = rows.map(row => row.join(" | ")).join("\n");
  } else throw new Error("不支持该文档格式");
  text = text.trim();
  if (!text) throw new Error("未提取到文字；扫描 PDF 请提供可复制文字版本或粘贴说明");
  if (text.length > MAX_TEXT_CHARS) throw new Error("文档文字超过 12 万字符，请拆分后上传");
  return text;
}
