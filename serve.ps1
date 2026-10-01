# Servidor HTTP local do jogo (necessário para carregar os modelos 3D). Use o Jogar.bat.
# Uso:  powershell -ExecutionPolicy Bypass -File serve.ps1   ->  http://localhost:8080
# Arquivos grandes (músicas) vão em pedaços de até 1 MB (Range/206), para o servidor nunca ficar preso
# enviando um arquivo inteiro enquanto o navegador pede outras coisas.
param([int]$Port = 8080)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Reinos & Mercadores em http://localhost:$Port  (Ctrl+C para parar)"
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.png'='image/png'; '.json'='application/json'; '.md'='text/markdown; charset=utf-8'; '.gltf'='model/gltf+json'; '.glb'='model/gltf-binary'; '.bin'='application/octet-stream'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.webmanifest'='application/manifest+json'; '.ogg'='audio/ogg'; '.mp3'='audio/mpeg'; '.txt'='text/plain; charset=utf-8' }
$CHUNK = 1048576
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path))
    if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $res = $ctx.Response
      $res.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', $(if ($path -like 'assets/*' -or $path -like 'js/vendor/*') { 'max-age=86400' } else { 'no-store' }))
      $res.Headers.Add('Accept-Ranges', 'bytes')
      $fs = [IO.File]::OpenRead($full)
      try {
        $total = $fs.Length
        $range = $ctx.Request.Headers['Range']
        $start = 0; $end = $total - 1
        if ($range -and $range -match 'bytes=(\d*)-(\d*)') {
          if ($matches[1] -ne '') { $start = [long]$matches[1] }
          if ($matches[2] -ne '') { $end = [Math]::Min([long]$matches[2], $total - 1) }
          # pedaço limitado: o navegador pede o resto depois
          $end = [Math]::Min($end, $start + $CHUNK - 1)
          $res.StatusCode = 206
          $res.Headers.Add('Content-Range', "bytes $start-$end/$total")
        }
        $len = $end - $start + 1
        $res.ContentLength64 = $len
        $fs.Seek($start, 'Begin') | Out-Null
        $buf = New-Object byte[] ([Math]::Min($len, 65536))
        $left = $len
        while ($left -gt 0) {
          $n = $fs.Read($buf, 0, [Math]::Min($buf.Length, $left))
          if ($n -le 0) { break }
          $res.OutputStream.Write($buf, 0, $n)
          $left -= $n
        }
      } finally { $fs.Close() }
    } else { $ctx.Response.StatusCode = 404 }
  } catch {
    # o navegador cancelou o pedido (ex.: trocou de música); segue atendendo os próximos
  }
  try { $ctx.Response.Close() } catch { }
}
