"""
Claims Service — Redpanda Trigger Event Consumer
Subscribes to: processed.trigger.events
Consumer group: claims_consumer

On each trigger event:
1. Parse zone_id from event payload
2. Insert trigger_event record into PostgreSQL
3. Query all active policies in that zone
4. For each policy: dedup via Redis SETNX → create claim → fraud score → route
5. Publish claims to appropriate Redpanda topic based on fraud decision
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from dataclasses import dataclass

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.claim import Claim, GpsPing, Policy, TriggerEvent, Worker, Zone
from services.fraud_engine import FraudScoringEngine
from shared.config import get_settings
from shared.database import get_db_context
from shared.messaging import KavachAIConsumer, KavachAIProducer
from shared.redis_client import get_redis

# QA fix: A
@dataclass
class EligiblePolicy:
    policy: Policy
    zone_match_type: str  # "primary" or "mobility_grace"

logger = logging.getLogger(__name__)
settings = get_settings()
fraud_engine = FraudScoringEngine()


class TriggerEventConsumer(KavachAIConsumer):
    """
    Consumes trigger events from Redpanda and creates claims for all
    active policies in the affected zone.
    """

    def __init__(self, producer: KavachAIProducer):
        super().__init__(
            topics=[settings.topic_processed_trigger_events],
            group_id="claims_consumer",
        )
        self._producer = producer

    async def process_message(self, message: dict) -> None:
        """
        Process a single trigger event message.
        Creates claims for all eligible workers in the triggered zone.
        """
        payload = message.get("payload", message)
        zone_id = payload.get("zone_id")
        zone_code = payload.get("zone_code", "unknown")
        city = payload.get("city", "unknown")
        event_type = payload.get("event_type", "unknown")
        tier = payload.get("tier", "tier1")
        metric_value = float(payload.get("metric_value", 0))
        payout_amount = float(payload.get("payout_amount", 0))
        data_source = payload.get("data_source", "unknown")
        metric_unit = payload.get("metric_unit", "unit")

        if not zone_id:
            logger.error("Trigger event missing zone_id, skipping", extra={"payload": payload})
            return

        logger.info(
            "Processing trigger event",
            extra={
                "zone_code": zone_code,
                "event_type": event_type,
                "tier": tier,
                "payout_amount": payout_amount,
            },
        )

        async with get_db_context() as db:
            # Step 1: Insert trigger_event record
            trigger_event = TriggerEvent(
                zone_id=uuid.UUID(zone_id) if isinstance(zone_id, str) else zone_id,
                event_type=event_type,
                tier=tier,
                metric_value=metric_value,
                metric_unit=metric_unit,
                data_source=data_source,
                raw_payload=payload,
                is_sustained=True,
                detected_at=datetime.now(timezone.utc),
            )
            db.add(trigger_event)
            await db.flush()
            trigger_event_id = trigger_event.id

            logger.info(
                "Trigger event persisted",
                extra={
                    "trigger_event_id": str(trigger_event_id),
                    "zone_code": zone_code,
                },
            )

            # Step 2: Find all eligible policies (Primary + Mobility Grace)
            zone_uuid = uuid.UUID(zone_id) if isinstance(zone_id, str) else zone_id
            # QA fix: W1
            now = datetime.now(timezone.utc)
            grace_cutoff = now - timedelta(minutes=90)

            # ── 2a: Primary set — policies registered to the triggered zone ─────
            primary_result = await db.execute(
                select(Policy).where(
                    and_(
                        Policy.zone_id == zone_uuid,
                        Policy.status == "active",
                        Policy.coverage_end > now,
                    )
                )
            )
            primary_policies = primary_result.scalars().all()
            primary_worker_ids = {p.worker_id for p in primary_policies}

            # QA fix: B
            # ── 2b: Mobility Grace set — workers physically present in zone ──────
            # Find workers with ≥3 GPS pings inside the zone boundary in the
            # last 90 minutes, whose policies are active but registered to a
            # DIFFERENT zone. Uses PostGIS ST_Contains for spatial accuracy.
            # QA fix: C2
            # QA fix: C2 corrected — GpsPing has no zone_id column; location is geometry(Point,4326)
            grace_ping_subquery = (
                select(GpsPing.worker_id)
                .join(Zone, func.ST_Contains(Zone.boundary, GpsPing.location))
                .where(
                    Zone.id == zone_uuid,
                    GpsPing.recorded_at >= datetime.now(timezone.utc) - timedelta(minutes=90),
                )
                .group_by(GpsPing.worker_id)
                .having(func.count(GpsPing.id) >= 3)
                .subquery()
            )

            grace_result = await db.execute(
                select(Policy)
                .where(
                    Policy.status == "active",
                    Policy.worker_id.in_(select(grace_ping_subquery.c.worker_id)),
                    Policy.zone_id != zone_uuid
                )
            )
            grace_policies = grace_result.scalars().all()

            # QA fix: B
            # ── Union & deduplicate ───────────────────────────────────────────────
            # QA fix: C3
            eligible_policies: list[EligiblePolicy] = (
                [EligiblePolicy(policy=p, zone_match_type="primary") for p in primary_policies] +
                [EligiblePolicy(policy=p, zone_match_type="mobility_grace") for p in grace_policies]
            )

            logger.info(
                f"Zone {zone_uuid}: {len(primary_policies)} primary + "
                f"{len(grace_policies)} mobility_grace eligible policies"
            )

            if not eligible_policies:
                logger.info(
                    "No eligible policies in zone",
                    extra={"zone_code": zone_code, "zone_id": zone_id},
                )
                return

            # Step 3: Create claims for each eligible policy
            redis = await get_redis()
            claims_created = 0

            for ep in eligible_policies:
                dedup_key = f"claim:{ep.policy.worker_id}:{trigger_event_id}"

                # Redis SETNX for deduplication (24-hour TTL)
                lock_acquired = await redis.set(
                    f"lock:{dedup_key}", "1", nx=True, ex=86400
                )

                if not lock_acquired:
                    logger.debug(
                        "Duplicate claim prevented",
                        extra={
                            "worker_id": str(ep.policy.worker_id),
                            "trigger_event_id": str(trigger_event_id),
                        },
                    )
                    continue

                # Compute effective payout (capped by policy limits)
                effective_payout = min(
                    payout_amount,
                    float(ep.policy.max_payout_per_event),
                )

                # Get worker sensor data:
                # Priority 1: Redis (mobile app submitted)
                # Priority 2: Event payload (test endpoint pre-seeded)
                sensor_key = f"sensor_data:{ep.policy.worker_id}"
                sensor_data_raw = await redis.get(sensor_key)
                sensor_data = None
                if sensor_data_raw:
                    import json
                    try:
                        sensor_data = json.loads(sensor_data_raw)
                    except Exception:
                        sensor_data = None

                # Fallback: use sensor_data from the trigger event payload (demo scenarios)
                if sensor_data is None and payload.get("sensor_data"):
                    sensor_data = payload["sensor_data"]

                # Inject zone_match_type for fraud engine mobility grace penalty
                if sensor_data is None:
                    sensor_data = {}
                sensor_data["zone_match_type"] = ep.zone_match_type
                sensor_data["is_mobility_grace"] = 1 if ep.zone_match_type == "mobility_grace" else 0

                # Step 4: Fraud scoring
                fraud_result = await fraud_engine.score_claim(
                    db=db,
                    worker_id=ep.policy.worker_id,
                    zone_id=zone_uuid,
                    sensor_data=sensor_data,
                )

                fraud_score = fraud_result["total_score"]
                decision = fraud_result["decision"]
                fraud_flags = fraud_result["flags"]

                # Map decision to claim status
                status_map = {
                    "approved": "auto_approved",
                    "soft_hold": "soft_hold",
                    "blocked": "blocked",
                }
                claim_status = status_map.get(decision, "pending")

                # Adjust payout for soft_hold (50% immediate)
                if decision == "soft_hold":
                    effective_payout = effective_payout * 0.5

                # Create claim record
                claim = Claim(
                    policy_id=ep.policy.id,
                    worker_id=ep.policy.worker_id,
                    trigger_event_id=trigger_event_id,
                    status=claim_status,
                    payout_amount=effective_payout,
                    fraud_score=fraud_score,
                    fraud_flags=fraud_flags,
                    sensor_data=sensor_data,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(claim)
                await db.flush()

                # Look up worker info for the event payload
                worker_result = await db.execute(
                    select(Worker).where(Worker.id == ep.policy.worker_id)
                )
                worker = worker_result.scalar_one_or_none()

                # Publish to appropriate Redpanda topic
                claim_event = {
                    "claim_id": str(claim.id),
                    "policy_id": str(ep.policy.id),
                    "worker_id": str(ep.policy.worker_id),
                    "trigger_event_id": str(trigger_event_id),
                    "zone_code": zone_code,
                    "zone_id": zone_id,
                    "city": city,
                    "event_type": event_type,
                    "tier": tier,
                    "payout_amount": float(effective_payout),
                    "fraud_score": float(fraud_score),
                    "status": claim_status,
                    "worker_upi_id": worker.upi_id if worker else None,
                    "worker_name": worker.full_name if worker else "Rider",
                }

                if decision == "approved":
                    topic = settings.topic_claims_approved
                elif decision == "soft_hold":
                    topic = "claims.soft_hold"
                else:
                    topic = "claims.blocked"

                await self._producer.publish(
                    topic=topic,
                    event_type=f"claim.{claim_status}",
                    payload=claim_event,
                    source_service="claims-service",
                    key=zone_code,
                )

                claims_created += 1
                logger.info(
                    "Claim created",
                    extra={
                        "claim_id": str(claim.id),
                        "worker_id": str(ep.policy.worker_id),
                        "status": claim_status,
                        "fraud_score": fraud_score,
                        "payout": effective_payout,
                    },
                )

            logger.info(
                f"Trigger event processed: {claims_created} claims created",
                extra={
                    "trigger_event_id": str(trigger_event_id),
                    "zone_code": zone_code,
                    "claims_created": claims_created,
                },
            )
