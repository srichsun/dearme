"""Every knob that costs money, and what it buys.

Changing a value here changes the bill. They used to live in six files — the
extraction limit beside the extractor, the recall depth beside recall, the
reading's word cap buried in an English prompt — which meant that answering
"why was this month expensive?" started with a search.

The prices in the comments are rough, in NT$, at the models set below. They are
here to give a sense of which way a number pushes, not to be accounted with.
"""
import os

# ── the models ────────────────────────────────────────────────────────────
# Two tiers on purpose. The coach's reply is the one a person reads and judges;
# the extractor and the condenser are mechanical — read a lot, write a little —
# and the cheap model does that at a tenth of the price.
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-5.6-terra")
WORKER_MODEL = os.getenv("OPENAI_WORKER_MODEL", "gpt-5.6-luna")

# ── writing a day ─────────────────────────────────────────────────────────
# Free and unmetered: storing text costs nothing, and a day is usually written
# in several passes. Charging for that would punish keeping up with your day.

# ── analysing a day (~NT$0.25 a run) ──────────────────────────────────────
ANALYSES_PER_DAY = 3

# ── rebuilding the reading (~NT$0.3 a run on the worker model) ─────────────
READINGS_PER_DAY = 3
READING_DAYS = 60      # how far back it reads; multiplies straight into cost
READING_WORDS = 1000   # how long it may be — it is injected into every reply

# ── answering a question (~NT$0.6 a turn) ─────────────────────────────────
# Output costs several times what input does, so this is the number with the
# most leverage on a reply's price.
REPLY_MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2048"))
RECALL_PER_CATEGORY = 8    # facts pulled back per category searched
RECALL_MAX = 24            # however many categories were asked for
REPLAY_MAX_CHARS = 120_000  # a day of conversation, replayed each turn

# ── how long a call may take ──────────────────────────────────────────────
# A reply streams, so a stall shows; the one-shot calls run to a thousand words
# and need room.
REPLY_TIMEOUT = 20.0
WRITE_TIMEOUT = 120.0
