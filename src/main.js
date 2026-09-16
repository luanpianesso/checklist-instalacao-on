import './style.css';
import {
  listInstallations, getInstallation, saveInstallation, deleteInstallation,
  addMedia, deleteMedia, getMediaForInstallation, uid
} from './db.js';
import { SECTIONS, PHOTO_CATEGORIES, createEmptyData, emptyInversor, emptyString } from './schema.js';
import { debounce, toast, formatDateTime, formatDate, fileToJpegBlob, escapeHtml } from './utils.js';
import { captureGeolocation, mapsLink } from './geo.js';
import { SignaturePad } from './signature.js';
import { AudioRecorder } from './audio.js';
import { buildExportPackage, shareOrDownload } from './zip.js';

const app = document.getElementById('app');

// ---------- Router ----------
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

function route() {
  const hash = location.hash || '#/';
  const match = hash.match(/^#\/form\/(.+)$/);
  if (match) {
    renderForm(match[1]);
  } else {
    renderHome();
  }
}

// ---------- Home ----------
async function renderHome() {
  const installations = await listInstallations();
  app.innerHTML = `
    <header class="app-header">
      <div class="brand">
        <img src="${import.meta.env.BASE_URL}logo-mark.png" alt="ON Engenharia" class="logo-img" />
        <div class="brand-text">
          <div class="b1">ON ENGENHARIA</div>
          <div class="b2">Soluções Elétricas personalizadas</div>
        </div>
      </div>
      <h1 class="page-title">Checklist de Instalação</h1>
      <div class="page-subtitle">Selecione uma instalação em andamento ou inicie uma nova</div>
    </header>
    <div class="home-wrap">
      <button class="btn-primary" id="btnNew">+ Nova instalação</button>
      <div class="install-list" id="installList"></div>
    </div>
  `;

  const listEl = app.querySelector('#installList');
  if (!installations.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="emoji">🔧</div>Nenhuma instalação iniciada ainda.</div>`;
  } else {
    listEl.innerHTML = installations.map((inst) => {
      const name = inst.data.clienteNome || 'Cliente sem nome';
      const addr = inst.data.clienteEndereco || 'Endereço não informado';
      const isDone = inst.status === 'concluida';
      return `
        <div class="install-card" data-id="${inst.id}">
          <div class="install-card-top">
            <div>
              <div class="install-name">${escapeHtml(name)}</div>
              <div class="install-addr">${escapeHtml(addr)}</div>
            </div>
            <span class="badge ${isDone ? 'badge-done' : 'badge-progress'}">${isDone ? 'Concluída' : 'Em andamento'}</span>
          </div>
          <div class="install-meta">Atualizado em ${formatDateTime(inst.updatedAt)}</div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.install-card').forEach((card) => {
      card.addEventListener('click', () => {
        location.hash = `#/form/${card.dataset.id}`;
      });
    });
  }

  app.querySelector('#btnNew').addEventListener('click', async () => {
    const id = uid();
    const record = {
      id,
      status: 'em_andamento',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: createEmptyData()
    };
    await saveInstallation(record);
    location.hash = `#/form/${id}`;
  });
}

// ---------- Form ----------
async function renderForm(id) {
  let installation = await getInstallation(id);
  if (!installation) {
    toast('Instalação não encontrada.', 'error');
    location.hash = '#/';
    return;
  }
  let mediaList = await getMediaForInstallation(id);
  const data = installation.data;
  // Compatibilidade com instalações salvas antes destes campos existirem.
  if (!Array.isArray(data.inversores) || !data.inversores.length) data.inversores = [emptyInversor()];
  if (!Array.isArray(data.strings) || !data.strings.length) data.strings = [emptyString(), emptyString()];

  const saveNow = async () => {
    await saveInstallation(installation);
    showSaved();
  };
  const saveDebounced = debounce(saveNow, 500);

  app.innerHTML = `
    <header class="app-header">
      <div class="header-row">
        <button class="header-back" id="btnBack">← Voltar</button>
        <span class="badge ${installation.status === 'concluida' ? 'badge-done' : 'badge-progress'}" id="statusBadge">
          ${installation.status === 'concluida' ? 'Concluída' : 'Em andamento'}
        </span>
      </div>
      <h1 class="page-title">${escapeHtml(data.clienteNome || 'Nova instalação')}</h1>
      <div class="page-subtitle">Preenchimento salvo automaticamente neste aparelho</div>
    </header>
    <div class="form-wrap" id="formRoot"></div>
    <div class="save-indicator" id="saveIndicator">Salvo</div>
  `;

  app.querySelector('#btnBack').addEventListener('click', () => { location.hash = '#/'; });

  const root = app.querySelector('#formRoot');
  root.innerHTML = [
    clienteCardHtml(data),
    geoCardHtml(data),
    ...SECTIONS.map((s, i) => sectionCardHtml(s, data, i)),
    photosCardHtml(mediaList),
    appAccessCardHtml(data),
    observacoesCardHtml(data, mediaList),
    signatureCardHtml(data),
    finalizeCardHtml(installation)
  ].join('');

  // ----- Accordion -----
  root.querySelectorAll('.card-header[data-toggle]').forEach((header, idx) => {
    if (idx === 0) header.closest('.card').classList.add('open');
    header.addEventListener('click', () => {
      header.closest('.card').classList.toggle('open');
    });
  });

  // ----- Text/textarea inputs (client, schema fields, app access, observations) -----
  root.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      data[input.dataset.field] = input.value;
      saveDebounced();
    });
  });

  // ----- Radio groups -----
  root.querySelectorAll('input[type=radio][data-field]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        data[radio.dataset.field] = radio.value;
        applyConditionalVisibility(root, data);
        saveDebounced();
      }
    });
  });
  applyConditionalVisibility(root, data);

  // ----- Inversores / strings (listas repetíveis) -----
  wireRepeatableList(root, {
    containerSelector: '#inversorList',
    data,
    arrayKey: 'inversores',
    makeEmpty: emptyInversor,
    itemHtml: inversorItemHtml,
    minItems: 1,
    saveDebounced
  });
  wireRepeatableList(root, {
    containerSelector: '#stringList',
    data,
    arrayKey: 'strings',
    makeEmpty: emptyString,
    itemHtml: stringItemHtml,
    minItems: 1,
    saveDebounced
  });

  // ----- Geolocation -----
  root.querySelector('#btnCaptureGeo').addEventListener('click', async () => {
    const btn = root.querySelector('#btnCaptureGeo');
    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Obtendo localização…';
    try {
      const geo = await captureGeolocation();
      data.geo = geo;
      renderGeoStatus(root, data);
      await saveNow();
      toast('Localização capturada.', 'success');
    } catch (err) {
      toast('Não foi possível obter a localização. Verifique as permissões.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  // ----- Photo categories -----
  wirePhotoCategories(root, installation, mediaList, saveNow);

  // ----- General gallery -----
  wireGeneralGallery(root, installation, mediaList);

  // ----- Audio recorder -----
  wireAudioRecorder(root, installation, mediaList);

  // ----- Signature -----
  const sigCanvas = root.querySelector('#sigCanvas');
  const pad = new SignaturePad(sigCanvas);
  const existingSig = mediaList.find((m) => m.kind === 'signature');
  if (existingSig) await pad.loadFromBlob(existingSig.blob);
  // Accordions start closed, so the canvas has no box (0x0) until opened; force a resize then.
  const sigCardHeader = sigCanvas.closest('.card').querySelector('.card-header');
  sigCardHeader.addEventListener('click', () => pad.forceResize());

  const persistSignature = debounce(async () => {
    if (pad.isEmpty()) return;
    const blob = await pad.toBlob();
    const mediaId = `${installation.id}:signature`;
    const item = { id: mediaId, installationId: installation.id, kind: 'signature', fieldKey: 'signature', blob, mimeType: 'image/png', createdAt: Date.now() };
    await addMedia(item);
    const existingIdx = mediaList.findIndex((m) => m.kind === 'signature');
    if (existingIdx >= 0) mediaList[existingIdx] = item; else mediaList.push(item);
    showSaved();
  }, 600);
  sigCanvas.addEventListener('pointerup', persistSignature);
  sigCanvas.addEventListener('touchend', persistSignature);

  root.querySelector('#btnClearSig').addEventListener('click', async () => {
    pad.clear();
    const mediaId = `${installation.id}:signature`;
    await deleteMedia(mediaId);
    mediaList = mediaList.filter((m) => m.kind !== 'signature');
  });

  // ----- Finalize / export -----
  root.querySelector('#btnFinalize').addEventListener('click', async () => {
    await handleFinalize(installation, mediaList, saveNow);
  });

  const deleteBtn = root.querySelector('#btnDelete');
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Excluir esta instalação e todos os arquivos (fotos, áudios, assinatura)? Esta ação não pode ser desfeita.')) {
      await deleteInstallation(installation.id);
      toast('Instalação excluída.');
      location.hash = '#/';
    }
  });
}

function showSaved() {
  const el = document.getElementById('saveIndicator');
  if (!el) return;
  el.textContent = `Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  el.classList.add('show');
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- HTML builders ----------
function clienteCardHtml(data) {
  return `
    <div class="card open">
      <div class="card-header" data-toggle><h3>Dados do cliente</h3><span class="chevron">▾</span></div>
      <div class="card-body">
        <div class="field">
          <label>Nome do cliente</label>
          <input type="text" data-field="clienteNome" value="${escapeHtml(data.clienteNome)}" placeholder="Nome completo" />
        </div>
        <div class="field">
          <label>Endereço</label>
          <input type="text" data-field="clienteEndereco" value="${escapeHtml(data.clienteEndereco)}" placeholder="Endereço da instalação" />
        </div>
      </div>
    </div>
  `;
}

function geoCardHtml(data) {
  return `
    <div class="card">
      <div class="card-header" data-toggle><h3>📍 Geolocalização do local</h3><span class="chevron">▾</span></div>
      <div class="card-body">
        <div class="geo-box">
          <div id="geoStatus">${geoStatusHtml(data)}</div>
          <button class="btn-outline-cyan" id="btnCaptureGeo" type="button">Capturar localização atual</button>
        </div>
      </div>
    </div>
  `;
}

function geoStatusHtml(data) {
  if (!data.geo) {
    return `<div class="geo-status">Localização ainda não capturada.</div>`;
  }
  const link = mapsLink(data.geo);
  return `<div class="geo-status ok">
    Lat/Lng: ${data.geo.lat.toFixed(6)}, ${data.geo.lng.toFixed(6)} (±${Math.round(data.geo.accuracy)}m)<br/>
    Capturado em ${formatDateTime(data.geo.timestamp)}<br/>
    <a href="${link}" target="_blank" rel="noopener">Ver no mapa</a>
  </div>`;
}

function renderGeoStatus(root, data) {
  root.querySelector('#geoStatus').innerHTML = geoStatusHtml(data);
}

function sectionCardHtml(section, data, idx) {
  let lastGroup = null;
  const fieldsHtml = section.fields.map((field) => {
    const showGroup = field.group && field.group !== lastGroup;
    lastGroup = field.group || null;
    return fieldHtml(field, data, showGroup);
  }).join('');

  let extraHtml = '';
  if (section.id === 'sistema') {
    extraHtml = repeatableListHtml({
      title: 'Inversores',
      hint: 'Adicione um item para cada inversor instalado.',
      containerId: 'inversorList',
      items: data.inversores,
      itemHtml: inversorItemHtml,
      addLabel: '+ Adicionar inversor'
    });
  } else if (section.id === 'testes') {
    extraHtml = repeatableListHtml({
      title: 'Tensão CC das strings',
      hint: 'Adicione um item para cada string do sistema.',
      containerId: 'stringList',
      items: data.strings,
      itemHtml: stringItemHtml,
      addLabel: '+ Adicionar string'
    });
  }

  const body = section.id === 'sistema' ? extraHtml + fieldsHtml : (section.id === 'testes' ? insertAfterFirstGroup(fieldsHtml, extraHtml) : fieldsHtml);

  return `
    <div class="card">
      <div class="card-header" data-toggle><h3>${escapeHtml(section.title)}</h3><span class="chevron">▾</span></div>
      <div class="card-body">${body}</div>
    </div>
  `;
}

// Insere o HTML das strings logo após o primeiro grupo de campos (Tensão CA), antes de Conectividade.
function insertAfterFirstGroup(fieldsHtml, extraHtml) {
  const marker = '<div class="field-group-title" data-group-marker>Conectividade</div>';
  const idx = fieldsHtml.indexOf(marker);
  if (idx === -1) return fieldsHtml + extraHtml;
  return fieldsHtml.slice(0, idx) + extraHtml + fieldsHtml.slice(idx);
}

function repeatableListHtml({ title, hint, containerId, items, itemHtml, addLabel }) {
  return `
    <div class="repeat-block">
      <div class="field-group-title" data-group-marker>${escapeHtml(title)}</div>
      <div class="hint">${escapeHtml(hint)}</div>
      <div id="${containerId}">${repeatableItemsHtml(items, itemHtml)}</div>
      <button type="button" class="btn-outline-cyan" data-add-item>${escapeHtml(addLabel)}</button>
    </div>
  `;
}

function repeatableItemsHtml(items, itemHtml) {
  return items.map((item, i) => itemHtml(item, i, items.length)).join('');
}

function inversorItemHtml(item, index, total) {
  return `
    <div class="repeat-item">
      <div class="repeat-item-header">
        <span>Inversor ${index + 1}</span>
        ${total > 1 ? `<button type="button" class="repeat-remove" data-remove-item="${index}">✕</button>` : ''}
      </div>
      <div class="field">
        <label>Potência do inversor</label>
        <input type="text" placeholder="Ex: 5kW" data-array-field="potencia" data-index="${index}" value="${escapeHtml(item.potencia)}" />
      </div>
      <div class="field">
        <label>SN do inversor</label>
        <input type="text" data-array-field="snInversor" data-index="${index}" value="${escapeHtml(item.snInversor)}" />
      </div>
      <div class="field">
        <label>SN do datalogger</label>
        <input type="text" data-array-field="snDatalogger" data-index="${index}" value="${escapeHtml(item.snDatalogger)}" />
      </div>
      <div class="field-group-title" style="margin-top:2px">Tensão no terminal CA de entrada</div>
      <div class="field">
        <label>Fase-Neutro (V)</label>
        <input type="text" inputmode="decimal" data-array-field="testeFaseNeutro" data-index="${index}" value="${escapeHtml(item.testeFaseNeutro)}" />
      </div>
      <div class="field">
        <label>Fase-Terra (V)</label>
        <input type="text" inputmode="decimal" data-array-field="testeFaseTerra" data-index="${index}" value="${escapeHtml(item.testeFaseTerra)}" />
      </div>
      <div class="field">
        <label>Neutro-Terra (V)</label>
        <input type="text" inputmode="decimal" data-array-field="testeNeutroTerra" data-index="${index}" value="${escapeHtml(item.testeNeutroTerra)}" />
      </div>
      <div class="field">
        <label>Fase-Fase (V)</label>
        <input type="text" inputmode="decimal" data-array-field="testeFaseFase" data-index="${index}" value="${escapeHtml(item.testeFaseFase)}" />
      </div>
    </div>
  `;
}

function stringItemHtml(item, index, total) {
  return `
    <div class="repeat-item">
      <div class="repeat-item-header">
        <span>String ${index + 1}</span>
        ${total > 1 ? `<button type="button" class="repeat-remove" data-remove-item="${index}">✕</button>` : ''}
      </div>
      <div class="field">
        <label>Tensão (V)</label>
        <input type="text" inputmode="decimal" data-array-field="tensao" data-index="${index}" value="${escapeHtml(item.tensao)}" />
      </div>
      <div class="field">
        <label>Amperagem (A)</label>
        <input type="text" inputmode="decimal" data-array-field="amperagem" data-index="${index}" value="${escapeHtml(item.amperagem)}" />
      </div>
    </div>
  `;
}

function wireRepeatableList(root, { containerSelector, data, arrayKey, makeEmpty, itemHtml, minItems, saveDebounced }) {
  const container = root.querySelector(containerSelector);
  if (!container) return;
  const block = container.closest('.repeat-block');
  const addBtn = block.querySelector('[data-add-item]');

  const rerender = () => {
    container.innerHTML = repeatableItemsHtml(data[arrayKey], itemHtml);
  };

  addBtn.addEventListener('click', () => {
    data[arrayKey].push(makeEmpty());
    rerender();
    saveDebounced();
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-item]');
    if (!btn) return;
    if (data[arrayKey].length <= minItems) return;
    data[arrayKey].splice(Number(btn.dataset.removeItem), 1);
    rerender();
    saveDebounced();
  });

  container.addEventListener('input', (e) => {
    const input = e.target.closest('[data-array-field]');
    if (!input) return;
    const idx = Number(input.dataset.index);
    data[arrayKey][idx][input.dataset.arrayField] = input.value;
    saveDebounced();
  });
}

function fieldHtml(field, data, showGroup) {
  const showAttr = field.showIf ? `data-show-field="${field.key}"` : '';
  const groupTitle = showGroup ? `<div class="field-group-title" data-group-marker>${escapeHtml(field.group)}</div>` : '';
  let inputHtml = '';
  if (field.type === 'text') {
    inputHtml = `<input type="text" inputmode="${field.inputmode || 'text'}" data-field="${field.key}" value="${escapeHtml(data[field.key])}" placeholder="${escapeHtml(field.placeholder || '')}" />`;
  } else if (field.type === 'textarea') {
    inputHtml = `<textarea data-field="${field.key}" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(data[field.key])}</textarea>`;
  } else if (field.type === 'radio') {
    inputHtml = `<div class="radio-row">${field.options.map((opt) => {
      const rid = `r_${field.key}_${opt.value}`;
      const checked = data[field.key] === opt.value ? 'checked' : '';
      return `<input class="radio-native" type="radio" id="${rid}" name="${field.key}" value="${opt.value}" data-field="${field.key}" ${checked} />
        <label class="radio-pill" for="${rid}">${escapeHtml(opt.label)}</label>`;
    }).join('')}</div>`;
  }
  return `${groupTitle}<div class="field" ${showAttr} style="${field.showIf ? 'display:none' : ''}">
    <label>${escapeHtml(field.label)}</label>
    ${inputHtml}
  </div>`;
}

function applyConditionalVisibility(root, data) {
  const conditions = [
    { target: 'sistemaInstaladoEmTelhadoTipo', check: () => data.sistemaInstaladoEm === 'TELHADO' },
    { target: 'localInversorOutro', check: () => data.localInversor === 'OUTRO' }
  ];
  conditions.forEach(({ target, check }) => {
    const el = root.querySelector(`[data-show-field="${target}"]`);
    if (el) el.style.display = check() ? 'flex' : 'none';
  });
}

function photosCardHtml(mediaList) {
  const rows = PHOTO_CATEGORIES.map((cat) => {
    const media = mediaList.find((m) => m.kind === 'photo' && m.fieldKey === cat.key);
    return photoCategoryRowHtml(cat, media);
  }).join('');
  const generalPhotos = mediaList.filter((m) => m.kind === 'photo' && m.fieldKey === 'general');
  return `
    <div class="card">
      <div class="card-header" data-toggle><h3>📷 7. Registros fotográficos</h3><span class="chevron">▾</span></div>
      <div class="card-body">
        <div id="photoCategoryList">${rows}</div>
        <div class="field">
          <label>Fotos gerais adicionais</label>
          <div class="hint">Fotos livres do local, materiais, obra, etc.</div>
          <div class="gallery-grid" id="generalGallery">
            ${generalPhotos.map((m) => galleryItemHtml(m)).join('')}
          </div>
          <div class="photo-add-group">
            <label class="btn-outline-cyan gallery-add-btn">📷 Tirar foto
              <input type="file" accept="image/*" capture="environment" multiple id="generalPhotoInputCamera" style="display:none" />
            </label>
            <label class="btn-outline-cyan gallery-add-btn">🖼️ Da galeria
              <input type="file" accept="image/*" multiple id="generalPhotoInputLibrary" style="display:none" />
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

function photoCategoryRowHtml(cat, media) {
  const thumb = media ? `<img class="photo-thumb" src="${URL.createObjectURL(media.blob)}" />` : `<div class="photo-thumb"></div>`;
  return `
    <div class="photo-category" data-cat="${cat.key}">
      <div class="photo-check ${media ? 'checked' : ''}">${media ? '✓' : ''}</div>
      ${thumb}
      <div class="photo-label">${escapeHtml(cat.label)}</div>
      ${media
        ? `<button type="button" class="photo-remove-btn" data-remove-cat="${cat.key}">✕</button>`
        : `<div class="photo-add-group">
             <label class="photo-add-btn" title="Tirar foto">📷
               <input type="file" accept="image/*" capture="environment" data-cat-input="${cat.key}" style="display:none" />
             </label>
             <label class="photo-add-btn" title="Escolher da galeria">🖼️
               <input type="file" accept="image/*" data-cat-input="${cat.key}" style="display:none" />
             </label>
           </div>`
      }
    </div>
  `;
}

function galleryItemHtml(media) {
  return `<div class="gallery-item" data-media-id="${media.id}">
    <img src="${URL.createObjectURL(media.blob)}" />
    <button type="button" class="remove" data-remove-general="${media.id}">✕</button>
  </div>`;
}

function wirePhotoCategories(root, installation, mediaList, saveNow) {
  const list = root.querySelector('#photoCategoryList');

  list.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-cat-input]');
    if (!input || !input.files?.length) return;
    const catKey = input.dataset.catInput;
    const file = input.files[0];
    try {
      const blob = await fileToJpegBlob(file);
      const mediaId = `${installation.id}:${catKey}`;
      const item = { id: mediaId, installationId: installation.id, kind: 'photo', fieldKey: catKey, blob, mimeType: 'image/jpeg', createdAt: Date.now() };
      await addMedia(item);
      const idx = mediaList.findIndex((m) => m.fieldKey === catKey && m.kind === 'photo');
      if (idx >= 0) mediaList[idx] = item; else mediaList.push(item);
      const cat = PHOTO_CATEGORIES.find((c) => c.key === catKey);
      list.querySelector(`[data-cat="${catKey}"]`).outerHTML = photoCategoryRowHtml(cat, item);
      showSaved();
    } catch (err) {
      toast('Não foi possível processar a foto.', 'error');
    }
  });

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-cat]');
    if (!btn) return;
    const catKey = btn.dataset.removeCat;
    const mediaId = `${installation.id}:${catKey}`;
    await deleteMedia(mediaId);
    const idx = mediaList.findIndex((m) => m.fieldKey === catKey && m.kind === 'photo');
    if (idx >= 0) mediaList.splice(idx, 1);
    const cat = PHOTO_CATEGORIES.find((c) => c.key === catKey);
    list.querySelector(`[data-cat="${catKey}"]`).outerHTML = photoCategoryRowHtml(cat, null);
    showSaved();
  });
}

function wireGeneralGallery(root, installation, mediaList) {
  const gallery = root.querySelector('#generalGallery');

  async function handleFiles(input) {
    if (!input.files?.length) return;
    for (const file of Array.from(input.files)) {
      try {
        const blob = await fileToJpegBlob(file);
        const item = { id: uid(), installationId: installation.id, kind: 'photo', fieldKey: 'general', blob, mimeType: 'image/jpeg', createdAt: Date.now() };
        await addMedia(item);
        mediaList.push(item);
        gallery.insertAdjacentHTML('beforeend', galleryItemHtml(item));
      } catch (err) {
        toast('Não foi possível processar uma das fotos.', 'error');
      }
    }
    input.value = '';
    showSaved();
  }

  root.querySelector('#generalPhotoInputCamera').addEventListener('change', (e) => handleFiles(e.target));
  root.querySelector('#generalPhotoInputLibrary').addEventListener('change', (e) => handleFiles(e.target));

  gallery.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-general]');
    if (!btn) return;
    const mediaId = btn.dataset.removeGeneral;
    await deleteMedia(mediaId);
    const idx = mediaList.findIndex((m) => m.id === mediaId);
    if (idx >= 0) mediaList.splice(idx, 1);
    gallery.querySelector(`[data-media-id="${mediaId}"]`)?.remove();
    showSaved();
  });
}

function appAccessCardHtml(data) {
  return `
    <div class="card">
      <div class="card-header" data-toggle><h3>🔐 Acesso ao aplicativo de monitoramento</h3><span class="chevron">▾</span></div>
      <div class="card-body">
        <div class="section-note">Estes dados também ficam disponíveis como campos editáveis dentro do PDF final, para atualização posterior.</div>
        <div class="field">
          <label>Login do aplicativo</label>
          <input type="text" data-field="appLogin" value="${escapeHtml(data.appLogin)}" placeholder="usuário / e-mail" autocapitalize="none" />
        </div>
        <div class="field">
          <label>Senha do aplicativo</label>
          <input type="text" data-field="appSenha" value="${escapeHtml(data.appSenha)}" placeholder="senha" autocapitalize="none" />
        </div>
      </div>
    </div>
  `;
}

function observacoesCardHtml(data, mediaList) {
  const audioItems = mediaList.filter((m) => m.kind === 'audio');
  return `
    <div class="card">
      <div class="card-header" data-toggle><h3>📝 Observações</h3><span class="chevron">▾</span></div>
      <div class="card-body">
        <div class="field">
          <label>Observações gerais</label>
          <textarea data-field="observacoesTexto" placeholder="Descreva qualquer observação relevante sobre a instalação">${escapeHtml(data.observacoesTexto)}</textarea>
        </div>
        <div class="field">
          <label>Gravação de áudio</label>
          <button type="button" class="record-btn" id="btnRecordAudio">🎙️ Gravar observação em áudio</button>
          <div class="audio-list" id="audioList">${audioItems.map(audioItemHtml).join('')}</div>
        </div>
      </div>
    </div>
  `;
}

function audioItemHtml(media) {
  const url = URL.createObjectURL(media.blob);
  return `<div class="audio-item" data-media-id="${media.id}">
    <audio controls src="${url}"></audio>
    <button type="button" class="photo-remove-btn" data-remove-audio="${media.id}">✕</button>
  </div>`;
}

function wireAudioRecorder(root, installation, mediaList) {
  const btn = root.querySelector('#btnRecordAudio');
  const list = root.querySelector('#audioList');
  const recorder = new AudioRecorder();
  let isRecording = false;

  btn.addEventListener('click', async () => {
    if (!isRecording) {
      try {
        await recorder.start();
        isRecording = true;
        btn.classList.add('recording');
        btn.textContent = '⏹️ Parar gravação';
      } catch (err) {
        toast(err.message || 'Não foi possível acessar o microfone.', 'error');
      }
    } else {
      const blob = await recorder.stop();
      isRecording = false;
      btn.classList.remove('recording');
      btn.textContent = '🎙️ Gravar observação em áudio';
      if (blob && blob.size > 0) {
        const item = {
          id: uid(),
          installationId: installation.id,
          kind: 'audio',
          fieldKey: 'observacao',
          blob,
          mimeType: blob.type,
          attachName: `observacao_${Date.now()}.webm`,
          createdAt: Date.now()
        };
        await addMedia(item);
        mediaList.push(item);
        list.insertAdjacentHTML('beforeend', audioItemHtml(item));
        showSaved();
      }
    }
  });

  list.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-remove-audio]');
    if (!removeBtn) return;
    const mediaId = removeBtn.dataset.removeAudio;
    await deleteMedia(mediaId);
    const idx = mediaList.findIndex((m) => m.id === mediaId);
    if (idx >= 0) mediaList.splice(idx, 1);
    list.querySelector(`[data-media-id="${mediaId}"]`)?.remove();
    showSaved();
  });
}

function signatureCardHtml(data) {
  return `
    <div class="card">
      <div class="card-header" data-toggle><h3>✍️ Assinatura do executor</h3><span class="chevron">▾</span></div>
      <div class="card-body">
        <div class="field">
          <label>Nome do executor</label>
          <input type="text" data-field="executorNome" value="${escapeHtml(data.executorNome)}" placeholder="Nome de quem está executando o serviço" />
        </div>
        <div class="field">
          <label>Assinatura</label>
          <div class="sig-canvas-wrap"><canvas id="sigCanvas"></canvas></div>
          <button type="button" class="btn-secondary" id="btnClearSig">Limpar assinatura</button>
        </div>
      </div>
    </div>
  `;
}

function finalizeCardHtml(installation) {
  const isDone = installation.status === 'concluida';
  return `
    <div class="form-actions">
      ${isDone
        ? `<button class="btn-primary" id="btnFinalize">Reexportar checklist</button>
           <div class="section-note" style="text-align:center">Instalação já concluída em ${formatDateTime(installation.finalizedAt)}. Você pode gerar o pacote novamente a qualquer momento.</div>`
        : `<button class="btn-primary" id="btnFinalize">✅ Finalizar e gerar arquivo para compartilhar</button>
           <div class="section-note" style="text-align:center">Gera um PDF completo + fotos + áudios em um único arquivo .zip, pronto para compartilhar.</div>`
      }
      <button class="btn-danger-ghost" id="btnDelete">Excluir esta instalação</button>
    </div>
  `;
}

async function handleFinalize(installation, mediaList, saveNow) {
  installation.status = 'concluida';
  installation.finalizedAt = Date.now();
  await saveNow();
  const badge = document.getElementById('statusBadge');
  if (badge) { badge.textContent = 'Concluída'; badge.className = 'badge badge-done'; }
  await handleExport(installation, mediaList);
}

async function handleExport(installation, mediaList) {
  const btn = document.getElementById('btnFinalize');
  const original = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Gerando arquivo…'; }
  try {
    const pkg = await buildExportPackage(installation, mediaList);
    const result = await shareOrDownload(pkg);
    if (result === 'shared') toast('Checklist compartilhado com sucesso.', 'success');
    else if (result === 'downloaded') toast('Arquivo gerado e baixado.', 'success');
  } catch (err) {
    console.error(err);
    toast('Erro ao gerar o arquivo. Tente novamente.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }
}
