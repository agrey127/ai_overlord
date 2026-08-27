alter table public.assistant_conversations
  drop constraint assistant_conversations_domain_check;

alter table public.assistant_conversations
  add constraint assistant_conversations_domain_check
  check (domain in ('general', 'strength', 'running', 'nutrition', 'finance', 'relationships', 'planning'));
