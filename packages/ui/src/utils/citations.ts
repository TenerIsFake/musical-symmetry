import type { SymmetryAnalysis, PitchClass } from '@musical-symmetry/core';
import { forteNumber } from '../data/forte-numbers';

export type CitationStyle = 'apa' | 'chicago' | 'mla' | 'bibtex';

/**
 * Format a Date as "Month DD, YYYY" (e.g. "May 7, 2026")
 */
function formatDateLong(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format a Date as "YYYY, Month DD" for Chicago footnote style.
 */
function formatDateChicago(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

function buildDescription(analysis: SymmetryAnalysis, pcs: PitchClass[]): string {
  const forte = forteNumber(pcs);
  const primeForm = `(${pcs.join(',')})`;
  const group = analysis.abstractGroup;
  const parts: string[] = [];
  if (forte) parts.push(`Forte number ${forte}`);
  parts.push(`prime form ${primeForm}`);
  parts.push(`symmetry group ${group}`);
  return parts.join(', ');
}

export function formatAPA(
  analysis: SymmetryAnalysis,
  pcs: PitchClass[],
  date: Date,
  url: string,
): string {
  const year = date.getFullYear();
  const retrieved = formatDateLong(date);
  const desc = buildDescription(analysis, pcs);
  return [
    `Tendrid. (${year}). Chrometria: Pitch-class set analysis — ${desc}.`,
    `  Chrometria (Symmetry Analyzer). Retrieved ${retrieved}, from ${url}`,
  ].join('\n');
}

export function formatChicago(
  analysis: SymmetryAnalysis,
  pcs: PitchClass[],
  date: Date,
  url: string,
): string {
  const accessed = formatDateChicago(date);
  const desc = buildDescription(analysis, pcs);
  return [
    `Tendrid. "Chrometria: Pitch-Class Set Analysis — ${desc}."`,
    `  Chrometria (Symmetry Analyzer). Accessed ${accessed}. ${url}.`,
  ].join('\n');
}

export function formatMLA(
  analysis: SymmetryAnalysis,
  pcs: PitchClass[],
  date: Date,
  url: string,
): string {
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' }).replace('.', '');
  const year = date.getFullYear();
  const accessed = `${day} ${month}. ${year}`;
  const desc = buildDescription(analysis, pcs);
  return [
    `Tendrid. "Chrometria: Pitch-Class Set Analysis — ${desc}."`,
    `  Chrometria, ${url}. Accessed ${accessed}.`,
  ].join('\n');
}

export function formatBibTeX(
  analysis: SymmetryAnalysis,
  pcs: PitchClass[],
  date: Date,
  url: string,
): string {
  const forte = forteNumber(pcs);
  const primeForm = `(${pcs.join(',')})`;
  const group = analysis.abstractGroup;
  const year = date.getFullYear();
  const month = date.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
  const key = `chrometria-${pcs.join('')}`;
  const noteParts: string[] = [];
  if (forte) noteParts.push(`Forte number: ${forte}`);
  noteParts.push(`Prime form: ${primeForm}`);
  noteParts.push(`Symmetry group: ${group}`);
  const note = noteParts.join('; ');
  return [
    `@misc{${key},`,
    `  author       = {Tendrid},`,
    `  title        = {{Chrometria}: Pitch-Class Set Analysis},`,
    `  year         = {${year}},`,
    `  month        = {${month}},`,
    `  howpublished = {\\url{${url}}},`,
    `  note         = {${note}},`,
    `}`,
  ].join('\n');
}

export function generateCitation(
  style: CitationStyle,
  analysis: SymmetryAnalysis,
  pcs: PitchClass[],
  date: Date,
  url: string,
): string {
  switch (style) {
    case 'apa':     return formatAPA(analysis, pcs, date, url);
    case 'chicago': return formatChicago(analysis, pcs, date, url);
    case 'mla':     return formatMLA(analysis, pcs, date, url);
    case 'bibtex':  return formatBibTeX(analysis, pcs, date, url);
  }
}
