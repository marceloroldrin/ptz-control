# PTZ Control

[![Release](https://img.shields.io/github/v/release/marceloroldrin/ptz-control)](https://github.com/marceloroldrin/ptz-control/releases/latest)
[![Download](https://img.shields.io/badge/download-Windows-blue)](https://marceloroldrin.github.io/ptz-control/)

Painel web / app desktop para controlar câmeras PTZ via **VISCA over IP**, pensado para uso como **Custom Browser Dock** no OBS Studio — sem plugin nativo C++.

**Downloads:** [marceloroldrin.github.io/ptz-control](https://marceloroldrin.github.io/ptz-control/)

## Requisitos

- Node.js 18+ (só para desenvolver / rodar sem o app Electron)
- Câmera com VISCA over IP (UDP, ex. porta 52381) ou VISCA raw over TCP (ex. porta 5678)
- OBS Studio 30+ (opcional)

## Download (recomendado)

1. Abra a [página de downloads](https://marceloroldrin.github.io/ptz-control/)
2. Baixe o instalador **Windows** (`PTZ-Control-Setup-*.exe`) ou o portable
3. Abra o app, configure o IP da câmera em ⚙
4. No OBS (opcional): **Docks → Custom Browser Docks** → `http://127.0.0.1:8765`

> O Windows pode avisar “app desconhecido” (sem certificado de assinatura). Use “Mais informações → Executar assim mesmo” se confiar na origem.

## Desenvolvimento

```bash
npm install
npm start          # só o servidor web
npm run electron   # janela desktop + servidor
```

Abra `http://127.0.0.1:8765` no navegador ou use o dock do OBS.

### Build local

```bash
npm run build:mac    # .dmg / .zip (Mac)
npm run build:win    # .exe (Windows)
npm run build:linux  # AppImage
```

## Releases (CI)

O GitHub Actions gera o instalador Windows ao publicar uma tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Artefatos publicados na [Release](https://github.com/marceloroldrin/ptz-control/releases):
- `PTZ-Control-Setup-<versão>.exe` — instalador NSIS
- `PTZ-Control-Portable-<versão>.exe` — portable

## Usar no OBS (Custom Browser Dock)

1. Inicie o app (`PTZ Control` ou `npm start`) **antes** de abrir o OBS.
2. No OBS: **Docks → Custom Browser Docks...**
3. Adicione um dock:
   - **Dock name:** `PTZ Control`
   - **URL:** `http://127.0.0.1:8765`
4. Clique em **Apply**.

### Controle remoto (tablet/celular na mesma rede)

Altere em `config/cameras.local.json` (ou salve pelo painel):

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8765
  }
}
```

Acesse `http://IP-DO-PC:8765` no tablet.

## Controles

- **Pad direcional:** segure para mover; solte para parar.
- **Zoom +/−:** segure para zoom contínuo; **Stop** para parar.
- **Presets:** **Ir** recalta preset; **Salvar** grava posição atual.
- **⚙ Configurações:** IP, porta, transporte (UDP/TCP) e endereço VISCA (1–7).

Configuração salva:
- **Desenvolvimento:** `config/cameras.local.json`
- **App empacotado (Mac):** `~/Library/Application Support/ptz-control/`
- **App empacotado (Windows):** `%APPDATA%/ptz-control/`

## Transportes VISCA

| Transporte | Uso típico | Porta comum |
|------------|------------|-------------|
| `udp` | VISCA over IP | **52381** |
| `tcp` | VISCA raw | **5678** |

## API

| Método | Rota | Corpo |
|--------|------|-------|
| GET | `/api/config` | — |
| PUT | `/api/config` | config completa |
| POST | `/api/ptz/move` | `{ "dir": "up", "panSpeed": 10, "tiltSpeed": 8 }` |
| POST | `/api/ptz/zoom` | `{ "action": "in" \| "out" \| "stop" }` |
| POST | `/api/ptz/stop` | — |
| POST | `/api/ptz/preset/:id` | `{ "action": "recall" \| "save" }` |

Direções: `up`, `down`, `left`, `right`, `upLeft`, `upRight`, `downLeft`, `downRight`, `stop`.

## Licença

MIT — ver [LICENSE](LICENSE).

## Referências

- [obs-ptz](https://github.com/glikely/obs-ptz) — plugin nativo de referência
- [OBS Studio](https://obsproject.com/)
