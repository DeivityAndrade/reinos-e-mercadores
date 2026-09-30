# Servidor HTTP local do jogo (necessário para carregar os modelos 3D). Use o Jogar.bat.
# Uso:  powershell -ExecutionPolicy Bypass -File serve.ps1   ->  http://localhost:8080
param([int]$Port = 8080)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Reinos & Mercadores em http://localhost:$Port  (Ctrl+C para parar)"
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.png'='image/png'; '.json'='application/json'; '.md'='text/markdown; charset=utf-8'; '.gltf'='model/gltf+json'; '.glb'='model/gltf-binary'; '.bin'='application/octet-stream'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.webmanifest'='application/manifest+json'; '.ogg'='audio/ogg'; '.mp3'='audio/mpeg' }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $root $path
  $full = [IO.Path]::GetFullPath($file)
  if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($full)
    $ext = [IO.Path]::GetExtension($full).ToLower()
    $ctx.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $ctx.Response.Headers.Add('Cache-Control', $(if ($path -like 'assets/*' -or $path -like 'js/vendor/*') { 'max-age=86400' } else { 'no-store' }))
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
