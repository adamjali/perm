#!/usr/bin/env python3
"""
Cleanup v1 Calendar Events

This script cleans up all PERM Tracker calendar events from Google Calendar
for users who had calendar sync enabled in v1.

This runs T+24hr after go-live as part of the migration cleanup process.
It uses v1's OAuth tokens to access users' Google Calendars and delete
PERM Tracker events.

Event patterns to delete:
- "PWD Expiration: {employer}"
- "ETA 9089 Filing: {employer}"
- "ETA 9089 Expiration: {employer}"
- "Ready to File: {employer}"
- "Recruitment Expires: {employer}"
- "I-140 Deadline: {employer}"
- "RFI Response Due: {employer}"
- "RFE Response Due: {employer}"

Usage:
    python cleanup_v1_calendar.py [--dry-run]

Environment Variables:
    SUPABASE_URL    - v1 Supabase URL
    SUPABASE_KEY    - v1 Supabase service key
    ENCRYPTION_KEY  - Key for decrypting OAuth tokens
    GOOGLE_CLIENT_ID - Google OAuth client ID
    GOOGLE_CLIENT_SECRET - Google OAuth client secret
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from supabase import create_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Event patterns to search for and delete
EVENT_PATTERNS = [
    "PWD Expiration:",
    "ETA 9089 Filing:",
    "ETA 9089 Expiration:",
    "Ready to File:",
    "Recruitment Expires:",
    "I-140 Deadline:",
    "RFI Response Due:",
    "RFE Response Due:",
]


class CalendarCleanup:
    """Handles cleanup of v1 calendar events."""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.supabase = None
        self.encryption_key: Optional[str] = None
        self.google_client_id: Optional[str] = None
        self.google_client_secret: Optional[str] = None

        # Statistics
        self.stats: Dict[str, Any] = {
            "users_processed": 0,
            "users_successful": 0,
            "users_failed": 0,
            "total_events_found": 0,
            "total_events_deleted": 0,
            "errors": [],
        }

    def initialize(self) -> bool:
        """Initialize connections and validate environment."""
        logger.info("Initializing calendar cleanup...")

        # Check required environment variables
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY")
        self.encryption_key = os.environ.get("ENCRYPTION_KEY")
        self.google_client_id = os.environ.get("GOOGLE_CLIENT_ID")
        self.google_client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

        missing_vars = []
        if not supabase_url:
            missing_vars.append("SUPABASE_URL")
        if not supabase_key:
            missing_vars.append("SUPABASE_KEY")
        if not self.encryption_key:
            missing_vars.append("ENCRYPTION_KEY")
        if not self.google_client_id:
            missing_vars.append("GOOGLE_CLIENT_ID")
        if not self.google_client_secret:
            missing_vars.append("GOOGLE_CLIENT_SECRET")

        if missing_vars:
            logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
            return False

        # Initialize Supabase client
        try:
            # supabase_url and supabase_key are guaranteed non-None after validation above
            self.supabase = create_client(supabase_url, supabase_key)  # type: ignore[arg-type]
            logger.info("Supabase client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return False

        # Test Google API imports
        try:
            from google.oauth2.credentials import Credentials  # noqa: F401
            from googleapiclient.discovery import build  # noqa: F401
            logger.info("Google API libraries available")
        except ImportError as e:
            logger.error(f"Missing Google API libraries: {e}")
            logger.error("Install with: pip install google-auth google-auth-oauthlib google-api-python-client")
            return False

        return True

    def decrypt_token(self, encrypted_token: Optional[str]) -> Optional[str]:
        """Decrypt a stored OAuth token."""
        if not encrypted_token or not self.encryption_key:
            return None

        try:
            from cryptography.fernet import Fernet
            key_bytes = self.encryption_key.encode('utf-8') if isinstance(self.encryption_key, str) else self.encryption_key
            f = Fernet(key_bytes)
            decrypted_bytes = f.decrypt(encrypted_token.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.warning(f"Failed to decrypt token: {e}")
            return None

    def get_google_credentials(self, user_data: Dict[str, Any]):
        """Get Google OAuth credentials from user data."""
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google.auth.exceptions import RefreshError

        refresh_token = self.decrypt_token(user_data.get("google_refresh_token"))
        if not refresh_token:
            return None

        # Get scopes
        scopes = user_data.get("google_scopes", [])
        if isinstance(scopes, str):
            import json
            try:
                scopes = json.loads(scopes)
            except Exception:
                scopes = [scopes]

        # Create credentials
        credentials = Credentials(
            token=user_data.get("google_access_token"),
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.google_client_id,
            client_secret=self.google_client_secret,
            scopes=scopes,
        )

        # Check if token expired and needs refresh
        token_expiry = user_data.get("google_token_expiry")
        needs_refresh = False

        if token_expiry:
            try:
                expiry_dt = datetime.fromisoformat(token_expiry.replace("Z", "+00:00"))
                if datetime.now(expiry_dt.tzinfo) >= expiry_dt:
                    needs_refresh = True
            except Exception:
                needs_refresh = True
        else:
            needs_refresh = True

        if needs_refresh:
            try:
                credentials.refresh(Request())
                logger.debug("Token refreshed successfully")
            except RefreshError as e:
                logger.warning(f"Token refresh failed: {e}")
                return None

        return credentials

    def get_calendar_service(self, credentials):
        """Get Google Calendar API service."""
        from googleapiclient.discovery import build
        return build('calendar', 'v3', credentials=credentials)

    def find_perm_events(self, service, _email: str) -> List[dict]:
        """Find all PERM Tracker events in user's calendar."""
        events_found: List[dict] = []

        # Search for events from the past 2 years to 1 year in future
        now = datetime.now(timezone.utc)
        time_min = (now - timedelta(days=730)).isoformat()
        time_max = (now + timedelta(days=365)).isoformat()

        try:
            for pattern in EVENT_PATTERNS:
                page_token = None
                while True:
                    events_result = service.events().list(
                        calendarId='primary',
                        q=pattern,
                        timeMin=time_min,
                        timeMax=time_max,
                        maxResults=100,
                        singleEvents=True,
                        pageToken=page_token,
                    ).execute()

                    events = events_result.get('items', [])

                    for event in events:
                        summary = event.get('summary', '')
                        if any(summary.startswith(p) for p in EVENT_PATTERNS):
                            if not any(e['id'] == event['id'] for e in events_found):
                                events_found.append({
                                    'id': event['id'],
                                    'summary': summary,
                                    'start': event.get('start', {}).get('date') or event.get('start', {}).get('dateTime'),
                                })

                    page_token = events_result.get('nextPageToken')
                    if not page_token:
                        break

        except Exception as e:
            logger.error(f"Error searching events: {e}")

        return events_found

    def delete_events(self, service, events: List[dict], _email: str) -> int:
        """Delete the specified events."""
        deleted_count = 0

        for event in events:
            try:
                if self.dry_run:
                    logger.info(f"  [DRY RUN] Would delete: {event['summary']} ({event['start']})")
                else:
                    service.events().delete(
                        calendarId='primary',
                        eventId=event['id']
                    ).execute()
                    logger.info(f"  Deleted: {event['summary']} ({event['start']})")
                deleted_count += 1
            except Exception as e:
                logger.warning(f"  Failed to delete event {event['id']}: {e}")

        return deleted_count

    def process_user(self, user_data: Dict[str, Any]) -> bool:
        """Process a single user's calendar cleanup."""
        email = user_data.get('email', 'unknown')

        logger.info(f"Processing user: {email}")

        credentials = self.get_google_credentials(user_data)
        if not credentials:
            logger.warning(f"  Could not get valid credentials for {email}")
            return False

        try:
            service = self.get_calendar_service(credentials)
        except Exception as e:
            logger.error(f"  Could not create calendar service for {email}: {e}")
            return False

        events = self.find_perm_events(service, email)
        events_found = len(events)
        logger.info(f"  Found {events_found} PERM Tracker event(s)")

        self.stats["total_events_found"] += events_found

        if events_found == 0:
            return True

        deleted = self.delete_events(service, events, email)
        self.stats["total_events_deleted"] += deleted

        if not self.dry_run:
            logger.info(f"  Deleted {deleted}/{events_found} event(s)")

        return True

    def run(self) -> bool:
        """Run the calendar cleanup process."""
        logger.info("=" * 70)
        if self.dry_run:
            logger.info("CALENDAR CLEANUP - DRY RUN MODE")
        else:
            logger.info("CALENDAR CLEANUP - LIVE MODE")
        logger.info("=" * 70)

        if not self.initialize():
            logger.error("Initialization failed")
            return False

        logger.info("\nQuerying users with calendar connected...")
        try:
            if self.supabase is None:
                logger.error("Supabase client not initialized")
                return False

            response = (
                self.supabase.table("perm_users")
                .select("id, email, google_refresh_token, google_access_token, google_token_expiry, google_scopes, calendar_connected")
                .eq("calendar_connected", True)
                .execute()
            )

            users = list(response.data) if response.data else []
            logger.info(f"Found {len(users)} user(s) with calendar connected")

        except Exception as e:
            logger.error(f"Failed to query users: {e}")
            return False

        if not users:
            logger.info("No users to process")
            return True

        logger.info("\nProcessing users...")
        for i, user in enumerate(users):
            self.stats["users_processed"] += 1
            user_dict: Dict[str, Any] = user if isinstance(user, dict) else {}
            user_email = user_dict.get("email", "unknown")

            try:
                if self.process_user(user_dict):
                    self.stats["users_successful"] += 1
                else:
                    self.stats["users_failed"] += 1
                    self.stats["errors"].append(f"User {user_email}: credential/auth failure")
            except Exception as e:
                self.stats["users_failed"] += 1
                self.stats["errors"].append(f"User {user_email}: {str(e)}")
                logger.error(f"Error processing user {user_email}: {e}")

            if i < len(users) - 1:
                time.sleep(1)

        self.print_summary()

        return self.stats["users_failed"] == 0

    def print_summary(self):
        """Print cleanup summary."""
        logger.info("\n" + "=" * 70)
        logger.info("CLEANUP SUMMARY")
        logger.info("=" * 70)

        if self.dry_run:
            logger.info("MODE: DRY RUN (no events were deleted)")
        else:
            logger.info("MODE: LIVE")

        logger.info(f"\nUsers processed: {self.stats['users_processed']}")
        logger.info(f"Users successful: {self.stats['users_successful']}")
        logger.info(f"Users failed: {self.stats['users_failed']}")
        logger.info(f"\nTotal events found: {self.stats['total_events_found']}")
        logger.info(f"Total events {'would be deleted' if self.dry_run else 'deleted'}: {self.stats['total_events_deleted']}")

        if self.stats["errors"]:
            logger.info(f"\nErrors ({len(self.stats['errors'])}):")
            for error in self.stats["errors"]:
                logger.info(f"  - {error}")

        logger.info("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description='Cleanup v1 PERM Tracker calendar events',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Environment Variables:
    SUPABASE_URL           v1 Supabase URL
    SUPABASE_KEY           v1 Supabase service key
    ENCRYPTION_KEY         Key for decrypting OAuth tokens
    GOOGLE_CLIENT_ID       Google OAuth client ID
    GOOGLE_CLIENT_SECRET   Google OAuth client secret

Examples:
    # Dry run (show what would be deleted)
    python cleanup_v1_calendar.py --dry-run

    # Live run (actually delete events)
    python cleanup_v1_calendar.py
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without deleting'
    )

    args = parser.parse_args()

    cleanup = CalendarCleanup(dry_run=args.dry_run)
    success = cleanup.run()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
