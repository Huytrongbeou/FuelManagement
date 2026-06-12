CREATE DATABASE auth_db;
CREATE DATABASE station_db;
CREATE DATABASE fuel_db;
CREATE DATABASE import_db;

\c auth_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c station_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c fuel_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c import_db;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
