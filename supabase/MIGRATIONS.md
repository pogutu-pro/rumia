# Supabase Migration Commands

## New migration
```bash
supabase migration new your_change_name
# edit the generated file in supabase/migrations/
supabase db push
```

## Push pending migrations
```bash
supabase db push
```

## Check migration status
```bash
supabase migration list
```

## Pull remote schema changes
```bash
supabase db pull
```
