#!/bin/bash

# Direct Firestore deletion using gcloud
# Keep only: oypjt7e3uUPnxB4tjlQlU

KEEP="oypjt7e3uUPnxB4tjlQlU"

DELETE_IDS=(
  "fndKL9FnT0vW8RiNJiwzF"
  "lucJ9zr0e2ggPCiENFuLP"
  "0DRst7Ohx8SdilIAdEEeF"
  "PJUz5CRGhBBsVUchZLvDA"
  "9qbCk1Y9drepfl7XZKxxl"
  "SdjXOrq5Pc2kzlCmPwJzQ"
  "HgBrRSZwi5ZqKeMh7xkle"
  "Y5YD3t73ivOPFo1ESudeN"
  "rc5ZqxlX5Nznqs6sbSD1Y"
  "ZucWbC4IPkqoc1zcpggRM"
  "k2ZCf4MAZYC7VeOLtJhCb"
  "PGyqRCR2uIo1bJmfP5cjX"
  "XUpWo2tw7zclSlFhUQea1"
  "li9Eqcxwx7Q0lTioFikFU"
  "mkHJyFk3j8fgU1kL9o75u"
)

echo "🗑️  Deleting ${#DELETE_IDS[@]} DAO House duplicate templates..."
echo "✅ Keeping: $KEEP"
echo ""

for id in "${DELETE_IDS[@]}"; do
  echo "Deleting: $id"
  gcloud firestore documents delete "templates/$id" --project=pled-ai 2>/dev/null || echo "  (already deleted or doesn't exist)"
done

echo ""
echo "✨ Done! Should have only 3 templates left:"
echo "  1. oypjt7e3uUPnxB4tjlQlU (DAO House P&L Complete Flow)"
echo "  2. 5FWDJYeR0jbDl7PzI1bzr (Captive Solar credit)"
echo "  3. A7vv9uLUf2t3CfKISnkqd (FSM Complete Test Workflow)"
