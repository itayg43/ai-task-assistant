#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create or get the first window
osascript <<APPLESCRIPT
tell application "iTerm"
    activate
    if (count of windows) is 0 then
        create window with default profile
    end if
end tell
APPLESCRIPT

sleep 0.5

# Function to create tab with command and title
create_tab() {
    local title="$1"
    local cmd="$2"
    
    osascript <<APPLESCRIPT
tell application "iTerm"
    activate
    tell current window
        create tab with default profile
        tell current session
            set name to "$title"
            write text "cd '$SCRIPT_DIR' && $cmd"
        end tell
    end tell
end tell
APPLESCRIPT
}

create_tab "Type Check" "npm run type-check"
sleep 0.5

create_tab "Docker Services" "docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build --watch"
sleep 5

sleep 10

create_tab "AI Logs" "docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f ai"
sleep 0.5

create_tab "Tasks Logs" "docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f tasks"
