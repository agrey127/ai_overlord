| column_name        | data_type                | is_nullable |
| ------------------ | ------------------------ | ----------- |
| user_id            | text                     | NO          |
| day                | date                     | NO          |
| steps              | integer                  | YES         |
| sleep_score        | integer                  | YES         |
| resting_heart_rate | integer                  | YES         |
| source             | text                     | NO          |
| captured_at        | timestamp with time zone | NO          |
| updated_at         | timestamp with time zone | NO          |
| source_updated_at  | timestamp with time zone | YES         |
| is_final           | boolean                  | NO          |