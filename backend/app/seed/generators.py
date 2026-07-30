"""Synthetic-but-plausible herd generation.

Two properties matter more than realism here:

1. **Weight is a cumulative sum of daily deltas.** The old seeder listed weights
   against "days ago" offsets and got the direction backwards, so every hog
   appeared to lose weight and every dashboard KPI came out negative (audit g).
   Building the series by accumulation makes that class of bug unrepresentable
   rather than merely fixed.
2. **Deterministic for a given seed.** Chapter 4 screenshots have to keep
   matching the numbers quoted alongside them after a re-seed.

Growth curves are hand-written rather than random: an animal is assigned an
archetype for life, so the dashboard shows genuinely different shapes — steady
growth, a plateau, a decline, an illness and recovery — instead of one trend
with noise on it.
"""

from __future__ import annotations

import enum
import random
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.models.hog import HogSex, ProductionClass


class Archetype(str, enum.Enum):
    healthy = "healthy"
    underperformer = "underperformer"
    stall = "stall"
    decline = "decline"
    illness_recovery = "illness_recovery"
    mortality = "mortality"


# Shares must sum to 1.0. Mortality is applied only to piglets (see assign_archetypes).
ARCHETYPE_MIX: dict[Archetype, float] = {
    Archetype.healthy: 0.60,
    Archetype.underperformer: 0.12,
    Archetype.stall: 0.10,
    Archetype.illness_recovery: 0.07,
    Archetype.decline: 0.06,
    Archetype.mortality: 0.05,
}

# kg/day at the class's typical age. Real-world ballpark for commercial pigs.
BASE_ADG: dict[ProductionClass, float] = {
    ProductionClass.piglet: 0.20,
    ProductionClass.weaner: 0.35,
    ProductionClass.grower: 0.65,
    ProductionClass.finisher: 0.85,
    ProductionClass.gilt: 0.55,
    ProductionClass.sow: 0.25,
    ProductionClass.boar: 0.30,
}

START_WEIGHT_KG: dict[ProductionClass, float] = {
    ProductionClass.piglet: 6.0,
    ProductionClass.weaner: 18.0,
    ProductionClass.grower: 35.0,
    ProductionClass.finisher: 70.0,
    ProductionClass.gilt: 95.0,
    ProductionClass.sow: 180.0,
    ProductionClass.boar: 220.0,
}

BREEDS = [
    "Large White",
    "Landrace",
    "Duroc",
    "Berkshire",
    "Hampshire",
    "Pietrain",
    "Tamworth",
]

NORMAL_TEMP_C = (38.4, 39.3)
FEVER_TEMP_C = (39.9, 41.0)

# Feed intake scales with metabolic body weight (W^0.75). Tuned so feed
# conversion lands in the plausible 2.5-3.2 range rather than an invented number.
FEED_INTAKE_K = 0.088

# Mature breeding animals are restricted-fed to hold condition rather than fed
# to appetite. Without this a 260 kg boar "eats" nearly 6 kg/day and drags herd
# feed conversion to an implausible figure.
RESTRICTED_FEED_CLASSES = {ProductionClass.sow, ProductionClass.boar, ProductionClass.gilt}
RESTRICTED_FEED_FACTOR = 0.45
FEED_PRICE_NGN_PER_KG = 1000.0

GESTATION_DAYS = 114
VACCINE_SCHEDULE = [(7, "Iron dextran"), (21, "Mycoplasma"), (60, "Erysipelas")]


@dataclass
class HogPlan:
    tag_number: str
    breed: str
    sex: HogSex
    production_class: ProductionClass
    birth_date: date
    archetype: Archetype
    start_weight_kg: float
    vigour: float  # lifelong multiplier: some animals are simply faster growers
    dam_tag: str | None = None
    sire_tag: str | None = None
    death_day: int | None = None
    stall_window: tuple[int, int] | None = None
    illness_window: tuple[int, int] | None = None


@dataclass
class DayPoint:
    day_index: int
    on: date
    weight_kg: float
    temperature_c: float
    feed_kg: float
    feed_cost: float
    note: str | None = None


@dataclass
class HogSeries:
    plan: HogPlan
    points: list[DayPoint] = field(default_factory=list)


def assign_archetypes(rng: random.Random, count: int) -> list[Archetype]:
    """Deal archetypes by share, then shuffle so they are not grouped by tag."""
    out: list[Archetype] = []
    for arch, share in ARCHETYPE_MIX.items():
        out.extend([arch] * round(share * count))
    while len(out) < count:
        out.append(Archetype.healthy)
    out = out[:count]
    rng.shuffle(out)
    return out


def _gain_multiplier(plan: HogPlan, day: int, rng: random.Random) -> float:
    """Archetype-shaped multiplier applied to the class's base daily gain."""
    arch = plan.archetype
    if arch is Archetype.underperformer:
        return 0.55
    if arch is Archetype.stall and plan.stall_window:
        lo, hi = plan.stall_window
        if lo <= day <= hi:
            return 0.02  # eating to maintain, not growing
        return 1.0
    if arch is Archetype.illness_recovery and plan.illness_window:
        lo, hi = plan.illness_window
        if lo <= day <= hi:
            return -0.45  # losing condition
        if hi < day <= hi + 14:
            return 1.35  # compensatory growth once recovered
        return 1.0
    if arch is Archetype.decline and plan.illness_window:
        lo, _ = plan.illness_window
        if day >= lo:
            return -0.30
        return 1.0
    if arch is Archetype.mortality and plan.death_day is not None:
        if day >= plan.death_day - 10:
            return -0.55
        return 0.9
    return 1.0


def _is_febrile(plan: HogPlan, day: int) -> bool:
    window = plan.illness_window
    if window and window[0] <= day <= window[1]:
        return True
    if plan.archetype is Archetype.mortality and plan.death_day is not None:
        return day >= plan.death_day - 7
    return False


def build_series(plan: HogPlan, start: date, days: int, rng: random.Random) -> HogSeries:
    """Daily weight/feed series. Weight only ever moves by an accumulated delta."""
    series = HogSeries(plan=plan)
    weight = plan.start_weight_kg
    base = BASE_ADG[plan.production_class]
    price = FEED_PRICE_NGN_PER_KG

    for day in range(days):
        if plan.death_day is not None and day > plan.death_day:
            break  # a dead pig stops eating and stops being weighed

        delta = base * plan.vigour * _gain_multiplier(plan, day, rng) * rng.gauss(1.0, 0.03)
        weight = max(1.0, weight + delta)

        febrile = _is_febrile(plan, day)
        lo, hi = FEVER_TEMP_C if febrile else NORMAL_TEMP_C
        temperature = rng.uniform(lo, hi)

        # Sick animals go off feed; that is what makes feed conversion move.
        intake = FEED_INTAKE_K * (weight**0.75) * (0.6 if febrile else 1.0)
        if plan.production_class in RESTRICTED_FEED_CLASSES:
            intake *= RESTRICTED_FEED_FACTOR
        intake *= rng.gauss(1.0, 0.05)
        intake = max(0.1, intake)

        price *= rng.gauss(1.0, 0.003)  # slow random walk, ~2%/week

        note = None
        if febrile:
            note = "Off feed, elevated temperature"
        elif plan.stall_window and plan.stall_window[0] <= day <= plan.stall_window[1]:
            note = "Weight plateau observed"

        series.points.append(
            DayPoint(
                day_index=day,
                on=start + timedelta(days=day),
                weight_kg=round(weight, 3),
                temperature_c=round(temperature, 2),
                feed_kg=round(intake, 4),
                feed_cost=round(intake * price, 2),
                note=note,
            )
        )
    return series


def plan_herd(
    rng: random.Random,
    hog_count: int,
    days: int,
    tag_prefix: str,
) -> list[HogPlan]:
    """Compose a herd with a realistic class mix and assigned archetypes.

    For the 20-hog demo this reproduces the composition named in
    project_description.md: 1 boar, 2 sows, 3 growers, 14 piglets.
    """
    composition = _composition_for(hog_count)
    archetypes = assign_archetypes(rng, hog_count)

    plans: list[HogPlan] = []
    idx = 0
    for prod_class, n in composition:
        for _ in range(n):
            arch = archetypes[idx]
            # Breeding stock is valuable and closely managed; don't kill it off,
            # and don't model it as an underperformer.
            if prod_class in (ProductionClass.sow, ProductionClass.boar) and arch in (
                Archetype.mortality,
                Archetype.decline,
            ):
                arch = Archetype.healthy
            # Mortality is a piglet phenomenon in practice.
            if arch is Archetype.mortality and prod_class is not ProductionClass.piglet:
                arch = Archetype.underperformer

            sex = _sex_for(prod_class, rng)
            plan = HogPlan(
                tag_number=f"{tag_prefix}-{1001 + idx}",
                breed=rng.choice(BREEDS),
                sex=sex,
                production_class=prod_class,
                birth_date=_birth_date_for(prod_class, days, rng),
                archetype=arch,
                start_weight_kg=START_WEIGHT_KG[prod_class] * rng.uniform(0.9, 1.1),
                vigour=max(0.55, rng.gauss(1.0, 0.15)),
            )
            if arch is Archetype.stall:
                lo = rng.randint(int(days * 0.25), int(days * 0.55))
                plan.stall_window = (lo, lo + rng.randint(14, 21))
            if arch in (Archetype.illness_recovery, Archetype.decline):
                lo = rng.randint(int(days * 0.3), int(days * 0.6))
                plan.illness_window = (lo, lo + rng.randint(7, 12))
            if arch is Archetype.mortality:
                plan.death_day = rng.randint(int(days * 0.35), int(days * 0.85))
                plan.illness_window = (max(0, plan.death_day - 12), plan.death_day)
            plans.append(plan)
            idx += 1
    return plans


def _composition_for(hog_count: int) -> list[tuple[ProductionClass, int]]:
    if hog_count <= 20:
        # The demonstration herd from project_description.md, scaled down if needed.
        wanted = [
            (ProductionClass.boar, 1),
            (ProductionClass.sow, 2),
            (ProductionClass.grower, 3),
            (ProductionClass.piglet, hog_count - 6),
        ]
        return [(c, n) for c, n in wanted if n > 0]
    return [
        (ProductionClass.boar, max(1, round(hog_count * 0.02))),
        (ProductionClass.sow, max(2, round(hog_count * 0.10))),
        (ProductionClass.gilt, max(1, round(hog_count * 0.05))),
        (ProductionClass.finisher, round(hog_count * 0.18)),
        (ProductionClass.grower, round(hog_count * 0.25)),
        (ProductionClass.weaner, round(hog_count * 0.20)),
        (
            ProductionClass.piglet,
            hog_count
            - max(1, round(hog_count * 0.02))
            - max(2, round(hog_count * 0.10))
            - max(1, round(hog_count * 0.05))
            - round(hog_count * 0.18)
            - round(hog_count * 0.25)
            - round(hog_count * 0.20),
        ),
    ]


def _sex_for(prod_class: ProductionClass, rng: random.Random) -> HogSex:
    if prod_class is ProductionClass.boar:
        return HogSex.male
    if prod_class in (ProductionClass.sow, ProductionClass.gilt):
        return HogSex.female
    return rng.choice([HogSex.male, HogSex.female])


def _birth_date_for(prod_class: ProductionClass, days: int, rng: random.Random) -> date:
    today = date.today()
    age_days = {
        ProductionClass.piglet: rng.randint(20, 60),
        ProductionClass.weaner: rng.randint(60, 100),
        ProductionClass.grower: rng.randint(100, 150),
        ProductionClass.finisher: rng.randint(150, 200),
        ProductionClass.gilt: rng.randint(230, 300),
        ProductionClass.sow: rng.randint(500, 900),
        ProductionClass.boar: rng.randint(600, 1000),
    }[prod_class]
    return today - timedelta(days=age_days + days)


def vaccination_plan(plan: HogPlan, start: date, days: int) -> list[tuple[date, str, date]]:
    """(dose_date, vaccine_name, next_due_date) falling inside the window."""
    out: list[tuple[date, str, date]] = []
    for age_days, vaccine in VACCINE_SCHEDULE:
        dose = plan.birth_date + timedelta(days=age_days)
        if start <= dose <= start + timedelta(days=days):
            if plan.death_day is not None and dose > start + timedelta(days=plan.death_day):
                continue
            out.append((dose, vaccine, dose + timedelta(days=180)))
    return out
