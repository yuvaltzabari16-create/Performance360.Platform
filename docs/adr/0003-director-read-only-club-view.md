# ADR 0003: The director has a read-only club view

Status: accepted (supersedes the first design, where the director saw counts only)

The product owner asked for a director who sees the club from above with all information, but does not
build training. The director therefore reads the roster athletes' profiles, schedule, tests, wellness, notes,
injuries and GPS, and uses staff and messages, but has no planner, no exercise library and no write access to
athlete data. Implemented as separate `*_select_director` policies keyed on `director_sees_athlete()`, never by
widening `can_access_athlete()`. Consequence: director visibility is explicit and each table is a conscious decision.
