# Aero Stream - posição do cursor no KDE Plasma (Wayland). No Wayland nenhum programa comum lê onde está o cursor, e a captura de tela do
# KDE nem sempre leva o cursor junto: quem assiste não via o mouse de quem transmite. Aqui fica um serviço pequeno no DBus da sessão; um
# script do KWin (carregado pelo app enquanto transmite) chama "Pos" a cada movimento, e este programa escreve "C <x> <y>" (pixels lógicos
# da área de trabalho) na saída para o app. (O KWin manda inteiros: "Pos" é (ii); "PosD" aceita double.) Usa o GLib/Gio do Python (PyGObject) ou, sem ele, o módulo dbus. Criado por Ryan Victtor.
import sys

NOME = sys.argv[1] if len(sys.argv) > 1 else 'org.aerostream.Cursor'
XML = """<node><interface name="org.aerostream.Cursor"><method name="Pos"><arg type="i" direction="in"/><arg type="i" direction="in"/></method><method name="PosD"><arg type="d" direction="in"/><arg type="d" direction="in"/></method></interface></node>"""


def escrever(x, y):
    try:
        sys.stdout.write('C %d %d\n' % (x, y))
        sys.stdout.flush()
    except Exception:
        sys.exit(0)


def com_gio():
    from gi.repository import Gio, GLib
    no = Gio.DBusNodeInfo.new_for_xml(XML)

    def chamada(con, remetente, caminho, iface, metodo, params, inv):
        if metodo in ('Pos', 'PosD'):
            x, y = params.unpack()
            escrever(int(x), int(y))
        inv.return_value(None)

    def pegou(con, nome):
        con.register_object('/Cursor', no.interfaces[0], chamada, None, None)
        print('OK', flush=True)

    Gio.bus_own_name(Gio.BusType.SESSION, NOME, Gio.BusNameOwnerFlags.NONE, pegou, None, lambda *a: sys.exit(2))
    GLib.MainLoop().run()


def com_dbus():
    import dbus
    import dbus.service
    from dbus.mainloop.glib import DBusGMainLoop
    from gi.repository import GLib
    DBusGMainLoop(set_as_default=True)
    bus = dbus.SessionBus()
    nome = dbus.service.BusName(NOME, bus)

    class Servico(dbus.service.Object):
        @dbus.service.method('org.aerostream.Cursor', in_signature='ii')
        def Pos(self, x, y):
            escrever(int(x), int(y))

    Servico(nome, '/Cursor')
    print('OK', flush=True)
    GLib.MainLoop().run()


if __name__ == '__main__':
    try:
        com_gio()
    except ImportError:
        try:
            com_dbus()
        except ImportError:
            print('ERR sem-dbus', flush=True)
            sys.exit(3)
