#!/usr/bin/env bash
# compile all files into 1 executable so we don't need a build system.
set -euo pipefail
cd "$(dirname "$0")"

g++ -O2 -std=c++17 -Wall -Wextra \
  main.cpp blockchain.cpp network.cpp scenarios.cpp \
  -o sim

./sim
