export interface DbConfig {
  database_provider: string;
  database_url: string;
  database_auth_token?: string;
  db_schema?: string;
  db_singleton_enabled?: string;
  db_max_connections?: string;
}
