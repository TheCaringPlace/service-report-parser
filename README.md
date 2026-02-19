# Service Report Parser

A parser for parsing Service Reports exported from the FreeStore Foodbank's tracking system as PDFs and converting them into consumable JSON. 

## Install

Install the CLI by:

- Checkout the code
- Run `npm i` to install
- Run `npm i -g` to make available as a global script

## Use

Run the script with:

`service-report-parser parse-reports -i <input-folder> -i <output-folder>`

## End to End Process

To consolidate all of the reports run the following commands:

```bash
AWS_PROFILE=thecaringplace AWS_REGION=us-east-2 service-report-parser sync-s3 -b caringplace-service-reports -d reports/downloaded
service-report-parser parse-reports -i reports/downloaded -o reports/parsed
service-report-parser consolidate-reports -i reports/parsed -o reports/consolidated.json
```

The consolidated data will be written to `reports/consolidated.json`