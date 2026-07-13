Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root "public"
$purple = [System.Drawing.ColorTranslator]::FromHtml("#6b55c8")
$lime = [System.Drawing.ColorTranslator]::FromHtml("#d9ff74")
$cream = [System.Drawing.ColorTranslator]::FromHtml("#fffdf7")

function New-IconBitmap([int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear($purple)

  $margin = [Math]::Round($size * 0.19)
  $gap = [Math]::Max(2, [Math]::Round($size * 0.055))
  $cell = [Math]::Floor(($size - (2 * $margin) - (2 * $gap)) / 3)
  $radius = [Math]::Max(2, [Math]::Round($cell * 0.22))

  $limeBrush = [System.Drawing.SolidBrush]::new($lime)
  $creamBrush = [System.Drawing.SolidBrush]::new($cream)

  for ($row = 0; $row -lt 3; $row++) {
    for ($column = 0; $column -lt 3; $column++) {
      $x = $margin + ($column * ($cell + $gap))
      $y = $margin + ($row * ($cell + $gap))
      $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
      $diameter = $radius * 2
      $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
      $path.AddArc($x + $cell - $diameter, $y, $diameter, $diameter, 270, 90)
      $path.AddArc($x + $cell - $diameter, $y + $cell - $diameter, $diameter, $diameter, 0, 90)
      $path.AddArc($x, $y + $cell - $diameter, $diameter, $diameter, 90, 90)
      $path.CloseFigure()
      $brush = if ($row -eq $column) { $limeBrush } else { $creamBrush }
      $graphics.FillPath($brush, $path)
      $path.Dispose()
    }
  }

  $limeBrush.Dispose()
  $creamBrush.Dispose()
  $graphics.Dispose()
  return $bitmap
}

$appleIcon = New-IconBitmap 180
$appleIcon.Save((Join-Path $public "apple-touch-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$appleIcon.Dispose()

$favicon = New-IconBitmap 32
$favicon.Save((Join-Path $public "favicon-32x32.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$favicon.Dispose()
