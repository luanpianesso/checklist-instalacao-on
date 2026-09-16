import JSZip from 'jszip';
import { generatePdf } from './pdf.js';

function safeName(str) {
  return String(str || 'instalacao')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'instalacao';
}

export async function buildExportPackage(installation, mediaList) {
  const zip = new JSZip();
  const baseName = safeName(installation.data.clienteNome);

  const pdfBytes = await generatePdf(installation, mediaList);
  zip.file(`Checklist_${baseName}.pdf`, pdfBytes);

  const photosFolder = zip.folder('fotos');
  let genCount = 0;
  for (const m of mediaList.filter((x) => x.kind === 'photo')) {
    const ext = (m.mimeType || '').includes('png') ? 'png' : 'jpg';
    let name;
    if (m.fieldKey === 'general') {
      genCount += 1;
      name = `geral_${String(genCount).padStart(2, '0')}.${ext}`;
    } else {
      name = `${m.fieldKey}.${ext}`;
    }
    photosFolder.file(name, m.blob);
  }

  const audioList = mediaList.filter((x) => x.kind === 'audio');
  if (audioList.length) {
    const audioFolder = zip.folder('audios');
    audioList.forEach((m, i) => {
      audioFolder.file(m.attachName || `observacao_${i + 1}.webm`, m.blob);
    });
  }

  const sig = mediaList.find((x) => x.kind === 'signature');
  if (sig) {
    zip.file('assinatura_executor.png', sig.blob);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { blob, fileName: `Checklist_${baseName}_${Date.now()}.zip`, pdfBytes, pdfName: `Checklist_${baseName}.pdf` };
}

export async function shareOrDownload({ blob, fileName }) {
  const file = new File([blob], fileName, { type: 'application/zip' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Checklist de Instalação',
        text: 'Checklist de instalação finalizado.'
      });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
