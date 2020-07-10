#!/bin/bash

# Exit on error
set -e

# Build
npm install
npm run build

# Test
npx firebase --project=firestore-snippets \
  emulators:exec \
  --only firestore \
  "npm run test"
