#!/bin/bash
# Monitor audio generation progress

echo "Monitoring audio file generation..."
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    clear
    echo "==================================="
    echo "Audio Generation Progress"
    echo "==================================="
    echo ""

    # Count files
    total_needed=30
    generated=$(ls packages/web/public/audio/*.wav 2>/dev/null | wc -l | tr -d ' ')
    remaining=$((total_needed - generated))

    echo "Files generated: $generated / $total_needed"
    echo "Remaining: $remaining"
    echo ""

    # Show progress bar
    progress=$((generated * 100 / total_needed))
    bar_length=40
    filled=$((progress * bar_length / 100))

    printf "Progress: ["
    for ((i=0; i<bar_length; i++)); do
        if [ $i -lt $filled ]; then
            printf "="
        else
            printf " "
        fi
    done
    printf "] $progress%%\n\n"

    # List recent files
    echo "Most recent files:"
    ls -lt packages/web/public/audio/*.wav 2>/dev/null | head -5 | awk '{print "  " $9 " (" $5 ")"}'

    echo ""
    echo "Checking again in 10 seconds..."
    sleep 10
done
