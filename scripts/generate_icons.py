"""生成仰止 PWA 图标 — 192x192 和 512x512 PNG"""
from PIL import Image, ImageDraw, ImageFont
import os

SIZES = [192, 512]
BG_COLOR = (26, 26, 46)  # #1a1a2e
ACCENT = (99, 102, 241)  # 紫蓝色
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT_DIR, exist_ok=True)

for size in SIZES:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角矩形背景
    r = size // 5
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=BG_COLOR)

    # 文字 — 用💬emoji，或画一个对话气泡形状
    # 画对话气泡
    margin = size // 5
    bubble_top = margin
    bubble_bottom = size - margin - size // 6
    bubble_left = margin
    bubble_right = size - margin

    # 圆角气泡主体
    b_radius = size // 5
    draw.rounded_rectangle(
        [(bubble_left, bubble_top), (bubble_right, bubble_bottom)],
        radius=b_radius,
        fill=ACCENT
    )

    # 气泡小尾巴（三角形）
    tail_w = size // 5
    tail_h = size // 6
    tail_x = size // 3
    tail_top = bubble_bottom - 2
    draw.polygon([
        (tail_x, tail_top),
        (tail_x + tail_w, tail_top),
        (tail_x + tail_w // 3, tail_top + tail_h),
    ], fill=ACCENT)

    # 内部省略号（...）
    dot_r = size // 20
    dot_y = (bubble_top + bubble_bottom) // 2
    spacing = size // 8
    for i, sx in enumerate([-spacing, 0, spacing]):
        cx = size // 2 + sx
        draw.ellipse(
            [(cx - dot_r, dot_y - dot_r), (cx + dot_r, dot_y + dot_r)],
            fill=(255, 255, 255, 220)
        )

    path = os.path.join(OUT_DIR, f'icon-{size}x{size}.png')
    img.save(path, 'PNG')
    print(f'[OK] {path} ({os.path.getsize(path)} bytes)')

print('Done!')
