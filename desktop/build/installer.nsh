; Désinstallation de l'ancienne application avant d'installer celle-ci.
;
; L'app s'appelait « League of Workouts » et portait un autre identifiant
; (com.leagueofworkouts.desktop). Pour Windows, c'est donc un logiciel
; entièrement distinct : les deux cohabitent, et surtout les deux se disputent
; le port 3099 qui sert à recevoir la session après une connexion Google. La
; première lancée le garde, la seconde attend une réponse qui ne vient jamais.
;
; On retire donc l'ancienne au moment d'installer la nouvelle.

; Clé de désinstallation de l'ancien identifiant, telle que la calcule
; electron-builder (UUID v5 de l'appId).
!define ANCIEN_GUID "{B8B134F7-10E8-5872-9CF5-35C3B161BDC9}"
!define ANCIENNE_CLE "Software\Microsoft\Windows\CurrentVersion\Uninstall\${ANCIEN_GUID}"

!macro desinstallerAncienne RACINE
  ReadRegStr $R8 ${RACINE} "${ANCIENNE_CLE}" "UninstallString"
  ${if} $R8 != ""
    ReadRegStr $R9 ${RACINE} "${ANCIENNE_CLE}" "InstallLocation"
    ; /S = silencieux. L'utilisateur a déjà accepté d'installer ; lui faire
    ; cliquer dans un second assistant serait gratuit.
    ExecWait '$R8 /S _?=$R9'
    ; Le désinstalleur se copie ailleurs pour pouvoir s'effacer : le fichier
    ; d'origine survit à l'opération et doit être retiré à la main.
    Delete "$R8"
    RMDir "$R9"
  ${endif}
!macroend

!macro customInit
  ; L'ancienne app pouvait être installée pour l'utilisateur seul ou pour la
  ; machine entière, selon le choix fait à l'époque : on regarde les deux.
  !insertmacro desinstallerAncienne HKCU
  !insertmacro desinstallerAncienne HKLM
!macroend
