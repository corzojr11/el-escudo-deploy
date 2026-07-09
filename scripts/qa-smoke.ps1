param(
  [string]$Root = 'D:\Proyectos IA\EL ESCUDO'
)

$checklist = Join-Path $Root 'QA_CHECKLIST_EL_ESCUDO.md'
$appRoot = Join-Path $Root 'el-escudo'

Write-Host '=== EL ESCUDO QA SMOKE ==='
if (Test-Path $checklist) {
  Write-Host "Checklist: $checklist"
} else {
  Write-Host "Checklist no encontrado: $checklist"
}

$paths = @(
  'src/navigation/TabNavigator.tsx',
  'src/screens/FinancesScreen.tsx',
  'src/screens/HealthScreen.tsx',
  'src/store/index.ts',
  'src/store/slices/authSlice.ts',
  'src/store/slices/financeSlice.ts',
  'src/store/slices/healthSlice.ts',
  'src/store/slices/projectSlice.ts',
  'src/store/slices/scheduleSlice.ts'
)

Write-Host "\n[1] Archivos clave"
foreach ($p in $paths) {
  $full = Join-Path $appRoot $p
  if (Test-Path $full) { Write-Host "OK  $p" } else { Write-Host "MISS $p" }
}

Write-Host "\n[2] Marcadores de sync"
$markers = @('markDataDirty', '_forceHydrateUntil', '_dirtyDomains', 'hydrateStore')
foreach ($m in $markers) {
  $count = (Get-ChildItem -Path (Join-Path $appRoot 'src') -Recurse -File | Select-String -Pattern $m -SimpleMatch | Measure-Object).Count
  Write-Host "$m => $count"
}

Write-Host "\n[3] TypeScript check (best effort)"
Push-Location $appRoot
try {
  & .\node_modules\.bin\tsc.cmd --noEmit | Out-Host
} catch {
  Write-Host "No se pudo ejecutar tsc: $($_.Exception.Message)"
}
Pop-Location

Write-Host "\nSmoke QA finalizado."
