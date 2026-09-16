import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SECTIONS, PHOTO_CATEGORIES } from './schema.js';
import { formatDate, formatDateTime } from './utils.js';
import { mapsLink } from './geo.js';

const NAVY = rgb(11 / 255, 28 / 255, 58 / 255);
const NAVY_LIGHT = rgb(26 / 255, 56 / 255, 104 / 255);
const CYAN = rgb(79 / 255, 195 / 255, 232 / 255);
const BORDER = rgb(0.82, 0.86, 0.91);
const TEXT = rgb(0.09, 0.13, 0.2);
const MUTED = rgb(0.42, 0.47, 0.55);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 46;
const HEADER_H = 64;

function optionLabel(options, value) {
  const opt = options.find((o) => o.value === value);
  return opt ? opt.label : (value || '—');
}

function radioDisplay(field, data) {
  const val = data[field.key];
  if (!val) return '—';
  return optionLabel(field.options, val);
}

export async function generatePdf(installation, mediaList) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Checklist de Instalação - ${installation.data.clienteNome || 'Cliente'}`);
  pdfDoc.setProducer('ON Engenharia - App Checklist');

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImage = null;
  try {
    const logoBytes = await fetch(`${import.meta.env.BASE_URL}logo-mark.png`).then((r) => r.arrayBuffer());
    logoImage = await pdfDoc.embedPng(logoBytes);
  } catch (e) { /* logo optional */ }

  const state = { page: null, y: 0, pageNum: 0 };

  function newPage() {
    state.page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    state.pageNum += 1;
    drawHeader(state.page, state.pageNum === 1);
    drawFooter(state.page);
    state.y = PAGE_H - HEADER_H - 22;
  }

  function drawHeader(page, big) {
    page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: NAVY });
    let textX = MARGIN + 40;
    if (logoImage) {
      const logoH = 32;
      const logoDims = logoImage.scaleToFit(logoH * (logoImage.width / logoImage.height), logoH);
      page.drawImage(logoImage, {
        x: MARGIN,
        y: PAGE_H - HEADER_H / 2 - logoDims.height / 2,
        width: logoDims.width,
        height: logoDims.height
      });
      textX = MARGIN + logoDims.width + 10;
    }
    page.drawText('ON ENGENHARIA', {
      x: textX,
      y: PAGE_H - HEADER_H / 2 - 3,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1)
    });
    page.drawText('Soluções Elétricas personalizadas', {
      x: textX,
      y: PAGE_H - HEADER_H / 2 - 15,
      size: 8,
      font: fontRegular,
      color: CYAN
    });
    const title = 'CHECKLIST DE INSTALAÇÃO';
    const tw = fontBold.widthOfTextAtSize(title, 12);
    page.drawText(title, {
      x: PAGE_W - MARGIN - tw,
      y: PAGE_H - HEADER_H / 2 - 4,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1)
    });
  }

  function drawFooter(page) {
    page.drawLine({ start: { x: MARGIN, y: FOOTER_H - 8 }, end: { x: PAGE_W - MARGIN, y: FOOTER_H - 8 }, thickness: 0.6, color: BORDER });
    const lines = [
      '(55) 9 9133-7296  ·  contato@onengenhariaeletrica.com.br  ·  @on_engenharia_',
      'onengenhariaeletrica.com.br  ·  RS 223 | KM 46,4 | Arroio Grande | Ibirubá/RS'
    ];
    page.drawText(lines[0], { x: MARGIN, y: FOOTER_H - 20, size: 7.5, font: fontRegular, color: MUTED });
    page.drawText(lines[1], { x: MARGIN, y: FOOTER_H - 31, size: 7.5, font: fontRegular, color: MUTED });
    const pageLabel = `Pág. ${state.pageNum}`;
    page.drawText(pageLabel, { x: PAGE_W - MARGIN - fontRegular.widthOfTextAtSize(pageLabel, 7.5), y: FOOTER_H - 20, size: 7.5, font: fontRegular, color: MUTED });
  }

  function ensureSpace(h) {
    if (!state.page || state.y - h < FOOTER_H + 10) {
      newPage();
    }
  }

  function wrapText(text, font, size, maxWidth) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function sectionTitle(text) {
    ensureSpace(30);
    state.page.drawRectangle({ x: MARGIN, y: state.y - 20, width: CONTENT_W, height: 22, color: NAVY_LIGHT });
    state.page.drawText(text, { x: MARGIN + 8, y: state.y - 15, size: 10.5, font: fontBold, color: rgb(1, 1, 1) });
    state.y -= 30;
  }

  function fieldRow(label, value, opts = {}) {
    const valueText = value === '' || value == null ? '—' : String(value);
    const labelW = opts.labelW || 230;
    const valueW = CONTENT_W - labelW - 16;
    const labelLines = wrapText(label, fontBold, 8.7, labelW);
    const valueLines = wrapText(valueText, fontRegular, 9.2, valueW);
    const lineCount = Math.max(labelLines.length, valueLines.length);
    const rowH = lineCount * 11 + 12;
    ensureSpace(rowH);
    state.page.drawRectangle({ x: MARGIN, y: state.y - rowH, width: CONTENT_W, height: rowH, borderColor: BORDER, borderWidth: 0.7, color: rgb(0.98, 0.985, 0.99) });
    state.page.drawLine({ start: { x: MARGIN + labelW, y: state.y }, end: { x: MARGIN + labelW, y: state.y - rowH }, thickness: 0.6, color: BORDER });
    labelLines.forEach((l, i) => {
      state.page.drawText(l, { x: MARGIN + 8, y: state.y - 14 - i * 11, size: 8.7, font: fontBold, color: TEXT });
    });
    valueLines.forEach((l, i) => {
      state.page.drawText(l, { x: MARGIN + labelW + 8, y: state.y - 14 - i * 11, size: 9.2, font: fontRegular, color: TEXT });
    });
    state.y -= rowH;
  }

  function groupLabel(text) {
    ensureSpace(18);
    state.page.drawText(text.toUpperCase(), { x: MARGIN + 2, y: state.y - 10, size: 8, font: fontBold, color: MUTED });
    state.y -= 16;
  }

  function spacer(h = 8) {
    state.y -= h;
  }

  newPage();

  const d = installation.data;

  // Cliente
  sectionTitle('DADOS DO CLIENTE');
  fieldRow('Nome do cliente', d.clienteNome);
  fieldRow('Endereço', d.clienteEndereco);
  spacer();

  // Geolocalização
  sectionTitle('GEOLOCALIZAÇÃO DO LOCAL');
  if (d.geo) {
    fieldRow('Coordenadas', `${d.geo.lat.toFixed(6)}, ${d.geo.lng.toFixed(6)} (precisão ~${Math.round(d.geo.accuracy)}m)`);
    fieldRow('Capturado em', formatDateTime(d.geo.timestamp));
    fieldRow('Link do mapa', mapsLink(d.geo));
  } else {
    fieldRow('Coordenadas', 'Não capturada');
  }
  spacer();

  // Sections 1-6 from schema
  for (const section of SECTIONS) {
    sectionTitle(section.title.toUpperCase());

    if (section.id === 'sistema') {
      (d.inversores || []).forEach((inv, i) => {
        if (!inv.potencia && !inv.snInversor && !inv.snDatalogger) return;
        groupLabel(`Inversor ${i + 1}`);
        fieldRow('Potência do inversor', inv.potencia);
        fieldRow('SN do inversor', inv.snInversor);
        fieldRow('SN do datalogger', inv.snDatalogger);
      });
    }

    let lastGroup = null;
    for (const field of section.fields) {
      if (field.showIf && !field.showIf(d)) continue;
      if (field.group && field.group !== lastGroup) {
        groupLabel(field.group);
        lastGroup = field.group;
      }
      if (!field.group && lastGroup) lastGroup = null;
      const value = field.type === 'radio' ? radioDisplay(field, d) : d[field.key];
      fieldRow(field.label, value);
      if (section.id === 'testes' && field.key === 'testeFaseFase') {
        (d.strings || []).forEach((str, i) => {
          if (!str.tensao && !str.amperagem) return;
          groupLabel(`String ${i + 1}`);
          fieldRow('Tensão (V)', str.tensao);
          fieldRow('Amperagem (A)', str.amperagem);
        });
        lastGroup = null;
      }
    }
    spacer();
  }

  // Registros fotográficos - checklist
  sectionTitle('REGISTROS FOTOGRÁFICOS');
  const photosByField = {};
  for (const m of mediaList) {
    if (m.kind === 'photo') {
      (photosByField[m.fieldKey] = photosByField[m.fieldKey] || []).push(m);
    }
  }
  for (const cat of PHOTO_CATEGORIES) {
    const has = (photosByField[cat.key] || []).length > 0;
    fieldRow(cat.label, has ? `Registrado (${photosByField[cat.key].length} foto(s))` : 'Não registrado');
  }
  spacer();

  // Embed & lay out all photos (categorized + general)
  const generalPhotos = mediaList.filter((m) => m.kind === 'photo' && m.fieldKey === 'general');
  const allPhotoGroups = [
    ...PHOTO_CATEGORIES.map((c) => ({ title: c.label, items: photosByField[c.key] || [] })).filter((g) => g.items.length),
    ...(generalPhotos.length ? [{ title: 'Fotos gerais', items: generalPhotos }] : [])
  ];

  if (allPhotoGroups.length) {
    sectionTitle('FOTOS ANEXADAS');
    for (const group of allPhotoGroups) {
      ensureSpace(16);
      state.page.drawText(group.title, { x: MARGIN, y: state.y - 10, size: 9.5, font: fontBold, color: NAVY });
      state.y -= 16;

      const cols = 2;
      const gap = 8;
      const imgW = (CONTENT_W - gap * (cols - 1)) / cols;
      const imgH = imgW * 0.72;
      let col = 0;
      let rowStartY = state.y;

      for (const media of group.items) {
        if (col === 0) {
          ensureSpace(imgH + 14);
          rowStartY = state.y;
        }
        try {
          const bytes = await media.blob.arrayBuffer();
          const isPng = (media.mimeType || '').includes('png');
          const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const x = MARGIN + col * (imgW + gap);
          const dims = img.scaleToFit(imgW, imgH);
          const offsetX = (imgW - dims.width) / 2;
          const offsetY = (imgH - dims.height) / 2;
          state.page.drawRectangle({ x, y: rowStartY - imgH, width: imgW, height: imgH, borderColor: BORDER, borderWidth: 0.7, color: rgb(0.97, 0.97, 0.98) });
          state.page.drawImage(img, { x: x + offsetX, y: rowStartY - imgH + offsetY, width: dims.width, height: dims.height });
        } catch (e) {
          // skip unreadable image
        }
        col += 1;
        if (col >= cols) {
          col = 0;
          state.y = rowStartY - imgH - 12;
        }
      }
      if (col !== 0) {
        state.y = rowStartY - imgH - 12;
      }
      spacer(4);
    }
  }

  // Acesso ao aplicativo de monitoramento
  sectionTitle('ACESSO AO APLICATIVO DE MONITORAMENTO');
  ensureSpace(14);
  state.page.drawText('Campos editáveis — podem ser preenchidos/atualizados diretamente neste PDF após o envio.', {
    x: MARGIN, y: state.y - 8, size: 8, font: fontRegular, color: MUTED
  });
  state.y -= 18;

  const form = pdfDoc.getForm();
  function textFieldRow(label, name, value) {
    const rowH = 26;
    ensureSpace(rowH);
    state.page.drawRectangle({ x: MARGIN, y: state.y - rowH, width: CONTENT_W, height: rowH, borderColor: BORDER, borderWidth: 0.7 });
    state.page.drawLine({ start: { x: MARGIN + 150, y: state.y }, end: { x: MARGIN + 150, y: state.y - rowH }, thickness: 0.6, color: BORDER });
    state.page.drawText(label, { x: MARGIN + 8, y: state.y - 16, size: 9, font: fontBold, color: TEXT });
    const tf = form.createTextField(`app.${name}`);
    tf.setText(value || '');
    tf.addToPage(state.page, { x: MARGIN + 158, y: state.y - rowH + 5, width: CONTENT_W - 166, height: rowH - 10, borderWidth: 0, font: fontRegular });
    state.y -= rowH;
  }
  textFieldRow('Login do aplicativo', 'login', d.appLogin);
  textFieldRow('Senha do aplicativo', 'senha', d.appSenha);
  spacer();

  // Observações
  sectionTitle('OBSERVAÇÕES');
  const obsLines = wrapText(d.observacoesTexto || '—', fontRegular, 9.5, CONTENT_W - 16);
  const obsH = obsLines.length * 12 + 16;
  ensureSpace(obsH);
  state.page.drawRectangle({ x: MARGIN, y: state.y - obsH, width: CONTENT_W, height: obsH, borderColor: BORDER, borderWidth: 0.7 });
  obsLines.forEach((l, i) => {
    state.page.drawText(l, { x: MARGIN + 8, y: state.y - 14 - i * 12, size: 9.5, font: fontRegular, color: TEXT });
  });
  state.y -= obsH + 8;

  const audioMedia = mediaList.filter((m) => m.kind === 'audio');
  if (audioMedia.length) {
    ensureSpace(14 * audioMedia.length + 8);
    state.page.drawText('Gravações de áudio anexadas a este documento (ver painel de anexos do leitor de PDF):', {
      x: MARGIN, y: state.y - 10, size: 8.5, font: fontBold, color: NAVY
    });
    state.y -= 16;
    audioMedia.forEach((m, i) => {
      state.page.drawText(`• ${m.attachName || `audio_${i + 1}.webm`}  (${formatDateTime(m.createdAt)})`, {
        x: MARGIN + 6, y: state.y - 10, size: 8.5, font: fontRegular, color: TEXT
      });
      state.y -= 14;
    });
    spacer();
  }

  // Assinatura
  sectionTitle('ASSINATURA DO EXECUTOR');
  const sig = mediaList.find((m) => m.kind === 'signature');
  const sigBoxH = 110;
  ensureSpace(sigBoxH + 10);
  state.page.drawRectangle({ x: MARGIN, y: state.y - sigBoxH, width: CONTENT_W, height: sigBoxH, borderColor: BORDER, borderWidth: 0.7 });
  if (sig) {
    try {
      const bytes = await sig.blob.arrayBuffer();
      const img = await pdfDoc.embedPng(bytes);
      const dims = img.scaleToFit(CONTENT_W - 20, sigBoxH - 40);
      state.page.drawImage(img, { x: MARGIN + 10, y: state.y - sigBoxH + 30, width: dims.width, height: dims.height });
    } catch (e) { /* ignore */ }
  }
  state.page.drawLine({ start: { x: MARGIN + 10, y: state.y - sigBoxH + 24 }, end: { x: MARGIN + CONTENT_W - 10, y: state.y - sigBoxH + 24 }, thickness: 0.7, color: BORDER });
  state.page.drawText(`Executor: ${d.executorNome || installation.executorNome || '—'}`, {
    x: MARGIN + 10, y: state.y - sigBoxH + 12, size: 9, font: fontBold, color: TEXT
  });
  const dateLabel = `Data: ${formatDate(installation.finalizedAt || Date.now())}`;
  state.page.drawText(dateLabel, {
    x: MARGIN + CONTENT_W - 10 - fontRegular.widthOfTextAtSize(dateLabel, 9), y: state.y - sigBoxH + 12, size: 9, font: fontRegular, color: TEXT
  });
  state.y -= sigBoxH;

  // Attach audio files as embedded files (playable via PDF viewer attachments panel)
  for (const m of audioMedia) {
    try {
      const bytes = await m.blob.arrayBuffer();
      await pdfDoc.attach(bytes, m.attachName || 'audio.webm', {
        mimeType: m.mimeType || 'audio/webm',
        description: 'Gravação de observações em campo'
      });
    } catch (e) { /* ignore */ }
  }

  form.updateFieldAppearances(fontRegular);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
