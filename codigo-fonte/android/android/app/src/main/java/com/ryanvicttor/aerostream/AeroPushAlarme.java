package com.ryanvicttor.aerostream;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;

// (0.9.2) com o Aero no fundo ou fechado, o Android acorda este aviso a cada pouco (mesmo com a tela apagada, no ritmo que o sistema
// deixa) e ele pergunta ao servidor se chegou mensagem. Logo depois de sair do app pergunta mais vezes; depois, com mais calma.
public class AeroPushAlarme extends BroadcastReceiver {
    private static final long RAPIDO = 60 * 1000L, CALMO = 4 * 60 * 1000L, JANELA = 30 * 60 * 1000L;

    private static PendingIntent pi(Context ctx) {
        Intent i = new Intent(ctx, AeroPushAlarme.class);
        return PendingIntent.getBroadcast(ctx, 7063, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void agendar(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(AeroPushJob.PREFS, Context.MODE_PRIVATE);
        if (sp.getString("t", "").isEmpty()) return;
        if (sp.getBoolean("fcm", false)) return; // (1.0.3) o push do Google avisa na hora: fica só a checagem de 15 min (economiza bateria)
        long fundo = sp.getLong("fundo", 0), agora = System.currentTimeMillis();
        long espera = fundo > 0 && agora - fundo < JANELA ? RAPIDO : CALMO;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try { am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + espera, pi(ctx)); } catch (Exception e) { /* fica o agendamento de 15 min */ }
    }

    static void cancelar(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pi(ctx));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context ctx = context.getApplicationContext();
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try { AeroPushJob.checar(ctx); } catch (Exception e) { /* tenta na próxima */ }
            if (!AeroNotif.naTela) agendar(ctx);
            pr.finish();
        }).start();
    }
}
