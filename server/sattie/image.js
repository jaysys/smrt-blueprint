import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";

const imageDir = path.resolve("server", "data", "sattie", "images");
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const OSM_TILE_TEMPLATE =
  process.env.SATTIE_OSM_TILE_URL_TEMPLATE ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_USER_AGENT = "k-sattie-sky-hub/0.2 (+https://localhost; contact: local-dev)";
const FOOTER_FONT_FAMILY = "Sattie Noto Sans KR";
const DECORATION_SCALE = 0.5;
const DECORATION_BG_START = "#f3fbff";
const DECORATION_BG_END = "#dceffc";
const DECORATION_GRID = "rgba(73, 128, 168, 0.12)";
const DECORATION_GRID_BOLD = "rgba(73, 128, 168, 0.2)";
const DECORATION_TEXT = "#204863";
const DECORATION_TEXT_MUTED = "#587991";
const DECORATION_BORDER = "rgba(104, 157, 195, 0.34)";
const DECORATION_CELL_BG = "rgba(255, 255, 255, 0.72)";
const FOOTER_FONT_PATHS = [
  path.resolve("node_modules", "@fontsource", "noto-sans-kr", "files", "noto-sans-kr-korean-400-normal.woff"),
  path.resolve("node_modules", "@fontsource", "noto-sans-kr", "files", "noto-sans-kr-korean-700-normal.woff"),
  path.resolve("node_modules", "@fontsource", "noto-sans-kr", "files", "noto-sans-kr-latin-400-normal.woff"),
  path.resolve("node_modules", "@fontsource", "noto-sans-kr", "files", "noto-sans-kr-latin-700-normal.woff"),
];

let footerFontsReady = false;

export function ensureSattieImageDir() {
  fs.mkdirSync(imageDir, { recursive: true });
  return imageDir;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureFooterFonts() {
  if (footerFontsReady) {
    return;
  }

  let registeredCount = 0;
  for (const fontPath of FOOTER_FONT_PATHS) {
    if (!fs.existsSync(fontPath)) {
      continue;
    }
    const key = GlobalFonts.registerFromPath(fontPath, FOOTER_FONT_FAMILY);
    if (key) {
      registeredCount += 1;
    }
  }

  if (registeredCount === 0) {
    throw new Error("Footer font registration failed. Install @fontsource/noto-sans-kr.");
  }

  footerFontsReady = true;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = buildCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodeRgbPng(width, height, rgbData) {
  const clampedWidth = Math.max(1, Math.min(4096, Math.trunc(width)));
  const clampedHeight = Math.max(1, Math.min(4096, Math.trunc(height)));
  const rows = [];

  for (let y = 0; y < clampedHeight; y += 1) {
    const row = Buffer.alloc(1 + clampedWidth * 3);
    row[0] = 0;
    for (let x = 0; x < clampedWidth; x += 1) {
      const offset = 1 + x * 3;
      const rgbOffset = (y * clampedWidth + x) * 3;
      row[offset] = rgbData[rgbOffset];
      row[offset + 1] = rgbData[rgbOffset + 1];
      row[offset + 2] = rgbData[rgbOffset + 2];
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(clampedWidth, 0);
  header.writeUInt32BE(clampedHeight, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const imageData = zlib.deflateSync(Buffer.concat(rows));

  return Buffer.concat([
    pngSignature,
    makeChunk("IHDR", header),
    makeChunk("IDAT", imageData),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildRgbData(width, height, pixelFn) {
  const clampedWidth = Math.max(1, Math.min(4096, Math.trunc(width)));
  const clampedHeight = Math.max(1, Math.min(4096, Math.trunc(height)));
  const rgbData = Buffer.alloc(clampedWidth * clampedHeight * 3);

  for (let y = 0; y < clampedHeight; y += 1) {
    for (let x = 0; x < clampedWidth; x += 1) {
      const offset = (y * clampedWidth + x) * 3;
      const [r, g, b] = pixelFn(x, y, clampedWidth, clampedHeight);
      rgbData[offset] = r;
      rgbData[offset + 1] = g;
      rgbData[offset + 2] = b;
    }
  }

  return { width: clampedWidth, height: clampedHeight, rgbData };
}

function buildPng(width, height, pixelFn) {
  const rgb = buildRgbData(width, height, pixelFn);
  return encodeRgbPng(rgb.width, rgb.height, rgb.rgbData);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitTextToWidth(ctx, text, maxWidth) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "-";
  }
  if (ctx.measureText(normalized).width <= maxWidth) {
    return normalized;
  }

  let output = normalized;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output.trimEnd()}…`;
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return ["-"];
  }

  const characters = Array.from(normalized);
  const lines = [];
  let current = "";

  for (let index = 0; index < characters.length; index += 1) {
    const candidate = current + characters[index];
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current.trim());
    current = characters[index].trimStart();
    if (lines.length === maxLines - 1) {
      const remainder = characters.slice(index).join("").trim();
      lines.push(fitTextToWidth(ctx, `${current}${remainder}`.trim(), maxWidth));
      return lines;
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return lines.slice(0, maxLines);
}

function getFooterColumns(width) {
  if (width >= 960) {
    return 3;
  }
  if (width >= 640) {
    return 2;
  }
  return 1;
}

function formatFooterKst(value) {
  if (!value) {
    return "-";
  }

  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(parsed))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
}

function buildFooterCells(width, items) {
  const padding = clamp(Math.round(width * 0.022 * DECORATION_SCALE), 8, 12);
  const gap = clamp(Math.round(width * 0.014 * DECORATION_SCALE), 5, 8);
  const rows = [];
  const columns = getFooterColumns(width);
  for (let cursor = 0; cursor < items.length; cursor += columns) {
    rows.push(items.slice(cursor, cursor + columns));
  }

  const labelFontSize = clamp(Math.round(width * 0.014 * DECORATION_SCALE), 10, 11);
  const valueFontSize = clamp(Math.round(width * 0.018 * DECORATION_SCALE), 11, 14);
  const valueLineHeight = Math.round(valueFontSize * 1.24);
  const cellHeight = clamp(labelFontSize + valueLineHeight * 2 + 14, 38, 46);
  const footerHeight = padding * 2 + rows.length * cellHeight + (rows.length - 1) * gap;
  const cells = [];

  rows.forEach((rowItems, rowIndex) => {
    const rowWidth = width - padding * 2 - gap * (rowItems.length - 1);
    const cellWidth = Math.floor(rowWidth / rowItems.length);
    const rowY = padding + rowIndex * (cellHeight + gap);
    let rowX = padding;

    rowItems.forEach((item, itemIndex) => {
      const isLast = itemIndex === rowItems.length - 1;
      const currentWidth = isLast ? width - padding - rowX : cellWidth;
      cells.push({
        x: rowX,
        y: rowY,
        width: currentWidth,
        height: cellHeight,
        ...item,
      });
      rowX += currentWidth + gap;
    });
  });

  return {
    footerHeight,
    labelFontSize,
    valueFontSize,
    valueLineHeight,
    cells,
  };
}

function buildHeaderLayout(width) {
  const paddingX = clamp(Math.round(width * 0.03 * DECORATION_SCALE), 9, 15);
  const titleFontSize = clamp(Math.round(width * 0.03 * DECORATION_SCALE), 11, 15);
  const subFontSize = clamp(Math.round(width * 0.0125 * DECORATION_SCALE), 8, 9);
  const headerHeight = clamp(Math.round(width * 0.11 * DECORATION_SCALE), 32, 46);

  return {
    paddingX,
    titleFontSize,
    subFontSize,
    headerHeight,
  };
}

function drawDecorationPattern(ctx, width, height, yOffset = 0) {
  const majorStep = clamp(Math.round(width * 0.08), 28, 56);
  const minorStep = Math.max(12, Math.round(majorStep / 2));

  ctx.save();
  ctx.translate(0, yOffset);

  ctx.strokeStyle = DECORATION_GRID;
  ctx.lineWidth = 1;
  for (let x = minorStep; x < width; x += minorStep) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  for (let y = minorStep; y < height; y += minorStep) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = DECORATION_GRID_BOLD;
  for (let x = majorStep; x < width; x += majorStep) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(width * 0.72, 0);
  ctx.quadraticCurveTo(width * 0.98, height * 0.18, width * 0.86, height);
  ctx.stroke();

  ctx.restore();
}

function drawHeaderBar(ctx, width, header) {
  const headerGradient = ctx.createLinearGradient(0, 0, width, header.headerHeight);
  headerGradient.addColorStop(0, DECORATION_BG_START);
  headerGradient.addColorStop(1, DECORATION_BG_END);
  ctx.fillStyle = headerGradient;
  ctx.fillRect(0, 0, width, header.headerHeight);
  drawDecorationPattern(ctx, width, header.headerHeight);

  const accentGradient = ctx.createLinearGradient(0, 0, width, 0);
  accentGradient.addColorStop(0, "rgba(255,255,255,0.72)");
  accentGradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = accentGradient;
  ctx.fillRect(0, 0, width, 1);

  ctx.fillStyle = "rgba(112, 170, 212, 0.18)";
  ctx.beginPath();
  ctx.arc(width - header.paddingX - 10, header.headerHeight / 2, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = DECORATION_TEXT_MUTED;
  ctx.textBaseline = "top";
  ctx.font = `700 ${header.subFontSize}px "${FOOTER_FONT_FAMILY}"`;
  ctx.fillText("K-SATTIE SYSTEM", header.paddingX, 5);

  ctx.fillStyle = DECORATION_TEXT;
  ctx.font = `700 ${header.titleFontSize}px "${FOOTER_FONT_FAMILY}"`;
  ctx.fillText("K-Sattie Image Hub", header.paddingX, 14);

  ctx.strokeStyle = DECORATION_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, header.headerHeight - 0.5);
  ctx.lineTo(width, header.headerHeight - 0.5);
  ctx.stroke();
}

function drawFooterCell(ctx, cell, labelFontSize, valueFontSize, valueLineHeight) {
  drawRoundedRect(ctx, cell.x, cell.y, cell.width, cell.height, 7);
  ctx.fillStyle = DECORATION_CELL_BG;
  ctx.fill();
  ctx.strokeStyle = DECORATION_BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();

  const contentX = cell.x + 8;
  const labelY = cell.y + 6;
  const valueY = labelY + labelFontSize + 5;
  const contentWidth = cell.width - 16;

  ctx.textBaseline = "top";
  ctx.fillStyle = DECORATION_TEXT_MUTED;
  ctx.font = `700 ${labelFontSize}px "${FOOTER_FONT_FAMILY}"`;
  ctx.fillText(cell.label, contentX, labelY);

  ctx.fillStyle = DECORATION_TEXT;
  ctx.font = `700 ${valueFontSize}px "${FOOTER_FONT_FAMILY}"`;
  const lines = wrapText(ctx, cell.value, contentWidth, 2);
  lines.forEach((line, index) => {
    ctx.fillText(line, contentX, valueY + index * valueLineHeight);
  });
}

function normalizeFooterValue(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "N/A";
}

function getChannelCount(colorType) {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 3:
      return 1;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`Unsupported PNG color type: ${colorType}`);
  }
}

function getBitsPerPixel(colorType, bitDepth) {
  return getChannelCount(colorType) * bitDepth;
}

function paethPredictor(left, up, upLeft) {
  const base = left + up - upLeft;
  const leftDistance = Math.abs(base - left);
  const upDistance = Math.abs(base - up);
  const upLeftDistance = Math.abs(base - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}

function unfilterPngScanlines(data, width, height, colorType, bitDepth) {
  const bitsPerPixel = getBitsPerPixel(colorType, bitDepth);
  const rowLength = Math.ceil((width * bitsPerPixel) / 8);
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const output = Buffer.alloc(rowLength * height);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = data[inputOffset];
    inputOffset += 1;
    const rowOffset = y * rowLength;

    for (let x = 0; x < rowLength; x += 1) {
      const raw = data[inputOffset];
      inputOffset += 1;
      const left = x >= bytesPerPixel ? output[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[rowOffset + x - rowLength] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[rowOffset + x - rowLength - bytesPerPixel] : 0;

      switch (filterType) {
        case 0:
          output[rowOffset + x] = raw;
          break;
        case 1:
          output[rowOffset + x] = (raw + left) & 0xff;
          break;
        case 2:
          output[rowOffset + x] = (raw + up) & 0xff;
          break;
        case 3:
          output[rowOffset + x] = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          output[rowOffset + x] = (raw + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
    }
  }

  return output;
}

function unpackPackedSamples(row, bitDepth, count) {
  if (bitDepth === 8) {
    return row.subarray(0, count);
  }

  const samples = new Uint8Array(count);
  const mask = (1 << bitDepth) - 1;
  let sampleIndex = 0;

  for (let i = 0; i < row.length && sampleIndex < count; i += 1) {
    const byte = row[i];
    for (let shift = 8 - bitDepth; shift >= 0 && sampleIndex < count; shift -= bitDepth) {
      const value = (byte >> shift) & mask;
      samples[sampleIndex] = Math.round((value / mask) * 255);
      sampleIndex += 1;
    }
  }

  return samples;
}

function blendChannel(channel, alpha) {
  return Math.round((channel * alpha + 255 * (255 - alpha)) / 255);
}

function decodePngToRgb(buffer) {
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Invalid PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compressionMethod = 0;
  let filterMethod = 0;
  let interlaceMethod = 0;
  let palette = null;
  let transparency = null;
  const imageDataChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    switch (type) {
      case "IHDR":
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
        compressionMethod = data[10];
        filterMethod = data[11];
        interlaceMethod = data[12];
        break;
      case "PLTE":
        palette = Buffer.from(data);
        break;
      case "tRNS":
        transparency = Buffer.from(data);
        break;
      case "IDAT":
        imageDataChunks.push(Buffer.from(data));
        break;
      case "IEND":
        offset = buffer.length;
        break;
      default:
        break;
    }
  }

  if (!width || !height) {
    throw new Error("PNG IHDR chunk is missing");
  }
  if (compressionMethod !== 0 || filterMethod !== 0 || interlaceMethod !== 0) {
    throw new Error("Unsupported PNG encoding parameters");
  }
  if (colorType === 3 && !palette) {
    throw new Error("Indexed PNG is missing palette");
  }
  if (![0, 2, 3, 4, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }
  if (![1, 2, 4, 8].includes(bitDepth)) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }
  if (bitDepth !== 8 && ![0, 3].includes(colorType)) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth} for color type ${colorType}`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(imageDataChunks));
  const scanlines = unfilterPngScanlines(inflated, width, height, colorType, bitDepth);
  const rowLength = Math.ceil((width * getBitsPerPixel(colorType, bitDepth)) / 8);
  const rgbData = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    const row = scanlines.subarray(y * rowLength, (y + 1) * rowLength);
    const rowOffset = y * width * 3;

    if (colorType === 2) {
      row.copy(rgbData, rowOffset, 0, width * 3);
      continue;
    }

    if (colorType === 6) {
      for (let x = 0; x < width; x += 1) {
        const srcOffset = x * 4;
        const destOffset = rowOffset + x * 3;
        const alpha = row[srcOffset + 3];
        rgbData[destOffset] = blendChannel(row[srcOffset], alpha);
        rgbData[destOffset + 1] = blendChannel(row[srcOffset + 1], alpha);
        rgbData[destOffset + 2] = blendChannel(row[srcOffset + 2], alpha);
      }
      continue;
    }

    if (colorType === 3) {
      const indices = unpackPackedSamples(row, bitDepth, width);
      const paletteEntryCount = Math.floor(palette.length / 3);
      if (paletteEntryCount === 0) {
        throw new Error("PNG palette is empty");
      }
      for (let x = 0; x < width; x += 1) {
        const index = indices[x];
        const safeIndex = Math.max(0, Math.min(index, paletteEntryCount - 1));
        const paletteOffset = safeIndex * 3;
        const destOffset = rowOffset + x * 3;
        const alpha = transparency?.[safeIndex] ?? 255;
        rgbData[destOffset] = blendChannel(palette[paletteOffset], alpha);
        rgbData[destOffset + 1] = blendChannel(palette[paletteOffset + 1], alpha);
        rgbData[destOffset + 2] = blendChannel(palette[paletteOffset + 2], alpha);
      }
      continue;
    }

    if (colorType === 0) {
      const graySamples = unpackPackedSamples(row, bitDepth, width);
      for (let x = 0; x < width; x += 1) {
        const destOffset = rowOffset + x * 3;
        rgbData[destOffset] = graySamples[x];
        rgbData[destOffset + 1] = graySamples[x];
        rgbData[destOffset + 2] = graySamples[x];
      }
      continue;
    }

    if (colorType === 4) {
      for (let x = 0; x < width; x += 1) {
        const srcOffset = x * 2;
        const destOffset = rowOffset + x * 3;
        const gray = row[srcOffset];
        const alpha = row[srcOffset + 1];
        const blended = blendChannel(gray, alpha);
        rgbData[destOffset] = blended;
        rgbData[destOffset + 1] = blended;
        rgbData[destOffset + 2] = blended;
      }
    }
  }

  return { width, height, rgbData };
}

function latlonToTile(lat, lon, zoom) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const scale = 2 ** zoom;
  const tileX = ((lon + 180) / 360) * scale;
  const latRad = (clampedLat * Math.PI) / 180;
  const tileY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { tileX, tileY };
}

function deriveCenterFromRequestProfile(requestProfile) {
  const center = requestProfile?.aoi_center;
  if (center?.lat != null && center?.lon != null) {
    return { lat: Number(center.lat), lon: Number(center.lon) };
  }

  const bbox = Array.isArray(requestProfile?.aoi_bbox) ? requestProfile.aoi_bbox : null;
  if (bbox?.length === 4) {
    const [minLon, minLat, maxLon, maxLat] = bbox.map((value) => Number(value));
    return {
      lat: (minLat + maxLat) / 2,
      lon: (minLon + maxLon) / 2,
    };
  }

  throw new Error("External generation requires AOI center or bbox");
}

function buildTileUrl(template, zoom, x, y) {
  return template
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}

async function fetchTileOsm(zoom, x, y) {
  const scale = 2 ** zoom;
  const wrappedX = ((x % scale) + scale) % scale;
  const clampedY = Math.max(0, Math.min(scale - 1, y));
  const tileUrl = buildTileUrl(OSM_TILE_TEMPLATE, zoom, wrappedX, clampedY);
  const response = await fetch(tileUrl, {
    headers: {
      "User-Agent": OSM_USER_AGENT,
      Accept: "image/png",
    },
  });

  if (!response.ok) {
    throw new Error(`Tile HTTP ${response.status}`);
  }

  return decodePngToRgb(Buffer.from(await response.arrayBuffer()));
}

function blitRgb(source, sourceWidth, sourceHeight, destination, destinationWidth, xOffset, yOffset) {
  for (let y = 0; y < sourceHeight; y += 1) {
    const srcStart = y * sourceWidth * 3;
    const destStart = ((yOffset + y) * destinationWidth + xOffset) * 3;
    source.copy(destination, destStart, srcStart, srcStart + sourceWidth * 3);
  }
}

function cropRgb(source, sourceWidth, left, top, width, height) {
  const output = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const srcStart = ((top + y) * sourceWidth + left) * 3;
    const destStart = y * width * 3;
    source.copy(output, destStart, srcStart, srcStart + width * 3);
  }
  return output;
}

function sampleRgb(data, width, height, x, y, channel) {
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  return data[(clampedY * width + clampedX) * 3 + channel];
}

function resizeRgbBilinear(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const output = Buffer.alloc(targetWidth * targetHeight * 3);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = ((y + 0.5) * sourceHeight) / targetHeight - 0.5;
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(sourceHeight - 1, y0 + 1);
    const wy = sourceY - y0;

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = ((x + 0.5) * sourceWidth) / targetWidth - 0.5;
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const wx = sourceX - x0;
      const destOffset = (y * targetWidth + x) * 3;

      for (let channel = 0; channel < 3; channel += 1) {
        const topLeft = sampleRgb(source, sourceWidth, sourceHeight, x0, y0, channel);
        const topRight = sampleRgb(source, sourceWidth, sourceHeight, x1, y0, channel);
        const bottomLeft = sampleRgb(source, sourceWidth, sourceHeight, x0, y1, channel);
        const bottomRight = sampleRgb(source, sourceWidth, sourceHeight, x1, y1, channel);
        const topMix = topLeft * (1 - wx) + topRight * wx;
        const bottomMix = bottomLeft * (1 - wx) + bottomRight * wx;
        output[destOffset + channel] = Math.round(topMix * (1 - wy) + bottomMix * wy);
      }
    }
  }

  return output;
}

async function buildExternalMapRgb({
  centerLat,
  centerLon,
  zoom,
  width,
  height,
  mapSource = "OSM",
}) {
  if (mapSource !== "OSM") {
    throw new Error(`Unsupported external_map_source: ${mapSource}`);
  }

  const { tileX, tileY } = latlonToTile(centerLat, centerLon, zoom);
  const baseTileX = Math.trunc(tileX);
  const baseTileY = Math.trunc(tileY);
  const tiles = await Promise.all(
    [-1, 0, 1].flatMap((dy) =>
      [-1, 0, 1].map(async (dx) => ({
        dx,
        dy,
        tile: await fetchTileOsm(zoom, baseTileX + dx, baseTileY + dy),
      })),
    ),
  );

  const mosaicWidth = 256 * 3;
  const mosaicHeight = 256 * 3;
  const mosaic = Buffer.alloc(mosaicWidth * mosaicHeight * 3);

  for (const { dx, dy, tile } of tiles) {
    if (tile.width !== 256 || tile.height !== 256) {
      throw new Error(`Unexpected tile size ${tile.width}x${tile.height}`);
    }
    blitRgb(tile.rgbData, tile.width, tile.height, mosaic, mosaicWidth, (dx + 1) * 256, (dy + 1) * 256);
  }

  const pixelX = Math.trunc((tileX - baseTileX) * 256) + 256;
  const pixelY = Math.trunc((tileY - baseTileY) * 256) + 256;
  const cropSize = 512;
  const left = Math.max(0, Math.min(mosaicWidth - cropSize, pixelX - cropSize / 2));
  const top = Math.max(0, Math.min(mosaicHeight - cropSize, pixelY - cropSize / 2));
  const cropped = cropRgb(mosaic, mosaicWidth, left, top, cropSize, cropSize);
  const resized = resizeRgbBilinear(cropped, cropSize, cropSize, width, height);

  return { width, height, rgbData: resized };
}

export async function renderExternalMapPng(options) {
  const externalMap = await buildExternalMapRgb(options);
  return encodeRgbPng(externalMap.width, externalMap.height, externalMap.rgbData);
}

export async function writeExternalMapImage(filePath, options) {
  const png = await renderExternalMapPng(options);
  fs.writeFileSync(filePath, png);
}

export function deriveExternalCenter(requestProfile) {
  return deriveCenterFromRequestProfile(requestProfile);
}

export function buildImageFilePath(commandId) {
  ensureSattieImageDir();
  return path.join(imageDir, `${commandId}.png`);
}

export function writeOpticalImage(filePath, width, height) {
  const png = buildPng(width, height, (x, y, w, h) => {
    const r = Math.round((x / Math.max(1, w - 1)) * 180 + 50);
    const g = Math.round((y / Math.max(1, h - 1)) * 130 + 70);
    const b = 150 + ((x + y) % 64);
    return [r, g, Math.min(255, b)];
  });
  fs.writeFileSync(filePath, png);
}

export function writeSarImage(filePath, width, height) {
  const png = buildPng(width, height, (x, y, w, h) => {
    const base = 45 + Math.round((y / Math.max(1, h - 1)) * 160);
    const noise = ((x * 13 + y * 7) % 40) - 20;
    const value = Math.max(0, Math.min(255, base + noise));
    return [value, value, value];
  });
  fs.writeFileSync(filePath, png);
}

export async function appendImageMetadataFooter(filePath, metadata) {
  ensureFooterFonts();

  const baseImage = await loadImage(filePath);
  const header = buildHeaderLayout(baseImage.width);
  const footerItems = [
    { label: "Satellite", value: normalizeFooterValue(metadata?.satellite) },
    { label: "Mission Name", value: normalizeFooterValue(metadata?.missionName) },
    { label: "AOI Name", value: normalizeFooterValue(metadata?.aoiName) },
    { label: "Lat/Lon", value: normalizeFooterValue(metadata?.latLon) },
    { label: "Image Created At (KST)", value: formatFooterKst(metadata?.imageCreatedAt) },
    { label: "Ground Station", value: normalizeFooterValue(metadata?.groundStation) },
    { label: "Requestor", value: normalizeFooterValue(metadata?.requestor) },
  ];
  const footer = buildFooterCells(baseImage.width, footerItems);
  const canvas = createCanvas(baseImage.width, header.headerHeight + baseImage.height + footer.footerHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#02060b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawHeaderBar(ctx, canvas.width, header);
  ctx.drawImage(baseImage, 0, header.headerHeight, baseImage.width, baseImage.height);

  const footerTop = header.headerHeight + baseImage.height;
  const footerGradient = ctx.createLinearGradient(0, footerTop, 0, canvas.height);
  footerGradient.addColorStop(0, DECORATION_BG_START);
  footerGradient.addColorStop(1, DECORATION_BG_END);
  ctx.fillStyle = footerGradient;
  ctx.fillRect(0, footerTop, canvas.width, footer.footerHeight);
  drawDecorationPattern(ctx, canvas.width, footer.footerHeight, footerTop);

  ctx.strokeStyle = DECORATION_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop + 0.5);
  ctx.lineTo(canvas.width, footerTop + 0.5);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, footerTop);
  footer.cells.forEach((cell) => {
    drawFooterCell(ctx, cell, footer.labelFontSize, footer.valueFontSize, footer.valueLineHeight);
  });
  ctx.restore();

  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
}

export function clearGeneratedImages() {
  ensureSattieImageDir();
  let deletedCount = 0;
  for (const fileName of fs.readdirSync(imageDir)) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
      continue;
    }
    const filePath = path.join(imageDir, fileName);
    if (fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      deletedCount += 1;
    }
  }
  return deletedCount;
}

export function fileExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}
