Add-Type -AssemblyName System.Drawing

# Draw at 1024 then downscale for crisp edges
$S = 1024
$bmp = New-Object System.Drawing.Bitmap $S, $S
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Flat rounded square
$m = 48; $w = $S - 2 * $m; $r = 230
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($m, $m, $r, $r, 180, 90)
$path.AddArc($m + $w - $r, $m, $r, $r, 270, 90)
$path.AddArc($m + $w - $r, $m + $w - $r, $r, $r, 0, 90)
$path.AddArc($m, $m + $w - $r, $r, $r, 90, 90)
$path.CloseFigure()
$bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 62, 124, 214))
$g.FillPath($bg, $path)

# "M" — left of center, generous padding
$font = New-Object System.Drawing.Font("Segoe UI", 430, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("M", $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(80, 6, 600, $S)), $fmt)

# Thin down arrow — right side, optically aligned with the M
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 58)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$ax = 762
$g.DrawLine($pen, $ax, 372, $ax, 648)
$g.DrawLine($pen, $ax - 96, 556, $ax, 652)
$g.DrawLine($pen, $ax + 96, 556, $ax, 652)

$g.Dispose()

# Downscale to 512 (electron-builder converts to multi-size .ico)
$out = New-Object System.Drawing.Bitmap 512, 512
$g2 = [System.Drawing.Graphics]::FromImage($out)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.DrawImage($bmp, 0, 0, 512, 512)
$g2.Dispose()

$out.Save("$PSScriptRoot\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $out.Dispose()
Write-Output "icon saved"
