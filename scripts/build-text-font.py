"""改写文本字体 public/fonts/unifontdianzhenhei.woff2，让它按游戏内的方式排版。

做两件事：

1. 步进对齐游戏内。游戏内每个字形的步进 = 墨迹宽 + 1 游戏像素（汉字、ASCII、标点都实测如此），
   而 unifont 用的是固定格子步进（半角 512、全角 1024），于是墨迹小的字符会白占一整个格子：
   〉 墨迹 320 却占 1024、。墨迹 256 却占 1024、. 墨迹 128 却占 512。改写后收缩到墨迹宽 + 间距，
   同时把墨迹左边缘对齐到落笔点（游戏内也不留左留白）。

2. 全角段（U+FF00–U+FFFF）的字形直接从游戏自带的字形表 glyph_FF.png 生成，替掉 unifont 的原字形。
   那张表每格 16×16、白色单色蒙版（游戏按文字颜色染色，所以我们也做成单色轮廓、交给 CSS 上色）。

脚本就地覆盖字体文件，且是幂等的：重复执行结果一致。
"""

import os
import struct
import sys
import zlib

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'public', 'fonts', 'unifontdianzhenhei.woff2')


# ===== 度量规则（字体单位，upem 1024）=====
# 实测游戏内截图里那行 38 个前导空格把墨迹推到 x319、各行左边距 x15，即 38 空格 = 304 游戏像素；
# 汉字墨迹 16 游戏像素对应本字体 960 单位 —— 由此定标：1 游戏像素 = 60 单位。
UNIT_PER_GAME_PX = 60

# 步进 = 墨迹宽 + 间距，间距取游戏内汉字的那一档：步进 17.3px − 墨迹 16px = 1.3px ≈ 78 单位。
# 不给 ASCII 单独设更小的值：unifont 的 ASCII 字形比 MC 画得小一圈，统一间距下它们会略窄，
# 逐字符去凑需要游戏内每个字符的宽度表，不值当。
GAP = 78

# 空格单独给步进：游戏内是 8 游戏像素（ASCII 半角格宽）→ 480 单位（0.469em）。
# unifont 原本是半角格 512，只宽 7%。U+3000 是全角空格，游戏内也占满一格，不动它。
SPACE_CODEPOINTS = (0x0020, 0x00A0)
SPACE_ADVANCE = 8 * UNIT_PER_GAME_PX

# 逐字符实测值（游戏内像素，除以 GAME_PX_PER_EM 换算成 em）。
# 「步进 = 墨迹 + 1 像素」这条通则在墨迹大小和 MC 不一致时会有偏差，这几个字符偏差明显、又正好
# 是 T显 分隔线的主体，所以直接钉死。注意 '＝' 虽然名字里有「全角」，游戏内量出来是 0.867em，
# 并非半角 —— 它约等于半角 '=' 的两倍宽，只是两横略高。
GAME_PX_PER_EM = 17.3  # 游戏内汉字步进
MEASURED_GAME_PX = {
    0x003D: 9,    # =   半角等号
    0xFF1D: 15,   # ＝  全角等号
    0x3008: 9,    # 〈
    0x3009: 9,    # 〉
}


# ===== 游戏字形表 =====
# 游戏资源包里 glyph_XX.png 是覆盖整个 BMP 的 225 张表：每张 256×256、16×16 格、每格 16px，
# 格位 = 码点低字节（glyph_FF 的第 3 行第 1 格就是 ＠ U+FF20）。这里只用全角那张。
# 找不到资源包就跳过这一步，沿用已有字形（产物是提交进仓库的，不影响构建）。
GAME_FONT_DIRS = (
    os.environ.get('MC_GLYPH_DIR'),
    r'D:\MCLDownload\MinecraftBENeteasePath\x64_mc\data\resource_packs\vanilla\font',
    os.path.join(os.environ.get('APPDATA', ''), '.minecraft', 'resource_packs', 'vanilla', 'font'),
)
GAME_GLYPH_FILE = 'glyph_FF.png'
GAME_GLYPH_CELL = 16
GAME_GLYPH_SCALE = UNIT_PER_GAME_PX  # 一个源像素 = 1 游戏像素
# 全角字形墨迹占格子 1..13 行，底部留 2 行降部空间 —— 即基线在距格子底 2 像素处
GAME_BASELINE_FROM_BOTTOM = 2


def read_png_mask(path):
    """极简 PNG 解码，返回每像素是否不透明的掩码 —— 字形表只关心这一点。
    支持游戏字形表用的「8 位调色板 + tRNS」和常见的 8 位 RGBA，非隔行。"""
    with open(path, 'rb') as fp:
        data = fp.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'

    pos, idat, width, height, ctype = 8, b'', 0, 0, 0
    palette, trns = b'', b''
    while pos < len(data):
        (size,) = struct.unpack('>I', data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + size]
        if tag == b'IHDR':
            width, height, depth, ctype, _, _, interlace = struct.unpack('>IIBBBBB', chunk)
            assert depth == 8 and ctype in (3, 6) and interlace == 0, '只支持 8 位调色板 / RGBA 非隔行'
        elif tag == b'PLTE':
            palette = chunk
        elif tag == b'tRNS':
            trns = chunk
        elif tag == b'IDAT':
            idat += chunk
        elif tag == b'IEND':
            break
        pos += 12 + size

    channels = 1 if ctype == 3 else 4
    stride = width * channels
    raw = zlib.decompress(idat)
    lines = []
    prev = bytearray(stride)
    p = 0
    for _ in range(height):
        filt = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if filt == 1:
                line[i] = (line[i] + a) & 0xFF
            elif filt == 2:
                line[i] = (line[i] + b) & 0xFF
            elif filt == 3:
                line[i] = (line[i] + ((a + b) >> 1)) & 0xFF
            elif filt == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        lines.append(line)
        prev = line

    mask = bytearray(width * height)
    for y, line in enumerate(lines):
        base = y * width
        if ctype == 3:
            for x in range(width):
                index = line[x]
                mask[base + x] = trns[index] if index < len(trns) else 255
        else:
            for x in range(width):
                mask[base + x] = line[x * 4 + 3]
    return width, height, mask


def load_game_sheet():
    for directory in GAME_FONT_DIRS:
        if not directory:
            continue
        path = os.path.join(directory, GAME_GLYPH_FILE)
        if os.path.exists(path):
            print('[text-font] 全角字形来源: %s' % path)
            return read_png_mask(path)
    return None


def rects_for(pixels):
    """把像素按行取游程、再纵向合并成矩形，减少轮廓数量。"""
    rows = {}
    for (x, y) in pixels:
        rows.setdefault(y, []).append(x)

    runs = {}
    for y, xs in rows.items():
        xs.sort()
        merged, start, prev = [], xs[0], xs[0]
        for x in xs[1:]:
            if x != prev + 1:
                merged.append((start, prev + 1))
                start = x
            prev = x
        merged.append((start, prev + 1))
        runs[y] = merged

    rects = []
    for y in sorted(runs):
        for run in runs[y]:
            for rect in reversed(rects):
                if rect[1] == y and rect[2] == run:
                    rect[1] = y + 1
                    break
            else:
                rects.append([y, y + 1, run])
    return [(y0, y1, x0, x1) for y0, y1, (x0, x1) in rects]


def build_glyph(rects, scale, cell_bottom_y):
    pen = TTGlyphPen(None)
    for y0, y1, x0, x1 in rects:
        left, right = x0 * scale, x1 * scale
        bottom, top = cell_bottom_y + (GAME_GLYPH_CELL - y1) * scale, cell_bottom_y + (GAME_GLYPH_CELL - y0) * scale
        pen.moveTo((left, bottom))
        pen.lineTo((left, top))
        pen.lineTo((right, top))
        pen.lineTo((right, bottom))
        pen.closePath()
    return pen.glyph()


def bake_game_glyphs(font, glyf, metrics, cmap, gap):
    """用游戏自带的字形表替换全角段（U+FF00–U+FFFF）的字形。"""
    sheet = load_game_sheet()
    if sheet is None:
        print('[text-font] 未找到游戏字形表，跳过全角段字形替换')
        return 0

    width, _, mask = sheet
    cell = GAME_GLYPH_CELL
    scale = GAME_GLYPH_SCALE
    cell_bottom_y = -GAME_BASELINE_FROM_BOTTOM * scale
    order = font.getGlyphOrder()

    baked = 0
    for index in range(256):
        cp = 0xFF00 + index
        # U+FFFE / U+FFFF 是非字符，表里那两格装的是表格自带的文字标签而不是字形。
        # 更要紧的是 cmap 格式 4 拿 0xFFFF 当终止标记，给它建映射会让整张子表结构非法，
        # 浏览器 OTS 会因此拒收整个字体。早先的版本写进去过，所以这里要主动清掉、保证自愈。
        if cp >= 0xFFFE:
            for table in font['cmap'].tables:
                table.cmap.pop(cp, None)
            continue
        col, row = index % 16, index // 16
        pixels = [
            (x, y)
            for y in range(cell)
            for x in range(cell)
            if mask[(row * cell + y) * width + col * cell + x]
        ]
        if not pixels:
            continue

        name = cmap.get(cp) or ('uni%04X' % cp)
        rects = rects_for(pixels)
        x_min = min(x0 for _, _, x0, _ in rects)
        # 与其它字形同样处理：墨迹左沿对齐落笔点，步进 = 墨迹宽 + 间距
        glyph = build_glyph(
            [(y0, y1, x0 - x_min, x1 - x_min) for y0, y1, x0, x1 in rects], scale, cell_bottom_y
        )
        glyph.recalcBounds(glyf)
        glyf[name] = glyph
        if name not in order:
            order.append(name)
        metrics[name] = (glyph.xMax - glyph.xMin + gap, 0)
        for table in font['cmap'].tables:
            if table.isUnicode():
                table.cmap[cp] = name
        baked += 1

    font.setGlyphOrder(order)
    glyf.glyphOrder = order
    return baked


def main():
    font = TTFont(FONT)
    upem = font['head'].unitsPerEm
    glyf = font['glyf']
    metrics = font['hmtx'].metrics
    order = font.getGlyphOrder()

    shifted = 0
    resized = 0
    for name in order:
        glyph = glyf[name]
        if glyph.numberOfContours == 0:
            continue  # 空格等无墨迹字形保留原步进，否则词间距会塌掉

        x_min = glyph.xMin
        if x_min:
            glyph.coordinates.translate((-x_min, 0))
            glyph.recalcBounds(glyf)
            shifted += 1

        advance = glyph.xMax - glyph.xMin + GAP
        if advance != metrics[name][0]:
            metrics[name] = (advance, 0)
            resized += 1

    cmap = font.getBestCmap()
    for cp in SPACE_CODEPOINTS:
        name = cmap.get(cp)
        if name:
            metrics[name] = (SPACE_ADVANCE, 0)
    baked = bake_game_glyphs(font, glyf, metrics, cmap, GAP)

    # 实测值最后应用：全角段换字形会重算步进，而实测值是最可信的（直接来自游戏内截图）
    for cp, px in MEASURED_GAME_PX.items():
        name = cmap.get(cp)
        if name:
            metrics[name] = (round(px / GAME_PX_PER_EM * upem), 0)

    font['maxp'].numGlyphs = len(glyf.glyphOrder)
    font['hhea'].numberOfHMetrics = len(glyf.glyphOrder)
    # fontTools 默认存盘时把 head.modified 写成当前时间，会让产物每次都不一样
    font.recalcTimestamp = False
    # 先写临时文件再原子替换：dev server 正在跑的时候原地覆盖，浏览器可能读到半截文件并缓存下来
    temp = FONT + '.tmp'
    font.save(temp)
    os.replace(temp, FONT)
    print('[text-font] 字形 %d，平移 %d，步进改写 %d，全角替换 %d，间距 %d 单位 → %s'
          % (len(glyf.glyphOrder), shifted, resized, baked, GAP, FONT))


if __name__ == '__main__':
    sys.exit(main())
