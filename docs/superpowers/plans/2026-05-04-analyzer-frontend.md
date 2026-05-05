# Analyzer Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file upload page to the existing UI that sends MIDI/MusicXML files to the analyzer backend and displays the symmetry analysis timeline as an interactive chart.

**Architecture:** New route/page in `packages/ui` with a file dropzone, POST to `http://localhost:3010/api/analyze`, and a timeline chart (D3.js) showing how symmetry groups evolve across beats/measures. Reuses existing ClassificationPanel for slice detail view.

**Tech Stack:** React 18, D3.js, Tailwind CSS (all already in packages/ui)

---

## Task 1: File Upload Component

**Files:**
- Create: `packages/ui/src/components/FileUpload.tsx`
- Create: `packages/ui/src/components/__tests__/FileUpload.test.tsx`

## Task 2: Timeline Chart Component

**Files:**
- Create: `packages/ui/src/components/TimelineChart.tsx`
- Create: `packages/ui/src/components/__tests__/TimelineChart.test.tsx`

## Task 3: Analyzer Page + Navigation

**Files:**
- Create: `packages/ui/src/pages/AnalyzerPage.tsx`
- Create: `packages/ui/src/pages/ClassifierPage.tsx`
- Modify: `packages/ui/src/App.tsx` (add simple hash router)

## Task 4: Slice Detail Panel

**Files:**
- Create: `packages/ui/src/components/SliceDetail.tsx`

## Task 5: Wire Up + Integration Test

**Files:**
- Modify: `packages/ui/src/App.tsx`
- Test: `packages/ui/src/pages/__tests__/AnalyzerPage.test.tsx`
