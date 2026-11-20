; Aero Stream - instalador do Windows: instala o ViGEmBus (controles virtuais) se ainda não estiver instalado. Criado por Ryan Victtor.
; O próprio instalador do ViGEmBus pede permissão de administrador (o aviso do Windows aparece uma vez).
!macro customInstall
  nsExec::ExecToStack 'sc query ViGEmBus'
  Pop $0
  ${If} $0 != 0
    IfFileExists "$INSTDIR\resources\vigem\ViGEmBus_setup.exe" 0 +2
      ExecWait '"$INSTDIR\resources\vigem\ViGEmBus_setup.exe" /passive /norestart'
  ${EndIf}
!macroend
