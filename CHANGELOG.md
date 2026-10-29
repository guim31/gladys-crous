# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The daily menus of the Crous university restaurants and cafeterias, for the
  26 regional Crous, read from the public feed of the Crous Mobile app,
  without any account or key. Restaurants offered by Crous, nearest first
  (and within a distance) when a home position is given.
- One device per restaurant: "Open today", today's lunch and dinner section by
  section, and the vegetarian dishes the restaurant marks. A day without a
  menu says why: closed, menu not communicated, not served, not published yet.
- Dashboard widget "Crous menus": today's and tomorrow's menus, a badge when a
  vegetarian dish is marked, the whole menu on tap.
- Scene action "Get the Crous menu": today's or tomorrow's menu in a sentence
  ready to send or to say.
- Scene triggers "Watched dish on the menu" (words of your choice, such as
  "frites") and "Tomorrow's menu published".
