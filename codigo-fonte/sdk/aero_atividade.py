"""SDK de atividade do Aero para Python 3 (só a biblioteca padrão). Licença MIT.

    from aero_atividade import AeroAtividade
    aero = AeroAtividade(nome="Meu Jogo")
    aero.definir(details="Fase 3", state="Modo difícil", start=time.time(),
                 large_image="https://i.imgur.com/capa.png", large_text="Meu Jogo")
    ...
    aero.limpar()
    aero.fechar()

Conecta no canal local "aero-ipc-0" (socket em $XDG_RUNTIME_DIR no Linux, pipe \\\\.\\pipe\\aero-ipc-0 no Windows).
Os métodos não levantam erro se o Aero estiver fechado: devolvem False e a atividade é mandada na próxima chamada que conectar.
"""
import json
import os
import struct
import sys
import time

HANDSHAKE, FRAME, CLOSE, PING, PONG = 0, 1, 2, 3, 4


def _caminhos():
    if os.environ.get("AERO_IPC_PATH"):
        return [os.environ["AERO_IPC_PATH"]]
    if sys.platform == "win32":
        return [r"\\.\pipe\aero-ipc-%d" % i for i in range(10)]
    bases = []
    for b in (os.environ.get("XDG_RUNTIME_DIR"), os.environ.get("TMPDIR"), os.environ.get("TMP"), os.environ.get("TEMP"), "/tmp"):
        if b and b not in bases:
            bases.append(b)
    return [os.path.join(b, "aero-ipc-%d" % i) for i in range(10) for b in bases]


class AeroAtividade:
    def __init__(self, nome="", client_id="aero-sdk"):
        self.nome, self.client_id = nome, client_id
        self._canal = None
        self._n = 0
        self._ultima = None

    # ---------- canal ----------
    def _abrir(self):
        for c in _caminhos():
            try:
                if sys.platform == "win32":
                    f = open(c, "r+b", buffering=0)
                    canal = (lambda b, f=f: f.write(b), lambda n, f=f: f.read(n), f.close)
                else:
                    if not os.path.exists(c):
                        continue
                    import socket
                    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                    s.settimeout(3)
                    s.connect(c)
                    canal = (s.sendall, s.recv, s.close)
                self._canal = canal
                self._mandar(HANDSHAKE, {"v": 1, "client_id": self.client_id})
                while True:  # espera o READY (responde PING)
                    op, msg = self._ler()
                    if op == PING:
                        self._mandar(PONG, msg or {})
                    elif op == FRAME and msg and msg.get("evt") == "READY":
                        return True
            except (OSError, ValueError):
                self._fechar_canal()
        return False

    def _fechar_canal(self):
        if self._canal:
            try:
                self._canal[2]()
            except OSError:
                pass
        self._canal = None

    def _mandar(self, op, obj):
        corpo = json.dumps(obj).encode("utf-8")
        self._canal[0](struct.pack("<ii", op, len(corpo)) + corpo)

    def _ler(self):
        def exato(n):
            b = b""
            while len(b) < n:
                p = self._canal[1](n - len(b))
                if not p:
                    raise OSError("fechou")
                b += p
            return b
        op, n = struct.unpack("<ii", exato(8))
        return op, json.loads(exato(n).decode("utf-8") or "null")

    # ---------- uso ----------
    def definir(self, details=None, state=None, start=None, end=None, large_image=None, large_text=None,
                small_image=None, small_text=None, party_size=None, party_max=None, tipo=0, nome=None):
        """start/end: segundos desde 1970 (time.time()). tipo: 0 jogando, 2 ouvindo, 3 assistindo, 5 competindo."""
        a = {"name": nome or self.nome or None, "type": tipo}
        if details: a["details"] = details
        if state: a["state"] = state
        ts = {k: int(v * 1000) for k, v in (("start", start), ("end", end)) if v}
        if ts: a["timestamps"] = ts
        assets = {k: v for k, v in (("large_image", large_image), ("large_text", large_text), ("small_image", small_image), ("small_text", small_text)) if v}
        if assets: a["assets"] = assets
        if party_size is not None and party_max: a["party"] = {"size": [int(party_size), int(party_max)]}
        return self._set({k: v for k, v in a.items() if v is not None})

    def limpar(self):
        return self._set(None)

    def _set(self, atividade):
        self._ultima = atividade
        for _ in range(2):
            if not self._canal and not self._abrir():
                return False
            try:
                self._n += 1
                args = {"pid": os.getpid()}
                if atividade:
                    args["activity"] = atividade
                self._mandar(FRAME, {"cmd": "SET_ACTIVITY", "args": args, "nonce": str(self._n)})
                op, msg = self._ler()
                while op == PING:
                    self._mandar(PONG, msg or {})
                    op, msg = self._ler()
                return True
            except OSError:
                self._fechar_canal()
        return False

    def fechar(self):
        if self._canal:
            try:
                self._mandar(CLOSE, {})
            except OSError:
                pass
        self._fechar_canal()


if __name__ == "__main__":  # teste rápido: python3 aero_atividade.py
    aero = AeroAtividade(nome="Teste do SDK")
    print("conectou" if aero.definir(details="Testando o SDK do Aero", state="Em Python", start=time.time()) else "o Aero não está aberto")
    time.sleep(30)
    aero.fechar()
