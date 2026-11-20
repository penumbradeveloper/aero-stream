# Aero Stream - entrada virtual no Linux (mouse, teclado e até 4 controles) pelo /dev/uinput.
# O app do PC inicia este programa e manda comandos de texto, um por linha:
#   KD <evdev> / KU <evdev>      tecla apertada / solta (códigos do Linux)
#   MR <dx> <dy>                 mouse: movimento relativo
#   MA <x> <y>                   mouse: posição absoluta (0 a 32767 na tela toda)
#   MB <b> <0|1>                 botão do mouse (0 esquerdo, 1 meio, 2 direito, 3 voltar, 4 avançar)
#   MW <dx> <dy>                 roda do mouse (passos)
#   P <slot> <botoes> <lx> <ly> <rx> <ry> <lt> <rt>   controle virtual (máscara de 17 bits; analógicos -127..127; gatilhos 0..255)
#   PX <slot>                    remove o controle virtual
#   R                            solta tudo que estiver apertado
# Na primeira linha de saída diz "OK" (conseguiu abrir o /dev/uinput) ou "ERR <motivo>".
# Se o /dev/uinput negar acesso, veja o LEIA-ME (regra do udev). Criado por Ryan Victtor.
import os, sys, struct, fcntl, time, threading, select, glob

UI_SET_EVBIT = 0x40045564
UI_SET_KEYBIT = 0x40045565
UI_SET_RELBIT = 0x40045566
UI_SET_ABSBIT = 0x40045567
UI_DEV_SETUP = 0x405C5503
UI_ABS_SETUP = 0x401C5504
UI_DEV_CREATE = 0x5501
UI_DEV_DESTROY = 0x5502

EV_SYN, EV_KEY, EV_REL, EV_ABS = 0, 1, 2, 3
REL_X, REL_Y, REL_HWHEEL, REL_WHEEL = 0, 1, 6, 8
ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ, ABS_HAT0X, ABS_HAT0Y = 0, 1, 2, 3, 4, 5, 16, 17
BTN_LEFT, BTN_RIGHT, BTN_MIDDLE, BTN_SIDE, BTN_EXTRA = 0x110, 0x111, 0x112, 0x113, 0x114
MOUSE_BTNS = [BTN_LEFT, BTN_MIDDLE, BTN_RIGHT, BTN_SIDE, BTN_EXTRA]  # índice do botão na web -> evdev

# bit do controle (posição "standard" da web) -> botão do Linux (jogo enxerga como Xbox 360)
PAD_BTNS = {0: 0x130, 1: 0x131, 2: 0x133, 3: 0x134, 4: 0x136, 5: 0x137, 8: 0x13A, 9: 0x13B, 10: 0x13D, 11: 0x13E, 16: 0x13C}

EVENTO = 'llHHi'  # struct input_event: timeval (2 long) + tipo + código + valor


def pacote(t, c, v):
    return struct.pack(EVENTO, 0, 0, t, c, v)


SYN = pacote(EV_SYN, 0, 0)


class Dispositivo(object):
    def __init__(self, nome, bus, vendor, product, versao, teclas=(), rels=(), abss=()):
        self.fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
        try:
            if teclas:
                fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_KEY)
                for k in teclas:
                    fcntl.ioctl(self.fd, UI_SET_KEYBIT, k)
            if rels:
                fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_REL)
                for r in rels:
                    fcntl.ioctl(self.fd, UI_SET_RELBIT, r)
            if abss:
                fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_ABS)
                for (a, mn, mx, fuzz, flat) in abss:
                    fcntl.ioctl(self.fd, UI_SET_ABSBIT, a)
                    fcntl.ioctl(self.fd, UI_ABS_SETUP, struct.pack('=H2xiiiiii', a, 0, mn, mx, fuzz, flat, 0))
            nome_b = nome.encode('utf-8')[:79]
            fcntl.ioctl(self.fd, UI_DEV_SETUP, struct.pack('=HHHH80sI', bus, vendor, product, versao, nome_b.ljust(80, b'\0'), 0))
            fcntl.ioctl(self.fd, UI_DEV_CREATE, 0)
        except Exception:
            os.close(self.fd)
            raise
        self.apertadas = set()
        time.sleep(0.12)  # dá tempo do sistema reconhecer o dispositivo novo

    def enviar(self, eventos):
        if eventos:
            os.write(self.fd, b''.join(eventos) + SYN)

    def soltar_tudo(self):
        ev = [pacote(EV_KEY, k, 0) for k in sorted(self.apertadas)]
        self.apertadas.clear()
        try:
            self.enviar(ev)
        except OSError:
            pass

    def destruir(self):
        try:
            self.soltar_tudo()
            fcntl.ioctl(self.fd, UI_DEV_DESTROY)
        except Exception:
            pass
        try:
            os.close(self.fd)
        except Exception:
            pass


class Entrada(object):
    def __init__(self):
        self.teclado = None
        self.mouse = None
        self.ponteiro = None
        self.pads = {}

    def _teclado(self):
        if self.teclado is None:
            self.teclado = Dispositivo('Aero Stream Teclado', 3, 0x1209, 0xAE01, 1, teclas=range(1, 249))
        return self.teclado

    def preparar(self):
        self._teclado()
        self._mouse()

    # ---- teclado ----
    def tecla(self, codigo, baixo):
        if not (1 <= codigo <= 255):
            return
        d = self._teclado()
        if baixo:
            d.apertadas.add(codigo)
        else:
            d.apertadas.discard(codigo)
        d.enviar([pacote(EV_KEY, codigo, 1 if baixo else 0)])

    # ---- mouse relativo (também leva os botões e a roda) ----
    def _mouse(self):
        if self.mouse is None:
            self.mouse = Dispositivo('Aero Stream Mouse', 3, 0x1209, 0xAE02, 1, teclas=MOUSE_BTNS, rels=(REL_X, REL_Y, REL_WHEEL, REL_HWHEEL))
        return self.mouse

    def mover(self, dx, dy):
        if dx or dy:
            ev = []
            if dx:
                ev.append(pacote(EV_REL, REL_X, dx))
            if dy:
                ev.append(pacote(EV_REL, REL_Y, dy))
            self._mouse().enviar(ev)

    def botao(self, b, baixo):
        if not (0 <= b < len(MOUSE_BTNS)):
            return
        d = self._mouse()
        c = MOUSE_BTNS[b]
        if baixo:
            d.apertadas.add(c)
        else:
            d.apertadas.discard(c)
        d.enviar([pacote(EV_KEY, c, 1 if baixo else 0)])

    def roda(self, dx, dy):
        ev = []
        if dy:
            ev.append(pacote(EV_REL, REL_WHEEL, -1 if dy > 0 else 1))  # na web "para baixo" é positivo; no Linux é negativo
        if dx:
            ev.append(pacote(EV_REL, REL_HWHEEL, 1 if dx > 0 else -1))
        if ev:
            self._mouse().enviar(ev)

    # ---- mouse absoluto (cobre a tela inteira) ----
    def absoluto(self, x, y):
        if self.ponteiro is None:
            self.ponteiro = Dispositivo('Aero Stream Ponteiro', 3, 0x1209, 0xAE03, 1, teclas=MOUSE_BTNS, abss=((ABS_X, 0, 32767, 0, 0), (ABS_Y, 0, 32767, 0, 0)))
        x = max(0, min(32767, int(x)))
        y = max(0, min(32767, int(y)))
        self.ponteiro.enviar([pacote(EV_ABS, ABS_X, x), pacote(EV_ABS, ABS_Y, y)])

    # ---- controles (aparecem como "Xbox 360" para os jogos) ----
    def _pad(self, slot):
        p = self.pads.get(slot)
        if p is None:
            d = Dispositivo('Microsoft X-Box 360 pad', 3, 0x045E, 0x028E, 0x0114, teclas=sorted(PAD_BTNS.values()), abss=(
                (ABS_X, -32768, 32767, 16, 128), (ABS_Y, -32768, 32767, 16, 128), (ABS_RX, -32768, 32767, 16, 128), (ABS_RY, -32768, 32767, 16, 128),
                (ABS_Z, 0, 255, 0, 0), (ABS_RZ, 0, 255, 0, 0), (ABS_HAT0X, -1, 1, 0, 0), (ABS_HAT0Y, -1, 1, 0, 0)))
            p = {'d': d, 'b': 0, 'v': {}}
            self.pads[slot] = p
        return p

    def pad(self, slot, b, lx, ly, rx, ry, lt, rt):
        if not (0 <= slot < 4):
            return
        p = self._pad(slot)
        d = p['d']
        ev = []
        antes = p['b']
        for bit, cod in PAD_BTNS.items():
            novo = (b >> bit) & 1
            if novo != ((antes >> bit) & 1):
                ev.append(pacote(EV_KEY, cod, novo))
                if novo:
                    d.apertadas.add(cod)
                else:
                    d.apertadas.discard(cod)
        p['b'] = b

        def esc(v):
            return max(-32767, min(32767, int(round(v * 32767.0 / 127.0))))

        hx = ((b >> 15) & 1) - ((b >> 14) & 1)
        hy = ((b >> 13) & 1) - ((b >> 12) & 1)
        alvo = {ABS_X: esc(lx), ABS_Y: esc(ly), ABS_RX: esc(rx), ABS_RY: esc(ry), ABS_Z: max(0, min(255, int(lt))), ABS_RZ: max(0, min(255, int(rt))), ABS_HAT0X: hx, ABS_HAT0Y: hy}
        for a, v in alvo.items():
            if p['v'].get(a) != v:
                p['v'][a] = v
                ev.append(pacote(EV_ABS, a, v))
        d.enviar(ev)

    def pad_sair(self, slot):
        p = self.pads.pop(slot, None)
        if p:
            p['d'].destruir()

    def soltar_tudo(self):
        for d in (self.teclado, self.mouse, self.ponteiro):
            if d:
                d.soltar_tudo()
        for p in self.pads.values():
            self.pad_zerar(p)

    def pad_zerar(self, p):
        try:
            p['d'].soltar_tudo()
            p['b'] = 0
            ev = [pacote(EV_ABS, a, 0) for a in (ABS_X, ABS_Y, ABS_RX, ABS_RY, ABS_Z, ABS_RZ, ABS_HAT0X, ABS_HAT0Y)]
            p['v'] = {}
            p['d'].enviar(ev)
        except OSError:
            pass

    def fechar(self):
        for d in (self.teclado, self.mouse, self.ponteiro):
            if d:
                d.destruir()
        for p in self.pads.values():
            p['d'].destruir()
        self.pads.clear()
        self.teclado = self.mouse = self.ponteiro = None


def comando(e, partes):
    c = partes[0]
    n = [int(float(x)) for x in partes[1:]]
    if c == 'KD' and len(n) >= 1:
        e.tecla(n[0], True)
    elif c == 'KU' and len(n) >= 1:
        e.tecla(n[0], False)
    elif c == 'MR' and len(n) >= 2:
        e.mover(n[0], n[1])
    elif c == 'MA' and len(n) >= 2:
        e.absoluto(n[0], n[1])
    elif c == 'MB' and len(n) >= 2:
        e.botao(n[0], bool(n[1]))
    elif c == 'MW' and len(n) >= 2:
        e.roda(n[0], n[1])
    elif c == 'P' and len(n) >= 8:
        e.pad(*n[:8])
    elif c == 'PX' and len(n) >= 1:
        e.pad_sair(n[0])
    elif c == 'R':
        e.soltar_tudo()
    elif c == 'PREP':  # cria o teclado e o mouse antes da primeira tecla
        e.preparar()


# ---- o HOST está usando o próprio mouse/teclado? (o host sempre tem prioridade sobre quem controla de longe) ----
# Lê só os aparelhos FÍSICOS (/dev/input/event*): tudo que é virtual (/sys/devices/virtual: os nossos, o controle "Xbox 360" que criamos,
# o teclado virtual do GPU Screen Recorder, do Steam, do KDE Connect...) fica de fora. Antes o "gsr-ui virtual keyboard" reenviava as
# teclas que NÓS injetávamos e o app achava que era o dono digitando: 2 de cada 3 teclas do amigo se perdiam.
# Avisa "HOST" (no máximo 10x/s) quando o mouse anda de verdade (alguns pixels, não a tremida do sensor) ou quando uma tecla do teclado ou
# um botão do mouse é APERTADO. Botões de controle (o controle do dono) e sensores (ABS/SW) não contam.
_saida = threading.Lock()


def vigiar_host():
    fds = {}

    def abrir():
        for f in glob.glob('/dev/input/event*'):
            if f in fds.values():
                continue
            n = f.rsplit('event', 1)[1]
            try:
                with open('/sys/class/input/event%s/device/name' % n) as fn:
                    nome = fn.read().strip()
            except OSError:
                nome = ''
            if nome.startswith('Aero Stream') or '/virtual/' in os.path.realpath('/sys/class/input/event' + n):
                continue
            try:
                fds[os.open(f, os.O_RDONLY | os.O_NONBLOCK)] = f
            except OSError:
                pass  # sem permissão neste aparelho: segue sem ele
    abrir()
    ultimo, varredura = 0.0, time.time()
    andou, andou_t = 0, 0.0  # movimento do mouse somado em 150 ms
    while True:
        if time.time() - varredura > 5:  # mouse ou teclado ligado depois
            abrir()
            varredura = time.time()
        if not fds:
            time.sleep(2)
            continue
        try:
            prontos, _, _ = select.select(list(fds), [], [], 1)
        except (OSError, ValueError):
            for fd in list(fds):
                try:
                    os.fstat(fd)
                except OSError:
                    fds.pop(fd, None)
            continue
        for fd in prontos:
            try:
                dados = os.read(fd, 24 * 64)
            except OSError:
                try:
                    os.close(fd)
                except OSError:
                    pass
                fds.pop(fd, None)
                continue
            for i in range(0, len(dados) - 23, 24):  # input_event: timeval (16) + tipo (H) + código (H) + valor (i)
                tipo, cod, valor = struct.unpack_from('HHi', dados, i + 16)
                conta = False
                if tipo == EV_REL:
                    agora = time.time()
                    if agora - andou_t > 0.15:
                        andou, andou_t = 0, agora
                    andou += abs(valor) if cod in (REL_X, REL_Y) else 4  # roda: um passo já conta
                    conta = andou >= 4
                elif tipo == EV_KEY and valor == 1:
                    conta = 1 <= cod <= 248 or BTN_LEFT <= cod <= 0x117  # teclado e botões do mouse (não os de controle)
                if conta:
                    agora = time.time()
                    if agora - ultimo > 0.1:
                        ultimo = agora
                        with _saida:
                            sys.stdout.write('HOST\n')
                            sys.stdout.flush()
                    break


def principal():
    # teste de acesso: abre e fecha o /dev/uinput sem criar nada
    try:
        os.close(os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK))
    except OSError as ex:
        print('ERR ' + (ex.strerror or str(ex)).replace('\n', ' '), flush=True)
        return 2
    print('OK', flush=True)
    threading.Thread(target=vigiar_host, daemon=True).start()
    e = Entrada()
    try:
        for linha in sys.stdin:
            partes = linha.split()
            if not partes:
                continue
            try:
                comando(e, partes)
            except Exception as ex:  # um comando ruim nunca derruba o auxiliar
                sys.stderr.write('erro: %s\n' % (ex,))
                sys.stderr.flush()
    finally:
        e.fechar()
    return 0


if __name__ == '__main__':
    sys.exit(principal())
