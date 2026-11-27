# Aero Stream - (1.0.6) "apertar para falar" no Linux: fica de olho em UMA tecla (ou botão do mouse) nos teclados e mouses de verdade
# (/dev/input/event*) e avisa quando ela é apertada e solta. Funciona em X11 e Wayland, com o Aero em segundo plano.
# Uso: ptt.py <código evdev>. Saída, uma por linha: "OK <aparelhos>" (começou), "PERM" (sem permissão para ler o teclado), "D" (apertou), "U" (soltou).
# Não guarda, não conta e não manda nada das outras teclas: tudo que não é o atalho é ignorado na hora. Criado por Ryan Victtor.
import os, sys, struct, time, select, glob

EV_KEY = 1


def tem_tecla(n, cod):
    # quais teclas/botões o aparelho tem, pelo /sys (dá para ler sem permissão): palavras em hex, a mais alta primeiro
    try:
        with open('/sys/class/input/event%s/device/capabilities/key' % n) as f:
            palavras = f.read().split()
    except OSError:
        return False
    bits = 0
    for p in palavras:
        bits = (bits << 64) | int(p, 16)
    return bool((bits >> cod) & 1)


def principal():
    try:
        alvo = int(sys.argv[1])
    except (IndexError, ValueError):
        print('ERR codigo', flush=True)
        return 2
    fds, negado = {}, [False]

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
                continue  # os nossos aparelhos virtuais e os de outros programas não contam
            if not tem_tecla(n, alvo):
                continue  # este aparelho nem tem a tecla do atalho
            try:
                fds[os.open(f, os.O_RDONLY | os.O_NONBLOCK)] = f
            except PermissionError:
                negado[0] = True  # o teclado de verdade sem permissão: o atalho falharia nele
            except OSError:
                pass
    abrir()
    if negado[0]:
        print('PERM', flush=True)
        return 3
    if not fds:
        print('ERR sem-aparelhos', flush=True)
        return 3
    print('OK %d' % len(fds), flush=True)
    apertado, varredura = False, time.time()
    while True:
        if time.time() - varredura > 5:  # teclado ou mouse ligado depois
            abrir()
            varredura = time.time()
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
            for i in range(0, len(dados) - 23, 24):
                tipo, cod, valor = struct.unpack_from('HHi', dados, i + 16)
                if tipo != EV_KEY or cod != alvo or valor == 2:
                    continue
                agora = valor == 1
                if agora != apertado:
                    apertado = agora
                    sys.stdout.write('D\n' if agora else 'U\n')
                    sys.stdout.flush()


if __name__ == '__main__':
    try:
        sys.exit(principal() or 0)
    except KeyboardInterrupt:
        pass
