| table_name  | column_name       | data_type                | is_nullable | column_default                        |
| ----------- | ----------------- | ------------------------ | ----------- | ------------------------------------- |
| meal_logs   | id                | integer                  | NO          | nextval('meal_logs_id_seq'::regclass) |
| meal_logs   | user_id           | text                     | NO          | null                                  |
| meal_logs   | meal_type         | text                     | NO          | null                                  |
| meal_logs   | meal_date         | date                     | NO          | null                                  |
| meal_logs   | description       | text                     | YES         | null                                  |
| meal_logs   | calories          | numeric                  | NO          | null                                  |
| meal_logs   | protein_g         | numeric                  | YES         | 0                                     |
| meal_logs   | fat_g             | numeric                  | YES         | 0                                     |
| meal_logs   | carbs_g           | numeric                  | YES         | 0                                     |
| meal_logs   | logged_at         | timestamp with time zone | NO          | now()                                 |
| meal_logs   | calendar_event_id | text                     | YES         | null                                  |
| meal_logs   | saturated_fat_g   | numeric                  | YES         | 0                                     |
| meal_logs   | fiber_g           | numeric                  | YES         | 0                                     |
| meal_logs   | soluble_fiber_g   | numeric                  | YES         | 0                                     |
| meal_logs   | sugar_g           | numeric                  | YES         | 0                                     |
| meal_logs   | sodium_mg         | numeric                  | YES         | 0                                     |
| meal_logs   | food_name         | text                     | YES         | null                                  |
| meal_logs   | serving_size      | text                     | YES         | null                                  |
| meal_logs   | saved_meal_id     | uuid                     | YES         | null                                  |
| saved_meals | id                | uuid                     | NO          | gen_random_uuid()                     |
| saved_meals | name              | character varying        | NO          | null                                  |
| saved_meals | description       | text                     | YES         | null                                  |
| saved_meals | calories          | numeric                  | NO          | null                                  |
| saved_meals | protein_g         | numeric                  | NO          | 0                                     |
| saved_meals | fat_g             | numeric                  | NO          | 0                                     |
| saved_meals | carbs_g           | numeric                  | NO          | 0                                     |
| saved_meals | user_id           | text                     | NO          | null                                  |
| saved_meals | created_at        | timestamp with time zone | YES         | now()                                 |
| saved_meals | updated_at        | timestamp with time zone | YES         | now()                                 |
| saved_meals | saturated_fat_g   | numeric                  | YES         | 0                                     |
| saved_meals | fiber_g           | numeric                  | YES         | 0                                     |
| saved_meals | soluble_fiber_g   | numeric                  | YES         | 0                                     |
| saved_meals | sugar_g           | numeric                  | YES         | 0                                     |
| saved_meals | sodium_mg         | numeric                  | YES         | 0                                     |