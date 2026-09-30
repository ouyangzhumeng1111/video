"""Narration script: segment windows (s) and voice-over lines, per the brief."""
SEGMENTS = [
    # (start, end, on-screen caption, narration)
    (0, 6, "好产品，如何找到对的客户？", "全球市场很大，真正适合你的客户在哪里？"),
    (6, 13, "懂产品，才知道该找谁", "从理解你的产品开始，让企业知识成为每一次判断的起点。"),
    (13, 21, "市场洞察 → 买家发现", "联合贸易数据与公开信息，看清市场，找到与你业务匹配的买家。"),
    (21, 29, "看见机会，也看见依据", "核验企业背景，追踪采购信号，让每一次优先跟进，都有据可查。"),
    (29, 37, "AI协同准备，关键动作由你掌控", "多个智能体协同准备个性化沟通，由你审核，再把专业内容送达客户。"),
    (37, 45, "回复 → 需求 → 资格 → 报价", "从客户回复，到需求确认、报价协同，让销售动作前后衔接。"),
    (45, 53, "纠错留痕，复核后复用", "你的纠错会被保留，在下次背调中经证据复核后采用。"),
    (53, 60, "TradeMind AI SDR", "TradeMind。让全球商机，成为清晰的下一步。"),
]

# Synthesis-only tweaks (punctuation / pace) that keep the words unchanged but
# make the TTS articulate them clearly; verified with ASR. seg -> (text, speed)
TTS_OVERRIDE = {
    7: ("你的纠错，会被保留，在下次背调中经证据复核后采用。", 0.90),
}

# Delivery direction per line (for instruct-capable TTS or a human voice actor).
DIRECTION = {
    1: "沉稳、略带悬念，像向观众抛出一个问题，句尾上扬后留白",
    2: "温和笃定，娓娓道来，“起点”稍作强调",
    3: "开阔、有画面感，节奏略快，“匹配的买家”落稳",
    4: "专业可信，逐项递进，“有据可查”放慢加重",
    5: "自信积极，“由你审核”稍停顿以突出人的掌控",
    6: "流畅、有推进感，三个环节一气呵成",
    7: "诚恳稳重，“经证据复核”放慢",
    8: "明亮有力量的品牌落点，“TradeMind”后停顿，结尾放缓收住",
}
