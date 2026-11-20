// Aero Stream - áudio por aplicativo no Windows. O app do PC compila este arquivo com o csc.exe que já vem no Windows.
// Comandos (um por execução):
//   AeroAudio.exe list                       lista os aplicativos com sessão de áudio (uma linha de JSON por sessão)
//   AeroAudio.exe vol <exe> <0-100>          volume de todas as sessões do programa (nome do .exe, sem pasta)
//   AeroAudio.exe mute <exe> <0|1>           muda o mudo das sessões do programa
//   AeroAudio.exe icon <caminho do .exe>     ícone do programa em PNG 32x32 (base64)
//   AeroAudio.exe hwnd <numero>              PID dono da janela
//   AeroAudio.exe cap <include|exclude> <pid> <taxa>   captura o som do programa (e dos filhos dele) ou de todos menos ele.
//                                            Primeira linha: "AERO_OK <taxa> 2"; depois, blocos float32 estéreo sem parar.
// A captura por processo usa a API oficial do Windows (ActivateAudioInterfaceAsync com PROCESS_LOOPBACK): modo "só esse processo" desde o Windows 10 2004 (build 19041); o modo "todos menos esse" só no Windows 11 (build 20348+). No Windows 10 o app captura cada programa com som separado (modo incluir).
// Criado por Ryan Victtor.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class AeroAudio
{
    // =============================== COM: sessões de áudio ===============================
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorCom { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr cb);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr cb);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        [PreserveSig] int OpenPropertyStore(int access, out IntPtr props);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2
    {
        [PreserveSig] int GetAudioSessionControl(IntPtr audioSessionGuid, uint streamFlags, out IntPtr sessionControl);
        [PreserveSig] int GetSimpleAudioVolume(IntPtr audioSessionGuid, uint streamFlags, out IntPtr audioVolume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
        [PreserveSig] int RegisterSessionNotification(IntPtr n);
        [PreserveSig] int UnregisterSessionNotification(IntPtr n);
        [PreserveSig] int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionId, IntPtr n);
        [PreserveSig] int UnregisterDuckNotification(IntPtr n);
    }

    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator
    {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
    }

    [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2
    {
        // herdados de IAudioSessionControl (a ordem importa)
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, ref Guid ctx);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid ctx);
        [PreserveSig] int GetGroupingParam(out Guid g);
        [PreserveSig] int SetGroupingParam(ref Guid g, ref Guid ctx);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr n);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr n);
        // próprios de IAudioSessionControl2
        [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetProcessId(out uint pid);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleAudioVolume
    {
        [PreserveSig] int SetMasterVolume(float level, ref Guid ctx);
        [PreserveSig] int GetMasterVolume(out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    // =============================== COM: captura por processo ===============================
    [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioClient
    {
        [PreserveSig] int Initialize(int shareMode, int streamFlags, long hnsBufferDuration, long hnsPeriodicity, IntPtr pFormat, IntPtr audioSessionGuid);
        [PreserveSig] int GetBufferSize(out uint frames);
        [PreserveSig] int GetStreamLatency(out long latency);
        [PreserveSig] int GetCurrentPadding(out uint padding);
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr pFormat, out IntPtr closest);
        [PreserveSig] int GetMixFormat(out IntPtr format);
        [PreserveSig] int GetDevicePeriod(out long padrao, out long minimo);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr eventHandle);
        [PreserveSig] int GetService(ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object ppv);
    }

    [ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioCaptureClient
    {
        [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong devicePosition, out ulong qpcPosition);
        [PreserveSig] int ReleaseBuffer(uint frames);
        [PreserveSig] int GetNextPacketSize(out uint frames);
    }

    [ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IActivateAudioInterfaceAsyncOperation
    {
        [PreserveSig] int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
    }

    [ComImport, Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IActivateAudioInterfaceCompletionHandler
    {
        [PreserveSig] int ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation);
    }

    [ComImport, Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAgileObject { }

    class Handler : IActivateAudioInterfaceCompletionHandler, IAgileObject
    {
        public readonly ManualResetEvent Pronto = new ManualResetEvent(false);
        public IActivateAudioInterfaceAsyncOperation Op;
        public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation op) { Op = op; Pronto.Set(); return 0; }
    }

    [DllImport("Mmdevapi.dll", PreserveSig = true)]
    static extern int ActivateAudioInterfaceAsync([MarshalAs(UnmanagedType.LPWStr)] string deviceInterfacePath, ref Guid riid, IntPtr activationParams,
        IActivateAudioInterfaceCompletionHandler completionHandler, out IActivateAudioInterfaceAsyncOperation activationOperation);

    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateEvent(IntPtr atributos, bool manual, bool inicial, string nome);
    [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr h, uint ms);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);

    // =============================== processos (pai de cada um) ===============================
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    struct PROCESSENTRY32
    {
        public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID; public uint th32ModuleID;
        public uint cntThreads; public uint th32ParentProcessID; public int pcPriClassBase; public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
    }
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto)] static extern bool Process32First(IntPtr snap, ref PROCESSENTRY32 e);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto)] static extern bool Process32Next(IntPtr snap, ref PROCESSENTRY32 e);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    static Dictionary<uint, uint> Pais()
    {
        Dictionary<uint, uint> r = new Dictionary<uint, uint>();
        IntPtr snap = CreateToolhelp32Snapshot(2, 0);
        if (snap == IntPtr.Zero || snap == new IntPtr(-1)) return r;
        try
        {
            PROCESSENTRY32 e = new PROCESSENTRY32();
            e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
            if (Process32First(snap, ref e))
            {
                do { r[e.th32ProcessID] = e.th32ParentProcessID; } while (Process32Next(snap, ref e));
            }
        }
        finally { CloseHandle(snap); }
        return r;
    }

    // =============================== utilidades ===============================
    static string J(string s)
    {
        if (s == null) return "";
        StringBuilder b = new StringBuilder();
        foreach (char c in s)
        {
            if (c == '"') b.Append("\\\""); else if (c == '\\') b.Append("\\\\"); else if (c < 32) b.Append(' '); else b.Append(c);
        }
        return b.ToString();
    }

    static string NomeExe(string caminho) { try { return Path.GetFileName(caminho).ToLowerInvariant(); } catch (Exception) { return ""; } }

    static List<IAudioSessionControl2> Sessoes()
    {
        List<IAudioSessionControl2> r = new List<IAudioSessionControl2>();
        IMMDeviceEnumerator en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
        IMMDevice dev;
        if (en.GetDefaultAudioEndpoint(0, 1, out dev) != 0 || dev == null) return r;   // 0 = saída (render), 1 = multimídia
        Guid iid = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
        object o;
        if (dev.Activate(ref iid, 23, IntPtr.Zero, out o) != 0 || o == null) return r;
        IAudioSessionManager2 mgr = (IAudioSessionManager2)o;
        IAudioSessionEnumerator se;
        if (mgr.GetSessionEnumerator(out se) != 0 || se == null) return r;
        int n; se.GetCount(out n);
        for (int i = 0; i < n; i++)
        {
            IAudioSessionControl2 c;
            if (se.GetSession(i, out c) != 0 || c == null) continue;
            r.Add(c);
        }
        return r;
    }

    static void Listar()
    {
        Dictionary<uint, uint> pais = Pais();
        Dictionary<uint, string[]> cache = new Dictionary<uint, string[]>();
        StringBuilder saida = new StringBuilder();
        foreach (IAudioSessionControl2 c in Sessoes())
        {
            try
            {
                if (c.IsSystemSoundsSession() == 0) continue;
                uint pid; c.GetProcessId(out pid);
                if (pid == 0) continue;
                int estado; c.GetState(out estado);
                if (estado == 2) continue;                                         // expirada
                ISimpleAudioVolume v = (ISimpleAudioVolume)c;
                float vol; bool mudo; v.GetMasterVolume(out vol); v.GetMute(out mudo);
                string[] info;
                if (!cache.TryGetValue(pid, out info))
                {
                    string exe = "", nome = "";
                    try
                    {
                        Process p = Process.GetProcessById((int)pid);
                        nome = p.ProcessName;
                        try { exe = p.MainModule.FileName; } catch (Exception) { }
                        if (exe.Length > 0)
                        {
                            try { string d = FileVersionInfo.GetVersionInfo(exe).FileDescription; if (!string.IsNullOrEmpty(d)) nome = d; } catch (Exception) { }
                        }
                    }
                    catch (Exception) { continue; }
                    info = new string[] { exe, nome };
                    cache[pid] = info;
                }
                uint pai; if (!pais.TryGetValue(pid, out pai)) pai = 0;
                saida.Append("{\"pid\":" + pid + ",\"ppid\":" + pai + ",\"exe\":\"" + J(info[0]) + "\",\"nome\":\"" + J(info[1]) + "\",\"vol\":" +
                    ((int)Math.Round(vol * 100)).ToString(CultureInfo.InvariantCulture) + ",\"mudo\":" + (mudo ? 1 : 0) + ",\"ativo\":" + (estado == 1 ? 1 : 0) + "}\n");
            }
            catch (Exception) { }
        }
        Console.Out.Write(saida.ToString());
        Console.Out.Flush();
    }

    // alvo = nome do .exe (ex.: "spotify.exe")
    static int Ajustar(string alvo, bool volume, float nivel, bool mudo)
    {
        int n = 0;
        string quer = alvo.ToLowerInvariant();
        foreach (IAudioSessionControl2 c in Sessoes())
        {
            try
            {
                if (c.IsSystemSoundsSession() == 0) continue;
                uint pid; c.GetProcessId(out pid);
                if (pid == 0) continue;
                string exe = "";
                try { exe = Process.GetProcessById((int)pid).MainModule.FileName; } catch (Exception) { }
                if (NomeExe(exe) != quer) continue;
                ISimpleAudioVolume v = (ISimpleAudioVolume)c;
                Guid ctx = Guid.Empty;
                if (volume) v.SetMasterVolume(Math.Max(0f, Math.Min(1f, nivel)), ref ctx); else v.SetMute(mudo, ref ctx);
                n++;
            }
            catch (Exception) { }
        }
        return n;
    }

    static void Icone(string caminho)
    {
        try
        {
            using (Icon ic = Icon.ExtractAssociatedIcon(caminho))
            using (Bitmap bmp = new Bitmap(32, 32))
            {
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.Transparent);
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.DrawImage(ic.ToBitmap(), 0, 0, 32, 32);
                }
                using (MemoryStream ms = new MemoryStream())
                {
                    bmp.Save(ms, ImageFormat.Png);
                    Console.Out.WriteLine(Convert.ToBase64String(ms.ToArray()));
                }
            }
        }
        catch (Exception) { Console.Out.WriteLine(""); }
        Console.Out.Flush();
    }

    // =============================== captura por processo ===============================
    static int IniciarCliente(bool incluir, uint pid, int taxa, int flags, out IAudioClient cliente)
    {
        cliente = null;
        IntPtr pParams = Marshal.AllocHGlobal(12);
        IntPtr pv = IntPtr.Zero, pFmt = IntPtr.Zero;
        try
        {
            Marshal.WriteInt32(pParams, 0, 1);                       // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK
            Marshal.WriteInt32(pParams, 4, (int)pid);                // processo alvo
            Marshal.WriteInt32(pParams, 8, incluir ? 0 : 1);         // 0 = só esse processo (e filhos); 1 = todos menos esse
            int tamPv = IntPtr.Size == 8 ? 24 : 16;
            pv = Marshal.AllocHGlobal(tamPv);
            for (int i = 0; i < tamPv; i++) Marshal.WriteByte(pv, i, 0);
            Marshal.WriteInt16(pv, 0, 65);                           // VT_BLOB
            Marshal.WriteInt32(pv, 8, 12);                           // cbSize
            Marshal.WriteIntPtr(pv, IntPtr.Size == 8 ? 16 : 12, pParams);

            Handler h = new Handler();
            IActivateAudioInterfaceAsyncOperation op;
            Guid iidCliente = new Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2");
            int hr = ActivateAudioInterfaceAsync("VAD\\Process_Loopback", ref iidCliente, pv, h, out op);
            if (hr != 0) return hr;
            if (!h.Pronto.WaitOne(8000)) return unchecked((int)0x800705B4);   // tempo esgotado
            int res; object iface;
            hr = h.Op.GetActivateResult(out res, out iface);
            if (hr != 0) return hr;
            if (res != 0 || iface == null) return res != 0 ? res : unchecked((int)0x80004005);
            IAudioClient ac = (IAudioClient)iface;

            pFmt = Marshal.AllocHGlobal(18);                         // WAVEFORMATEX: PCM 16 bits, estéreo
            Marshal.WriteInt16(pFmt, 0, 1);
            Marshal.WriteInt16(pFmt, 2, 2);
            Marshal.WriteInt32(pFmt, 4, taxa);
            Marshal.WriteInt32(pFmt, 8, taxa * 4);
            Marshal.WriteInt16(pFmt, 12, 4);
            Marshal.WriteInt16(pFmt, 14, 16);
            Marshal.WriteInt16(pFmt, 16, 0);
            hr = ac.Initialize(0, flags, 200000, 0, pFmt, IntPtr.Zero);
            if (hr != 0) return hr;
            cliente = ac;
            return 0;
        }
        finally
        {
            if (pFmt != IntPtr.Zero) Marshal.FreeHGlobal(pFmt);
            if (pv != IntPtr.Zero) Marshal.FreeHGlobal(pv);
            Marshal.FreeHGlobal(pParams);
        }
    }

    static int Capturar(bool incluir, uint pid, int taxa)
    {
        // (0.6.4) o Windows 10 recusa algumas combinações (0x88890021 = flag inválida, ex.: NOPERSIST na captura por processo): tenta da mais
        // completa para a mais simples, cada uma num cliente novo (o Initialize só vale uma vez por cliente)
        const int LOOPBACK = 0x00020000, EVENTO = 0x00040000, NOPERSIST = 0x00080000, CONVERTER = unchecked((int)0x80000000) | 0x08000000;
        int[] tentativas = { LOOPBACK | EVENTO | NOPERSIST, LOOPBACK | EVENTO | NOPERSIST | CONVERTER, LOOPBACK | EVENTO, LOOPBACK | EVENTO | CONVERTER, LOOPBACK | CONVERTER, LOOPBACK };
        IAudioClient ac = null; int hr = -1, usadas = 0;
        foreach (int fl in tentativas)
        {
            hr = IniciarCliente(incluir, pid, taxa, fl, out ac);
            if (hr == 0 && ac != null) { usadas = fl; break; }
            ac = null;
        }
        if (hr != 0 || ac == null) { Console.Error.WriteLine("falha 0x" + hr.ToString("X8")); return 2; }

        bool comEvento = (usadas & EVENTO) != 0;
        IntPtr ev = CreateEvent(IntPtr.Zero, false, false, null);
        if (comEvento && (hr = ac.SetEventHandle(ev)) != 0) { Console.Error.WriteLine("evento 0x" + hr.ToString("X8")); return 3; }
        Guid iidCap = new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");
        object oc;
        if ((hr = ac.GetService(ref iidCap, out oc)) != 0 || oc == null) { Console.Error.WriteLine("servico 0x" + hr.ToString("X8")); return 4; }
        IAudioCaptureClient cap = (IAudioCaptureClient)oc;

        Stream so = Console.OpenStandardOutput();
        byte[] cab = Encoding.ASCII.GetBytes("AERO_OK " + taxa + " 2\n");
        so.Write(cab, 0, cab.Length); so.Flush();

        // se o app do PC fechar a entrada, termina junto
        Thread vigia = new Thread(delegate ()
        {
            try { while (Console.In.Read() >= 0) { } } catch (Exception) { }
            Environment.Exit(0);
        });
        vigia.IsBackground = true; vigia.Start();

        if ((hr = ac.Start()) != 0) { Console.Error.WriteLine("iniciar 0x" + hr.ToString("X8")); return 5; }
        byte[] saida = new byte[0];
        while (true)
        {
            WaitForSingleObject(ev, comEvento ? 100u : 10u); // sem evento: lê a cada 10 ms
            uint pacote;
            while (cap.GetNextPacketSize(out pacote) == 0 && pacote > 0)
            {
                IntPtr dados; uint quadros, sinais; ulong p1, p2;
                if (cap.GetBuffer(out dados, out quadros, out sinais, out p1, out p2) != 0) break;
                int bytes = (int)quadros * 4;
                byte[] cru = new byte[bytes];
                if ((sinais & 2) == 0) Marshal.Copy(dados, cru, 0, bytes);   // 2 = silêncio: fica tudo zero
                cap.ReleaseBuffer(quadros);
                int amostras = (int)quadros * 2;
                float[] f = new float[amostras];
                for (int i = 0; i < amostras; i++) f[i] = ((short)(cru[i * 2] | (cru[i * 2 + 1] << 8))) / 32768f;
                if (saida.Length != amostras * 4) saida = new byte[amostras * 4];
                Buffer.BlockCopy(f, 0, saida, 0, saida.Length);
                try { so.Write(saida, 0, saida.Length); so.Flush(); } catch (Exception) { return 0; }   // o app fechou
            }
        }
    }

    [MTAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0) return 1;
            switch (args[0])
            {
                case "list": Listar(); return 0;
                case "vol": return args.Length >= 3 ? (Ajustar(args[1], true, float.Parse(args[2], CultureInfo.InvariantCulture) / 100f, false) > 0 ? 0 : 3) : 1;
                case "mute": return args.Length >= 3 ? (Ajustar(args[1], false, 0f, args[2] == "1") > 0 ? 0 : 3) : 1;
                case "icon": if (args.Length >= 2) Icone(args[1]); return 0;
                case "hwnd":
                    {
                        uint pid; long h = long.Parse(args[1], CultureInfo.InvariantCulture);
                        GetWindowThreadProcessId(new IntPtr(h), out pid);
                        Console.Out.WriteLine(pid); Console.Out.Flush(); return 0;
                    }
                case "cap":
                    if (args.Length < 4) return 1;
                    return Capturar(args[1] == "include", uint.Parse(args[2], CultureInfo.InvariantCulture), int.Parse(args[3], CultureInfo.InvariantCulture));
            }
        }
        catch (Exception e) { Console.Error.WriteLine(e.GetType().Name + ": " + e.Message); return 9; }
        return 1;
    }
}
