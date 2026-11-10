#!/usr/bin/env python3
"""
词汇闪卡配图下载脚本
====================

用途：
  从 OpenMoji 开源项目（CC BY-SA 4.0）下载彩色插画 SVG，
  按 data/content.json 里 vocab 分类的英文单词重命名，
  保存到 images/vocab/<word>.svg，供词卡页面展示。

依赖：
  仅使用 Python 标准库（urllib），无需额外安装。

运行方式：
  python3 scripts/download_vocab_images.py

重新运行：
  默认跳过已存在的图片文件（增量下载）。使用 --force 强制重新下载全部。

内容更新后：
  如果 data/content.json 的 vocab 中新增了单词，请先在下面的
  WORD_TO_CODEPOINT 字典里补充该单词对应的 Unicode 表情符号编码
  （可在 https://openmoji.org/library/ 搜索单词找到对应编码），
  然后重新运行本脚本。
"""

import argparse
import os
import sys
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(PROJECT_ROOT, "images", "vocab")

OPENMOJI_BASE = "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg"

# word -> OpenMoji 文件名（Unicode codepoint，十六进制，多码点用 "-" 连接）
WORD_TO_CODEPOINT = {
    # Animals 动物
    "cat": "1F408", "dog": "1F415", "duck": "1F986", "bird": "1F426",
    "fish": "1F420", "bear": "1F43B", "rabbit": "1F407", "monkey": "1F412",
    "elephant": "1F418", "pig": "1F416", "cow": "1F404", "horse": "1F40E",
    # Zoo Animals 动物园
    "lion": "1F981", "tiger": "1F405", "giraffe": "1F992", "zebra": "1F993",
    "panda": "1F43C", "kangaroo": "1F998", "hippo": "1F99B", "crocodile": "1F40A",
    "penguin": "1F427", "camel": "1F42A", "wolf": "1F43A", "fox": "1F98A",
    # Food 食物
    "apple": "1F34E", "banana": "1F34C", "egg": "1F95A", "milk": "1F95B",
    "rice": "1F35A", "noodle": "1F35C", "bread": "1F35E", "water": "1F4A7",
    "cake": "1F370", "cookie": "1F36A", "carrot": "1F955", "yogurt": "1F36E",
    # Body 身体
    "head": "1F9E0", "hair": "1F9B1", "eye": "1F441", "nose": "1F443",
    "mouth": "1F444", "ear": "1F442", "hand": "270B", "foot": "1F9B6",
    "tummy": "1FAC3", "finger": "1F446", "tooth": "1F9B7", "knee": "1F9B5",
    # Home 家居
    "door": "1F6AA", "window": "1FA9F", "chair": "1FA91", "table": "1F6CB",
    "bed": "1F6CF", "lamp": "1F4A1", "cup": "2615", "box": "1F4E6",
    "book": "1F4D6", "ball": "26BD", "shoe": "1F45F", "key": "1F511",
    # Actions 动作
    "eat": "1F37D", "drink": "1F964", "sleep": "1F634", "run": "1F3C3",
    "jump": "1F938", "walk": "1F6B6", "clap": "1F44F", "hug": "1F917",
    "kiss": "1F48B", "sit": "1F4BA", "stand": "1F9CD", "wash": "1F9FC",
    # Colors 颜色
    "red": "1F534", "blue": "1F535", "yellow": "1F7E1", "green": "1F7E2",
    "orange": "1F7E0", "purple": "1F7E3", "pink": "1FA77", "black": "26AB",
    "white": "26AA", "brown": "1F7E4",
    # Vehicles 交通工具
    "car": "1F697", "bus": "1F68C", "train": "1F686", "bike": "1F6B2",
    "truck": "1F69A", "plane": "2708", "boat": "26F5", "taxi": "1F695",
    "motorcycle": "1F3CD", "ambulance": "1F691",
    # Nature 自然
    "sun": "2600", "moon": "1F319", "star": "2B50", "tree": "1F333",
    "flower": "1F33C", "grass": "1F33F", "rain": "1F327", "cloud": "2601",
    "wind": "1F32C", "leaf": "1F343",
}


def main():
    parser = argparse.ArgumentParser(description="下载词汇闪卡配图（OpenMoji 插画）")
    parser.add_argument("--force", action="store_true", help="强制重新下载所有图片")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    skipped = 0
    downloaded = 0
    failed = []

    for word, code in sorted(WORD_TO_CODEPOINT.items()):
        out_path = os.path.join(OUT_DIR, f"{word}.svg")
        if not args.force and os.path.exists(out_path):
            skipped += 1
            continue
        url = f"{OPENMOJI_BASE}/{code}.svg"
        try:
            urllib.request.urlretrieve(url, out_path)
            size = os.path.getsize(out_path)
            if size < 100:
                failed.append((word, code, "文件过小，可能下载失败"))
            else:
                downloaded += 1
                print(f"  ✓ {word}.svg")
        except Exception as e:
            failed.append((word, code, str(e)))

    print(f"\n跳过已存在 {skipped} 个，新下载 {downloaded} 个。")
    if failed:
        print(f"失败 {len(failed)} 个：", file=sys.stderr)
        for word, code, err in failed:
            print(f"  ✗ {word} ({code}): {err}", file=sys.stderr)
        sys.exit(1)
    print(f"图片目录：{OUT_DIR}")


if __name__ == "__main__":
    main()
