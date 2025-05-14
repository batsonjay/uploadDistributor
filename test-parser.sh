#!/bin/bash

# First build the parser
cd packages/songlist-parser && npm run build && cd ../..

# Find all .rtf and .docx files in apps/tf
for file in apps/tf/*.{rtf,docx}; do
    if [ -f "$file" ]; then
        echo -e "\nAbout to process: $file"
        read -p "Continue? (y/n): " choice
        case "$choice" in
            y|Y)
                npx songlist "$file"
                ;;
            *)
                echo "Aborting all processing"
                exit 0
                ;;
        esac
    fi
done
