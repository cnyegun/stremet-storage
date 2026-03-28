# Stremet Storage Dummy Data

This folder contains sample datasets used to verify the Logistical Flow and Weight Sensor logic.

## Files
- `sample_items.json`: Represents different types of inventory (Raw, WIP, Finished) with weights and delivery dates.
- `sensor_verification_log.json`: Mock hardware data showing how the `measured_weight` from sensors is compared against the database.

## Logistics Logic Reference
- **X-Coordinate (0-1000)**: 
    - 0 = Production Line (Far Left)
    - 1000 = Delivery Doors (Far Right)
- **Columns (1-10)**:
    - 1 = Back of rack
    - 10 = Front of rack (Easiest access)
- **Rows (1-4)**:
    - 1 = Floor (Heavy)
    - 2-3 = Golden Zone (High frequency)
    - 4 = Top (Light/Rarely used)
