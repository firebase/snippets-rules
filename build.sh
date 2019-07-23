#!/bin/bash

# Exit on error
set -e

# Secure env variables
if [ -z "$TRAVIS_SECURE_ENV_VARS" ]; then
  echo "TRAVIS_SECURE_ENV_VARS: unset, setting to false"
  TRAVIS_SECURE_ENV_VARS=false
else
  echo "TRAVIS_SECURE_ENV_VARS: $TRAVIS_SECURE_ENV_VARS"
fi

# Build
npm install
npm run build

export FIREBASE=./node_modules/.bin/firebase

# Only run test suite when we can decode the service acct
if [ "$TRAVIS_SECURE_ENV_VARS" = false ]; then
  echo "Could not find secure environment variables, skipping integration tests."
else
  export GOOGLE_APPLICATION_CREDENTIALS=service-account.json
  $FIREBASE --project=firestore-snippets \
    emulators:exec \
    --only firestore \
    "npm run test"
fi
