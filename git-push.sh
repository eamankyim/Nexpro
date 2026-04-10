#!/usr/bin/env bash

set -euo pipefail

# Usage:
#   ./git-push.sh
#   ./git-push.sh "Your commit message"
#   ./git-push.sh "Your commit message" origin

COMMIT_MESSAGE="${1:-}"
REMOTE_NAME="${2:-origin}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this script inside a git repository."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$CURRENT_BRANCH" == "HEAD" ]]; then
  echo "Error: detached HEAD state. Checkout a branch first."
  exit 1
fi

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "Error: remote '$REMOTE_NAME' does not exist."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ -z "$COMMIT_MESSAGE" ]]; then
    echo "Working tree has changes."
    echo "Pass a commit message to auto-commit before push:"
    echo "  ./git-push.sh \"your commit message\""
    exit 1
  fi

  echo "Staging changes..."
  git add .
  echo "Committing..."
  git commit -m "$COMMIT_MESSAGE"
else
  echo "No local changes to commit."
fi

echo "Pushing '$CURRENT_BRANCH' to '$REMOTE_NAME'..."
git push -u "$REMOTE_NAME" "$CURRENT_BRANCH"

echo "Done."
