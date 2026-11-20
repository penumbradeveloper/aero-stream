// Aero Stream - prioridade de GPU no Windows enquanto transmite. Criado por Ryan Victtor.
//
// Com um jogo pesado usando ~100% da placa, o Windows dá a vez ao jogo e a captura/codificação da transmissão espera na fila: a tela de
// quem assiste cai de fps sempre que o jogo se mexe (e volta quando pausa). O OBS resolve isso subindo a prioridade de agendamento da GPU
// do próprio processo; aqui é o mesmo: D3DKMTSetProcessSchedulingPriorityClass nos processos do Aero que capturam e codificam.
// "Alta" (4) precisa de administrador em alguns sistemas; sem ela, usa "acima do normal" (3). Nunca "tempo real" (trava o driver da NVIDIA).
//
// (0.8.4) e tira o "modo de eficiência" (EcoQoS) do Windows 11 desses processos enquanto transmite: o próprio Chromium marca os processos dele
// que estão "em segundo plano" (o app atrás do jogo em tela cheia) para rodar devagar, e aí a captura, a codificação e a rede perdiam o ritmo
// (quadros em rajada, o ms subindo). Ao parar (classe 2), o Windows volta a decidir sozinho.
//
// Uso: AeroPrioridade.exe <classe 0-4> <pid> [pid...]   -> imprime "pid:classeAplicada" para cada processo
using System;
using System.Runtime.InteropServices;

static class AeroPrioridade {
  [DllImport("gdi32.dll")] static extern int D3DKMTSetProcessSchedulingPriorityClass(IntPtr processo, int classe);
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint acesso, bool herdar, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] struct PowerThrottling { public uint Version; public uint ControlMask; public uint StateMask; }
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetProcessInformation(IntPtr processo, int classe, ref PowerThrottling info, uint tamanho);
  const int ProcessPowerThrottling = 4;
  const uint EXECUTION_SPEED = 0x1, IGNORE_TIMER_RESOLUTION = 0x4;
  // ligado = true: sem EcoQoS (rápido sempre); false: o Windows decide
  static bool SemEficiencia(IntPtr h, bool ligado) {
    try {
      PowerThrottling p = new PowerThrottling();
      p.Version = 1; p.ControlMask = ligado ? (EXECUTION_SPEED | IGNORE_TIMER_RESOLUTION) : 0; p.StateMask = 0;
      return SetProcessInformation(h, ProcessPowerThrottling, ref p, (uint)Marshal.SizeOf(typeof(PowerThrottling)));
    } catch (Exception) { return false; }
  }
  const uint PROCESS_SET_INFORMATION = 0x0200, PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

  static int Main(string[] args) {
    if (args.Length < 2) { Console.WriteLine("uso: AeroPrioridade <classe> <pid>..."); return 2; }
    int pedida = Math.Max(0, Math.Min(4, int.Parse(args[0])));
    for (int i = 1; i < args.Length; i++) {
      int pid; if (!int.TryParse(args[i], out pid)) continue;
      IntPtr h = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
      if (h == IntPtr.Zero) { Console.WriteLine(pid + ":erro"); continue; }
      int aplicada = -1;
      for (int c = pedida; c >= 2; c--) { if (D3DKMTSetProcessSchedulingPriorityClass(h, c) == 0) { aplicada = c; break; } if (pedida <= 2) break; }
      bool eco = SemEficiencia(h, pedida > 2);
      CloseHandle(h);
      Console.WriteLine(pid + ":" + aplicada + (eco ? "" : ":eco?"));
    }
    return 0;
  }
}
