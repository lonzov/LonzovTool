"""从 public/sprites 的两张字形图生成特殊符号字体 public/fonts/mc-symbols.woff2。

只包含「特殊符号页」列出的那些码点（src/data/glyph-map.json），供 T显 预览做字体回退用 ——
unifont 点阵黑不含私有区码点，缺了它预览里打特殊符号就是豆腐块。

度量规则由 weixinzhe.top 的参考渲染反推（该站渲染与游戏内一致），推导写在下面常量处。
依赖：Python fontTools（pyftsubset 同源）。
"""

import json
import os
import struct
import zlib

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import otTables
from fontTools.ttLib.tables.C_P_A_L_ import Color
from fontTools.ttLib.tables.O_S_2f_2 import Panose
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLYPH_MAP = os.path.join(ROOT, 'src', 'data', 'glyph-map.json')
SPRITES = os.path.join(ROOT, 'public', 'sprites')
DST = os.path.join(ROOT, 'public', 'fonts', 'mc-symbols.woff2')

# ===== 度量规则（字体单位，upem 1000）=====
# 以游戏内实机截图为准标定，锚点是 ASCII "H" 与汉字 "雪"：
#   E0CD 墨迹 ÷ ASCII "H" 墨迹：截图 30÷10 = 3.0；本字体 unifont 的 H 墨迹高 0.625em，
#   故 E0CD 应为 3.0 × 0.625 = 1.875em，对应源图墨迹 15px → 125 单位/源像素。
# 关键点：两张源图在游戏内是**同一个「每源像素」尺度**。截图里 E0CD（源图墨迹 15px）量得
# 30 像素、红心 E10C（源图墨迹 9px）量得约 18 像素，都是 2.0 像素/源像素。二者只差源图格子
# （32px vs 16px），所以手柄符号本身就比物品符号大一倍，不需要给 E0 单独打折。
UNITS_PER_SOURCE_PX = 125
# 实机截图里符号墨迹中心与 ASCII 墨迹中心完全重合（都在基线上方 4.5px）。我们的文字是
# unifont，其 "H" 墨迹中心在基线上方 0.3125em，于是符号中心取其同位。
CENTER_Y = round(1000 * 0.3125)  # 313
# 实机里两个相邻 E0CD 的墨迹连成一片（总宽 60 = 2×30），透明边不参与步进，只留常规间距
ADVANCE_GAP = 125

BLOCKS = [
    {'base': 0xE000, 'file': 'glyph_E0.png', 'cell': 32},
    {'base': 0xE100, 'file': 'glyph_E1.png', 'cell': 16},
]


def read_png(path):
    """极简 PNG 解码，只吃本项目这两张 8 位 RGBA 非隔行图，省掉 Pillow 依赖。"""
    with open(path, 'rb') as fp:
        data = fp.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, width, height = 8, b'', 0, 0
    while pos < len(data):
        (size,) = struct.unpack('>I', data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + size]
        if tag == b'IHDR':
            width, height, depth, ctype, _, _, interlace = struct.unpack('>IIBBBBB', chunk)
            assert depth == 8 and ctype == 6 and interlace == 0, '只支持 8 位 RGBA 非隔行'
        elif tag == b'IDAT':
            idat += chunk
        elif tag == b'IEND':
            break
        pos += 12 + size

    raw = zlib.decompress(idat)
    stride = width * 4
    out = bytearray(height * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(height):
        filt = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        for i in range(stride):
            a = line[i - 4] if i >= 4 else 0
            b = prev[i]
            c = prev[i - 4] if i >= 4 else 0
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
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return width, height, out


def cell_pixels(img, img_width, cell, col, row):
    pixels = {}
    for y in range(cell):
        for x in range(cell):
            i = ((row * cell + y) * img_width + col * cell + x) * 4
            if img[i + 3]:
                pixels[(x, y)] = (img[i], img[i + 1], img[i + 2])
    return pixels


def rects_for(pixels):
    """同色像素按行取游程，再把相邻行里区间相同的游程合并成矩形，减少轮廓数量。"""
    by_color = {}
    for (x, y), color in pixels.items():
        by_color.setdefault(color, {}).setdefault(y, []).append(x)

    out = {}
    for color, rows in by_color.items():
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
        out[color] = [(y0, y1, x0, x1) for y0, y1, (x0, x1) in rects]
    return out


def build_skeleton():
    font = TTFont()
    font.setGlyphOrder(['.notdef'])

    glyf = newTable('glyf')
    glyf.glyphOrder = ['.notdef']
    glyf.glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    font['glyf'] = glyf
    font['loca'] = newTable('loca')  # glyf 编译时写入，缺了它存盘后读不回来

    head = font['head'] = newTable('head')
    head.tableVersion = 1.0
    head.fontRevision = 1.0
    head.checkSumAdjustment = 0
    head.magicNumber = 0x5F0F3CF5
    head.flags = 3
    head.unitsPerEm = 1000
    head.created = head.modified = 0
    head.xMin = head.yMin = head.xMax = head.yMax = 0
    head.macStyle = 0
    head.lowestRecPPEM = 8
    head.fontDirectionHint = 2
    head.indexToLocFormat = 0
    head.glyphDataFormat = 0

    hhea = font['hhea'] = newTable('hhea')
    hhea.tableVersion = 0x00010000
    hhea.ascent, hhea.descent, hhea.lineGap = 800, -200, 0
    hhea.minLeftSideBearing = hhea.minRightSideBearing = hhea.xMaxExtent = 0
    hhea.caretSlopeRise, hhea.caretSlopeRun, hhea.caretOffset = 1, 0, 0
    hhea.reserved0 = hhea.reserved1 = hhea.reserved2 = hhea.reserved3 = 0
    hhea.metricDataFormat = 0

    maxp = font['maxp'] = newTable('maxp')
    maxp.tableVersion = 0x00010000
    # 0.5 版没有这些字段，1.0 版必须全部存在，纯静态字体一律给 0
    for field in ('maxZones', 'maxTwilightPoints', 'maxStorage', 'maxFunctionDefs',
                  'maxInstructionDefs', 'maxStackElements', 'maxSizeOfInstructions',
                  'maxComponentElements', 'maxComponentDepth'):
        setattr(maxp, field, 1 if field == 'maxZones' else 0)

    font['hmtx'] = newTable('hmtx')
    font['hmtx'].metrics = {'.notdef': (0, 0)}

    font['cmap'] = newTable('cmap')
    font['cmap'].tableVersion = 0
    cmap4 = CmapSubtable.newSubtable(4)
    cmap4.platformID, cmap4.platEncID, cmap4.language = 3, 1, 0
    cmap4.cmap = {}
    font['cmap'].tables = [cmap4]

    post = font['post'] = newTable('post')
    post.formatType = 3.0
    post.italicAngle = 0
    post.underlinePosition, post.underlineThickness = -100, 50
    post.isFixedPitch = 0
    post.minMemType42 = post.maxMemType42 = 0
    post.minMemType1 = post.maxMemType1 = 0
    post.glyphOrder = ['.notdef']

    font['name'] = newTable('name')
    for name_id, value in ((1, 'MC Symbols'), (2, 'Regular'), (4, 'MC Symbols'), (6, 'MCSymbols-Regular')):
        font['name'].setName(value, name_id, 3, 1, 0x409)
        font['name'].setName(value, name_id, 1, 0, 0)

    colr = font['COLR'] = newTable('COLR')
    colr.version = 0
    colr.ColorLayers = {}
    cpal = font['CPAL'] = newTable('CPAL')
    cpal.version = 0
    cpal.numPaletteEntries = 0
    cpal.palettes = [[]]
    cpal.paletteTypes = [0]
    cpal.paletteLabels = [0xFFFF]
    cpal.paletteEntryLabels = []
    return font, glyf, cmap4, colr, cpal


def build_os2(font):
    """OS/2 是规范要求的必需表，缺了它浏览器会整份字体拒绝加载，表现就是豆腐块。"""
    os2 = newTable('OS/2')
    os2.version = 1
    os2.usWeightClass, os2.usWidthClass, os2.fsType = 400, 5, 0
    os2.ySubscriptXSize, os2.ySubscriptYSize = 650, 600
    os2.ySubscriptXOffset, os2.ySubscriptYOffset = 0, 75
    os2.ySuperscriptXSize, os2.ySuperscriptYSize = 650, 600
    os2.ySuperscriptXOffset, os2.ySuperscriptYOffset = 0, 350
    os2.yStrikeoutSize, os2.yStrikeoutPosition = 50, 250
    os2.sFamilyClass = 0
    os2.panose = Panose()
    for field in ('bFamilyType', 'bSerifStyle', 'bWeight', 'bProportion', 'bContrast',
                  'bStrokeVariation', 'bArmStyle', 'bLetterForm', 'bMidline', 'bXHeight'):
        setattr(os2.panose, field, 0)
    os2.panose.bFamilyType, os2.panose.bWeight = 2, 5  # 无衬线 + 常规字重
    os2.achVendID = 'LNZV'
    os2.fsSelection = 0x40  # REGULAR
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = 800, -200, 0
    # 符号墨迹上下都会超出普通字身框（符号格有 2em 高），字身框必须按实际轮廓给才不会裁字。
    # 注意不能用 head 的包围盒：那是存盘时才算的，此刻还是 0。
    ymin = ymax = 0
    for glyph in font['glyf'].glyphs.values():
        if glyph.numberOfContours:
            ymin, ymax = min(ymin, glyph.yMin), max(ymax, glyph.yMax)
    os2.usWinAscent = max(800, ymax)
    os2.usWinDescent = max(200, -ymin)
    os2.ulUnicodeRange1 = os2.ulUnicodeRange2 = os2.ulUnicodeRange3 = os2.ulUnicodeRange4 = 0
    os2.ulCodePageRange1 = os2.ulCodePageRange2 = 0
    font['OS/2'] = os2
    os2.recalcAvgCharWidth(font)
    os2.recalcUnicodeRanges(font)
    os2.updateFirstAndLastCharIndex(font)


def main():
    font, glyf, cmap4, colr, cpal = build_skeleton()
    palette = cpal.palettes[0]
    palette_index = {}
    order = ['.notdef']
    metrics = font['hmtx'].metrics

    def color_id(rgb):
        # fontTools 的 Color 字段顺序是 (blue, green, red, alpha)，必须按字段名传
        color = Color(blue=rgb[2], green=rgb[1], red=rgb[0], alpha=255)
        key = tuple(color)
        if key not in palette_index:
            palette_index[key] = len(palette)
            palette.append(color)
        return palette_index[key]

    def add_glyph(name, rects):
        pen = TTGlyphPen(None)
        for x0, y0, x1, y1 in rects:
            pen.moveTo((x0, y0))
            pen.lineTo((x0, y1))
            pen.lineTo((x1, y1))
            pen.lineTo((x1, y0))
            pen.closePath()
        glyph = pen.glyph()
        glyph.recalcBounds(glyf)
        glyf.glyphs[name] = glyph
        order.append(name)
        # 彩色图层字形不占宽；基字形的真实步进在下面覆盖
        metrics[name] = (0, glyph.xMin if glyph.numberOfContours else 0)
        return glyph

    wanted = [int(h, 16) for h in json.load(open(GLYPH_MAP, encoding='utf-8'))['glyphs'] if h != 'a0a']
    images = {}
    for block in BLOCKS:
        images[block['file']] = read_png(os.path.join(SPRITES, block['file']))
        print('  %s: %d×%d, 格 %dpx' % ((block['file'],) + images[block['file']][:2] + (block['cell'],)))

    for cp in wanted:
        block = next(b for b in BLOCKS if b['base'] <= cp < b['base'] + 256)
        img_width, _, img = images[block['file']]
        cell = block['cell']
        index = cp - block['base']
        pixels = cell_pixels(img, img_width, cell, index % 16, index // 16)
        if not pixels:
            raise SystemExit('码点 %04X 的源图格子是空的' % cp)

        scale = UNITS_PER_SOURCE_PX
        xs = [x for x, _ in pixels]
        ys = [y for _, y in pixels]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        # 横向裁掉左右透明边，墨迹左沿贴住落笔点；纵向保留格内位置，墨迹中心对齐 CENTER_Y
        mid_y = (miny + maxy + 1) / 2

        def to_x(px, minx=minx, scale=scale):
            return round((px - minx) * scale)

        def to_y(py, mid_y=mid_y, scale=scale):
            return round(CENTER_Y + (mid_y - py) * scale)

        base_name = 'uni%04X' % cp
        for color, rects in rects_for(pixels).items():
            name = '%s.c%02X%02X%02X' % (base_name, *color)
            add_glyph(name, [(to_x(x0), to_y(y1), to_x(x1), to_y(y0)) for y0, y1, x0, x1 in rects])
            record = otTables.LayerRecord()
            record.name = name
            record.colorID = color_id(color)
            colr.ColorLayers.setdefault(base_name, []).append(record)

        add_glyph(base_name, [])
        colr.ColorLayers[base_name].sort(key=lambda r: r.name)
        metrics[base_name] = (round((maxx - minx + 1) * scale) + ADVANCE_GAP, 0)
        cmap4.cmap[cp] = base_name

    font.setGlyphOrder(order)
    glyf.glyphOrder = order
    font['maxp'].numGlyphs = len(order)
    font['post'].glyphOrder = order
    cpal.numPaletteEntries = len(palette)
    cpal.paletteEntryLabels = [0xFFFF] * len(palette)
    font['hhea'].advanceWidthMax = max(w for w, _ in metrics.values())
    font['hhea'].numberOfHMetrics = len(order)
    build_os2(font)

    merged = os.path.join(ROOT, 'node_modules', '.cache', 'lonzovtool', 'mc-symbols.ttf')
    os.makedirs(os.path.dirname(merged), exist_ok=True)
    # fontTools 默认存盘时把 head.modified 写成当前时间，会让产物每次都不一样，
    # 提交进仓库的二进制就会无谓地变动
    font.recalcTimestamp = False
    font.save(merged)
    print('字形 %d，调色板 %d 色' % (len(order), len(palette)))

    options = subset.Options()
    options.layout_features = []
    options.hinting = False
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables += ['DSIG', 'gasp']
    subsetter = subset.Subsetter(options=options)
    subset_font = subset.load_font(merged, options)
    subsetter.populate(unicodes=wanted)
    subsetter.subset(subset_font)
    subset_font.flavor = 'woff2'
    subset_font.recalcTimestamp = False
    subset_font.save(DST)
    print('输出 %s（%d 字节）' % (DST, os.path.getsize(DST)))


main()
