import json
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from . import config, db, usage
from .graph import build_graph
from .inventory import parse_manifest_text, seed_inventory
from .llm import get_llm
from .models import Finding
from .services.email import EmailNotConfiguredError, UnverifiedRecipientError, send_limit_increase_request


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_inventory()
    usage.init_usage_db()
    yield


app = FastAPI(title="Exposure Triage Assistant API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph = build_graph()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/inventory")
def inventory():
    """What "Prioritize Exposures" will actually analyze — this project's
    own backend + frontend dependencies, as currently loaded in the DB."""
    return {"dependencies": db.get_all_dependencies()}


@app.post("/inventory/rescan")
def rescan_inventory():
    """Re-scan requirements.txt / package.json without restarting the server
    (useful right after adding or upgrading a dependency)."""
    return {"dependencies": seed_inventory()}


@app.post("/inventory/import")
async def import_inventory(file: UploadFile = File(...), mode: str = Form(...)):
    """Adds to, or wholesale replaces, the current inventory with packages
    parsed from an uploaded requirements.txt or package.json — tagged
    source="imported" so the UI never presents them as this project's own
    scan. Doesn't survive a rescan or restart, which rebuild from the real
    manifests fresh (see inventory.seed_inventory)."""
    if mode not in ("add", "replace"):
        raise HTTPException(400, "mode must be 'add' or 'replace'")

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "Couldn't read that file as text.")

    packages = parse_manifest_text(file.filename or "", text)
    if not packages:
        raise HTTPException(
            400,
            "No versioned packages found. Expected a requirements.txt (name==version per "
            "line) or a package.json with a dependencies/devDependencies object.",
        )

    if mode == "replace":
        db.replace_dependencies(packages)
    else:
        db.merge_dependencies(packages)

    return {"dependencies": db.get_all_dependencies(), "imported": len(packages)}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream_analysis():
    state: dict = {}
    try:
        for step in _graph.stream(state, stream_mode="updates"):
            for node_name, partial_state in step.items():
                if partial_state:  # a node with nothing to change surfaces as None, not {}
                    state.update(partial_state)
                yield _sse("node", {"node": node_name, "state": _public_state(state)})
        yield _sse("done", {"state": _public_state(state)})
    except Exception as exc:
        yield _sse("error", {"message": str(exc)})


def _public_state(state: dict) -> dict:
    """Strip internal-only keys (e.g. the LLM draft) before sending to the client."""
    return {k: v for k, v in state.items() if not k.startswith("_")}


@app.get("/analyze")
def analyze():
    return StreamingResponse(
        _stream_analysis(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class ChatRequest(BaseModel):
    prompt: str
    findings: list[Finding]


def _findings_context(findings: list[Finding]) -> str:
    lines = []
    for f in sorted(findings, key=lambda f: f.risk_rank if f.risk_rank is not None else 999):
        kev = f"KEV yes, added {f.kev_date_added}" if f.in_kev and f.kev_date_added else ("KEV yes" if f.in_kev else "KEV no")
        pkg = f"{f.package}@{f.version}" if f.package else "—"
        line = (
            f"- {f.cve_id} ({pkg}): CVSS {f.cvss_score} ({f.cvss_severity}), "
            f"EPSS {f.epss_score}, {kev}, risk_rank #{f.risk_rank} (cvss_rank #{f.cvss_rank})"
        )
        if f.rationale:
            line += f" — {f.rationale}"
        lines.append(line)
    return "\n".join(lines)


async def _stream_chat(prompt: str, findings: list[Finding]):
    try:
        usage.check_daily_limit()
        llm = get_llm(temperature=0.2)
        system = (
            "A security analyst is looking at a prioritized list of vulnerability findings and "
            "is asking you questions about them before deciding what to act on. Answer only from "
            "the finding data below and well-established security knowledge. Never invent "
            "specifics, affected versions, exploit mechanics, dates, that aren't given below; say "
            "you don't know instead. If the question refers to a CVE not in this list, say so.\n\n"
            + _findings_context(findings)
        )
        messages = [SystemMessage(content=system), HumanMessage(content=prompt)]
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield str(chunk.content)
        usage.record_call()
    except usage.DailyLimitReached as exc:
        yield f"{usage.LIMIT_REACHED_MARKER}{exc}"
    except Exception as exc:
        yield f"(couldn't answer: {exc})"


@app.post("/findings/chat")
def findings_chat(req: ChatRequest):
    return StreamingResponse(
        _stream_chat(req.prompt, req.findings),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class Exchange(BaseModel):
    question: str
    answer: str


class ChatTitleRequest(BaseModel):
    exchanges: list[Exchange]


_CVE_PATTERN = re.compile(r"CVE-\d{4}-\d+")


@app.post("/findings/chat/title")
def findings_chat_title(req: ChatTitleRequest):
    """Labels a finished Q&A session for the collapsed/saved view — a short
    topic, not a summary of the answers themselves. Prefixed with the CVE the
    conversation centers on, when there is one."""
    transcript = "\n\n".join(f"Q: {e.question}\nA: {e.answer}" for e in req.exchanges)
    llm = get_llm(temperature=0.2)
    system = (
        "Summarize the topic of this security Q&A conversation. First identify the "
        "CVE ID (format CVE-YYYY-NNNNN) it's primarily about — the most central one, "
        "if more than one appears. Respond in exactly this format: 'CVE-YYYY-NNNNN: ' "
        "followed by a 3 to 6 word topic phrase. Only use a CVE ID that actually "
        "appears in the conversation text below — never invent one. If no CVE ID "
        "appears anywhere in the conversation, skip the prefix and give just the "
        "topic phrase. Plain text only: no quotes, no trailing punctuation."
    )
    try:
        usage.check_daily_limit()
        resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=transcript)])
        usage.record_call()
        title = str(resp.content).strip().strip("\"'")
    except Exception:
        fallback = req.exchanges[0].question if req.exchanges else ""
        match = _CVE_PATTERN.search(fallback)
        prefix = f"{match.group(0)}: " if match else ""
        title = f"{prefix}{fallback[:60]}" if fallback else ""
    return {"title": title or "Saved conversation"}


_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LimitIncreaseRequest(BaseModel):
    email: str
    message: str = ""


@app.post("/contact/limit-increase")
def request_limit_increase(req: LimitIncreaseRequest):
    """The action offered by the modal that appears once DAILY_LLM_CALL_LIMIT
    is hit — lets a visitor ask for a higher limit instead of just being
    turned away. Rate-limited on its own (see usage.check_contact_request_limit),
    independent of the LLM call limit itself: SES sends have a real, if
    small, cost too."""
    if not _EMAIL_PATTERN.match(req.email):
        raise HTTPException(400, "That doesn't look like a valid email address.")

    try:
        usage.check_contact_request_limit()
    except usage.DailyLimitReached as exc:
        raise HTTPException(429, str(exc))

    try:
        send_limit_increase_request(req.email, req.message)
    except UnverifiedRecipientError:
        raise HTTPException(
            422,
            detail={
                "error": "unverified_email",
                "message": "We couldn't send anything to that email address. Please double-check it and try again.",
            },
        )
    except EmailNotConfiguredError:
        raise HTTPException(503, "Email isn't set up for this deployment yet — try again later.")

    usage.record_contact_request()
    return {"status": "sent"}
