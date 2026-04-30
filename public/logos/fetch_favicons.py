#!/usr/bin/env python3
"""
爬取 tools.json 中所有卡片的 favicon 并更新 logo 路径
- 尺寸：128x128
- 格式：PNG + WebP 压缩对比，取较小文件
- 路径：相对于 public/logos/ 目录
"""

import json
import os
import re
import urllib.request
import urllib.error
from urllib.parse import urlparse
from PIL import Image
import io

# 脚本所在目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# tools.json 路径（项目根目录下的 src/data/tools.json）
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
TOOLS_JSON_PATH = os.path.join(PROJECT_ROOT, 'src', 'data', 'tools.json')

# Favicon 获取方式（优先级从高到低）
FAVICON_SOURCES = [
    # Google Favicon API（最可靠，sz=128）
    lambda domain: f'https://www.google.com/s2/favicons?domain={domain}&sz=128',
    # DuckDuckGo Favicon API
    lambda domain: f'https://icons.duckduckgo.com/ip3/{domain}.ico',
    # 直接请求 favicon.ico
    lambda domain: f'https://{domain}/favicon.ico',
]


def extract_domain(url):
    """从 URL 中提取域名"""
    if not url or not url.startswith(('http://', 'https://')):
        return None
    parsed = urlparse(url)
    return parsed.netloc.lower()


def domain_to_filename(domain):
    """将域名转换为文件名（点替换为下划线）"""
    return domain.replace('.', '_')


def compress_to_webp(image_data, quality=80):
    """将图片压缩为 WebP 格式，返回压缩后的数据"""
    try:
        img = Image.open(io.BytesIO(image_data))
        # 转换为 RGBA 模式（支持透明）
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=quality)
        return output.getvalue()
    except Exception as e:
        print(f'    ⚠️ WebP 压缩失败: {e}')
        return None


def download_and_process_favicon(domain, output_dir):
    """下载 favicon 并处理，返回相对路径或 None"""
    filename = domain_to_filename(domain)
    
    # 检查是否已存在
    png_path = os.path.join(output_dir, f'{filename}.png')
    webp_path = os.path.join(output_dir, f'{filename}.webp')
    
    if os.path.exists(png_path) or os.path.exists(webp_path):
        # 选择较小的文件
        files = []
        if os.path.exists(png_path):
            files.append(('.png', png_path, os.path.getsize(png_path)))
        if os.path.exists(webp_path):
            files.append(('.webp', webp_path, os.path.getsize(webp_path)))
        
        if files:
            files.sort(key=lambda x: x[2])
            ext, path, size = files[0]
            print(f'  ✓ 已存在: {filename}{ext} ({size} bytes)')
            return f'/logos/{filename}{ext}'
    
    # 尝试下载
    image_data = None
    for source_idx, favicon_source in enumerate(FAVICON_SOURCES):
        url = favicon_source(domain)
        try:
            print(f'  → 尝试下载 (源{source_idx + 1}): {url}')
            
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            with urllib.request.urlopen(req, timeout=10) as response:
                image_data = response.read()
                print(f'  ✓ 下载成功 ({len(image_data)} bytes)')
                break
                
        except Exception as e:
            print(f'  ✗ 失败: {e}')
            continue
    
    if not image_data:
        return None
    
    # 尝试打开图片
    try:
        img = Image.open(io.BytesIO(image_data))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
    except Exception as e:
        print(f'  ✗ 无法解析图片: {e}')
        return None
    
    # 保存 PNG
    png_output = io.BytesIO()
    img.save(png_output, format='PNG')
    png_data = png_output.getvalue()
    
    # 压缩 WebP
    webp_data = compress_to_webp(image_data, quality=80)
    
    # 对比大小，选择较小的
    if webp_data and len(webp_data) < len(png_data):
        # 使用 WebP
        webp_path = os.path.join(output_dir, f'{filename}.webp')
        with open(webp_path, 'wb') as f:
            f.write(webp_data)
        print(f'  ✓ 保存 WebP: {filename}.webp ({len(webp_data)} bytes)')
        return f'/logos/{filename}.webp'
    else:
        # 使用 PNG
        png_path = os.path.join(output_dir, f'{filename}.png')
        with open(png_path, 'wb') as f:
            f.write(png_data)
        print(f'  ✓ 保存 PNG: {filename}.png ({len(png_data)} bytes)')
        return f'/logos/{filename}.png'


def process_tools_json():
    """处理 tools.json 文件"""
    print(f'读取 {TOOLS_JSON_PATH}...')
    
    with open(TOOLS_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    output_dir = SCRIPT_DIR
    os.makedirs(output_dir, exist_ok=True)
    
    total = 0
    success = 0
    failed = 0
    
    for category in data.get('categories', []):
        category_name = category.get('name', '未知分类')
        print(f'\n📁 分类: {category_name}')
        
        for tool in category.get('tools', []):
            total += 1
            title = tool.get('title', '未知工具')
            link = tool.get('link', '')
            current_logo = tool.get('logo', '')
            
            # 如果已经有本地路径，跳过
            if current_logo and current_logo.startswith('./'):
                print(f'  ⏭️  跳过 (已有本地 logo): {title}')
                continue
            
            if not link:
                print(f'  ⚠️  跳过 (无链接): {title}')
                continue
            
            domain = extract_domain(link)
            if not domain:
                print(f'  ⚠️  跳过 (无效链接): {title} - {link}')
                continue
            
            print(f'\n🔧 {title}')
            print(f'   域名: {domain}')
            
            # 下载并处理 favicon
            relative_path = download_and_process_favicon(domain, output_dir)
            
            if relative_path:
                tool['logo'] = relative_path
                success += 1
            else:
                print(f'  ❌ 所有源都失败，保留原 logo')
                failed += 1
    
    # 保存更新后的 JSON
    print(f'\n\n💾 保存更新后的 {TOOLS_JSON_PATH}...')
    with open(TOOLS_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f'\n✅ 完成！')
    print(f'   总计: {total}')
    print(f'   成功: {success}')
    print(f'   失败: {failed}')


if __name__ == '__main__':
    # 检查依赖
    try:
        from PIL import Image
    except ImportError:
        print('❌ 缺少依赖：Pillow')
        print('请运行: pip install Pillow')
        exit(1)
    
    process_tools_json()
