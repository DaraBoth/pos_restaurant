#!/bin/bash

# DineOS Release Script (Shell version)
# Usage: ./release.sh -t <major|minor|patch|fix> -m "Commit message"

TYPE="patch"
MESSAGE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--type)
      TYPE="$2"
      shift 2
      ;;
    -m|--message)
      MESSAGE="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$TYPE" == "fix" ]; then TYPE="patch"; fi

if [ -z "$MESSAGE" ]; then
  echo "Error: Message is required (-m 'message')"
  exit 1
fi

# 1. Get current version
CUR_VERSION=$(grep '"version":' package.json | head -1 | awk -F '"' '{print $4}')
echo "Current Version: $CUR_VERSION"

# 2. Split version
IFS='.' read -r major minor patch <<< "$CUR_VERSION"

# 3. Bump version
if [ "$TYPE" == "major" ]; then
  major=$((major + 1))
  minor=0
  patch=0
elif [ "$TYPE" == "minor" ]; then
  minor=$((minor + 1))
  patch=0
else
  patch=$((patch + 1))
fi

NEW_VERSION="$major.$minor.$patch"
echo "New Version: $NEW_VERSION"

# 4. Update files
# Using sed to update the first occurrence of "version": "..."
sed -i "0,/\"version\": \".*\"/s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json
sed -i "0,/\"version\": \".*\"/s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# 5. Git operations
git add package.json src-tauri/tauri.conf.json
git add .
git commit -m "release: v$NEW_VERSION - $MESSAGE"
git tag "v$NEW_VERSION"

echo "Pushing code and tags..."
git push origin main
git push origin "v$NEW_VERSION"

echo "Successfully released v$NEW_VERSION!"
