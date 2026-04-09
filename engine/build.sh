#!/bin/bash
set -e
# -O2           : enable optimizations
# -march=native : use CPU-native SIMD (SSE/AVX) — auto-vectorizes the dot product loop
# -lm           : link math library for sqrtf
gcc -O2 -march=native -o search search.c -lm
echo "engine built → ./search"