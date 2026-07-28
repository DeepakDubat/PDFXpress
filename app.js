/* ===== PDFXpress - Main Application ===== */

// State
const state = {
  mergeFiles: [],
  splitFile: null, splitPages: 0,
  convertFile: null, convertPages: 0,
  formFile: null, formAnnotations: [], annotTool: 'text',
  formPdfBytes: null,
  word2pdfFile: null,
  pdf2wordFile: null,
  img2pdfFiles: []
};

// ===== PREVIEW MODAL =====
function createPreviewModal() {
  if (document.getElementById('preview-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'preview-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:500;
    display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
    padding:1rem;overflow-y:auto;backdrop-filter:blur(8px);`;
  modal.innerHTML = `
    <div style="width:100%;max-width:900px;">
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:0.8rem 0;margin-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.1);">
        <span id="preview-title" style="font-weight:700;font-size:1.1rem;color:#e8eaf6;"></span>
        <button onclick="closePreview()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
          color:#e8eaf6;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.9rem;
          font-weight:600;transition:all 0.2s;">✕ Close</button>
      </div>
      <div id="preview-body"></div>
    </div>`;
  modal.addEventListener('click', e => { if(e.target===modal) closePreview(); });
  document.body.appendChild(modal);
}

function closePreview() {
  const m = document.getElementById('preview-modal');
  if (m) m.remove();
}

async function showPDFPreview(bytes, title) {
  createPreviewModal();
  document.getElementById('preview-title').textContent = '👁 Preview: ' + title;
  const body = document.getElementById('preview-body');
  body.innerHTML = '<div style="color:#8890b0;text-align:center;padding:2rem;">Rendering PDF...</div>';
  try {
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    body.innerHTML = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      canvas.style.cssText = 'width:100%;border-radius:8px;margin-bottom:0.8rem;display:block;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const label = document.createElement('div');
      label.style.cssText = 'color:#8890b0;font-size:0.78rem;margin-bottom:1.2rem;text-align:center;';
      label.textContent = `Page ${i} of ${pdf.numPages}`;
      body.appendChild(canvas);
      body.appendChild(label);
    }
  } catch(e) {
    body.innerHTML = `<div style="color:#ff6b6b;padding:1rem;">Error rendering PDF: ${e.message}</div>`;
  }
}

function showImagePreview(dataUrl, title) {
  createPreviewModal();
  document.getElementById('preview-title').textContent = '👁 ' + title;
  const body = document.getElementById('preview-body');
  body.innerHTML = `<img src="${dataUrl}" style="width:100%;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.6);" />`;
}

// ===== NAVIGATION =====
function openTool(name) {
  document.getElementById('tool-panels').classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelector('.tools-section').style.display = 'none';
  document.querySelector('.how-section').style.display = 'none';
  document.querySelector('.features-section').style.display = 'none';
  document.querySelector('.hero').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeTool() {
  document.getElementById('tool-panels').classList.remove('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tools-section').style.display = '';
  document.querySelector('.how-section').style.display = '';
  document.querySelector('.features-section').style.display = '';
  document.querySelector('.hero').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ===== DRAG & DROP =====
function dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function dropFiles(e, tool) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  const files = [...e.dataTransfer.files];
  if (tool === 'merge') addFiles('merge', files);
  else if (tool === 'split') loadSplitPDF(files[0]);
  else if (tool === 'convert') loadConvertPDF(files[0]);
  else if (tool === 'formfill') loadFormPDF(files[0]);
  else if (tool === 'word2pdf') loadWord2PDF(files[0]);
  else if (tool === 'pdf2word') loadPDF2Word(files[0]);
  else if (tool === 'img2pdf') addImageFiles(files);
}

// ===== HELPERS =====
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function setProgress(tool, pct, label) {
  const pw = document.getElementById(tool + '-progress');
  pw.style.display = 'block';
  document.getElementById(tool + '-fill').style.width = pct + '%';
  if (label) document.getElementById(tool + '-label').textContent = label;
}
function hideProgress(tool) { document.getElementById(tool + '-progress').style.display = 'none'; }
function downloadBytes(bytes, filename) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const blob = new Blob([arr], { type: 'application/pdf' });
  const url = (window.URL || window.webkitURL).createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // 10 seconds — enough time for even large merged PDFs to be picked up by the browser
  setTimeout(() => {
    (window.URL || window.webkitURL).revokeObjectURL(url);
    a.remove();
  }, 10000);
}

function makeResultItem(icon, label, onDownload, onPreview, extraInfo = '') {
  const div = document.createElement('div'); div.className = 'result-item';
  div.style.cssText = 'display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:10px; padding:10px 16px; margin-top:0.8rem;';
  div.innerHTML = `<span class="ri-icon" style="font-size:1.2rem;">${icon}</span>
    <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
      <input type="text" class="ri-name-input" value="${label}" style="background:transparent; border:none; border-bottom:1px dashed rgba(255,255,255,0.3); color:#fff; font-family:inherit; font-size:0.92rem; padding:2px 4px; outline:none; width:100%; box-sizing:border-box;" />
      ${extraInfo ? `<span style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; padding-left:4px;">${extraInfo}</span>` : ''}
    </div>
    <button class="btn-preview" style="background:rgba(124,92,252,0.15); border:1px solid rgba(124,92,252,0.3); color:#a78bfa; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:600; transition:all 0.2s;">👁 Preview</button>
    <button class="btn-download" style="background:rgba(0,212,255,0.15); border:1px solid rgba(0,212,255,0.3); color:#00d4ff; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:600; transition:all 0.2s; display:flex; align-items:center; gap:4px;">⬇ Download</button>`;
  
  const input = div.querySelector('.ri-name-input');
  div.querySelector('.btn-preview').onclick = onPreview;
  div.querySelector('.btn-download').onclick = () => {
    let name = input.value.trim();
    if (!name) name = label;
    if (!name.toLowerCase().endsWith('.pdf')) {
      name += '.pdf';
    }
    onDownload(name);
  };
  return div;
}

// ===== MERGE =====
function addFiles(tool, filesInput) {
  const files = filesInput instanceof FileList ? [...filesInput] : filesInput;
  files.forEach(f => {
    if (!f.name.endsWith('.pdf')) { showToast('Only PDF files allowed', 'error'); return; }
    state.mergeFiles.push(f);
  });
  renderMergeList();
}
function renderMergeList() {
  const list = document.getElementById('merge-list');
  list.innerHTML = '';
  state.mergeFiles.forEach((f, i) => {
    const div = document.createElement('div'); div.className = 'file-item';
    div.innerHTML = `<span class="fi-icon">📄</span>
      <span class="fi-name">${f.name}</span>
      <span class="fi-size">${fmtSize(f.size)}</span>
      <button class="fi-remove" onclick="removeMergeFile(${i})">✕</button>`;
    list.appendChild(div);
  });
  document.getElementById('merge-btn').disabled = state.mergeFiles.length < 2;
}
function removeMergeFile(i) { state.mergeFiles.splice(i,1); renderMergeList(); }

async function mergePDFs() {
  if (state.mergeFiles.length < 2) return;
  setProgress('merge', 10, 'Loading PDFs...');
  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    for (let i = 0; i < state.mergeFiles.length; i++) {
      const pct = 10 + Math.floor((i / state.mergeFiles.length) * 70);
      setProgress('merge', pct, `Processing ${i+1}/${state.mergeFiles.length}...`);
      const ab = await state.mergeFiles[i].arrayBuffer();
      const doc = await PDFDocument.load(ab);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    setProgress('merge', 90, 'Finalizing...');
    const bytes = await merged.save();
    setProgress('merge', 100, 'Done!');
    const result = document.getElementById('merge-result');
    result.innerHTML = '';
    const item = makeResultItem('✅', 'merged_document.pdf',
      (newName) => downloadBytes(bytes, newName),
      () => showPDFPreview(bytes, 'merged_document.pdf'),
      `${state.mergeFiles.length} files combined`
    );
    result.appendChild(item);
    showToast('PDFs merged successfully!', 'success');
    setTimeout(() => hideProgress('merge'), 1000);
  } catch(e) {
    showToast('Error merging PDFs: ' + e.message, 'error');
    hideProgress('merge');
  }
}

// ===== SPLIT =====
async function loadSplitPDF(file) {
  if (!file || !file.name.endsWith('.pdf')) { showToast('Please select a PDF file', 'error'); return; }
  state.splitFile = file;
  try {
    const ab = await file.arrayBuffer();
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(ab);
    state.splitPages = doc.getPageCount();
    document.getElementById('split-options').style.display = 'block';
    document.getElementById('split-info').textContent = `📄 ${file.name} — ${state.splitPages} pages — ${fmtSize(file.size)}`;
    document.getElementById('split-btn').disabled = false;
    document.getElementById('split-to').max = state.splitPages;
    document.getElementById('split-from').max = state.splitPages;
    document.querySelectorAll('input[name="split-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('split-range-inputs').style.display = r.value === 'range' ? 'flex' : 'none';
      });
    });
    showToast(`Loaded: ${file.name}`, 'success');
  } catch(e) { showToast('Could not read PDF: ' + e.message, 'error'); }
}

async function splitPDF() {
  if (!state.splitFile) return;
  const mode = document.querySelector('input[name="split-mode"]:checked').value;
  setProgress('split', 10, 'Loading PDF...');
  try {
    const ab = await state.splitFile.arrayBuffer();
    const { PDFDocument } = PDFLib;
    const src = await PDFDocument.load(ab);
    const result = document.getElementById('split-result'); result.innerHTML = '';
    if (mode === 'all') {
      const dlls = [];
      for (let i = 0; i < state.splitPages; i++) {
        setProgress('split', 10 + Math.floor((i/state.splitPages)*85), `Extracting page ${i+1}/${state.splitPages}...`);
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(src, [i]);
        newDoc.addPage(page);
        const bytes = await newDoc.save();
        const idx = i;
        dlls.push({ bytes, name: `page_${idx+1}.pdf` });
        const item = makeResultItem('📄', `page_${idx+1}.pdf`,
          (newName) => {
            dlls[idx].name = newName;
            downloadBytes(dlls[idx].bytes, newName);
          },
          () => showPDFPreview(dlls[idx].bytes, dlls[idx].name)
        );
        result.appendChild(item);
      }
      const allBtn = document.createElement('button');
      allBtn.className = 'btn-download-all';
      allBtn.textContent = '⬇ Download All as ZIP';
      result.appendChild(allBtn);
      allBtn.onclick = () => downloadAllZip(dlls);
    } else {
      let from = parseInt(document.getElementById('split-from').value) || 1;
      let to = parseInt(document.getElementById('split-to').value) || state.splitPages;
      from = Math.max(1, Math.min(from, state.splitPages));
      to = Math.max(from, Math.min(to, state.splitPages));
      const newDoc = await PDFDocument.create();
      const indices = Array.from({length: to-from+1}, (_,i) => from-1+i);
      const pages = await newDoc.copyPages(src, indices);
      pages.forEach(p => newDoc.addPage(p));
      const bytes = await newDoc.save();
      setProgress('split', 95, 'Finalizing...');
      const fname = `pages_${from}_to_${to}.pdf`;
      const item = makeResultItem('✅', fname,
        (newName) => downloadBytes(bytes, newName),
        () => showPDFPreview(bytes, fname)
      );
      result.appendChild(item);
    }
    setProgress('split', 100, 'Done!');
    showToast('PDF split successfully!', 'success');
    setTimeout(() => hideProgress('split'), 1000);
  } catch(e) { showToast('Error: ' + e.message, 'error'); hideProgress('split'); }
}

async function downloadAllZip(files) {
  showToast('Creating ZIP...', 'info');
  const zip = new JSZip();
  const inputs = document.querySelectorAll('#split-result .ri-name-input');
  files.forEach((f, idx) => {
    let name = f.name;
    if (inputs[idx]) {
      name = inputs[idx].value.trim() || f.name;
    }
    if (!name.toLowerCase().endsWith('.pdf')) {
      name += '.pdf';
    }
    zip.file(name, f.bytes);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'split_pages.zip';
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('ZIP downloaded!', 'success');
}

// ===== CONVERT =====
async function loadConvertPDF(file) {
  if (!file || !file.name.endsWith('.pdf')) { showToast('Please select a PDF file', 'error'); return; }
  state.convertFile = file;
  try {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    state.convertPages = pdf.numPages;
    document.getElementById('convert-options').style.display = 'block';
    document.getElementById('convert-info').textContent = `📄 ${file.name} — ${state.convertPages} pages — ${fmtSize(file.size)}`;
    document.getElementById('convert-btn').disabled = false;
    showToast(`Loaded: ${file.name}`, 'success');
  } catch(e) { showToast('Could not read PDF: ' + e.message, 'error'); }
}

async function convertToImages() {
  if (!state.convertFile) return;
  const scale = parseFloat(document.querySelector('input[name="quality"]:checked').value);
  setProgress('convert', 5, 'Initializing...');
  const result = document.getElementById('convert-result'); result.innerHTML = '';
  try {
    const ab = await state.convertFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const imgData = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      setProgress('convert', 5 + Math.floor((i/pdf.numPages)*90), `Rendering page ${i}/${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      const ci = i;
      imgData.push({ url: dataUrl, name: `page_${ci}.png` });
      const card = document.createElement('div'); card.className = 'img-card';
      card.innerHTML = `<img src="${dataUrl}" alt="Page ${ci}" style="cursor:pointer" />
        <div class="img-card-footer" style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:8px 10px;">
          <input type="text" class="img-name-input" value="page_${ci}.png" style="background:transparent; border:none; border-bottom:1px dashed rgba(255,255,255,0.3); color:#fff; font-family:inherit; font-size:0.78rem; padding:2px; outline:none; flex:1; min-width:0;" />
          <button class="btn-preview-img" style="background:rgba(124,92,252,0.2);border:1px solid rgba(124,92,252,0.4);color:#a78bfa;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:600;">👁</button>
          <button class="btn-download-img" style="background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:600;">⬇</button>
        </div>`;
      card.querySelector('.btn-preview-img').onclick = () => showImagePreview(imgData[ci-1].url, card.querySelector('.img-name-input').value.trim());
      card.querySelector('.btn-download-img').onclick = () => {
        const a=document.createElement('a');
        a.href=imgData[ci-1].url;
        let name = card.querySelector('.img-name-input').value.trim();
        if (!name) name = `page_${ci}.png`;
        const lowerName = name.toLowerCase();
        if (!lowerName.endsWith('.png') && !lowerName.endsWith('.jpg') && !lowerName.endsWith('.jpeg') && !lowerName.endsWith('.gif')) {
          name += '.png';
        }
        a.download=name;
        a.click();
      };
      card.querySelector('img').onclick = () => showImagePreview(imgData[ci-1].url, card.querySelector('.img-name-input').value.trim());
      result.appendChild(card);
    }
    setProgress('convert', 100, 'Done!');
    showToast('Conversion complete!', 'success');
    setTimeout(() => hideProgress('convert'), 1000);
  } catch(e) { showToast('Error: ' + e.message, 'error'); hideProgress('convert'); }
}



// ===== FORM FILL / ANNOTATE =====
async function loadFormPDF(file) {
  if (!file || !file.name.endsWith('.pdf')) { showToast('Please select a PDF file', 'error'); return; }
  state.formFile = file;
  state.formAnnotations = [];
  const viewer = document.getElementById('formfill-viewer');
  viewer.innerHTML = '<div style="padding:2rem;text-align:center;color:#8890b0">Loading PDF...</div>';
  try {
    const ab = await file.arrayBuffer();
    state.formPdfBytes = new Uint8Array(ab);
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    viewer.innerHTML = '';
    const container = document.createElement('div'); container.className = 'pdf-page-container';
    viewer.appendChild(container);
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1.4 });
      const wrap = document.createElement('div'); wrap.className = 'pdf-page-wrap';
      wrap.style.width = vp.width + 'px';
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const annotLayer = document.createElement('div');
      annotLayer.className = 'annot-layer active-layer';
      annotLayer.style.width = vp.width + 'px';
      annotLayer.style.height = vp.height + 'px';
      annotLayer.dataset.page = i;
      annotLayer.addEventListener('click', (e) => handleAnnotClick(e, annotLayer, i));
      wrap.appendChild(canvas); wrap.appendChild(annotLayer);
      container.appendChild(wrap);
    }
    document.getElementById('formfill-toolbar').style.display = 'block';
    showToast(`Loaded: ${file.name}`, 'success');
  } catch(e) {
    viewer.innerHTML = `<div style="padding:2rem;text-align:center;color:#ff6b6b">Error: ${e.message}</div>`;
    showToast('Could not load PDF: ' + e.message, 'error');
  }
}

function handleAnnotClick(e, layer, pageNum) {
  const rect = layer.getBoundingClientRect();
  const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  const color = document.getElementById('annot-color').value;
  const size = parseInt(document.getElementById('annot-size').value);
  if (state.annotTool === 'text') {
    const el = document.createElement('div');
    el.contentEditable = true; el.className = 'annot-text';
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;color:${color};font-size:${size}px;
      font-family:Inter,sans-serif;min-width:120px;outline:none;cursor:text;
      background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;
      border:1px dashed rgba(255,255,255,0.2);white-space:nowrap;`;
    el.textContent = 'Type here...';
    el.addEventListener('focus', () => { if(el.textContent==='Type here...') el.textContent=''; });
    el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); el.remove(); });
    layer.appendChild(el); el.focus();
  } else if (state.annotTool === 'highlight') {
    const el = document.createElement('div');
    el.className = 'annot-highlight';
    el.style.cssText = `position:absolute;left:${x-40}px;top:${y-10}px;width:120px;height:22px;
      background:${color}55;border-radius:2px;cursor:pointer;`;
    el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); el.remove(); });
    layer.appendChild(el);
  } else if (state.annotTool === 'sign') {
    showSignaturePad(x, y, layer, color, size);
  }
}

function showSignaturePad(x, y, layer, color, size) {
  const existing = document.getElementById('sig-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'sig-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center;`;
  overlay.innerHTML = `<div style="background:#0d0f1e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:1.5rem;max-width:440px;width:95%;">
    <h3 style="margin-bottom:1rem;font-size:1.1rem;">✍ Draw Signature</h3>
    <canvas id="sig-canvas" width="400" height="160" style="background:#fff;border-radius:8px;cursor:crosshair;display:block;"></canvas>
    <div style="display:flex;gap:0.8rem;margin-top:1rem;">
      <button onclick="clearSig()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#8890b0;cursor:pointer;">Clear</button>
      <button onclick="applySig(${x},${y})" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#7c5cfc,#a78bfa);color:white;font-weight:700;cursor:pointer;">Apply</button>
      <button onclick="document.getElementById('sig-overlay').remove()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#8890b0;cursor:pointer;">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const canvas = document.getElementById('sig-canvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  ctx.strokeStyle = color; ctx.lineWidth = size/8; ctx.lineCap = 'round';
  canvas.addEventListener('mousedown', e => { drawing=true; ctx.beginPath(); ctx.moveTo(e.offsetX,e.offsetY); });
  canvas.addEventListener('mousemove', e => { if(!drawing) return; ctx.lineTo(e.offsetX,e.offsetY); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => drawing=false);
  window._sigLayer = layer; window._sigX = x; window._sigY = y;
}

function clearSig() {
  const c = document.getElementById('sig-canvas');
  c.getContext('2d').clearRect(0,0,c.width,c.height);
}

function applySig(x, y) {
  const canvas = document.getElementById('sig-canvas');
  const dataUrl = canvas.toDataURL();
  const layer = window._sigLayer;
  const img = document.createElement('img');
  img.src = dataUrl;
  img.className = 'annot-signature';
  img.style.cssText = `position:absolute;left:${x-80}px;top:${y-40}px;width:160px;height:64px;object-fit:contain;cursor:pointer;`;
  img.addEventListener('dblclick', (ev) => { ev.stopPropagation(); img.remove(); });
  layer.appendChild(img);
  document.getElementById('sig-overlay').remove();
}

function setAnnotTool(tool) {
  state.annotTool = tool;
  document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + tool).classList.add('active');
}

function clearAnnotations() {
  document.querySelectorAll('.annot-layer').forEach(l => l.innerHTML = '');
  state.formAnnotations = [];
  showToast('Annotations cleared', 'info');
}

async function downloadAnnotatedPDF() {
  showToast('Preparing annotated PDF...', 'info');
  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.load(state.formPdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    
    const layers = document.querySelectorAll('.annot-layer');
    for (let pi = 0; pi < layers.length; pi++) {
      const layer = layers[pi];
      const page = doc.getPage(pi);
      const { height } = page.getSize();
      
      const scaleX = page.getWidth() / layer.offsetWidth;
      const scaleY = page.getHeight() / layer.offsetHeight;

      // 1. Text annotations
      const textEls = layer.querySelectorAll('.annot-text');
      for (const el of textEls) {
        const txt = el.textContent.trim();
        if (!txt || txt === 'Type here...') continue;
        
        const elRect = el.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        const rx = elRect.left - layerRect.left;
        const ry = elRect.top - layerRect.top;
        
        const style = window.getComputedStyle(el);
        const fSize = parseFloat(style.fontSize) || 16;
        const padLeft = parseFloat(style.paddingLeft) || 8;
        const padTop = parseFloat(style.paddingTop) || 4;
        
        let colorRgb = rgb(0.1, 0.3, 0.9);
        const colorStr = style.color;
        const rgbMatch = colorStr.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        if (rgbMatch) {
          colorRgb = rgb(
            parseInt(rgbMatch[1]) / 255,
            parseInt(rgbMatch[2]) / 255,
            parseInt(rgbMatch[3]) / 255
          );
        }
        
        const pdfX = (rx + padLeft) * scaleX;
        const pdfY = height - ((ry + padTop) * scaleY) - (fSize * scaleY * 0.85);
        
        page.drawText(txt, {
          x: pdfX,
          y: pdfY,
          size: fSize * scaleY,
          font,
          color: colorRgb
        });
      }

      // 2. Highlight annotations
      const highlightEls = layer.querySelectorAll('.annot-highlight');
      for (const el of highlightEls) {
        const elRect = el.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        const rx = elRect.left - layerRect.left;
        const ry = elRect.top - layerRect.top;
        
        const w = elRect.width * scaleX;
        const h = elRect.height * scaleY;
        const x = rx * scaleX;
        const y = height - (ry * scaleY) - h;
        
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        let colorRgb = rgb(1, 1, 0);
        let opacity = 0.35;
        
        const rgbaMatch = bg.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
        if (rgbaMatch) {
          colorRgb = rgb(
            parseInt(rgbaMatch[1]) / 255,
            parseInt(rgbaMatch[2]) / 255,
            parseInt(rgbaMatch[3]) / 255
          );
          if (rgbaMatch[4] !== undefined) {
            opacity = parseFloat(rgbaMatch[4]);
          }
        }
        
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color: colorRgb,
          opacity: opacity
        });
      }

      // 3. Signature annotations
      const sigEls = layer.querySelectorAll('.annot-signature');
      for (const imgEl of sigEls) {
        const src = imgEl.src;
        if (src.startsWith('data:image/png;base64,')) {
          const base64Data = src.replace('data:image/png;base64,', '');
          const pngImage = await doc.embedPng(base64Data);
          
          const elRect = imgEl.getBoundingClientRect();
          const layerRect = layer.getBoundingClientRect();
          const rx = elRect.left - layerRect.left;
          const ry = elRect.top - layerRect.top;
          
          const w = elRect.width * scaleX;
          const h = elRect.height * scaleY;
          const x = rx * scaleX;
          const y = height - (ry * scaleY) - h;
          
          page.drawImage(pngImage, {
            x,
            y,
            width: w,
            height: h
          });
        }
      }
    }
    
    const bytes = await doc.save();
    const fname = state.formFile.name.replace('.pdf','') + '_annotated.pdf';
    const result = document.getElementById('formfill-result');
    result.innerHTML = '';
    const item = makeResultItem('📝', fname,
      (newName) => downloadBytes(bytes, newName),
      () => showPDFPreview(bytes, fname)
    );
    result.appendChild(item);
    showToast('Annotated PDF ready!', 'success');
  } catch(e) {
    showToast('Error saving PDF: ' + e.message, 'error');
    console.error(e);
  }
}

// ===== NAVBAR SCROLL =====
window.addEventListener('scroll', () => {
  document.getElementById('navbar').style.background =
    window.scrollY > 20 ? 'rgba(7,8,15,0.95)' : 'rgba(7,8,15,0.85)';
});

// ===== SPLIT RANGE TOGGLE =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="split-mode"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('split-range-inputs').style.display = r.value === 'range' ? 'flex' : 'none';
    });
  });
});


// ===== WORD → PDF =====
async function loadWord2PDF(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'docx') { showToast('Please select a .docx file', 'error'); return; }
  state.word2pdfFile = file;
  const info = document.getElementById('word2pdf-info');
  info.style.display = 'block';
  info.textContent = `📄 ${file.name} — ${fmtSize(file.size)}`;
  document.getElementById('word2pdf-btn').disabled = false;
  showToast(`Loaded: ${file.name}`, 'success');
}

async function convertWord2PDF() {
  if (!state.word2pdfFile) return;
  setProgress('word2pdf', 10, 'Reading Word document...');
  try {
    const ab = await state.word2pdfFile.arrayBuffer();
    setProgress('word2pdf', 30, 'Converting to HTML...');

    // mammoth: DOCX → HTML
    const result = await mammoth.convertToHtml({ arrayBuffer: ab });
    const htmlContent = result.value;

    setProgress('word2pdf', 50, 'Rendering pages...');

    // Create a hidden iframe to render the HTML at a fixed width
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;background:#fff;';
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <style>
        body{font-family:Arial,sans-serif;font-size:12pt;padding:40px 60px;color:#000;background:#fff;margin:0;}
        h1,h2,h3,h4{margin:16px 0 8px;}
        p{margin:0 0 10px;line-height:1.6;}
        table{border-collapse:collapse;width:100%;margin-bottom:12px;}
        td,th{border:1px solid #ccc;padding:6px 10px;}
        ul,ol{padding-left:20px;margin-bottom:10px;}
        img{max-width:100%;}
      </style>
    </head><body>${htmlContent}</body></html>`);
    idoc.close();

    // Wait for render
    await new Promise(r => setTimeout(r, 500));

    setProgress('word2pdf', 65, 'Building PDF...');

    // We render the iframe body to canvas page by page using scrolling
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    const pageW = 794;
    const pageH = 1123;
    const totalH = iframe.contentDocument.body.scrollHeight;
    const numPages = Math.ceil(totalH / pageH);

    for (let pg = 0; pg < numPages; pg++) {
      setProgress('word2pdf', 65 + Math.floor((pg / numPages) * 25), `Rendering page ${pg + 1}/${numPages}...`);
      const canvas = document.createElement('canvas');
      canvas.width = pageW * 2; canvas.height = pageH * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render the visible slice of the iframe body
      const offsetY = pg * pageH;
      const slice = idoc.body;

      // Use html2canvas if available, else fallback
      let dataUrl;
      try {
        const hCanvas = await html2canvas(slice, {
          canvas,
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: -offsetY,
          windowWidth: pageW,
          windowHeight: pageH,
          backgroundColor: '#ffffff'
        });
        dataUrl = hCanvas.toDataURL('image/jpeg', 0.92);
      } catch (_) {
        // Fallback: white page with note
        ctx.fillStyle = '#333';
        ctx.font = '24px Arial';
        ctx.fillText(`Page ${pg + 1}`, 40, 60);
        dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      }

      const imgBytes = dataUrlToBytes(dataUrl);
      const img = await pdfDoc.embedJpg(imgBytes);
      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
    }

    iframe.remove();
    setProgress('word2pdf', 95, 'Finalizing...');
    const bytes = await pdfDoc.save();
    setProgress('word2pdf', 100, 'Done!');

    const fname = state.word2pdfFile.name.replace(/\.docx$/i, '') + '.pdf';
    const result2 = document.getElementById('word2pdf-result');
    result2.innerHTML = '';
    const item = makeResultItem('✅', fname,
      (newName) => downloadBytes(bytes, newName),
      () => showPDFPreview(bytes, fname),
      `Converted from: ${state.word2pdfFile.name}`
    );
    result2.appendChild(item);
    showToast('Word converted to PDF!', 'success');
    setTimeout(() => hideProgress('word2pdf'), 1000);
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    hideProgress('word2pdf');
    console.error(e);
  }
}

// ===== PDF → WORD =====
async function loadPDF2Word(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a PDF file', 'error'); return;
  }
  state.pdf2wordFile = file;
  const info = document.getElementById('pdf2word-info');
  info.style.display = 'block';
  info.textContent = `📄 ${file.name} — ${fmtSize(file.size)}`;
  document.getElementById('pdf2word-btn').disabled = false;
  showToast(`Loaded: ${file.name}`, 'success');
}

async function convertPDF2Word() {
  if (!state.pdf2wordFile) return;
  setProgress('pdf2word', 10, 'Loading PDF...');
  try {
    const ab = await state.pdf2wordFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const numPages = pdf.numPages;

    setProgress('pdf2word', 20, 'Extracting text...');
    let allText = '';
    const pageTexts = [];

    for (let i = 1; i <= numPages; i++) {
      setProgress('pdf2word', 20 + Math.floor((i / numPages) * 60), `Processing page ${i}/${numPages}...`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      pageTexts.push(pageText);
      allText += pageText + '\n\n';
    }

    setProgress('pdf2word', 85, 'Building Word document...');

    // Use docx.js to create a proper DOCX
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
    const children = [];

    // Title
    children.push(new Paragraph({
      text: state.pdf2wordFile.name.replace(/\.pdf$/i, ''),
      heading: HeadingLevel.HEADING_1
    }));

    pageTexts.forEach((text, idx) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `— Page ${idx + 1} —`, bold: true, color: '888888', size: 18 })]
      }));
      // Split by sentences/paragraphs
      const paras = text.split(/(?<=\.\s)|\n+/).filter(p => p.trim().length > 0);
      paras.forEach(para => {
        children.push(new Paragraph({
          children: [new TextRun({ text: para.trim(), size: 24 })]
        }));
      });
      children.push(new Paragraph({ text: '' }));
    });

    const doc = new Document({
      sections: [{ properties: {}, children }]
    });

    const blob = await Packer.toBlob(doc);
    const arrayBuf = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuf);

    setProgress('pdf2word', 100, 'Done!');

    const fname = state.pdf2wordFile.name.replace(/\.pdf$/i, '') + '.docx';
    const resultEl = document.getElementById('pdf2word-result');
    resultEl.innerHTML = '';

    // Custom download for DOCX (not PDF)
    const div = document.createElement('div');
    div.className = 'result-item';
    div.style.cssText = 'display:flex;align-items:center;gap:12px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:12px 16px;margin-top:0.8rem;';
    div.innerHTML = `
      <span style="font-size:1.5rem;">📝</span>
      <div style="flex:1;min-width:0;">
        <input type="text" class="ri-name-input" value="${fname}" style="background:transparent;border:none;border-bottom:1px dashed rgba(255,255,255,0.3);color:#fff;font-family:inherit;font-size:0.92rem;padding:2px 4px;outline:none;width:100%;box-sizing:border-box;"/>
        <span style="font-size:0.75rem;color:var(--text-muted);padding-left:4px;">Converted from: ${state.pdf2wordFile.name} (${numPages} pages)</span>
      </div>
      <button id="docx-dl-btn" style="background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;transition:all 0.2s;">⬇ Download DOCX</button>`;
    div.querySelector('#docx-dl-btn').onclick = () => {
      let name = div.querySelector('.ri-name-input').value.trim() || fname;
      if (!name.toLowerCase().endsWith('.docx')) name += '.docx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    resultEl.appendChild(div);
    showToast('PDF converted to Word!', 'success');
    setTimeout(() => hideProgress('pdf2word'), 1000);
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    hideProgress('pdf2word');
    console.error(e);
  }
}

// ===== IMAGE → PDF =====
function addImageFiles(filesInput) {
  const files = filesInput instanceof FileList ? [...filesInput] : filesInput;
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  files.forEach(f => {
    if (!allowed.includes(f.type)) { showToast(`Skipped: ${f.name} (not an image)`, 'error'); return; }
    state.img2pdfFiles.push(f);
  });
  renderImg2PDFList();
}

function renderImg2PDFList() {
  const list = document.getElementById('img2pdf-list');
  list.innerHTML = '';
  state.img2pdfFiles.forEach((f, i) => {
    const div = document.createElement('div'); div.className = 'file-item';
    // Show a tiny thumbnail
    const url = URL.createObjectURL(f);
    div.innerHTML = `
      <img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--glass-border);" />
      <span class="fi-name">${f.name}</span>
      <span class="fi-size">${fmtSize(f.size)}</span>
      <button class="fi-remove" onclick="removeImg2PDFFile(${i})">✕</button>`;
    list.appendChild(div);
  });
  const hasFiles = state.img2pdfFiles.length > 0;
  document.getElementById('img2pdf-btn').disabled = !hasFiles;
  document.getElementById('img2pdf-options').style.display = hasFiles ? 'block' : 'none';
}

function removeImg2PDFFile(i) {
  state.img2pdfFiles.splice(i, 1);
  renderImg2PDFList();
}

async function convertImg2PDF() {
  if (state.img2pdfFiles.length === 0) return;
  const pageSize = document.querySelector('input[name="img2pdf-size"]:checked').value;
  setProgress('img2pdf', 5, 'Initializing...');
  try {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    // Standard page dimensions (points = 1/72 inch)
    const PAGE_SIZES = {
      a4:     [595.28, 841.89],
      letter: [612,    792]
    };

    for (let i = 0; i < state.img2pdfFiles.length; i++) {
      setProgress('img2pdf', 5 + Math.floor((i / state.img2pdfFiles.length) * 90),
        `Embedding image ${i + 1}/${state.img2pdfFiles.length}...`);

      const file = state.img2pdfFiles[i];
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);

      // Determine image type and embed
      let img;
      const mime = file.type.toLowerCase();
      try {
        if (mime === 'image/png') {
          img = await pdfDoc.embedPng(bytes);
        } else {
          // For jpg, webp, gif, bmp — convert via canvas to jpeg first
          const dataUrl = await fileToDataUrl(file);
          const jpegBytes = await dataUrlToJpeg(dataUrl);
          img = await pdfDoc.embedJpg(jpegBytes);
        }
      } catch(_) {
        // Fallback: convert everything through canvas
        const dataUrl = await fileToDataUrl(file);
        const jpegBytes = await dataUrlToJpeg(dataUrl);
        img = await pdfDoc.embedJpg(jpegBytes);
      }

      const { width: iw, height: ih } = img;

      let pageW, pageH;
      if (pageSize === 'fit') {
        pageW = iw; pageH = ih;
      } else {
        [pageW, pageH] = PAGE_SIZES[pageSize];
      }

      const page = pdfDoc.addPage([pageW, pageH]);

      // Scale image to fit inside the page with padding
      const padding = pageSize === 'fit' ? 0 : 20;
      const maxW = pageW - padding * 2;
      const maxH = pageH - padding * 2;
      const scale = Math.min(maxW / iw, maxH / ih, 1);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      page.drawImage(img, { x, y, width: drawW, height: drawH });
    }

    setProgress('img2pdf', 97, 'Finalizing...');
    const bytes = await pdfDoc.save();
    setProgress('img2pdf', 100, 'Done!');

    const fname = 'images_combined.pdf';
    const resultEl = document.getElementById('img2pdf-result');
    resultEl.innerHTML = '';
    const item = makeResultItem('🖼️', fname,
      (newName) => downloadBytes(bytes, newName),
      () => showPDFPreview(bytes, fname),
      `${state.img2pdfFiles.length} image(s) combined`
    );
    resultEl.appendChild(item);
    showToast('Images converted to PDF!', 'success');
    setTimeout(() => hideProgress('img2pdf'), 1000);
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    hideProgress('img2pdf');
    console.error(e);
  }
}

// Helper: File to data URL
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: data URL → JPEG bytes via canvas
function dataUrlToJpeg(dataUrl, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
        blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab))).catch(reject);
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Helper: data URL (base64) → Uint8Array (no fetch needed, works on file://)
function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
