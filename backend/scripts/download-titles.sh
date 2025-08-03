#!/bin/bash

# Set the date for the eCFR data
DATE="2025-07-30"

# Create the docs directory if it doesn't exist
mkdir -p docs

# Loop through titles 1 to 50
for i in {1..50}
do
  URL="https://www.ecfr.gov/api/versioner/v1/full/${DATE}/title-${i}.xml"
  OUTPUT_FILE="docs/title-${i}.xml"
  echo "Downloading ${URL} to ${OUTPUT_FILE}..."
  curl -o "${OUTPUT_FILE}" "${URL}"
  # Add a small delay to avoid overwhelming the server
  sleep 1
done

echo "All titles downloaded."
