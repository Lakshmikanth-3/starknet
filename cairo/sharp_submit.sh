#!/bin/bash

# STEP 1: CAIRO 0 SHARP SUBMISSION FLOW

# 1. Compile the program
echo "Compiling commitment.cairo..."
cairo-compile commitment.cairo --output commitment_compiled.json

# 2. Run locally to verify logic
echo "Running locally with input.json..."
cairo-run --program=commitment_compiled.json --print_output --layout=small --program_input=input.json

# 3. Submit to SHARP
echo "Submitting to SHARP..."
# This command returns a job_key
cairo-sharp submit --source commitment.cairo --program_input input.json

echo "---------------------------------------------------"
echo "HOW TO CHECK STATUS:"
echo "Copy the job_key from the output above and run:"
echo "cairo-sharp status <job_key>"
echo ""
echo "Status Path:"
echo "PENDING -> PROCESSED -> ONCHAIN"
echo "When status is ONCHAIN, your proof is verified on Ethereum/Sepolia."
echo "---------------------------------------------------"
