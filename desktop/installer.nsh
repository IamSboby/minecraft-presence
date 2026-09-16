!macro customUnInit
  ${ifNot} ${isUpdated}
    ExecWait '"$INSTDIR\Minecraft Presence.exe" --uninstall-cleanup' $0
    ${if} $0 != 0
      Abort
    ${endif}
  ${endif}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Minecraft Presence"
  ${endif}
!macroend
