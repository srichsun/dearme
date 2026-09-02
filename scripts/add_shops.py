"""Add restaurants to the live meals list from shared Google Maps links.

Run from your own terminal (it reaches the production database):

    uv run python scripts/add_shops.py https://maps.app.goo.gl/… https://maps.app.goo.gl/…

It fetches DATABASE_URL and PLACES_SERVER_KEY from Secret Manager with the
gcloud you are logged in as, starts cloud-sql-proxy on :5434 if nothing is
listening there, and adds each link's shop for the one account that has a
goal (yours). A shop already on the list is skipped, never duplicated.
"""
import os
import socket
import subprocess
import sys
import time

PROJECT = "project-53471801-f70d-47e4-a57"
INSTANCE = f"{PROJECT}:asia-east1:coach-db"
PORT = 5434


def secret(name: str) -> str:
    return subprocess.check_output(
        ["gcloud", "secrets", "versions", "access", "latest", f"--secret={name}", f"--project={PROJECT}"],
        text=True,
    ).strip()


def listening() -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def main(links: list[str]) -> None:
    if not links:
        sys.exit(__doc__)
    if not listening():
        subprocess.Popen(
            ["cloud-sql-proxy", INSTANCE, "--port", str(PORT)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(30):
            if listening():
                break
            time.sleep(1)
        time.sleep(2)  # the port opens a moment before the proxy is really ready

    password = secret("DATABASE_URL").split("//")[1].split("@")[0].split(":")[1]
    os.environ["DATABASE_URL"] = f"postgresql+psycopg://coach:{password}@127.0.0.1:{PORT}/coach"
    os.environ["PLACES_SERVER_KEY"] = secret("PLACES_SERVER_KEY")

    from sqlalchemy import select

    from app.core import db
    from app.models import Goal, Meal
    from app.services import meals, places

    with db.get_session() as s:
        uid = s.scalar(select(Goal.user_id))
    if not uid:
        sys.exit("No account with a goal yet — open /meals once first.")

    for url in links:
        try:
            f = places.resolve(url)
        except places.LinkError as e:
            print(f"skip: {url} — {e}")
            continue
        with db.get_session() as s:
            have = s.scalar(select(Meal).where(Meal.user_id == uid, Meal.place_id == f["place_id"]))
        if have:
            print(f"already there: {f['place_name']}")
            continue
        kind, price = f.pop("kind_hint"), f.pop("price_hint")
        m = meals.create_meal(
            uid, name=f["place_name"], category="meal", source="eat_out", season="all",
            kind=kind, price=price, **f,
        )
        print(f"added: {m.name} | {m.kind} | {'$' * (m.price or 0) or 'no price'}")
    print(f"meals on the list now: {len(meals.list_meals(uid))}")


if __name__ == "__main__":
    main(sys.argv[1:])
