import dgram from 'node:dgram';
import net from 'node:net';

const PAN_SPEED_MAX = 0x18;
const TILT_SPEED_MAX = 0x14;

const DIRECTIONS = {
  up: { pan: 0x03, tilt: 0x01 },
  down: { pan: 0x03, tilt: 0x02 },
  left: { pan: 0x01, tilt: 0x03 },
  right: { pan: 0x02, tilt: 0x03 },
  upLeft: { pan: 0x01, tilt: 0x01 },
  upRight: { pan: 0x02, tilt: 0x01 },
  downLeft: { pan: 0x01, tilt: 0x02 },
  downRight: { pan: 0x02, tilt: 0x02 },
  stop: { pan: 0x03, tilt: 0x03 },
};

const ZOOM = {
  in: 0x02,
  out: 0x03,
  stop: 0x00,
};

let sequence = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildViscaPayload(address, bytes) {
  const packet = Buffer.from([0x80 + address, ...bytes, 0xff]);
  return packet;
}

function wrapViscaOverIp(payload) {
  const seq = sequence;
  sequence = sequence >= 0xffffffff ? 1 : sequence + 1;

  const frame = Buffer.alloc(10 + payload.length);
  frame.writeUInt16BE(0x0100, 0);
  frame.writeUInt16BE(0x0101, 2);
  frame.writeUInt32BE(seq, 4);
  frame.writeUInt16BE(payload.length, 8);
  payload.copy(frame, 10);
  return frame;
}

function sendUdp(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.send(data, port, host, (error) => {
      socket.close();
      if (error) reject(error);
      else resolve();
    });
  });
}

function sendTcp(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);

    socket.connect(port, host, () => {
      socket.write(data, () => {
        socket.end();
        resolve();
      });
    });

    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`TCP timeout connecting to ${host}:${port}`));
    });
  });
}

async function sendPacket(camera, payload, useEnvelope) {
  const data = useEnvelope ? wrapViscaOverIp(payload) : payload;

  if (camera.transport === 'tcp') {
    await sendTcp(camera.host, camera.port, data);
  } else {
    await sendUdp(camera.host, camera.port, data);
  }
}

function normalizeSpeeds(panSpeed, tiltSpeed) {
  return {
    pan: clamp(Math.round(panSpeed), 1, PAN_SPEED_MAX),
    tilt: clamp(Math.round(tiltSpeed), 1, TILT_SPEED_MAX),
  };
}

export function createViscaClient(camera) {
  const address = camera.viscaAddress ?? 1;
  const useEnvelope = camera.transport === 'udp';

  async function panTilt(direction, panSpeed = 10, tiltSpeed = 8) {
    const dir = DIRECTIONS[direction];
    if (!dir) throw new Error(`Unknown direction: ${direction}`);

    const speeds = normalizeSpeeds(panSpeed, tiltSpeed);
    const payload = buildViscaPayload(address, [
      0x01,
      0x06,
      0x01,
      speeds.pan,
      speeds.tilt,
      dir.pan,
      dir.tilt,
    ]);

    await sendPacket(camera, payload, useEnvelope);
  }

  async function zoom(action, speed = 3) {
    const zoomAction = ZOOM[action];
    if (zoomAction === undefined) throw new Error(`Unknown zoom action: ${action}`);

    const payload = buildViscaPayload(address, [0x01, 0x04, 0x07, zoomAction]);
    await sendPacket(camera, payload, useEnvelope);
  }

  async function stop() {
    await panTilt('stop', 3, 3);
    await zoom('stop');
  }

  async function recallPreset(preset) {
    const id = clamp(Math.round(preset), 0, 255);
    const payload = buildViscaPayload(address, [0x01, 0x04, 0x3f, 0x02, id]);
    await sendPacket(camera, payload, useEnvelope);
  }

  async function savePreset(preset) {
    const id = clamp(Math.round(preset), 0, 255);
    const payload = buildViscaPayload(address, [0x01, 0x04, 0x3f, 0x01, id]);
    await sendPacket(camera, payload, useEnvelope);
  }

  return { panTilt, zoom, stop, recallPreset, savePreset };
}
