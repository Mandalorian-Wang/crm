import argparse
import asyncio
import json
import os
import subprocess
import tempfile
from pathlib import Path

import boxlite

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / "deploy/boxlite/.local/deployment.json"


async def execute(box, command):
    execution = await box.exec("sudo", ["-n", "sh", "-c", command])

    async def forward(channel):
        async for line in channel:
            print(line, flush=True)

    await asyncio.gather(forward(execution.stdout()), forward(execution.stderr()))
    result = await execution.wait()
    if result.exit_code != 0:
        raise RuntimeError(f"Sandbox command failed with exit code {result.exit_code}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "upload", "upload-env", "run", "status", "backup"])
    parser.add_argument("command", nargs="?")
    args = parser.parse_args()
    os.environ.setdefault("BOXLITE_REST_URL", "https://api.dev.boxlite.ai")
    if not os.environ.get("BOXLITE_API_KEY"):
        raise RuntimeError("Export BOXLITE_API_KEY before running this tool")
    runtime = boxlite.Boxlite.rest(boxlite.BoxliteRestOptions.from_env())
    if args.action == "create":
        if STATE.exists():
            raise RuntimeError("Deployment state already exists; use status or run")
        if any(info.name == "boxlite-crm-dev" for info in await runtime.list_info()):
            raise RuntimeError("Sandbox name already exists; recover its state instead of creating a replacement")
        box = boxlite.SimpleBox(
            runtime=runtime,
            image="python",
            name="boxlite-crm-dev",
            cpus=4,
            memory_mib=8192,
            auto_remove=False,
            auto_stop=0,
            entrypoint=["sh", "-c", "while true; do if [ -x /opt/crm-start ]; then /opt/crm-start; fi; sleep 5; done"],
            network=boxlite.NetworkSpec(
                outbound=boxlite.OutboundNetworkSpec(mode="enabled", allow_net=[]),
                inbound=boxlite.InboundNetworkSpec(mode="enabled"),
            ),
        )
        await box.start()
        tunnel = await box.tunnel(("127.0.0.1", 8080))
        STATE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        STATE.write_text(json.dumps({"boxId": box.id, "url": tunnel.uri()}, indent=2) + "\n")
        STATE.chmod(0o600)
        print(STATE.read_text())
        return
    state = json.loads(STATE.read_text())
    box = await runtime.get(state["boxId"])
    if args.action == "upload":
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "source.tar.gz"
            subprocess.run(["git", "archive", "--format=tar.gz", "-o", str(archive), "HEAD"], cwd=ROOT, check=True)
            if archive.stat().st_size > 16 * 1024 * 1024:
                raise RuntimeError("Source archive exceeds the 16 MiB upload budget")
            await box.copy_in(str(archive), "/root/crm-source.tar.gz")
        await execute(box, "mkdir -p /app/crm && tar -xzf /root/crm-source.tar.gz -C /app/crm")
    elif args.action == "upload-env":
        env = ROOT / ".env"
        env.chmod(0o600)
        await box.copy_in(str(env), "/app/crm/.env")
        await execute(box, "chmod 600 /app/crm/.env")
    elif args.action == "run":
        if not args.command:
            raise RuntimeError("run requires one shell command argument; do not put secrets in it")
        await execute(box, args.command)
    elif args.action == "status":
        print(json.dumps(state))
        await execute(box, "supervisorctl -c /app/crm/deploy/boxlite/supervisord.conf status; curl -fsS http://127.0.0.1:8080/healthz")
    elif args.action == "backup":
        destination = STATE.parent / "crm.dump"
        await execute(box, "sudo -u postgres pg_dump -Fc crm > /root/crm.dump && chmod 600 /root/crm.dump")
        await box.copy_out("/root/crm.dump", str(destination))
        destination.chmod(0o600)
        print(f"Private backup saved to {destination}")


asyncio.run(main())
