"""Sends the "daily limit increase request" email via AWS SES — the same
plain-boto3 approach as gunbarrelstudio.com's other projects (see
gbs-fastapi's app/services/email.py), reimplemented here so this project
stays self-contained rather than depending on that sibling backend at
runtime.
"""
from __future__ import annotations

import html
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .. import config

logger = logging.getLogger("exposure-triage-assistant")


class UnverifiedRecipientError(Exception):
    """SES rejected the send because the recipient address isn't verified —
    the standard failure mode while an SES account is still in sandbox
    mode."""

    def __init__(self, email: str):
        self.email = email
        super().__init__(f"Recipient email address not verified in SES: {email}")


class EmailNotConfiguredError(Exception):
    """AWS credentials or SES_SENDER_EMAIL aren't set — a deployment/config
    gap, not something the requester did wrong. Distinct from
    UnverifiedRecipientError so the endpoint can give an accurate message
    instead of implying the requester's own address is at fault."""


def _send(to: str, subject: str, html_body: str, text_body: str) -> None:
    client = boto3.client(
        "ses",
        region_name=config.AWS_REGION,
        aws_access_key_id=config.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY or None,
    )
    try:
        client.send_email(
            Source=config.SES_SENDER_EMAIL,
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                },
            },
        )
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        error_message = e.response.get("Error", {}).get("Message", "")
        logger.error(f"SES error sending to {to}: {error_message}")
        if error_code == "MessageRejected" and "not verified" in error_message.lower():
            raise UnverifiedRecipientError(to) from e
        raise
    except BotoCoreError as e:  # e.g. NoCredentialsError — AWS creds not set at all
        logger.error(f"SES send to {to} failed before reaching AWS: {e}")
        raise EmailNotConfiguredError(str(e)) from e


def send_limit_increase_request(requester_email: str, message: str) -> None:
    safe_email = html.escape(requester_email)
    safe_message = html.escape(message) if message else "(no additional message)"

    # Notify the site owner. Log-and-continue on failure — an unverified
    # notification address is a config problem on this end, not something
    # the requester did wrong, and shouldn't block their confirmation email.
    try:
        _send(
            config.LIMIT_REQUEST_NOTIFY_EMAIL,
            "Daily limit increase request",
            f"<p><strong>From:</strong> &lt;{safe_email}&gt;</p><p>{safe_message}</p>",
            f"From: {requester_email}\n\n{message or '(no additional message)'}",
        )
    except UnverifiedRecipientError as e:
        logger.error(f"Notification address not verified in SES: {e.email}")

    # Confirmation to the requester. Left to propagate — this is their own
    # address, so they can act on a failure (e.g. a typo).
    _send(
        requester_email,
        "Your request has been received",
        "<p>Thanks for reaching out about the Exposure Triage Assistant demo's daily usage "
        "limit. We'll follow up soon.</p>",
        "Thanks for reaching out about the Exposure Triage Assistant demo's daily usage limit. "
        "We'll follow up soon.",
    )
