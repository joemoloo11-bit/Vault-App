Add-Type -AssemblyName System.Drawing

$sizes = @(256, 128, 64, 48, 32, 16)
$pngStreams = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # ── Background: dark surface with very subtle radial-ish gradient ──
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(22, 27, 38),    # #161B26  (slightly lighter top)
        [System.Drawing.Color]::FromArgb(13, 17, 23),    # #0D1117  (app background)
        90
    )

    # Rounded square mask (iOS-style radius ~22%)
    $radius = [Math]::Max(2, [int]($size * 0.22))
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $bgPath.AddArc(0, 0, $d, $d, 180, 90)
    $bgPath.AddArc($size - $d, 0, $d, $d, 270, 90)
    $bgPath.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $bgPath.AddArc(0, $size - $d, $d, $d, 90, 90)
    $bgPath.CloseFigure()
    $g.FillPath($bgBrush, $bgPath)

    # ── Subtle inner border for definition on dark taskbars ──
    if ($size -ge 48) {
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 99, 102, 241), [single]([Math]::Max(1, $size * 0.008)))
        $g.DrawPath($borderPen, $bgPath)
        $borderPen.Dispose()
    }

    # ── V letter: bold Arial Black with teal gradient (sleek dark + bold V) ──
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $fontSize = [int]($size * 0.62)
    $font = New-Object System.Drawing.Font("Arial Black", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    # Measure to position precisely
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Build the V as a path so we can fill with a gradient
    $vPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $vPath.AddString(
        "V",
        $font.FontFamily,
        [int]$font.Style,
        [single]$fontSize,
        (New-Object System.Drawing.RectangleF(0, 0, $size, $size)),
        $format
    )

    $vBounds = $vPath.GetBounds()
    $vBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $vBounds,
        [System.Drawing.Color]::FromArgb(255, 94, 234, 212),   # #5EEAD4 (teal-300, bright top)
        [System.Drawing.Color]::FromArgb(255, 13, 148, 136),   # #0D9488 (teal-600, deep apex)
        90
    )
    $g.FillPath($vBrush, $vPath)

    $g.Dispose()
    $bgBrush.Dispose()
    $bgPath.Dispose()
    $vBrush.Dispose()
    $vPath.Dispose()
    $font.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngStreams += ,@{ Size = $size; Bytes = $ms.ToArray() }
    $ms.Dispose()
}

[System.IO.File]::WriteAllBytes("build\icon.png", $pngStreams[0].Bytes)

# Build ICO container with all sizes (PNG-encoded)
$ico = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($ico)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$pngStreams.Count)

$headerSize = 6 + ($pngStreams.Count * 16)
$dataOffset = $headerSize

foreach ($entry in $pngStreams) {
    $size = $entry.Size
    $bytes = $entry.Bytes
    $w = if ($size -ge 256) { 0 } else { $size }
    $h = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$bytes.Length)
    $writer.Write([uint32]$dataOffset)
    $dataOffset += $bytes.Length
}

foreach ($entry in $pngStreams) {
    $writer.Write($entry.Bytes)
}

[System.IO.File]::WriteAllBytes("build\icon.ico", $ico.ToArray())
$writer.Dispose()
$ico.Dispose()

Write-Host "Generated build\icon.ico ($($pngStreams.Count) sizes) and build\icon.png"
