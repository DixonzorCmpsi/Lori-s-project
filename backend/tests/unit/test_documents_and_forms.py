"""Documents hub and e-signed forms."""

import pytest

from app.models import User
from app.routers import forms as forms_module
from tests.conftest import CAST_USER_ID

BASE = "/api/productions/prod-id"
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"


async def _upload(client, auth_headers, who="staff-member-id", name="script.pdf", data=PDF, **form):
    fields = {"title": "Act 1 script", "category": "script", "description": "Rev B"}
    fields.update(form)
    return await client.post(
        f"{BASE}/documents",
        files={"file": (name, data, "application/octet-stream")},
        data=fields,
        headers=auth_headers(who),
    )


class TestDocuments:
    async def test_staff_upload_and_everyone_can_list_and_download(self, client, auth_headers):
        created = await _upload(client, auth_headers)
        assert created.status_code == 201
        doc = created.json()
        assert doc["filename"] == "script.pdf"
        assert doc["content_type"] == "application/pdf"
        assert doc["size_bytes"] == len(PDF)

        listing = (
            await client.get(f"{BASE}/documents", headers=auth_headers("cast-member-id"))
        ).json()
        assert [d["title"] for d in listing] == ["Act 1 script"]

        download = await client.get(
            f"{BASE}/documents/{doc['id']}/download", headers=auth_headers("cast-member-id")
        )
        assert download.status_code == 200
        assert download.content == PDF
        assert download.headers["content-disposition"].startswith("attachment")
        assert download.headers["content-type"].startswith("application/pdf")

    async def test_cast_cannot_upload_or_delete(self, client, auth_headers):
        assert (await _upload(client, auth_headers, who="cast-member-id")).status_code == 403
        doc = (await _upload(client, auth_headers)).json()
        refused = await client.delete(
            f"{BASE}/documents/{doc['id']}", headers=auth_headers("cast-member-id")
        )
        assert refused.status_code == 403

    async def test_outsiders_cannot_list_or_download(self, client, auth_headers):
        doc = (await _upload(client, auth_headers)).json()
        assert (
            await client.get(f"{BASE}/documents", headers=auth_headers("outsider-id"))
        ).status_code == 403
        assert (
            await client.get(
                f"{BASE}/documents/{doc['id']}/download", headers=auth_headers("outsider-id")
            )
        ).status_code == 403

    @pytest.mark.parametrize("name", ["page.html", "logo.svg", "run.exe", "noextension", "x.php"])
    async def test_dangerous_or_unknown_types_are_refused(self, client, auth_headers, name):
        assert (await _upload(client, auth_headers, name=name)).status_code == 400

    async def test_content_type_comes_from_the_extension_not_the_upload(self, client, auth_headers):
        doc = (
            await _upload(client, auth_headers, name="notes.txt", data=b"<script>alert(1)</script>")
        ).json()
        assert doc["content_type"] == "text/plain"

    async def test_markdown_files_are_accepted(self, client, auth_headers):
        response = await _upload(
            client, auth_headers, name="notes.md", data=b"# Rehearsal notes\n- bring a pencil"
        )
        assert response.status_code == 201
        assert response.json()["content_type"] == "text/markdown"

    async def test_path_tricks_in_the_filename_are_removed(self, client, auth_headers):
        doc = (await _upload(client, auth_headers, name="../../etc/passwd.pdf")).json()
        assert doc["filename"] == "passwd.pdf"

    async def test_size_limit(self, client, auth_headers):
        too_big = await _upload(client, auth_headers, data=b"0" * (10 * 1024 * 1024 + 1))
        assert too_big.status_code == 413
        assert (await _upload(client, auth_headers, data=b"")).status_code == 400

    async def test_bad_category_or_title(self, client, auth_headers):
        assert (await _upload(client, auth_headers, category="memes")).status_code == 400
        assert (await _upload(client, auth_headers, title="  ")).status_code == 400

    async def test_update_and_delete(self, client, auth_headers):
        doc = (await _upload(client, auth_headers)).json()
        headers = auth_headers("director-id")
        patched = await client.patch(
            f"{BASE}/documents/{doc['id']}",
            json={"title": "Final script", "category": "handbook"},
            headers=headers,
        )
        assert patched.json()["title"] == "Final script"
        assert (
            await client.delete(f"{BASE}/documents/{doc['id']}", headers=headers)
        ).status_code == 204
        assert (
            await client.get(f"{BASE}/documents/{doc['id']}/download", headers=headers)
        ).status_code == 404


@pytest.fixture(autouse=True)
def _reset_form_cooldown():
    forms_module._last_reminder.clear()
    yield
    forms_module._last_reminder.clear()


async def _form(client, auth_headers, who="director-id", **overrides):
    body = {
        "title": "Photo release",
        "body": "I allow photos.",
        "requires_guardian": True,
        "audience": "all",
    }
    body.update(overrides)
    return await client.post(f"{BASE}/forms", json=body, headers=auth_headers(who))


def _sign(name="Test Cast", **overrides):
    body = {"signed_name": name, "agree": True}
    body.update(overrides)
    return body


class TestFormsAdmin:
    async def test_staff_create_cast_cannot(self, client, auth_headers):
        assert (await _form(client, auth_headers, who="staff-member-id")).status_code == 201
        assert (await _form(client, auth_headers, who="cast-member-id")).status_code == 403

    async def test_validation(self, client, auth_headers):
        assert (await _form(client, auth_headers, title=" ")).status_code == 400
        assert (await _form(client, auth_headers, body=" ")).status_code == 400
        assert (await _form(client, auth_headers, audience="everyone")).status_code == 400

    async def test_cast_list_shows_only_active_forms_for_them(self, client, auth_headers):
        await _form(client, auth_headers, title="For everyone")
        await _form(client, auth_headers, title="Cast only", audience="cast")
        archived = (await _form(client, auth_headers, title="Old")).json()
        await client.patch(
            f"{BASE}/forms/{archived['id']}",
            json={"is_active": False},
            headers=auth_headers("director-id"),
        )

        cast = (await client.get(f"{BASE}/forms", headers=auth_headers("cast-member-id"))).json()
        assert {f["title"] for f in cast} == {"For everyone", "Cast only"}
        staff = (await client.get(f"{BASE}/forms", headers=auth_headers("staff-member-id"))).json()
        assert {f["title"] for f in staff} == {"For everyone", "Cast only", "Old"}
        cast_only = next(f for f in staff if f["title"] == "Cast only")
        assert (
            cast_only["required_count"]
            < next(f for f in staff if f["title"] == "For everyone")["required_count"]
        )

    async def test_unsigned_form_can_be_edited_and_deleted(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        headers = auth_headers("director-id")
        assert (
            await client.patch(
                f"{BASE}/forms/{form['id']}", json={"body": "New text"}, headers=headers
            )
        ).status_code == 200
        assert (
            await client.delete(f"{BASE}/forms/{form['id']}", headers=headers)
        ).status_code == 204


class TestSigning:
    async def test_sign_and_see_it_recorded(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        headers = auth_headers("cast-member-id")
        signed = await client.post(f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=headers)
        assert signed.status_code == 201
        detail = (await client.get(f"{BASE}/forms/{form['id']}", headers=headers)).json()
        assert detail["my_signature"]["signed_name"] == "Test Cast"
        assert detail["locked"] is True
        listed = (await client.get(f"{BASE}/forms", headers=headers)).json()
        assert listed[0]["signed"] is True

    async def test_name_must_match_the_account(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        response = await client.post(
            f"{BASE}/forms/{form['id']}/sign",
            json=_sign(name="Someone Else"),
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 400
        assert "Test Cast" in response.json()["message"]

    async def test_name_match_ignores_case_and_spacing(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        response = await client.post(
            f"{BASE}/forms/{form['id']}/sign",
            json=_sign(name="  test   CAST "),
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 201

    async def test_must_tick_the_box(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        response = await client.post(
            f"{BASE}/forms/{form['id']}/sign",
            json=_sign(agree=False),
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 400

    async def test_cannot_sign_twice(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        headers = auth_headers("cast-member-id")
        await client.post(f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=headers)
        again = await client.post(f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=headers)
        assert again.status_code == 409

    async def test_minors_need_a_guardian(self, client, auth_headers, db_session):
        user = await db_session.get(User, CAST_USER_ID)
        user.age_range = "13-17"
        await db_session.commit()
        form = (await _form(client, auth_headers)).json()
        headers = auth_headers("cast-member-id")
        missing = await client.post(
            f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=headers
        )
        assert missing.status_code == 400
        bad_email = await client.post(
            f"{BASE}/forms/{form['id']}/sign",
            json=_sign(guardian_name="Pat Cast", guardian_email="not-an-email"),
            headers=headers,
        )
        assert bad_email.status_code == 400
        ok = await client.post(
            f"{BASE}/forms/{form['id']}/sign",
            json=_sign(guardian_name="Pat Cast", guardian_email="pat@example.com"),
            headers=headers,
        )
        assert ok.status_code == 201
        sigs = (
            await client.get(
                f"{BASE}/forms/{form['id']}/signatures", headers=auth_headers("director-id")
            )
        ).json()
        assert sigs["signed"][0]["guardian_email"] == "pat@example.com"

    async def test_adults_are_not_asked_for_a_guardian(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        response = await client.post(
            f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 201

    async def test_cast_only_forms_are_not_for_staff(self, client, auth_headers):
        form = (await _form(client, auth_headers, audience="cast")).json()
        response = await client.post(
            f"{BASE}/forms/{form['id']}/sign",
            json=_sign(name="Test Staff"),
            headers=auth_headers("staff-member-id"),
        )
        assert response.status_code == 400

    async def test_archived_forms_cannot_be_signed(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        await client.patch(
            f"{BASE}/forms/{form['id']}",
            json={"is_active": False},
            headers=auth_headers("director-id"),
        )
        response = await client.post(
            f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 400


class TestLockedAndTracking:
    async def test_signed_forms_cannot_change_or_be_deleted_but_can_be_archived(
        self, client, auth_headers
    ):
        form = (await _form(client, auth_headers)).json()
        await client.post(
            f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=auth_headers("cast-member-id")
        )
        headers = auth_headers("director-id")
        edit = await client.patch(
            f"{BASE}/forms/{form['id']}", json={"body": "Sneaky change"}, headers=headers
        )
        assert edit.status_code == 409 and edit.json()["error"] == "LOCKED"
        delete = await client.delete(f"{BASE}/forms/{form['id']}", headers=headers)
        assert delete.status_code == 409
        archive = await client.patch(
            f"{BASE}/forms/{form['id']}", json={"is_active": False}, headers=headers
        )
        assert archive.status_code == 200

    async def test_signature_tracker_splits_signed_and_pending(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        await client.post(
            f"{BASE}/forms/{form['id']}/sign", json=_sign(), headers=auth_headers("cast-member-id")
        )
        data = (
            await client.get(
                f"{BASE}/forms/{form['id']}/signatures", headers=auth_headers("staff-member-id")
            )
        ).json()
        assert [s["user_id"] for s in data["signed"]] == ["cast-member-id"]
        pending = {p["user_id"] for p in data["pending"]}
        assert "other-cast-user-id" in pending and "cast-member-id" not in pending
        assert (
            await client.get(
                f"{BASE}/forms/{form['id']}/signatures", headers=auth_headers("cast-member-id")
            )
        ).status_code == 403

    async def test_reminders_are_rate_limited_and_staff_only(self, client, auth_headers):
        form = (await _form(client, auth_headers)).json()
        headers = auth_headers("director-id")
        first = await client.post(f"{BASE}/forms/{form['id']}/remind", headers=headers)
        assert first.status_code == 200 and first.json()["pending"] > 0
        assert (
            await client.post(f"{BASE}/forms/{form['id']}/remind", headers=headers)
        ).status_code == 429
        assert (
            await client.post(
                f"{BASE}/forms/{form['id']}/remind", headers=auth_headers("cast-member-id")
            )
        ).status_code == 403
