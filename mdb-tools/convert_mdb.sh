#!/bin/bash

DB_MDB="data.mdb"
DB_SQLITE="data.sqlite"

# Create SQLite database
sqlite3 $DB_SQLITE "PRAGMA foreign_keys = OFF;"

# Get all tables and process each
mdb-tables -1 $DB_MDB | while read -r table; do
    echo "Processing $table..."
    
    # Get schema for this table
    mdb-schema $DB_MDB sqlite | grep -A 1000 "CREATE TABLE $table" | grep -B 1000 -m1 ";" > temp_schema.sql
    
    # Create table in SQLite
    sqlite3 $DB_SQLITE < temp_schema.sql
    
    # Export to CSV and import to SQLite
    mdb-export $DB_MDB "$table" > temp.csv
    sqlite3 $DB_SQLITE ".mode csv" ".import temp.csv $table"
done

# Cleanup
rm temp_schema.sql temp.csv

echo "Conversion complete"
