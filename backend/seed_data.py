"""Seed Supabase with director account + mock cast members."""

import asyncio
import os
import sys
from datetime import date, datetime, time, timedelta
from uuid import uuid4

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Pre-computed bcrypt hash for "Director123!" (used for all seed accounts)
_HASH = "$2b$12$YI6YS96Qxiyeo0qPJ3gInO6DSZ7vs6i4/mLNJQJ3BNzlstE296v6m"


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

        # Check if director already exists
        result = await session.execute(
            select(User).where(User.email == "dixon.zor@radsquared.ai")
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Director already exists: {existing.id}")
            director_id = existing.id
        else:
            director_id = str(uuid4())
            director = User(
                id=director_id,
                email="dixon.zor@radsquared.ai",
                name="Dixon",
                password_hash=_HASH,
                age_range="18+",
                email_verified=True,
                token_version=0,
            )
            session.add(director)
            print(f"Created director: dixon.zor@radsquared.ai / Director123!")

        # Create theater
        result = await session.execute(
            select(Theater).where(Theater.owner_id == director_id)
        )
        existing_theater = result.scalar_one_or_none()
        if existing_theater:
            theater_id = existing_theater.id
            print(f"Theater already exists: {existing_theater.name}")
        else:
            theater_id = str(uuid4())
            theater = Theater(
                id=theater_id,
                owner_id=director_id,
                name="RadSquared Community Theater",
                city="Portland",
                state="OR",
            )
            session.add(theater)
            print("Created theater: RadSquared Community Theater")

        # Create production
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
            production = Production(
                id=production_id,
                theater_id=theater_id,
                name="Into the Woods",
                estimated_cast_size=25,
                first_rehearsal=today + timedelta(days=14),
                opening_night=today + timedelta(days=75),
                closing_night=today + timedelta(days=82),
            )
            session.add(production)
            print("Created production: Into the Woods")

        # Director membership
        result = await session.execute(
            select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id == director_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(ProductionMember(
                id=str(uuid4()),
                production_id=production_id,
                user_id=director_id,
                role="director",
            ))
            print("Added director to production")

        # Mock cast members
        cast_members = [
            ("Sarah Mitchell", "sarah.mitchell@example.com", "Baker's Wife"),
            ("James Rodriguez", "james.rodriguez@example.com", "Baker"),
            ("Emily Chen", "emily.chen@example.com", "Cinderella"),
            ("Marcus Williams", "marcus.williams@example.com", "Jack"),
            ("Olivia Taylor", "olivia.taylor@example.com", "Little Red"),
            ("Noah Park", "noah.park@example.com", "Rapunzel's Prince"),
            ("Ava Johnson", "ava.johnson@example.com", "Witch"),
            ("Liam O'Brien", "liam.obrien@example.com", "Cinderella's Prince"),
            ("Sophia Nakamura", "sophia.nakamura@example.com", "Rapunzel"),
            ("Ethan Brown", "ethan.brown@example.com", "Narrator"),
            ("Isabella Garcia", "isabella.garcia@example.com", "Jack's Mother"),
            ("Mason Lee", "mason.lee@example.com", "Mysterious Man"),
        ]

        # Staff member
        result = await session.execute(
            select(User).where(User.email == "stage.manager@example.com")
        )
        sm = result.scalar_one_or_none()
        if not sm:
            sm_id = str(uuid4())
            sm = User(
                id=sm_id,
                email="stage.manager@example.com",
                name="Alex Rivera",
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
            print("Created staff: Alex Rivera (stage.manager@example.com / Staff123!)")
        else:
            sm_id = sm.id

        for name, email, role_name in cast_members:
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
                ))

            print(f"  Cast: {name} ({email}) - {role_name}")

        # Create rehearsal dates
        today = date.today()
        first_rehearsal = today + timedelta(days=14)
        result = await session.execute(
            select(RehearsalDate).where(
                RehearsalDate.production_id == production_id,
            )
        )
        if not result.scalars().first():
            # Generate Mon/Wed/Fri rehearsals for 8 weeks
            current = first_rehearsal
            end_date = first_rehearsal + timedelta(weeks=8)
            while current <= end_date:
                if current.weekday() in (0, 2, 4):  # Mon, Wed, Fri
                    session.add(RehearsalDate(
                        id=str(uuid4()),
                        production_id=production_id,
                        rehearsal_date=current,
                        start_time=time(18, 30),
                        end_time=time(21, 30),
                        type="regular",
                    ))
                current += timedelta(days=1)
            print("Created rehearsal schedule (Mon/Wed/Fri for 8 weeks)")

        # Create invite token
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
                expires_at=datetime.utcnow() + timedelta(days=30),
                max_uses=50,
                use_count=0,
            ))
            print("Created invite token")

        # Create a welcome bulletin post
        result = await session.execute(
            select(BulletinPost).where(
                BulletinPost.production_id == production_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(BulletinPost(
                id=str(uuid4()),
                production_id=production_id,
                author_id=director_id,
                title="Welcome to Into the Woods!",
                body="Welcome everyone to our production! Please submit your conflicts ASAP so we can finalize the rehearsal schedule. First read-through is in two weeks.",
                is_pinned=True,
            ))
            print("Created welcome bulletin post")

        await session.commit()
        print("\nSeed complete!")
        print(f"\nLogin credentials:")
        print(f"  Director: dixon.zor@radsquared.ai / Director123!")
        print(f"  Staff:    stage.manager@example.com / Staff123!")
        print(f"  Cast:     any cast email above / Cast123!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
