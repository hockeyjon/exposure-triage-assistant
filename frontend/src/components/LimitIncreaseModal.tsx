"use client";

import { useState } from "react";
import Modal from "./Modal";
import Spinner from "./Spinner";
import { isUnverifiedEmailError, requestLimitIncrease } from "@/lib/api";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LimitIncreaseModal({
  open,
  onClose,
  contextMessage,
}: {
  open: boolean;
  onClose: () => void;
  contextMessage?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailRejected, setEmailRejected] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!open) return null;

  const emailIsValid = EMAIL_PATTERN.test(email);
  const emailHasError = (!emailIsValid && emailTouched) || emailRejected;
  const emailHelperText = emailRejected
    ? "We couldn't send to that email address. Please double-check it and try again."
    : !emailIsValid && emailTouched
      ? "Enter a valid email address"
      : "";

  function reset() {
    setEmail("");
    setEmailTouched(false);
    setEmailRejected(false);
    setMessage("");
    setStatus("idle");
    setErrorText(null);
  }

  function close() {
    onClose();
    reset();
  }

  async function submit() {
    setStatus("submitting");
    setEmailRejected(false);
    setErrorText(null);
    try {
      await requestLimitIncrease(email, message);
      setStatus("success");
    } catch (err) {
      if (isUnverifiedEmailError(err)) {
        setEmailRejected(true);
        setStatus("idle");
      } else {
        setErrorText(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }
  }

  return (
    <Modal
      title="Daily limit reached"
      onClose={close}
      footer={
        status === "idle" ? (
          <>
            <button
              onClick={close}
              className="rounded border border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!emailIsValid}
              className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send Request
            </button>
          </>
        ) : (
          (status === "success" || status === "error") && (
            <button
              onClick={close}
              className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              Close
            </button>
          )
        )
      }
    >
      {status === "idle" && (
        <div className="space-y-3">
          <p className="text-ink-muted">
            {contextMessage || "The daily LLM usage limit for this demo has been reached."}{" "}
            Use this form to send a &ldquo;Daily limit increase request&rdquo; email, and
            we&rsquo;ll follow up.
          </p>
          <p className="text-ink-muted">
            You&rsquo;ll get a confirmation email at the address you provide:
          </p>
          <p/>
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailRejected(false);
              }}
              onBlur={() => setEmailTouched(true)}
              placeholder="Your email address"
              className={`w-full rounded border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none ${
                emailHasError ? "border-rose-500/60" : "border-line focus:border-brand/50"
              }`}
            />
            {emailHelperText && <p className="mt-1 text-xs text-rose-400">{emailHelperText}</p>}
          </div>
          <textarea
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= 500) setMessage(e.target.value);
            }}
            placeholder="Anything you'd like to add? (optional)"
            rows={4}
            className="w-full rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand/50 focus:outline-none"
          />
          <p className="text-right text-xs text-ink-muted">{message.length}/500</p>
        </div>
      )}

      {status === "submitting" && (
        <div className="flex items-center justify-center gap-2 py-4 text-ink-muted">
          <Spinner />
          <span>Sending…</span>
        </div>
      )}

      {status === "success" && (
        <p>
          <span className="font-semibold italic">Thank you</span> — we received your request and
          will follow up soon. A confirmation email will be sent to your email address.
        </p>
      )}

      {status === "error" && (
        <p>
          <span className="font-semibold italic">Thank you</span> for your request. Unfortunately
          there was an issue sending it: {errorText}
        </p>
      )}
    </Modal>
  );
}
