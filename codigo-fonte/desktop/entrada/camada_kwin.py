# Aero Stream - a camada dos cursores de quem controla, no KDE Plasma (Wayland). No Wayland uma janela comum não consegue ficar por cima
# de tudo nem num lugar escolhido (ela virava "mais uma janela" na barra de tarefas). Quem desenha os cursores é um script QML do próprio
# KWin (desktop/cursores_kwin.js), numa camada do tipo "aviso na tela" que fica acima até de jogo em tela cheia e deixa todo clique passar.
# Este ajudante é a ponte: o app escreve a lista de cursores na entrada ("L <json>") e o script do KWin busca a lista mais nova pelo DBus
# da sessão (método "Lista"). Usa o GLib/Gio do Python (PyGObject). Criado por Ryan Victtor.
import sys

NOME = sys.argv[1] if len(sys.argv) > 1 else 'org.aerostream.Camada'
XML = """<node><interface name="org.aerostream.Camada"><method name="Lista"><arg type="s" direction="out"/></method></interface></node>"""
atual = {'json': '{"a":[0,0,0,0],"c":[]}'}


def main():
    from gi.repository import Gio, GLib
    no = Gio.DBusNodeInfo.new_for_xml(XML)

    def chamada(con, remetente, caminho, iface, metodo, params, inv):
        if metodo == 'Lista':
            inv.return_value(GLib.Variant('(s)', (atual['json'],)))
        else:
            inv.return_value(None)

    def pegou(con, nome):
        con.register_object('/Camada', no.interfaces[0], chamada, None, None)
        print('OK', flush=True)

    def entrada(canal, cond):
        if cond & (GLib.IOCondition.HUP | GLib.IOCondition.ERR):
            loop.quit()
            return False
        linha = sys.stdin.readline()
        if not linha:
            loop.quit()
            return False
        if linha.startswith('L '):
            atual['json'] = linha[2:].strip()[:20000]
        return True

    Gio.bus_own_name(Gio.BusType.SESSION, NOME, Gio.BusNameOwnerFlags.NONE, pegou, None, lambda *a: sys.exit(2))
    GLib.io_add_watch(GLib.IOChannel.unix_new(sys.stdin.fileno()), GLib.PRIORITY_DEFAULT, GLib.IOCondition.IN | GLib.IOCondition.HUP | GLib.IOCondition.ERR, entrada)
    loop = GLib.MainLoop()
    loop.run()


if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print('ERR sem-gio', flush=True)
        sys.exit(3)
