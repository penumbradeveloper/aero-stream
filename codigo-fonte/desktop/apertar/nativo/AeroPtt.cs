// Aero Stream - (1.0.6) "apertar para falar" no Windows: olha UMA tecla (ou botão do mouse) pelo GetAsyncKeyState e avisa quando ela é
// apertada e solta, com o Aero em segundo plano ou atrás de um jogo. Não é um gancho de teclado: não vê nem guarda nenhuma outra tecla.
// Uso: AeroPtt.exe <código da tecla virtual>. Saída: "OK", depois "D" (apertou) e "U" (soltou). Fecha sozinho quando o Aero fecha.
// Criado por Ryan Victtor.
using System;
using System.Runtime.InteropServices;
using System.Threading;

class AeroPtt {
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vKey);
  static int Main(string[] args) {
    int vk;
    if (args.Length < 1 || !int.TryParse(args[0], out vk) || vk < 1 || vk > 254) { Console.WriteLine("ERR codigo"); return 2; }
    Console.WriteLine("OK"); Console.Out.Flush();
    // o Aero fechou (a entrada padrão fechou): este programa fecha junto
    new Thread(() => { try { while (Console.In.ReadLine() != null) { } } catch { } Environment.Exit(0); }) { IsBackground = true }.Start();
    bool antes = false;
    while (true) {
      bool agora = (GetAsyncKeyState(vk) & 0x8000) != 0;
      if (agora != antes) { antes = agora; Console.WriteLine(agora ? "D" : "U"); Console.Out.Flush(); }
      Thread.Sleep(8);
    }
  }
}
