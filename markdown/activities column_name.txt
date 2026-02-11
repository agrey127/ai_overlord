| column_name        | data_type                | is_nullable |
| ------------------ | ------------------------ | ----------- |
| id                 | bigint                   | NO          |
| user_id            | text                     | NO          |
| activity_type      | text                     | NO          |
| activity_date      | date                     | NO          |
| duration_minutes   | double precision         | NO          |
| calories_burned    | double precision         | NO          |
| distance_miles     | numeric                  | YES         |
| average_heart_rate | integer                  | YES         |
| cadence            | integer                  | YES         |
| notes              | text                     | YES         |
| created_at         | timestamp with time zone | YES         |
| pace_min_per_mile  | numeric                  | YES         |
| calendar_event_id  | text                     | YES         |