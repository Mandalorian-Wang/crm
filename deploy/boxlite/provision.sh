#!/bin/sh
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y postgresql nginx supervisor curl unzip xz-utils git ca-certificates
node_version=22.22.0
bun_version=1.4.4
runtime_dir=$(mktemp -d)
trap 'rm -rf "$runtime_dir"' EXIT HUP INT TERM
cd "$runtime_dir"
curl -fsSLO "https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-x64.tar.xz"
curl -fsSLO "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt"
awk -v file="node-v${node_version}-linux-x64.tar.xz" '$2 == file' SHASUMS256.txt | sha256sum -c -
tar -xJf "node-v${node_version}-linux-x64.tar.xz" -C /usr/local --strip-components=1
curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${bun_version}/bun-linux-x64.zip" -o bun.zip
unzip -q bun.zip
install -m 755 bun-linux-x64/bun /usr/local/bin/bun
pg_ctlcluster 15 main start || pg_ctlcluster 15 main status
