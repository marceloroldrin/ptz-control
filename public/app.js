const state = {
  config: null,
  activeDir: null,
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function setStatus(message, ok = true) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.dataset.ok = ok ? '1' : '0';
}

function getSpeeds() {
  return {
    panSpeed: Number(document.getElementById('panSpeed').value),
    tiltSpeed: Number(document.getElementById('tiltSpeed').value),
  };
}

async function move(dir) {
  if (dir === 'stop') {
    await api('/api/ptz/stop', { method: 'POST', body: '{}' });
    return;
  }
  await api('/api/ptz/move', {
    method: 'POST',
    body: JSON.stringify({ dir, ...getSpeeds() }),
  });
}

async function zoom(action) {
  await api('/api/ptz/zoom', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

async function preset(id, action = 'recall') {
  await api(`/api/ptz/preset/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

function bindPad() {
  document.querySelectorAll('.pad-btn').forEach((button) => {
    const dir = button.dataset.dir;

    const start = async (event) => {
      event.preventDefault();
      if (state.activeDir === dir) return;
      state.activeDir = dir;
      try {
        await move(dir);
        setStatus(dir === 'stop' ? 'Parado' : `Movendo: ${dir}`);
      } catch (error) {
        setStatus(error.message, false);
      }
    };

    const end = async (event) => {
      event.preventDefault();
      if (state.activeDir !== dir || dir === 'stop') return;
      state.activeDir = null;
      try {
        await move('stop');
        setStatus('Parado');
      } catch (error) {
        setStatus(error.message, false);
      }
    };

    button.addEventListener('mousedown', start);
    button.addEventListener('mouseup', end);
    button.addEventListener('mouseleave', end);
    button.addEventListener('touchstart', start, { passive: false });
    button.addEventListener('touchend', end);
    button.addEventListener('touchcancel', end);
  });
}

function bindZoom() {
  const bindHold = (element, action) => {
    const start = async (event) => {
      event.preventDefault();
      try {
        await zoom(action);
        setStatus(`Zoom: ${action}`);
      } catch (error) {
        setStatus(error.message, false);
      }
    };
    const end = async (event) => {
      event.preventDefault();
      try {
        await zoom('stop');
        setStatus('Zoom parado');
      } catch (error) {
        setStatus(error.message, false);
      }
    };
    element.addEventListener('mousedown', start);
    element.addEventListener('mouseup', end);
    element.addEventListener('mouseleave', end);
    element.addEventListener('touchstart', start, { passive: false });
    element.addEventListener('touchend', end);
  };

  bindHold(document.getElementById('zoomIn'), 'in');
  bindHold(document.getElementById('zoomOut'), 'out');
  document.getElementById('zoomStop').addEventListener('click', () => zoom('stop'));
}

function renderPresets() {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 8; i += 1) {
    const card = document.createElement('div');
    card.className = 'preset-card';

    const label = document.createElement('span');
    label.textContent = `P${i + 1}`;

    const recall = document.createElement('button');
    recall.textContent = 'Ir';
    recall.addEventListener('click', () => preset(i));

    const save = document.createElement('button');
    save.textContent = 'Salvar';
    save.className = 'secondary';
    save.addEventListener('click', () => preset(i, 'save'));

    card.append(label, recall, save);
    grid.appendChild(card);
  }
}

function renderCameras() {
  const select = document.getElementById('cameraSelect');
  select.innerHTML = '';
  state.config.cameras.forEach((camera) => {
    const option = document.createElement('option');
    option.value = camera.id;
    option.textContent = camera.name;
    if (camera.id === state.config.activeCameraId) option.selected = true;
    select.appendChild(option);
  });
  fillSettingsForm();
}

function getActiveCamera() {
  return state.config.cameras.find((camera) => camera.id === state.config.activeCameraId);
}

function fillSettingsForm() {
  const camera = getActiveCamera();
  if (!camera) return;
  const form = document.getElementById('settingsForm');
  form.name.value = camera.name;
  form.host.value = camera.host;
  form.port.value = camera.port;
  form.transport.value = camera.transport;
  form.viscaAddress.value = camera.viscaAddress ?? 1;
}

async function saveConfig() {
  await api('/api/config', {
    method: 'PUT',
    body: JSON.stringify(state.config),
  });
}

async function loadConfig() {
  state.config = await api('/api/config');
  state.config.defaults ??= { panSpeed: 10, tiltSpeed: 8, zoomSpeed: 3 };
  document.getElementById('panSpeed').value = state.config.defaults.panSpeed;
  document.getElementById('tiltSpeed').value = state.config.defaults.tiltSpeed;
  document.getElementById('panSpeedValue').textContent = document.getElementById('panSpeed').value;
  document.getElementById('tiltSpeedValue').textContent = document.getElementById('tiltSpeed').value;
  renderCameras();
  setStatus('Pronto');
}

function bindSettings() {
  document.getElementById('settingsToggle').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.toggle('hidden');
  });

  document.getElementById('cameraSelect').addEventListener('change', async (event) => {
    state.config.activeCameraId = event.target.value;
    fillSettingsForm();
    await saveConfig();
    setStatus(`Câmera: ${getActiveCamera()?.name ?? '?'}`);
  });

  document.getElementById('panSpeed').addEventListener('input', (event) => {
    document.getElementById('panSpeedValue').textContent = event.target.value;
    state.config.defaults.panSpeed = Number(event.target.value);
  });

  document.getElementById('tiltSpeed').addEventListener('input', (event) => {
    document.getElementById('tiltSpeedValue').textContent = event.target.value;
    state.config.defaults.tiltSpeed = Number(event.target.value);
  });

  document.getElementById('settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const camera = getActiveCamera();
    if (!camera) return;
    const form = event.target;
    camera.name = form.name.value.trim();
    camera.host = form.host.value.trim();
    camera.port = Number(form.port.value);
    camera.transport = form.transport.value;
    camera.viscaAddress = Number(form.viscaAddress.value);
    await saveConfig();
    renderCameras();
    setStatus(`Salvo: ${camera.name}`);
  });

  document.getElementById('addCamera').addEventListener('click', async () => {
    const id = `cam${Date.now()}`;
    state.config.cameras.push({
      id,
      name: `Câmera ${state.config.cameras.length + 1}`,
      host: '192.168.1.100',
      port: 52381,
      transport: 'udp',
      viscaAddress: 1,
    });
    state.config.activeCameraId = id;
    await saveConfig();
    renderCameras();
  });
}

async function init() {
  bindPad();
  bindZoom();
  renderPresets();
  bindSettings();
  await loadConfig();
}

init().catch((error) => setStatus(error.message, false));
