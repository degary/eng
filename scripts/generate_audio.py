#!/usr/bin/env python3
"""
英语启蒙网站 - 本地音频生成脚本
================================

用途：
  读取 data/content.json 中的所有英文文本（场景句子、儿歌歌词、词汇、动物园句子），
  使用 Microsoft Edge TTS（免费、国内网络通常可直接访问）批量生成 mp3 音频文件，
  并生成 audio/manifest.json 映射表（文本 -> 文件路径），供前端 js/audio.js 读取播放。

使用场景：
  部署服务器（如 1Panel）内网无法访问 Google TTS 时，先在本地（有网络的电脑）
  运行此脚本生成音频文件，再将整个 audio/ 文件夹上传到服务器。

依赖安装：
  pip install edge-tts

运行方式：
  python3 scripts/generate_audio.py
  # 或指定并发数、语音角色：
  python3 scripts/generate_audio.py --voice en-US-AnaNeural --concurrency 5

输出：
  audio/<hash>.mp3          每条文本一个音频文件（文件名为文本内容的哈希，避免重名/特殊字符问题）
  audio/manifest.json       { "原文文本": "文件名.mp3", ... }

重新运行：
  默认跳过已存在的音频文件（增量生成）。使用 --force 强制重新生成全部。
"""

import argparse
import asyncio
import hashlib
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
CONTENT_PATH = os.path.join(PROJECT_ROOT, "data", "content.json")
AUDIO_DIR = os.path.join(PROJECT_ROOT, "audio")
MANIFEST_PATH = os.path.join(AUDIO_DIR, "manifest.json")

# 推荐的儿童友好英语语音（美式，女声，语气适中）
DEFAULT_VOICE = "en-US-AnaNeural"  # 儿童声线；可选 en-US-JennyNeural（成年女声，更清晰）


def text_hash(text: str) -> str:
    """用文本内容生成稳定短哈希作为文件名，避免特殊字符和重复。"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:16]


def collect_texts(content: dict) -> list:
    """从 content.json 中提取所有需要生成音频的英文文本，去重后返回列表。"""
    texts = set()

    # 场景：每句 phrase.en，以及关键词 words[].w
    for sc in content.get("scenarios", []):
        for p in sc.get("phrases", []):
            if p.get("en"):
                texts.add(p["en"].strip())
        for w in sc.get("words", []):
            if w.get("w"):
                texts.add(w["w"].strip())

    # 词汇闪卡：vocab[].words 是 [en, cn] 二元数组
    for cat in content.get("vocab", []):
        for pair in cat.get("words", []):
            if pair and pair[0]:
                texts.add(pair[0].strip())

    # 动物园专题：zoo.animals[] 的 en 单词和 sentence；zoo.outdoor.animals[] 同理
    zoo = content.get("zoo", {})
    for a in zoo.get("animals", []):
        if a.get("en"):
            texts.add(a["en"].strip())
        if a.get("sentence"):
            texts.add(a["sentence"].strip())
    outdoor = zoo.get("outdoor", {})
    for a in outdoor.get("animals", []):
        if a.get("en"):
            texts.add(a["en"].strip())
        if a.get("sentence"):
            texts.add(a["sentence"].strip())

    # 儿歌：每行歌词 lyrics[][0]，以及整首连读（与前端 app.js 的"连续朗读"按钮一致）
    for song in content.get("songs", []):
        lines = [l[0].strip() for l in song.get("lyrics", []) if l and l[0]]
        for line in lines:
            texts.add(line)
        if lines:
            texts.add(" ".join(lines))  # 整首连读文本，供"连续朗读"按钮使用

    # 场景：整段朗读文本（与前端 app.js 的"朗读全部"按钮一致）
    for sc in content.get("scenarios", []):
        all_en = [p["en"].strip() for p in sc.get("phrases", []) if p.get("en")]
        if all_en:
            texts.add(" ".join(all_en))

    return sorted(texts)


async def generate_one(text: str, voice: str, out_path: str, semaphore: asyncio.Semaphore) -> bool:
    import edge_tts

    async with semaphore:
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(out_path)
            return True
        except Exception as e:
            print(f"  ✗ 生成失败: {text[:40]!r} -> {e}", file=sys.stderr)
            return False


async def main_async(args):
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("错误：未安装 edge-tts。请先运行：pip install edge-tts", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(CONTENT_PATH):
        print(f"错误：找不到内容文件 {CONTENT_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(CONTENT_PATH, "r", encoding="utf-8") as f:
        content = json.load(f)

    texts = collect_texts(content)
    print(f"共提取到 {len(texts)} 条待生成文本。")

    os.makedirs(AUDIO_DIR, exist_ok=True)

    manifest = {}
    if os.path.exists(MANIFEST_PATH) and not args.force:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    tasks = []
    semaphore = asyncio.Semaphore(args.concurrency)
    skipped = 0

    for text in texts:
        key = text
        filename = f"{text_hash(text)}.mp3"
        out_path = os.path.join(AUDIO_DIR, filename)

        if not args.force and key in manifest and os.path.exists(os.path.join(AUDIO_DIR, manifest[key])):
            skipped += 1
            continue

        manifest[key] = filename
        tasks.append(generate_one(text, args.voice, out_path, semaphore))

    print(f"跳过已存在 {skipped} 条，需要生成 {len(tasks)} 条。")

    if tasks:
        results = []
        batch_size = 50
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i + batch_size]
            batch_results = await asyncio.gather(*batch)
            results.extend(batch_results)
            done = min(i + batch_size, len(tasks))
            print(f"  进度：{done}/{len(tasks)}")
        success = sum(1 for r in results if r)
        print(f"生成完成：成功 {success}/{len(tasks)}")
    else:
        print("没有需要新生成的音频。")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"已写入映射文件：{MANIFEST_PATH}")
    print(f"音频文件目录：{AUDIO_DIR}")
    print("\n完成后，请将整个 audio/ 文件夹上传到服务器的同级目录下即可。")


def main():
    parser = argparse.ArgumentParser(description="为英语启蒙网站生成本地 TTS 音频文件")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Edge TTS 语音角色，默认 {DEFAULT_VOICE}")
    parser.add_argument("--concurrency", type=int, default=5, help="并发生成数，默认 5")
    parser.add_argument("--force", action="store_true", help="强制重新生成所有音频（忽略已存在的文件）")
    args = parser.parse_args()

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
