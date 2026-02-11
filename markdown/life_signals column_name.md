| column_name    | data_type                | is_nullable | column_default    |
| -------------- | ------------------------ | ----------- | ----------------- |
| id             | uuid                     | NO          | gen_random_uuid() |
| user_id        | text                     | NO          | null              |
| domain         | text                     | NO          | null              |
| signal_key     | text                     | NO          | null              |
| severity       | integer                  | NO          | null              |
| score          | numeric                  | NO          | null              |
| title          | text                     | NO          | null              |
| message        | text                     | NO          | null              |
| recommendation | text                     | YES         | null              |
| evidence       | jsonb                    | NO          | '{}'::jsonb       |
| starts_on      | date                     | YES         | null              |
| ends_on        | date                     | YES         | null              |
| created_at     | timestamp with time zone | NO          | now()             |
| updated_at     | timestamp with time zone | NO          | now()             |
| is_active      | boolean                  | NO          | true              |
| facts          | text                     | YES         | null              |
| detected_at    | timestamp with time zone | YES         | null              |
| resolved_at    | timestamp with time zone | YES         | null              |