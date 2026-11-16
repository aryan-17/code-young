-- DESIGN.md §7 — complete schema

CREATE TABLE mentors (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  timezone    TEXT NOT NULL,
  bio         TEXT NOT NULL
);

CREATE TABLE availability_rules (
  id          INTEGER PRIMARY KEY,
  mentor_id   INTEGER NOT NULL REFERENCES mentors(id),
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_local TEXT NOT NULL,
  end_local   TEXT NOT NULL
);

CREATE TABLE bookings (
  id                INTEGER PRIMARY KEY,
  token             TEXT NOT NULL UNIQUE,
  idempotency_key   TEXT NOT NULL UNIQUE,
  mentor_id         INTEGER NOT NULL REFERENCES mentors(id),
  start_utc         TEXT NOT NULL,
  end_utc           TEXT NOT NULL,
  mentor_local_date TEXT NOT NULL,
  parent_name       TEXT NOT NULL,
  parent_email      TEXT NOT NULL,
  parent_phone      TEXT,
  parent_timezone   TEXT NOT NULL,
  child_name        TEXT NOT NULL,
  child_age         INTEGER NOT NULL,
  class_link        TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('confirmed','cancelled')),
  created_at        TEXT NOT NULL,
  cancelled_at      TEXT
);

CREATE UNIQUE INDEX ux_mentor_slot ON bookings(mentor_id, start_utc) WHERE status = 'confirmed';
CREATE INDEX ix_mentor_day ON bookings(mentor_id, mentor_local_date) WHERE status = 'confirmed';
CREATE INDEX ix_start ON bookings(start_utc);

CREATE TABLE notifications (
  id               INTEGER PRIMARY KEY,
  booking_id       INTEGER NOT NULL REFERENCES bookings(id),
  recipient_type   TEXT NOT NULL CHECK (recipient_type IN ('parent','mentor')),
  recipient_email  TEXT NOT NULL,
  timezone         TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('booking_confirmed','booking_cancelled')),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
