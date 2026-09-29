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
