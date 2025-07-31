#!/bin/bash

# Script to check and manage LiveKit egresses via API

BASE_URL="http://localhost:3000/api/egress"

# Function to list active egresses
list_egresses() {
    echo "Fetching active egresses..."
    response=$(curl -s -X GET "$BASE_URL")
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Function to stop a specific egress
stop_egress() {
    local egress_id=$1
    if [ -z "$egress_id" ]; then
        echo "Error: Egress ID required"
        echo "Usage: $0 stop <egress-id>"
        exit 1
    fi
    
    echo "Stopping egress: $egress_id"
    response=$(curl -s -X POST "$BASE_URL/$egress_id/stop")
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
}

# Main script logic
case "$1" in
    list)
        list_egresses
        ;;
    stop)
        stop_egress "$2"
        ;;
    *)
        echo "Usage: $0 {list|stop <egress-id>}"
        echo ""
        echo "Commands:"
        echo "  list              - List all active egresses"
        echo "  stop <egress-id>  - Stop a specific egress"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 stop EG_mCRDaL5yNyzU"
        exit 1
        ;;
esac