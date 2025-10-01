# 2025-10-01: rwsdk/db Playground Example and Documentation

## Problem

The `rwsdk/db` feature lacks a dedicated playground example to demonstrate its usage and test its functionality. The documentation also needs a section on how to seed the database.

## Plan

1.  Create a new playground example named `database-do`.
2.  Implement the database setup as described in the documentation.
3.  Add a database schema and migrations for a to-do list.
4.  Create a seeding script to populate the database with initial data.
5.  Build a simple UI to display, add, and toggle to-do items.
6.  Write end-to-end tests to verify database operations (create, read, update, toggle).
7.  Update the `rwsdk/db` documentation to include a section on seeding, using the new to-do list example as a reference.
