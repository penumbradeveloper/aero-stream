// Aero Stream - entrada virtual no Windows (mouse e teclado via SendInput; controles virtuais via ViGEm, se estiver instalado).
// O app do PC compila este arquivo com o csc.exe que já vem no Windows e manda comandos de texto, um por linha, pela entrada padrão:
//   mr <dx> <dy>          mouse: movimento relativo
//   ma <x> <y>            mouse: posição absoluta, de 0 a 65535 sobre a área virtual de todas as telas
//   mb <b> <0|1>          botão (0 esquerdo, 1 meio, 2 direito, 3 voltar, 4 avançar)
//   mw <dx> <dy>          roda (passos)
//   k <scan> <ext> <0|1>  tecla por scancode
//   kv <vk> <0|1>         tecla por código virtual (Pause)
//   p <slot> <botoes> <lx> <ly> <rx> <ry> <lt> <rt>    controle virtual (precisa do ViGEmBus + ViGEmClient.dll)
//   px <slot>             remove o controle virtual
//   r                     solta tudo
// Primeira linha de saída: "AERO <mouse 0|1> <teclado 0|1> <gamepad 0|1> <motivo>".
// Depois: "HOST" (no máximo 10x/s) quando a pessoa NESTE computador mexe o mouse ou aperta uma tecla de verdade (ganchos de baixo
// nível do Windows; o que este programa injeta vem marcado como "injetado" e não conta). O host sempre tem prioridade.
// Argumento 1 (opcional): caminho do ViGEmClient.dll. Criado por Ryan Victtor.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

static class AeroInput
{
    // ---------------- SendInput ----------------
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)]
    struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public INPUTUNION u; }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr LoadLibrary(string nome);

    const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    const uint MOVE = 0x0001, LEFTDOWN = 0x0002, LEFTUP = 0x0004, RIGHTDOWN = 0x0008, RIGHTUP = 0x0010, MIDDLEDOWN = 0x0020, MIDDLEUP = 0x0040,
               XDOWN = 0x0080, XUP = 0x0100, WHEEL = 0x0800, HWHEEL = 0x1000, VIRTUALDESK = 0x4000, ABSOLUTE = 0x8000;
    const uint KEYUP = 0x0002, EXTENDED = 0x0001, SCANCODE = 0x0008;

    static readonly HashSet<string> teclasApertadas = new HashSet<string>();
    static readonly HashSet<int> botoesApertados = new HashSet<int>();

    static void Enviar(INPUT i) { SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT))); }

    static void Mouse(int dx, int dy, uint dados, uint flags)
    {
        INPUT i = new INPUT(); i.type = INPUT_MOUSE;
        i.u.mi.dx = dx; i.u.mi.dy = dy; i.u.mi.mouseData = dados; i.u.mi.dwFlags = flags; i.u.mi.time = 0; i.u.mi.dwExtraInfo = IntPtr.Zero;
        Enviar(i);
    }

    static void Botao(int b, bool baixo)
    {
        if (baixo) botoesApertados.Add(b); else botoesApertados.Remove(b);
        switch (b)
        {
            case 0: Mouse(0, 0, 0, baixo ? LEFTDOWN : LEFTUP); break;
            case 1: Mouse(0, 0, 0, baixo ? MIDDLEDOWN : MIDDLEUP); break;
            case 2: Mouse(0, 0, 0, baixo ? RIGHTDOWN : RIGHTUP); break;
            case 3: Mouse(0, 0, 1, baixo ? XDOWN : XUP); break;
            case 4: Mouse(0, 0, 2, baixo ? XDOWN : XUP); break;
        }
    }

    static void TeclaScan(int scan, int ext, bool baixo)
    {
        INPUT i = new INPUT(); i.type = INPUT_KEYBOARD;
        i.u.ki.wVk = 0; i.u.ki.wScan = (ushort)scan; i.u.ki.time = 0; i.u.ki.dwExtraInfo = IntPtr.Zero;
        i.u.ki.dwFlags = SCANCODE | (ext != 0 ? EXTENDED : 0) | (baixo ? 0u : KEYUP);
        Enviar(i);
    }

    static void TeclaVirtual(int vk, bool baixo)
    {
        INPUT i = new INPUT(); i.type = INPUT_KEYBOARD;
        i.u.ki.wVk = (ushort)vk; i.u.ki.wScan = 0; i.u.ki.time = 0; i.u.ki.dwExtraInfo = IntPtr.Zero; i.u.ki.dwFlags = baixo ? 0u : KEYUP;
        Enviar(i);
    }

    // ---------------- controles virtuais (ViGEm) ----------------
    [StructLayout(LayoutKind.Sequential)]
    struct XUSB_REPORT { public ushort wButtons; public byte bLeftTrigger; public byte bRightTrigger; public short sThumbLX; public short sThumbLY; public short sThumbRX; public short sThumbRY; }

    static class V
    {
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern IntPtr vigem_alloc();
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern uint vigem_connect(IntPtr client);
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern IntPtr vigem_target_x360_alloc();
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern uint vigem_target_add(IntPtr client, IntPtr target);
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern uint vigem_target_remove(IntPtr client, IntPtr target);
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern void vigem_target_free(IntPtr target);
        [DllImport("ViGEmClient.dll", CallingConvention = CallingConvention.Cdecl)] public static extern uint vigem_target_x360_update(IntPtr client, IntPtr target, XUSB_REPORT report);
    }

    const uint VIGEM_OK = 0x20000000;
    static bool gamepadOk = false;
    static string motivo = "";
    static IntPtr clienteVigem = IntPtr.Zero;
    static readonly IntPtr[] pads = new IntPtr[4];

    static void IniciarVigem(string dll)
    {
        if (string.IsNullOrEmpty(dll) || dll == "-") { motivo = "sem-vigem-dll"; return; }
        try
        {
            if (!File.Exists(dll)) { motivo = "sem-vigem-dll"; return; }
            if (LoadLibrary(dll) == IntPtr.Zero) { motivo = "vigem-dll-invalida"; return; }
            clienteVigem = V.vigem_alloc();
            if (clienteVigem == IntPtr.Zero) { motivo = "vigem-alloc"; return; }
            if (V.vigem_connect(clienteVigem) != VIGEM_OK) { motivo = "sem-vigembus"; return; }
            gamepadOk = true;
        }
        catch (Exception) { motivo = "vigem-erro"; }
    }

    static short Eixo(int v, bool inverter)
    {
        int r = (int)Math.Round(v * 32767.0 / 127.0);
        if (inverter) r = -r;
        if (r > 32767) r = 32767; if (r < -32767) r = -32767;
        return (short)r;
    }

    static void Pad(int slot, int b, int lx, int ly, int rx, int ry, int lt, int rt)
    {
        if (!gamepadOk || slot < 0 || slot > 3) return;
        if (pads[slot] == IntPtr.Zero)
        {
            IntPtr t = V.vigem_target_x360_alloc();
            if (t == IntPtr.Zero) return;
            if (V.vigem_target_add(clienteVigem, t) != VIGEM_OK) { V.vigem_target_free(t); return; }
            pads[slot] = t;
        }
        int xb = 0;
        if ((b & (1 << 12)) != 0) xb |= 0x0001;   // cima
        if ((b & (1 << 13)) != 0) xb |= 0x0002;   // baixo
        if ((b & (1 << 14)) != 0) xb |= 0x0004;   // esquerda
        if ((b & (1 << 15)) != 0) xb |= 0x0008;   // direita
        if ((b & (1 << 9)) != 0) xb |= 0x0010;    // start
        if ((b & (1 << 8)) != 0) xb |= 0x0020;    // back
        if ((b & (1 << 10)) != 0) xb |= 0x0040;   // L3
        if ((b & (1 << 11)) != 0) xb |= 0x0080;   // R3
        if ((b & (1 << 4)) != 0) xb |= 0x0100;    // LB
        if ((b & (1 << 5)) != 0) xb |= 0x0200;    // RB
        if ((b & (1 << 16)) != 0) xb |= 0x0400;   // guia
        if ((b & 1) != 0) xb |= 0x1000;           // A
        if ((b & 2) != 0) xb |= 0x2000;           // B
        if ((b & 4) != 0) xb |= 0x4000;           // X
        if ((b & 8) != 0) xb |= 0x8000;           // Y
        XUSB_REPORT r = new XUSB_REPORT();
        r.wButtons = (ushort)xb;
        r.bLeftTrigger = (byte)Math.Max(0, Math.Min(255, lt));
        r.bRightTrigger = (byte)Math.Max(0, Math.Min(255, rt));
        r.sThumbLX = Eixo(lx, false); r.sThumbLY = Eixo(ly, true);   // no XInput "para cima" é positivo
        r.sThumbRX = Eixo(rx, false); r.sThumbRY = Eixo(ry, true);
        V.vigem_target_x360_update(clienteVigem, pads[slot], r);
    }

    static void PadSair(int slot)
    {
        if (!gamepadOk || slot < 0 || slot > 3 || pads[slot] == IntPtr.Zero) return;
        try { V.vigem_target_remove(clienteVigem, pads[slot]); V.vigem_target_free(pads[slot]); } catch (Exception) { }
        pads[slot] = IntPtr.Zero;
    }

    static void SoltarTudo()
    {
        foreach (int b in new List<int>(botoesApertados)) Botao(b, false);
        foreach (string k in new List<string>(teclasApertadas))
        {
            string[] p = k.Split(':');
            if (p[0] == "s") TeclaScan(int.Parse(p[1], CultureInfo.InvariantCulture), int.Parse(p[2], CultureInfo.InvariantCulture), false);
            else TeclaVirtual(int.Parse(p[1], CultureInfo.InvariantCulture), false);
        }
        teclasApertadas.Clear();
    }

    static int N(string[] p, int i) { return (int)Math.Round(double.Parse(p[i], CultureInfo.InvariantCulture)); }

    static void Comando(string linha)
    {
        string[] p = linha.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (p.Length == 0) return;
        switch (p[0])
        {
            case "mr": if (p.Length >= 3) Mouse(N(p, 1), N(p, 2), 0, MOVE); break;
            case "ma": if (p.Length >= 3) Mouse(N(p, 1), N(p, 2), 0, MOVE | ABSOLUTE | VIRTUALDESK); break;
            case "mb": if (p.Length >= 3) Botao(N(p, 1), N(p, 2) != 0); break;
            case "mw":
                if (p.Length >= 3)
                {
                    int dx = N(p, 1), dy = N(p, 2);
                    if (dy != 0) Mouse(0, 0, unchecked((uint)(dy > 0 ? -120 : 120)), WHEEL);   // na web "para baixo" é positivo
                    if (dx != 0) Mouse(0, 0, unchecked((uint)(dx > 0 ? 120 : -120)), HWHEEL);
                }
                break;
            case "k":
                if (p.Length >= 4)
                {
                    int scan = N(p, 1), ext = N(p, 2); bool baixo = N(p, 3) != 0;
                    string chave = "s:" + scan + ":" + ext;
                    if (baixo) teclasApertadas.Add(chave); else teclasApertadas.Remove(chave);
                    TeclaScan(scan, ext, baixo);
                }
                break;
            case "kv":
                if (p.Length >= 3)
                {
                    int vk = N(p, 1); bool baixo = N(p, 2) != 0;
                    string chave = "v:" + vk;
                    if (baixo) teclasApertadas.Add(chave); else teclasApertadas.Remove(chave);
                    TeclaVirtual(vk, baixo);
                }
                break;
            case "p": if (p.Length >= 9) Pad(N(p, 1), N(p, 2), N(p, 3), N(p, 4), N(p, 5), N(p, 6), N(p, 7), N(p, 8)); break;
            case "px": if (p.Length >= 2) PadSair(N(p, 1)); break;
            case "r": SoltarTudo(); break;
        }
    }

    // ---------------- o host está usando o próprio mouse/teclado? ----------------
    delegate IntPtr GanchoProc(int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int idHook, GanchoProc fn, IntPtr hMod, uint threadId);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern int GetMessage(out MSG msg, IntPtr hWnd, uint min, uint max);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string nome);
    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }
    static GanchoProc ganchoMouse, ganchoTeclado; // guardados: o coletor de lixo não pode levar
    static long ultimoHost = 0;
    static readonly object travaSaida = new object();
    static void AvisarHost()
    {
        long agora = Environment.TickCount;
        if (agora - Interlocked.Read(ref ultimoHost) < 100) return;
        Interlocked.Exchange(ref ultimoHost, agora);
        lock (travaSaida) { try { Console.Out.WriteLine("HOST"); Console.Out.Flush(); } catch (Exception) { } }
    }
    // mouse: movimento só conta a partir de 3 px (a tremida do sensor não tira o controle do amigo); clique e roda contam na hora
    static int ultX = int.MinValue, ultY = int.MinValue;
    static void VigiarHost()
    {
        IntPtr mod = GetModuleHandle(null);
        // MSLLHOOKSTRUCT: pt.x (0), pt.y (4), flags (12): bit 0 = injetado. KBDLLHOOKSTRUCT.flags (deslocamento 8): bit 4 = injetado.
        // (0.6.0) o movimento INJETADO (o do amigo) também atualiza a última posição: antes só o do dono contava, então depois que o amigo
        // levava o cursor para longe, a menor tremida do mouse do dono parecia um salto enorme e tirava o controle dele (e soltava as teclas)
        ganchoMouse = (n, w, l) => {
            if (n >= 0)
            {
                int x = Marshal.ReadInt32(l, 0), y = Marshal.ReadInt32(l, 4);
                if ((Marshal.ReadInt32(l, 12) & 1) != 0) { if ((long)w == 0x200) { ultX = x; ultY = y; } }
                else if ((long)w != 0x200) AvisarHost();
                else if (ultX == int.MinValue || Math.Abs(x - ultX) + Math.Abs(y - ultY) >= 3) { if (ultX != int.MinValue) AvisarHost(); ultX = x; ultY = y; }
            }
            return CallNextHookEx(IntPtr.Zero, n, w, l);
        };
        ganchoTeclado = (n, w, l) => { if (n >= 0 && ((long)w == 0x100 || (long)w == 0x104) && (Marshal.ReadInt32(l, 8) & 0x10) == 0) AvisarHost(); return CallNextHookEx(IntPtr.Zero, n, w, l); };
        SetWindowsHookEx(14, ganchoMouse, mod, 0);    // WH_MOUSE_LL
        SetWindowsHookEx(13, ganchoTeclado, mod, 0);  // WH_KEYBOARD_LL
        MSG msg; while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { } // os ganchos de baixo nível precisam de uma fila de mensagens
    }

    // ---- o jogo prendeu o mouse (mira)? cursor escondido ou preso num retângulo pequeno: avisa "MIRA 1"; voltou ao normal: "MIRA 0" ----
    [StructLayout(LayoutKind.Sequential)] struct PONTO { public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)] struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public PONTO pt; }
    [StructLayout(LayoutKind.Sequential)] struct RETANG { public int l; public int t; public int r; public int b; }
    [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CURSORINFO ci);
    [DllImport("user32.dll")] static extern bool GetClipCursor(out RETANG r);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
    static void VigiarMira()
    {
        int antes = -1;
        while (true)
        {
            int mira = 0;
            try
            {
                CURSORINFO ci = new CURSORINFO(); ci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
                bool escondido = GetCursorInfo(ref ci) && (ci.flags & 1) == 0 && (ci.flags & 2) == 0; // 2 = escondido pelo toque (não é jogo)
                RETANG r; bool preso = false;
                if (GetClipCursor(out r)) { int w = r.r - r.l, h = r.b - r.t, vw = GetSystemMetrics(78), vh = GetSystemMetrics(79); preso = vw > 0 && vh > 0 && (long)w * h < ((long)vw * vh) / 4; }
                mira = escondido || preso ? 1 : 0;
            }
            catch (Exception) { }
            if (mira != antes) { antes = mira; lock (travaSaida) { try { Console.Out.WriteLine("MIRA " + mira); Console.Out.Flush(); } catch (Exception) { } } }
            Thread.Sleep(250);
        }
    }

    static void Main(string[] args)
    {
        IniciarVigem(args.Length > 0 ? args[0] : "-");
        lock (travaSaida) { Console.Out.WriteLine("AERO 1 1 " + (gamepadOk ? "1" : "0") + " " + (motivo.Length > 0 ? motivo : "-")); Console.Out.Flush(); }
        Thread vigia = new Thread(VigiarHost); vigia.IsBackground = true; vigia.Start();
        Thread mira = new Thread(VigiarMira); mira.IsBackground = true; mira.Start();
        string linha;
        try
        {
            while ((linha = Console.In.ReadLine()) != null)
            {
                try { Comando(linha); } catch (Exception) { }
            }
        }
        catch (Exception) { }
        // o app fechou: não deixa nada apertado nem controle ligado
        try { SoltarTudo(); for (int i = 0; i < 4; i++) PadSair(i); } catch (Exception) { }
    }
}
