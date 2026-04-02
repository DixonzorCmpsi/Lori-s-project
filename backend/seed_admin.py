"""Seed admin tester account with ~50 cast members, 2-month run, weekday rehearsals."""

import asyncio
import os
import sys
from datetime import date, datetime, time, timedelta
from uuid import uuid4

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Pre-computed bcrypt hash for "pass5000"
_HASH = "$2b$12$XAHFOaMSX5eYguVXHGeO0uNOjZeyU3F.69n9IBNUzaIdYWmfJ6FD6"

CAST_MEMBERS = [
    ("Aiden Walker", "aiden.walker@example.com", "Phantom"),
    ("Bianca Reyes", "bianca.reyes@example.com", "Christine"),
    ("Caleb Nguyen", "caleb.nguyen@example.com", "Raoul"),
    ("Diana Okafor", "diana.okafor@example.com", "Carlotta"),
    ("Elijah Scott", "elijah.scott@example.com", "Firmin"),
    ("Fatima Al-Hassan", "fatima.alhassan@example.com", "Andre"),
    ("Gabriel Torres", "gabriel.torres@example.com", "Piangi"),
    ("Hannah Johansson", "hannah.johansson@example.com", "Meg Giry"),
    ("Isaac Petrov", "isaac.petrov@example.com", "Madame Giry"),
    ("Jasmine Kwon", "jasmine.kwon@example.com", "Ensemble"),
    ("Kenji Yamamoto", "kenji.yamamoto@example.com", "Ensemble"),
    ("Luna Martinez", "luna.martinez@example.com", "Ensemble"),
    ("Marcus Thompson", "marcus.thompson@example.com", "Ensemble"),
    ("Nina Kowalski", "nina.kowalski@example.com", "Ensemble"),
    ("Omar Diallo", "omar.diallo@example.com", "Ensemble"),
    ("Priya Sharma", "priya.sharma@example.com", "Ensemble"),
    ("Quinn O'Malley", "quinn.omalley@example.com", "Ensemble"),
    ("Rosa Ferreira", "rosa.ferreira@example.com", "Ensemble"),
    ("Samuel Chen", "samuel.chen@example.com", "Ensemble"),
    ("Tatiana Volkov", "tatiana.volkov@example.com", "Ensemble"),
    ("Ulysses Grant", "ulysses.grant@example.com", "Ensemble"),
    ("Valentina Rossi", "valentina.rossi@example.com", "Ensemble"),
    ("Wesley Kim", "wesley.kim@example.com", "Ensemble"),
    ("Xena Papadopoulos", "xena.papadopoulos@example.com", "Ensemble"),
    ("Yusuf Ibrahim", "yusuf.ibrahim@example.com", "Ensemble"),
    ("Zara Novak", "zara.novak@example.com", "Ensemble"),
    ("Amara Jenkins", "amara.jenkins@example.com", "Ensemble"),
    ("Blake Sorensen", "blake.sorensen@example.com", "Ensemble"),
    ("Camille Dubois", "camille.dubois@example.com", "Ensemble"),
    ("Darian Patel", "darian.patel@example.com", "Ensemble"),
    ("Elena Popescu", "elena.popescu@example.com", "Ensemble"),
    ("Felix Andersen", "felix.andersen@example.com", "Ensemble"),
    ("Grace Tanaka", "grace.tanaka@example.com", "Ensemble"),
    ("Hugo Morales", "hugo.morales@example.com", "Ensemble"),
    ("Imani Washington", "imani.washington@example.com", "Ensemble"),
    ("Julian Strand", "julian.strand@example.com", "Ensemble"),
    ("Kira Bergstrom", "kira.bergstrom@example.com", "Ensemble"),
    ("Leo Nakamura", "leo.nakamura@example.com", "Ensemble"),
    ("Maya Okonkwo", "maya.okonkwo@example.com", "Ensemble"),
    ("Nico Bianchi", "nico.bianchi@example.com", "Ensemble"),
    ("Olive Sinclair", "olive.sinclair@example.com", "Ensemble"),
    ("Paolo Rivera", "paolo.rivera@example.com", "Ensemble"),
    ("Quinn Delgado", "quinn.delgado@example.com", "Ensemble"),
    ("Remy Laurent", "remy.laurent@example.com", "Ensemble"),
    ("Suki Hayashi", "suki.hayashi@example.com", "Ensemble"),
    ("Tobias Eriksson", "tobias.eriksson@example.com", "Ensemble"),
    ("Uma Krishnan", "uma.krishnan@example.com", "Ensemble"),
    ("Victor Almeida", "victor.almeida@example.com", "Ensemble"),
    ("Wren Calloway", "wren.calloway@example.com", "Swing"),
    ("Xiomara Vega", "xiomara.vega@example.com", "Swing"),
]


async def seed():
    from app.database import engine, Base, async_session_maker
    from app.models import (
        User, Theater, Production, ProductionMember,
        RehearsalDate, BulletinPost, CastProfile,
        InviteToken,
    )

    # Create tables (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        from sqlalchemy import select

        # ── Admin director account ──────────────────────────────────────
        result = await session.execute(
            select(User).where(User.email == "admin@test.com")
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Admin already exists: {existing.id}")
            admin_id = existing.id
        else:
            admin_id = str(uuid4())
            admin = User(
                id=admin_id,
                email="admin@test.com",
                name="Admin",
                password_hash=_HASH,
                age_range="18+",
                email_verified=True,
                token_version=0,
            )
            session.add(admin)
            print("Created admin: admin@test.com / pass5000")

        # ── Theater ─────────────────────────────────────────────────────
        result = await session.execute(
            select(Theater).where(Theater.owner_id == admin_id)
        )
        existing_theater = result.scalar_one_or_none()
        if existing_theater:
            theater_id = existing_theater.id
            print(f"Theater already exists: {existing_theater.name}")
        else:
            theater_id = str(uuid4())
            theater = Theater(
                id=theater_id,
                owner_id=admin_id,
                name="Tester Playhouse",
                city="New York",
                state="NY",
            )
            session.add(theater)
            print("Created theater: Tester Playhouse")

        # ── Production (2-month run) ────────────────────────────────────
        result = await session.execute(
            select(Production).where(Production.theater_id == theater_id)
        )
        existing_prod = result.scalar_one_or_none()
        if existing_prod:
            production_id = existing_prod.id
            print(f"Production already exists: {existing_prod.name}")
        else:
            production_id = str(uuid4())
            today = date.today()
            first_rehearsal = today + timedelta(days=7)
            opening_night = today + timedelta(days=42)
            closing_night = opening_night + timedelta(days=60)  # ~2 months
            production = Production(
                id=production_id,
                theater_id=theater_id,
                name="The Phantom of the Opera",
                estimated_cast_size=50,
                first_rehearsal=first_rehearsal,
                opening_night=opening_night,
                closing_night=closing_night,
            )
            session.add(production)
            print(f"Created production: The Phantom of the Opera")
            print(f"  First rehearsal: {first_rehearsal}")
            print(f"  Opening night:   {opening_night}")
            print(f"  Closing night:   {closing_night}")

        # ── Director membership ─────────────────────────────────────────
        result = await session.execute(
            select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id == admin_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(ProductionMember(
                id=str(uuid4()),
                production_id=production_id,
                user_id=admin_id,
                role="director",
            ))
            print("Added admin as director")

        # ── Staff member (stage manager) ────────────────────────────────
        sm_email = "sm.admin@example.com"
        result = await session.execute(
            select(User).where(User.email == sm_email)
        )
        sm = result.scalar_one_or_none()
        if not sm:
            sm_id = str(uuid4())
            sm = User(
                id=sm_id,
                email=sm_email,
                name="Jordan Blake",
                password_hash=_HASH,
                age_range="18+",
                email_verified=True,
            )
            session.add(sm)
            result2 = await session.execute(
                select(ProductionMember).where(
                    ProductionMember.production_id == production_id,
                    ProductionMember.user_id == sm_id,
                )
            )
            if not result2.scalar_one_or_none():
                session.add(ProductionMember(
                    id=str(uuid4()),
                    production_id=production_id,
                    user_id=sm_id,
                    role="staff",
                ))
            print(f"Created staff: Jordan Blake ({sm_email} / pass5000)")
        else:
            sm_id = sm.id

        # ── 50 Cast members ─────────────────────────────────────────────
        for name, email, role_name in CAST_MEMBERS:
            result = await session.execute(
                select(User).where(User.email == email)
            )
            existing_user = result.scalar_one_or_none()
            if existing_user:
                user_id = existing_user.id
            else:
                user_id = str(uuid4())
                user = User(
                    id=user_id,
                    email=email,
                    name=name,
                    password_hash=_HASH,
                    age_range="18+",
                    email_verified=True,
                )
                session.add(user)

            # Add membership
            result = await session.execute(
                select(ProductionMember).where(
                    ProductionMember.production_id == production_id,
                    ProductionMember.user_id == user_id,
                )
            )
            if not result.scalar_one_or_none():
                session.add(ProductionMember(
                    id=str(uuid4()),
                    production_id=production_id,
                    user_id=user_id,
                    role="cast",
                ))

            # Add cast profile
            result = await session.execute(
                select(CastProfile).where(
                    CastProfile.production_id == production_id,
                    CastProfile.user_id == user_id,
                )
            )
            if not result.scalar_one_or_none():
                session.add(CastProfile(
                    id=str(uuid4()),
                    production_id=production_id,
                    user_id=user_id,
                    display_name=name,
                    role_character=role_name,
                ))

            print(f"  Cast: {name} ({email}) - {role_name}")

        # ── Rehearsal schedule: weekdays only, weekends blocked ─────────
        today = date.today()
        first_rehearsal = today + timedelta(days=7)
        closing_night = today + timedelta(days=42 + 60)

        result = await session.execute(
            select(RehearsalDate).where(
                RehearsalDate.production_id == production_id,
            )
        )
        if not result.scalars().first():
            count = 0
            current = first_rehearsal
            while current <= closing_night:
                weekday = current.weekday()
                # 0=Mon..4=Fri are weekdays, 5=Sat/6=Sun are skipped
                if weekday < 5:
                    # Vary rehearsal type near the end
                    days_to_opening = (today + timedelta(days=42) - current).days
                    if days_to_opening <= 0:
                        rtype = "performance"
                        start, end = time(19, 0), time(22, 0)
                    elif days_to_opening <= 7:
                        rtype = "dress" if days_to_opening <= 3 else "tech"
                        start, end = time(17, 0), time(22, 0)
                    else:
                        rtype = "regular"
                        start, end = time(18, 30), time(21, 30)

                    session.add(RehearsalDate(
                        id=str(uuid4()),
                        production_id=production_id,
                        rehearsal_date=current,
                        start_time=start,
                        end_time=end,
                        type=rtype,
                    ))
                    count += 1
                current += timedelta(days=1)
            print(f"Created {count} weekday rehearsal/performance dates (weekends blocked)")

        # ── Invite token ────────────────────────────────────────────────
        result = await session.execute(
            select(InviteToken).where(
                InviteToken.production_id == production_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(InviteToken(
                id=str(uuid4()),
                production_id=production_id,
                token=str(uuid4())[:8],
                expires_at=datetime.utcnow() + timedelta(days=90),
                max_uses=100,
                use_count=0,
            ))
            print("Created invite token")

        # ── Welcome bulletin ────────────────────────────────────────────
        result = await session.execute(
            select(BulletinPost).where(
                BulletinPost.production_id == production_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(BulletinPost(
                id=str(uuid4()),
                production_id=production_id,
                author_id=admin_id,
                title="Welcome to Phantom!",
                body="Welcome cast and crew! Rehearsals are Monday through Friday "
                     "— weekends are OFF. Please submit your conflicts ASAP so "
                     "we can finalize the schedule. See you at first read-through!",
                is_pinned=True,
            ))
            print("Created welcome bulletin post")

        await session.commit()
        print("\n--- Seed complete! ---")
        print(f"\nLogin: admin@test.com / pass5000")
        print(f"Staff: sm.admin@example.com / pass5000")
        print(f"Cast:  any cast email above / pass5000")
        print(f"\n50 cast members, weekday-only rehearsals, 2-month run.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
