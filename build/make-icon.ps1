# Cleans up logo.png into a crisp, centered, transparent-corner app icon.
# Run with Windows PowerShell 5.1:  powershell.exe -File build\make-icon.ps1
# Paths are derived from $PSScriptRoot (engine-provided) to avoid non-ASCII
# string literals, which PS 5.1 would misread under a non-UTF-8 code page.
Add-Type -AssemblyName System.Drawing

$src = Join-Path (Split-Path $PSScriptRoot -Parent) "logo.png"
$dst = Join-Path $PSScriptRoot "icon.png"
$ico = Join-Path $PSScriptRoot "icon.ico"

$code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public static class IconMaker {
    // A pixel counts as flat background if it is near-white / light-gray
    // (low saturation and bright). The blue/teal border is saturated, so it
    // is never matched and the icon interior stays intact.
    // Background = bright AND low-saturation. The white backdrop (sat ~0) and
    // the blue-tinted drop-shadow (sat <= 30) are both bright and washed out,
    // while the gradient border stays saturated even where it is bright
    // (teal top-right: avg ~196 but sat ~58). The saturation guard protects
    // that teal edge; the brightness guard protects the darker blue border.
    // The fill starts only from the image edge, so the border ring walls off
    // the enclosed interior and the bear line-art.
    static bool IsBg(byte r, byte g, byte b) {
        int mn = Math.Min(r, Math.Min(g, b));
        int mx = Math.Max(r, Math.Max(g, b));
        return (r + g + b) / 3 >= 196 && (mx - mn) <= 40;
    }

    static int bgCount(bool[] bg) {
        int c = 0; for (int i = 0; i < bg.Length; i++) if (bg[i]) c++; return c;
    }

    static System.Drawing.Drawing2D.GraphicsPath RoundedRect(int x, int y, int w, int h, int r) {
        var p = new System.Drawing.Drawing2D.GraphicsPath();
        int d = r * 2;
        p.AddArc(x, y, d, d, 180, 90);
        p.AddArc(x + w - d, y, d, d, 270, 90);
        p.AddArc(x + w - d, y + h - d, d, d, 0, 90);
        p.AddArc(x, y + h - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    public static void Run(byte[] srcBytes, string dst, string icoPath, int outSize, double padFrac) {
        using (var ms = new System.IO.MemoryStream(srcBytes))
        using (var orig = new Bitmap(ms)) {
            int w = orig.Width, h = orig.Height;
            var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp)) g.DrawImage(orig, 0, 0, w, h);

            var data = bmp.LockBits(new Rectangle(0, 0, w, h),
                ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int n = w * h;
            byte[] px = new byte[n * 4];
            System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);

            // Flood fill from every border pixel through background-colored pixels.
            bool[] bg = new bool[n];
            var stack = new Stack<int>();
            Action<int,int> push = (x, y) => {
                if (x < 0 || y < 0 || x >= w || y >= h) return;
                int i = y * w + x;
                if (bg[i]) return;
                int o = i * 4;
                if (IsBg(px[o+2], px[o+1], px[o])) { bg[i] = true; stack.Push(i); }
            };
            for (int x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
            for (int y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
            while (stack.Count > 0) {
                int i = stack.Pop(); int x = i % w, y = i / w;
                push(x-1, y); push(x+1, y); push(x, y-1); push(x, y+1);
                push(x-1,y-1); push(x+1,y-1); push(x-1,y+1); push(x+1,y+1);
            }

            // Make background transparent.
            for (int i = 0; i < n; i++) if (bg[i]) px[i*4+3] = 0;

            // Soften the seam: a kept pixel touching background gets alpha scaled
            // by how far it is from pure white (removes the pale halo fringe).
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int i = y * w + x;
                    if (bg[i]) continue;
                    bool edge = (x>0 && bg[i-1]) || (x<w-1 && bg[i+1]) ||
                                (y>0 && bg[i-w]) || (y<h-1 && bg[i+w]);
                    if (!edge) continue;
                    int o = i * 4;
                    int mn = Math.Min(px[o+2], Math.Min(px[o+1], px[o]));
                    int mx = Math.Max(px[o+2], Math.Max(px[o+1], px[o]));
                    int sat = mx - mn; int avg = (px[o]+px[o+1]+px[o+2])/3;
                    if (sat < 20 && avg > 200) {
                        double a = (255 - avg) / 45.0; if (a < 0) a = 0; if (a > 1) a = 1;
                        px[o+3] = (byte)(px[o+3] * a);
                    }
                }
            }

            System.Runtime.InteropServices.Marshal.Copy(px, 0, data.Scan0, px.Length);
            bmp.UnlockBits(data);

            // Bounds of the rounded square itself: "strong" pixels are the
            // saturated blue/teal border or the dark bear line-art. The faint
            // blue-tinted drop shadow is neither, so it is excluded here and
            // then clipped away by the rounded-rect mask below.
            int sMinX = w, sMinY = h, sMaxX = -1, sMaxY = -1;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int o = (y*w+x)*4;
                    if (px[o+3] < 40) continue;
                    int r2 = px[o+2], g2b = px[o+1], b2 = px[o];
                    int mn2 = Math.Min(r2, Math.Min(g2b, b2));
                    int mx2 = Math.Max(r2, Math.Max(g2b, b2));
                    int avg2 = (r2+g2b+b2)/3;
                    bool strong = (mx2 - mn2) >= 32 || avg2 <= 105;
                    if (strong) {
                        if (x<sMinX) sMinX=x; if (x>sMaxX) sMaxX=x;
                        if (y<sMinY) sMinY=y; if (y>sMaxY) sMaxY=y;
                    }
                }
            }
            Console.Error.WriteLine("size=" + w + "x" + h + " bgPixels=" + bgCount(bg) +
                " squareBox=(" + sMinX + "," + sMinY + ")-(" + sMaxX + "," + sMaxY + ")");
            if (sMaxX < sMinX || sMaxY < sMinY)
                throw new Exception("empty square bbox");

            int cw = sMaxX - sMinX + 1, ch = sMaxY - sMinY + 1;
            int side = Math.Max(cw, ch);
            int pad = (int)Math.Round(side * padFrac);
            int canvas = side + pad * 2;
            // Radius of the square's rounded corners, as a fraction of its side.
            int radius = (int)Math.Round(side * 0.185);
            // Clip exactly at the border's outer edge (strong-pixel bbox) so
            // no drop-shadow leaks past it.
            int grow = 0;

            using (var trimmed = new Bitmap(canvas, canvas, PixelFormat.Format32bppArgb))
            using (var g = Graphics.FromImage(trimmed)) {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;

                int rectX = (canvas - cw) / 2 - grow;
                int rectY = (canvas - ch) / 2 - grow;
                int rectW = cw + grow * 2;
                int rectH = ch + grow * 2;

                using (var clip = RoundedRect(rectX, rectY, rectW, rectH, radius))
                    g.SetClip(clip);

                int dx = (canvas - cw) / 2 - sMinX;
                int dy = (canvas - ch) / 2 - sMinY;
                g.DrawImage(bmp, dx, dy);
                g.ResetClip();

                using (var final = new Bitmap(outSize, outSize, PixelFormat.Format32bppArgb))
                using (var g2 = Graphics.FromImage(final)) {
                    g2.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g2.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                    g2.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                    g2.DrawImage(trimmed, 0, 0, outSize, outSize);
                    final.Save(dst, ImageFormat.Png);
                    if (icoPath != null) WriteIco(final, icoPath);
                }
            }
            bmp.Dispose();
        }
    }

    // Windows multi-resolution .ico. Small sizes are stored as 32-bit BMP
    // (DIB) entries and 256 as a PNG entry — the format the shell reads for
    // file-type icons at every display size.
    static void WriteIco(Bitmap master, string icoPath) {
        int[] sizes = { 16, 24, 32, 48, 64, 128, 256 };
        var images = new System.Collections.Generic.List<byte[]>();
        var dims = new System.Collections.Generic.List<int>();
        foreach (int s in sizes) {
            using (var bm = new Bitmap(s, s, PixelFormat.Format32bppArgb))
            using (var gg = Graphics.FromImage(bm)) {
                gg.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                gg.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                gg.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                gg.DrawImage(master, 0, 0, s, s);
                images.Add(DibForIco(bm)); dims.Add(s);
            }
        }
        using (var fs = new System.IO.FileStream(icoPath, System.IO.FileMode.Create))
        using (var bw = new System.IO.BinaryWriter(fs)) {
            bw.Write((short)0); bw.Write((short)1); bw.Write((short)images.Count);
            int offset = 6 + 16 * images.Count;
            for (int i = 0; i < images.Count; i++) {
                int d = dims[i];
                bw.Write((byte)(d >= 256 ? 0 : d));
                bw.Write((byte)(d >= 256 ? 0 : d));
                bw.Write((byte)0); bw.Write((byte)0);
                bw.Write((short)1); bw.Write((short)32);
                bw.Write(images[i].Length);
                bw.Write(offset);
                offset += images[i].Length;
            }
            foreach (var img in images) bw.Write(img);
        }
    }

    // A 32-bit BMP for an ICO entry: BITMAPINFOHEADER with doubled height
    // (color + AND mask), BGRA rows bottom-up, plus a zeroed AND mask.
    static byte[] DibForIco(Bitmap bm) {
        int w = bm.Width, h = bm.Height;
        var data = bm.LockBits(new Rectangle(0, 0, w, h),
            ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        byte[] px = new byte[w * h * 4];
        System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);
        bm.UnlockBits(data);
        using (var ms = new System.IO.MemoryStream())
        using (var bw = new System.IO.BinaryWriter(ms)) {
            bw.Write(40); bw.Write(w); bw.Write(h * 2);
            bw.Write((short)1); bw.Write((short)32); bw.Write(0);
            bw.Write(w * h * 4); bw.Write(0); bw.Write(0); bw.Write(0); bw.Write(0);
            for (int y = h - 1; y >= 0; y--)
                for (int x = 0; x < w; x++) {
                    int o = (y * w + x) * 4;
                    bw.Write(px[o]); bw.Write(px[o+1]); bw.Write(px[o+2]); bw.Write(px[o+3]);
                }
            int maskRow = ((w + 31) / 32) * 4;
            bw.Write(new byte[maskRow * h]);
            return ms.ToArray();
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing, System.Drawing.Primitives -ErrorAction Stop

# outSize 1024, ~7% padding around the rounded square
$bytes = [System.IO.File]::ReadAllBytes($src)
[IconMaker]::Run($bytes, $dst, $ico, 1024, 0.07)
Write-Output "icon saved -> $dst"
Write-Output "icon saved -> $ico"
