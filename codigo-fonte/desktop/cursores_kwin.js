// Aero Stream - cursores de quem controla POR CIMA de tudo no KDE Plasma (Wayland), desenhados pelo próprio KWin.
// No Wayland a janela transparente do Electron não fica por cima de tudo nem no lugar certo: aparecia como uma janela a mais (com
// item na barra de tarefas), e uma janela do tamanho da tela por cima do jogo ainda pesava. Aqui um script QML do KWin cria uma camada do
// tipo "aviso na tela" (a mesma dos avisos de volume do Plasma): fica acima até de jogo em tela cheia, deixa todo clique passar e é escondida
// da transmissão (excludeFromCapture). A lista de cursores chega pelo ajudante entrada/camada_kwin.py (DBus da sessão).
// O script só fica carregado enquanto há cursor para mostrar (some 4 s depois do último). Criado por Ryan Victtor.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync, spawn } = require('child_process');

const TITULO = 'Aero Stream Cursores';

// o QML do KWin: busca a lista no DBus (60 vezes por segundo com cursores na tela) e desenha cada cursor com o nome embaixo
function qml(servico) {
  return `import QtQuick
import org.kde.kwin
import org.kde.plasma.core as PlasmaCore

Item {
    id: raiz
    property var area: [0, 0, 0, 0]
    property bool pedindo: false
    property int falhas: 0
    ListModel { id: cursores }

    function aplicar(txt) {
        let d; try { d = JSON.parse(txt); } catch (e) { return; }
        if (d.a && d.a.length === 4 && (d.a[0] !== area[0] || d.a[1] !== area[1] || d.a[2] !== area[2] || d.a[3] !== area[3])) { area = d.a; ajustar.restart(); }
        const vivos = {};
        for (const c of (d.c || [])) {
            vivos[c.id] = true;
            let i = -1; for (let k = 0; k < cursores.count; k++) if (cursores.get(k).cid === c.id) { i = k; break; }
            if (i < 0) cursores.append({ cid: c.id, px: c.x, py: c.y, cor: c.cor, nome: c.nome, ping: c.ping || 0 });
            else { cursores.setProperty(i, 'px', c.x); cursores.setProperty(i, 'py', c.y); cursores.setProperty(i, 'cor', c.cor); cursores.setProperty(i, 'nome', c.nome); cursores.setProperty(i, 'ping', c.ping || 0); }
        }
        for (let k = cursores.count - 1; k >= 0; k--) if (!vivos[cursores.get(k).cid]) cursores.remove(k);
    }

    DBusCall {
        id: chamada
        service: ${JSON.stringify(servico)}; path: "/Camada"; dbusInterface: "org.aerostream.Camada"; method: "Lista"
        onFinished: function (r) { raiz.pedindo = false; raiz.falhas = 0; if (r && r.length) raiz.aplicar(r[0]); }
        onFailed: { raiz.pedindo = false; if (++raiz.falhas > 30) cursores.clear(); }
    }
    Timer { interval: cursores.count ? 16 : 120; running: true; repeat: true; onTriggered: { if (!raiz.pedindo) { raiz.pedindo = true; chamada.call(); } } }

    // a camada: do tamanho da tela compartilhada; escondida da transmissão (quem assiste já vê os cursores no próprio Aero)
    Timer {
        id: ajustar; interval: 60
        onTriggered: {
            for (const w of Workspace.stackingOrder) if (w.caption === ${JSON.stringify(TITULO)}) {
                if ('excludeFromCapture' in w) w.excludeFromCapture = true;
                if (raiz.area[2] > 0) w.frameGeometry = Qt.rect(raiz.area[0], raiz.area[1], raiz.area[2], raiz.area[3]);
            }
        }
    }
    PlasmaCore.Dialog {
        id: camada
        title: ${JSON.stringify(TITULO)}
        type: PlasmaCore.Dialog.OnScreenDisplay
        flags: Qt.WindowTransparentForInput | Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus
        backgroundHints: PlasmaCore.Types.NoBackground
        location: PlasmaCore.Types.Floating
        outputOnly: true
        visible: cursores.count > 0 && raiz.area[2] > 0
        x: raiz.area[0]; y: raiz.area[1]
        onVisibleChanged: if (visible) ajustar.restart()
        mainItem: Item {
            width: Math.max(1, raiz.area[2]); height: Math.max(1, raiz.area[3])
            Repeater {
                model: cursores
                delegate: Item {
                    id: cur
                    x: model.px - 2; y: model.py - 2
                    Behavior on x { NumberAnimation { duration: 40 } }
                    Behavior on y { NumberAnimation { duration: 40 } }
                    property int ultimoPing: 0
                    property string corAtual: model.cor
                    onCorAtualChanged: seta.requestPaint()
                    Rectangle {
                        id: onda; x: -12; y: -12; width: 28; height: 28; radius: 14; color: "transparent"; border.width: 3; border.color: model.cor; opacity: 0
                        ParallelAnimation { id: pulso; NumberAnimation { target: onda; property: "scale"; from: 0.3; to: 1.4; duration: 500 } NumberAnimation { target: onda; property: "opacity"; from: 1; to: 0; duration: 500 } }
                    }
                    Component.onCompleted: ultimoPing = model.ping
                    property int pingAgora: model.ping
                    onPingAgoraChanged: if (pingAgora && pingAgora !== ultimoPing) { ultimoPing = pingAgora; pulso.restart(); }
                    Canvas {
                        id: seta; width: 28; height: 28
                        onPaint: {
                            const g = getContext("2d"); g.reset(); g.scale(26 / 24, 26 / 24);
                            g.beginPath(); g.moveTo(4.2, 2.6); g.lineTo(3, 3.2); g.lineTo(3, 19.8); g.lineTo(4.3, 20.3); g.lineTo(8.4, 16.2); g.lineTo(11.3, 22.8); g.lineTo(12.4, 23.2); g.lineTo(14.8, 22.1); g.lineTo(15.2, 21); g.lineTo(12.3, 14.5); g.lineTo(18, 14.1); g.lineTo(18.4, 12.8); g.closePath();
                            g.fillStyle = cur.corAtual; g.fill(); g.lineWidth = 1.6; g.strokeStyle = "#ffffff"; g.lineJoin = "round"; g.stroke();
                        }
                    }
                    Rectangle {
                        x: 22; y: 20; radius: 10; color: model.cor; width: rotulo.implicitWidth + 18; height: rotulo.implicitHeight + 4
                        Text { id: rotulo; anchors.centerIn: parent; text: model.nome; color: "white"; font.pixelSize: 12; font.weight: Font.DemiBold }
                    }
                }
            }
        }
    }
}
`;
}

function criarCursoresKwin({ pastaTemp, log = () => {}, ajudante } = {}) {
  const pid = process.pid, servico = 'org.aerostream.Camada' + pid, nomeScript = 'aero-camada-' + pid;
  let proc = null, pronto = false, carregado = false, carregando = null, ocioso = 0, falhou = false, serie = 0, pasta = '';
  const dbus = (args, ms = 4000) => new Promise((res) => execFile('gdbus', ['call', '--session', '--dest', 'org.kde.KWin', ...args], { timeout: ms }, (e, out) => res(e ? null : String(out))));

  function iniciarAjudante() {
    if (proc) return;
    let codigo; try { codigo = fs.readFileSync(ajudante, 'utf8'); } catch (e) { falhou = true; return; }
    try { proc = spawn('python3', ['-u', '-c', codigo, servico], { stdio: ['pipe', 'pipe', 'ignore'] }); } catch (e) { proc = null; falhou = true; return; }
    const p = proc;
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d) => { if (/^OK/m.test(d)) pronto = true; if (/^ERR/m.test(d)) { falhou = true; log('camada: ' + String(d).trim()); } });
    p.stdin.on('error', () => {});
    p.on('exit', () => { if (proc === p) { proc = null; pronto = false; } });
  }
  function carregar() {
    if (carregado || carregando) return carregando;
    carregando = (async () => {
      // cada carga numa pasta nova: o KWin guarda o QML já lido pelo caminho do arquivo
      try { if (pasta) fs.rmSync(pasta, { recursive: true, force: true }); } catch (e) { /* ok */ }
      pasta = path.join(pastaTemp, 'aero-camada-' + pid + '-' + (++serie));
      const arq = path.join(pasta, 'contents', 'ui', 'main.qml');
      try { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, qml(servico)); } catch (e) { falhou = true; return false; }
      await dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nomeScript]);
      const saida = await dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.loadDeclarativeScript', arq, nomeScript]);
      const n = saida && (/(-?\d+)/.exec(saida) || [])[1];
      if (!n || +n < 0) { log('camada: o KWin não carregou o script'); falhou = true; return false; }
      const ok = await dbus(['--object-path', '/Scripting/Script' + n, '--method', 'org.kde.kwin.Script.run']);
      carregado = ok !== null;
      if (!carregado) falhou = true;
      return carregado;
    })().finally(() => { carregando = null; });
    return carregando;
  }
  function descarregar() {
    clearTimeout(ocioso);
    if (!carregado) return;
    carregado = false;
    dbus(['--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nomeScript]);
  }
  const escrever = (obj) => { if (proc && proc.stdin.writable) { try { proc.stdin.write('L ' + JSON.stringify(obj) + '\n'); } catch (e) { /* ok */ } } };

  return {
    // false = não deu (sem KWin/PyGObject): o app usa a janela transparente comum
    disponivel: () => !falhou,
    // area: { x, y, width, height } da tela compartilhada (pixels lógicos); lista: [{ id, x, y (0 a 1), cor, nome, ping }]
    mostrar(area, lista) {
      if (falhou) return false;
      iniciarAjudante(); if (falhou) return false;
      const c = lista.map((k) => ({ id: k.id, x: Math.round(k.x * area.width), y: Math.round(k.y * area.height), cor: k.cor, nome: k.nome, ping: k.ping }));
      escrever({ a: [area.x, area.y, area.width, area.height], c });
      clearTimeout(ocioso);
      if (!c.length) { ocioso = setTimeout(descarregar, 4000); return true; }
      if (pronto) carregar(); else setTimeout(() => { if (pronto && !carregado) carregar(); }, 400);
      return true;
    },
    fechar() {
      clearTimeout(ocioso);
      if (carregado) { try { execFileSync('gdbus', ['call', '--session', '--dest', 'org.kde.KWin', '--object-path', '/Scripting', '--method', 'org.kde.kwin.Scripting.unloadScript', nomeScript], { timeout: 1500 }); } catch (e) { /* ok */ } carregado = false; }
      if (proc) { try { proc.kill(); } catch (e) { /* ok */ } proc = null; }
      try { if (pasta) fs.rmSync(pasta, { recursive: true, force: true }); } catch (e) { /* ok */ }
    },
  };
}

module.exports = { criarCursoresKwin, qml };
