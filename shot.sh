#!/bin/bash

# Custom /shot command implementation
# Looks for screenshot files and analyzes the latest one

set -e

# Define search directories
SEARCH_DIRS=(
    "/home/psylux/Downloads"
    "/home/psylux/Desktop"
    "/home/psylux"
    "/tmp"
)

# Screenshot filename patterns
PATTERNS=(
    "Screenshot*.png"
    "Screenshot*.jpg"
    "screenshot*.png"
    "screen*.png"
    "*.screenshot.png"
    "Screen Shot*.png"
)

echo "🔍 Searching for screenshot files..."

# Collect all matching files
found_files=()

for dir in "${SEARCH_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        for pattern in "${PATTERNS[@]}"; do
            while IFS= read -r -d $'\0' file; do
                found_files+=("$file")
            done < <(find "$dir" -maxdepth 2 -type f -name "$pattern" -print0 2>/dev/null)
        done
    fi
done

# Also search for recent image files that might be screenshots
for dir in "${SEARCH_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        while IFS= read -r -d $'\0' file; do
            # Check if file looks like a screenshot (recent, common screenshot names, or recent PNGs)
            if [[ "$file" =~ [Ss]creen ]] || [[ "$file" =~ \.png$ ]]; then
                # Only add if not already in array
                if ! printf '%s\0' "${found_files[@]}" | grep -Fqxz "$file"; then
                    found_files+=("$file")
                fi
            fi
        done < <(find "$dir" -maxdepth 2 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -newermt "24 hours ago" -print0 2>/dev/null)
    fi
done

if [[ ${#found_files[@]} -eq 0 ]]; then
    echo "❌ No screenshot files found in common locations."
    echo ""
    echo "Common screenshot locations searched:"
    printf "  • %s\n" "${SEARCH_DIRS[@]}"
    exit 1
fi

# Sort by modification time (newest first)
sorted_files=()
while IFS= read -r -d $'\0' file; do
    sorted_files+=("$file")
done < <(printf '%s\0' "${found_files[@]}" | xargs -0 stat -c "%Y %n" 2>/dev/null | sort -rn | cut -d' ' -f2- | tr '\n' '\0')

latest="${sorted_files[0]}"

echo "📸 Latest screenshot found:"
echo "   $latest"
echo ""
echo "📊 File information:"
ls -lh "$latest"
echo ""
echo "📅 Last modified: $(stat -c "%y" "$latest")"
echo ""

# Check if we have any image analysis tools
if command -v identify &>/dev/null; then
    echo "🎨 Image analysis (ImageMagick):"
    identify -verbose "$latest" | grep -E "(Geometry:|Resolution:|Filesize:|Colorspace:|Depth:)" | head -10
elif command -v file &>/dev/null; then
    echo "📄 File type information:"
    file "$latest"
fi

echo ""
echo "💡 To analyze this image visually, you could:"
echo "   • Open it with: xdg-open \"$latest\" 2>/dev/null || echo 'No GUI available'"
echo "   • Copy it to clipboard (if supported)"
echo "   • Describe its contents to me for interpretation"

# If there are more screenshots, show them
if [[ ${#sorted_files[@]} -gt 1 ]]; then
    echo ""
    echo "📚 Other recent screenshots (${#sorted_files[@]} total):"
    for i in "${!sorted_files[@]:0:5}"; do
        if [[ $i -eq 0 ]]; then
            echo "   [LATEST] ${sorted_files[$i]}"
        else
            echo "   [$(($i+1))] ${sorted_files[$i]}"
        fi
    done
    if [[ ${#sorted_files[@]} -gt 5 ]]; then
        echo "   ... and $(( ${#sorted_files[@]} - 5 )) more"
    fi
fi