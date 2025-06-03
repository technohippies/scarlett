#!/bin/bash

# Scarlett Extension Release Script
# Usage: ./scripts/release.sh [version]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Function to check if git working directory is clean
check_git_clean() {
    if [[ -n $(git status --porcelain) ]]; then
        print_color $RED "Error: Working directory is not clean. Please commit or stash your changes."
        exit 1
    fi
}

# Function to update version in package.json
update_version() {
    local version=$1
    print_color $BLUE "Updating version to $version in package.json..."
    
    # Use npm to update version (this also creates a git tag)
    npm version $version --no-git-tag-version
    
    print_color $GREEN "Version updated to $version"
}

# Function to build extensions
build_extensions() {
    print_color $BLUE "Building Chrome extension..."
    npm run build
    
    print_color $BLUE "Building Firefox extension..."
    npm run build:firefox
}

# Function to create zip files
create_zip_files() {
    local version=$1
    
    print_color $BLUE "Creating Chrome zip file..."
    npm run zip
    
    print_color $BLUE "Creating Firefox zip file..."
    npm run zip:firefox
    
    # Rename zip files to include version (WXT creates files with package name)
    if [ -f ".output/scarlett-supercoach-${version}-chrome.zip" ]; then
        mv ".output/scarlett-supercoach-${version}-chrome.zip" ".output/scarlett-chrome-v${version}.zip"
        print_color $GREEN "Created: .output/scarlett-chrome-v${version}.zip"
    fi
    
    if [ -f ".output/scarlett-supercoach-${version}-firefox.zip" ]; then
        mv ".output/scarlett-supercoach-${version}-firefox.zip" ".output/scarlett-firefox-v${version}.zip"
        print_color $GREEN "Created: .output/scarlett-firefox-v${version}.zip"
    fi
}

# Function to commit version changes
commit_version() {
    local version=$1
    print_color $BLUE "Committing version changes..."
    
    git add package.json
    git commit -m "chore: bump version to v${version}"
    git tag "v${version}"
    
    print_color $GREEN "Created git tag: v${version}"
}

# Function to push changes
push_changes() {
    local version=$1
    print_color $BLUE "Pushing changes to remote..."
    
    git push origin main
    git push origin "v${version}"
    
    print_color $GREEN "Pushed changes and tag to remote"
}

# Function to create GitHub release
create_github_release() {
    local version=$1
    
    print_color $BLUE "Creating GitHub release..."
    
    # Create release notes
    local release_notes="## What's New in v${version}

- [Add your release notes here]

## Downloads

- **Chrome Extension**: scarlett-chrome-v${version}.zip
- **Firefox Extension**: scarlett-firefox-v${version}.zip

## Installation

### Chrome
1. Download the Chrome zip file
2. Open Chrome and go to \`chrome://extensions/\`
3. Enable \"Developer mode\"
4. Click \"Load unpacked\" and select the extracted folder

### Firefox
1. Download the Firefox zip file
2. Open Firefox and go to \`about:debugging\`
3. Click \"This Firefox\"
4. Click \"Load Temporary Add-on\" and select the zip file"

    # Create GitHub release using gh CLI
    gh release create "v${version}" \
        ".output/scarlett-chrome-v${version}.zip" \
        ".output/scarlett-firefox-v${version}.zip" \
        --title "Scarlett v${version}" \
        --notes "$release_notes" \
        --draft
    
    print_color $GREEN "GitHub release created as draft: https://github.com/technohippies/scarlett/releases/tag/v${version}"
    print_color $YELLOW "Please edit the release notes and publish when ready!"
}

# Main function
main() {
    local version=$1
    
    if [ -z "$version" ]; then
        print_color $RED "Error: Please provide a version number"
        print_color $YELLOW "Usage: ./scripts/release.sh [version]"
        print_color $YELLOW "Examples:"
        print_color $YELLOW "  ./scripts/release.sh 0.3.0"
        print_color $YELLOW "  ./scripts/release.sh 0.3.1"
        print_color $YELLOW "  ./scripts/release.sh 1.0.0"
        exit 1
    fi
    
    # Validate version format (basic semver check)
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
        print_color $RED "Error: Invalid version format. Please use semantic versioning (e.g., 1.0.0, 1.0.0-beta)"
        exit 1
    fi
    
    print_color $GREEN "Starting release process for version $version..."
    
    # Check if git working directory is clean
    check_git_clean
    
    # Update version
    update_version $version
    
    # Build extensions
    build_extensions
    
    # Create zip files
    create_zip_files $version
    
    # Commit version changes
    commit_version $version
    
    # Push changes
    push_changes $version
    
    # Create GitHub release
    create_github_release $version
    
    print_color $GREEN "Release process completed successfully!"
    print_color $BLUE "Next steps:"
    print_color $YELLOW "1. Go to: https://github.com/technohippies/scarlett/releases"
    print_color $YELLOW "2. Edit the draft release notes"
    print_color $YELLOW "3. Publish the release"
}

# Run main function with all arguments
main "$@" 