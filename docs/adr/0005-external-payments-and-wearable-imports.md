# ADR 0005: External payments; wearable data by file import first

Status: accepted

Card data never touches the app: billing links to hosted checkout and a test asserts there are no card fields.
GPS and wearable data enter by CSV export import (summary or position data), which needs no vendor contract and
works with StatSports, Catapult, Polar or any export. Live vendor APIs are added per vendor when the club has
credentials, behind the same import functions.
